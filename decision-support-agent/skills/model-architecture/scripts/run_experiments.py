#!/usr/bin/env python3
"""Layered model experiments for a decision-support system.

Layer 1  baseline      logistic / linear regression
Layer 2  ML            gradient boosting (LightGBM if installed, else sklearn HistGB), limited tuning
Layer 3  DL            only when justified: pretrained text embeddings (+ head) and/or tabular MLP
                       on very large data; otherwise skipped with a written reason
Layer 4  hybrid        DL text embeddings as features inside the GBM

Protocol
- time-based split when --date-col is given (60/20/20), else stratified random split
- model selection and decision threshold use VALIDATION only; TEST is scored once at the end
- threshold minimises expected cost (cost_fp * FP + cost_fn * FN), not 0.5
- the simplest model wins unless a more complex one beats it by --min-gain on the business metric
- --group-cols are used ONLY for bias reporting, never as model input
- every run is appended to an experiments CSV (and MLflow if installed)

Requires: pandas, numpy, scikit-learn. Optional: lightgbm, shap, sentence-transformers, mlflow, joblib.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import time
import warnings
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingClassifier, HistGradientBoostingRegressor
from sklearn.impute import SimpleImputer
from sklearn.inspection import permutation_importance
from sklearn.linear_model import LinearRegression, LogisticRegression, Ridge
from sklearn.metrics import (average_precision_score, brier_score_loss, mean_absolute_error,
                             mean_squared_error, roc_auc_score)
from sklearn.model_selection import train_test_split
from sklearn.neural_network import MLPClassifier, MLPRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, OrdinalEncoder, StandardScaler

warnings.filterwarnings("ignore")

try:
    import lightgbm as lgb  # noqa: F401
    HAS_LGB = True
except Exception:
    HAS_LGB = False

COMPLEXITY = {"baseline": 0, "gbm": 1, "dl": 2, "hybrid": 3}
EXPLAIN = {"baseline": "גבוהה (מקדמים)", "gbm": "בינונית-גבוהה (SHAP)", "dl": "נמוכה", "hybrid": "בינונית (SHAP + embeddings)"}


# ------------------------------------------------------------------ data
def load(path: Path) -> pd.DataFrame:
    s = path.suffix.lower()
    if s == ".parquet":
        return pd.read_parquet(path)
    if s in (".xlsx", ".xls"):
        return pd.read_excel(path)
    return pd.read_csv(path, low_memory=False)


def split(df: pd.DataFrame, y: pd.Series, date_col: str | None, task: str, seed: int):
    if date_col:
        order = pd.to_datetime(df[date_col], errors="coerce").sort_values(kind="mergesort").index
        n = len(order)
        tr, va, te = order[: int(n * 0.6)], order[int(n * 0.6): int(n * 0.8)], order[int(n * 0.8):]
        d = pd.to_datetime(df[date_col], errors="coerce")
        info = (f"פיצול לפי זמן: אימון עד {d[tr].max().date()}, "
                f"validation {d[va].min().date()}–{d[va].max().date()}, test מ-{d[te].min().date()}")
        return tr, va, te, info
    strat = y if task == "classification" else None
    tr, rest = train_test_split(df.index, test_size=0.4, random_state=seed, stratify=strat)
    strat_rest = y.loc[rest] if task == "classification" else None
    va, te = train_test_split(rest, test_size=0.5, random_state=seed, stratify=strat_rest)
    return tr, va, te, "פיצול אקראי מרובד 60/20/20 (אין עמודת תאריך)"


def tabular_columns(X: pd.DataFrame):
    num = X.select_dtypes(include=["number", "bool"]).columns.tolist()
    cat = [c for c in X.columns if c not in num]
    return num, cat


def linear_pre(num, cat):
    return ColumnTransformer([
        ("num", Pipeline([("imp", SimpleImputer(strategy="median", add_indicator=True)), ("sc", StandardScaler())]), num),
        ("cat", Pipeline([("imp", SimpleImputer(strategy="constant", fill_value="__missing__")),
                          ("oh", OneHotEncoder(handle_unknown="ignore", min_frequency=20, sparse_output=False))]), cat),
    ], remainder="drop", verbose_feature_names_out=False)


def tree_pre(num, cat):
    return ColumnTransformer([
        ("num", "passthrough", num),
        ("cat", Pipeline([("imp", SimpleImputer(strategy="constant", fill_value="__missing__")),
                          ("ord", OrdinalEncoder(handle_unknown="use_encoded_value", unknown_value=-1))]), cat),
    ], remainder="drop", verbose_feature_names_out=False)


# ------------------------------------------------------------------ text (DL)
def text_embedder(texts_fit: pd.Series, dims: int, seed: int):
    """Return (transform_fn, description). Pretrained multilingual encoder if available."""
    try:
        from sentence_transformers import SentenceTransformer
        model_name = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
        m = SentenceTransformer(model_name)

        def f(s: pd.Series) -> np.ndarray:
            return m.encode(s.fillna("").astype(str).tolist(), batch_size=64, show_progress_bar=False)
        return f, f"embeddings ממודל מאומן מראש ({model_name})", True
    except Exception:
        from sklearn.decomposition import TruncatedSVD
        from sklearn.feature_extraction.text import TfidfVectorizer
        vec = TfidfVectorizer(max_features=20000, ngram_range=(1, 2), min_df=3)
        Xt = vec.fit_transform(texts_fit.fillna("").astype(str))
        k = max(2, min(dims, Xt.shape[1] - 1))
        svd = TruncatedSVD(n_components=k, random_state=seed).fit(Xt)

        def f(s: pd.Series) -> np.ndarray:
            return svd.transform(vec.transform(s.fillna("").astype(str)))
        return f, "TF-IDF + SVD (חלופה קלה – sentence-transformers לא מותקן)", False


# ------------------------------------------------------------------ metrics
def expected_cost(y, pred, cfp, cfn):
    fp = int(((pred == 1) & (y == 0)).sum())
    fn = int(((pred == 0) & (y == 1)).sum())
    return fp * cfp + fn * cfn, fp, fn


def best_threshold(y, p, cfp, cfn):
    grid = np.unique(np.quantile(p, np.linspace(0, 1, 201)))
    costs = [expected_cost(y, (p >= t).astype(int), cfp, cfn)[0] for t in grid]
    i = int(np.argmin(costs))
    return float(grid[i]), float(costs[i])


def ece(y, p, bins=10):
    edges = np.linspace(0, 1, bins + 1)
    idx = np.clip(np.digitize(p, edges) - 1, 0, bins - 1)
    total = 0.0
    for b in range(bins):
        m = idx == b
        if m.any():
            total += m.mean() * abs(p[m].mean() - y[m].mean())
    return float(total)


def class_metrics(y, p, thr, cfp, cfn):
    pred = (p >= thr).astype(int)
    cost, fp, fn = expected_cost(y, pred, cfp, cfn)
    return {
        "business_cost": cost, "cost_per_case": cost / len(y), "fp": fp, "fn": fn,
        "flag_rate": float(pred.mean()),
        "roc_auc": float(roc_auc_score(y, p)) if len(np.unique(y)) > 1 else float("nan"),
        "pr_auc": float(average_precision_score(y, p)) if len(np.unique(y)) > 1 else float("nan"),
        "brier": float(brier_score_loss(y, p)), "ece": ece(y, p),
    }


def reg_metrics(y, p, unit_cost):
    mae = float(mean_absolute_error(y, p))
    return {"business_cost": mae * unit_cost * len(y), "cost_per_case": mae * unit_cost,
            "mae": mae, "rmse": float(np.sqrt(mean_squared_error(y, p)))}


# ------------------------------------------------------------------ models
class Candidate:
    def __init__(self, name, layer, fit_predict, note=""):
        self.name, self.layer, self.fit_predict, self.note = name, layer, fit_predict, note
        self.model = None


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("data", type=Path)
    ap.add_argument("--target", required=True)
    ap.add_argument("--task", choices=["auto", "classification", "regression"], default="auto")
    ap.add_argument("--date-col")
    ap.add_argument("--id-col")
    ap.add_argument("--drop", nargs="*", default=[], help="leakage / excluded columns")
    ap.add_argument("--group-cols", nargs="*", default=[], help="bias-check only, never model input")
    ap.add_argument("--text-cols", nargs="*", default=[])
    ap.add_argument("--cost-fp", type=float, default=1.0, help="cost of a false positive")
    ap.add_argument("--cost-fn", type=float, default=1.0, help="cost of a false negative")
    ap.add_argument("--unit-cost", type=float, default=1.0, help="regression: cost per unit of absolute error")
    ap.add_argument("--min-gain", type=float, default=0.02, help="relative business gain a more complex model needs")
    ap.add_argument("--dl-min-rows", type=int, default=1_000_000)
    ap.add_argument("--force-dl", action="store_true", help="run tabular MLP regardless of size (documented as exception)")
    ap.add_argument("--text-dims", type=int, default=64)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--out", type=Path, default=Path("work/05_model_comparison.md"))
    ap.add_argument("--models-dir", type=Path, default=Path("models"))
    ap.add_argument("--log", type=Path, default=Path("experiments.csv"))
    a = ap.parse_args()
    np.random.seed(a.seed)

    raw = load(a.data)
    data_hash = hashlib.sha256(pd.util.hash_pandas_object(raw, index=True).values.tobytes()).hexdigest()[:12]
    df = raw[raw[a.target].notna()].copy()
    y_raw = df[a.target]

    task = a.task
    if task == "auto":
        task = "classification" if y_raw.nunique() == 2 else "regression"
    if task == "classification":
        vals = sorted(y_raw.unique(), key=str)
        pos = 1 if set(map(str, vals)) <= {"0", "1", "0.0", "1.0"} else y_raw.value_counts().idxmin()
        y = (y_raw.astype(str) == str(pos)).astype(int) if pos != 1 else y_raw.astype(float).astype(int)
    else:
        y = y_raw.astype(float)

    excluded = {a.target, a.id_col, a.date_col, *a.drop, *a.group_cols, *a.text_cols} - {None}
    feat_cols = [c for c in df.columns if c not in excluded]
    # parse datetime-like object columns away (raw dates are not features)
    for c in list(feat_cols):
        if pd.api.types.is_datetime64_any_dtype(df[c]):
            feat_cols.remove(c)
    X = df[feat_cols]
    num, cat = tabular_columns(X)

    tr, va, te, split_info = split(df, y, a.date_col, task, a.seed)
    Xtr, Xva, Xte = X.loc[tr], X.loc[va], X.loc[te]
    ytr, yva, yte = y.loc[tr].to_numpy(), y.loc[va].to_numpy(), y.loc[te].to_numpy()
    clf = task == "classification"

    # ---------------- text features (computed once, fit on train only)
    text_note, txt = None, None
    if a.text_cols:
        joined = df[a.text_cols].fillna("").astype(str).agg(" ".join, axis=1)
        emb_fn, text_note, _pretrained = text_embedder(joined.loc[tr], a.text_dims, a.seed)
        txt = {k: emb_fn(joined.loc[idx]) for k, idx in (("tr", tr), ("va", va), ("te", te))}

    # ---------------- candidate builders: each returns (model, p_val, p_test, train_seconds, ms_per_row)
    def run_sklearn(est, pre, Xs=(Xtr, Xva, Xte)):
        pipe = Pipeline([("pre", pre), ("m", est)])
        t0 = time.time()
        pipe.fit(Xs[0], ytr)
        secs = time.time() - t0
        pr = (lambda Z: pipe.predict_proba(Z)[:, 1]) if clf else pipe.predict
        t1 = time.time()
        pte = pr(Xs[2])
        ms = (time.time() - t1) * 1000 / max(len(Xs[2]), 1)
        return pipe, pr(Xs[1]), pte, secs, ms

    def baseline():
        est = LogisticRegression(max_iter=2000, class_weight="balanced", C=1.0) if clf else Ridge(alpha=1.0)
        return run_sklearn(est, linear_pre(num, cat))

    def gbm_estimator(params):
        if HAS_LGB:
            import lightgbm as lgb
            cls = lgb.LGBMClassifier if clf else lgb.LGBMRegressor
            return cls(n_estimators=params["n"], learning_rate=params["lr"], num_leaves=params["leaves"],
                       min_child_samples=params["mcs"], subsample=0.8, subsample_freq=1, colsample_bytree=0.8,
                       random_state=a.seed, verbose=-1)
        cls = HistGradientBoostingClassifier if clf else HistGradientBoostingRegressor
        return cls(max_iter=params["n"], learning_rate=params["lr"], max_leaf_nodes=params["leaves"],
                   min_samples_leaf=params["mcs"], random_state=a.seed)

    grid = [dict(n=n, lr=lr, leaves=lv, mcs=m) for n, lr in ((300, 0.05), (600, 0.03))
            for lv in (15, 31) for m in (20, 100)]

    def score_val(p):
        if clf:
            return best_threshold(yva, p, a.cost_fp, a.cost_fn)[1]
        return reg_metrics(yva, p, a.unit_cost)["business_cost"]

    tuned = {}

    def tune(builder_X):
        best = None
        for params in grid:  # limited tuning on validation
            res = run_sklearn(gbm_estimator(params), tree_pre(num, cat) if builder_X is None else "passthrough",
                              (Xtr, Xva, Xte) if builder_X is None else builder_X)
            s = score_val(res[1])
            if best is None or s < best[0]:
                best = (s, params, res)
        return best

    def gbm():
        best = tune(None)
        tuned["gbm"] = best[1]
        return best[2]

    def hybrid_matrices():
        pre = tree_pre(num, cat).fit(Xtr)
        return tuple(np.hstack([pre.transform(Z), txt[k]]) for Z, k in ((Xtr, "tr"), (Xva, "va"), (Xte, "te")))

    def hybrid():
        best = tune(hybrid_matrices())
        tuned["hybrid"] = best[1]
        return best[2]

    def dl_text():
        mlp = (MLPClassifier if clf else MLPRegressor)(hidden_layer_sizes=(64,), early_stopping=True,
                                                         max_iter=300, random_state=a.seed)
        pipe = Pipeline([("sc", StandardScaler()), ("m", mlp)])
        t0 = time.time()
        pipe.fit(txt["tr"], ytr)
        secs = time.time() - t0
        pr = (lambda Z: pipe.predict_proba(Z)[:, 1]) if clf else pipe.predict
        t1 = time.time()
        pte = pr(txt["te"])
        return pipe, pr(txt["va"]), pte, secs, (time.time() - t1) * 1000 / len(te)

    def dl_tabular():
        mlp = (MLPClassifier if clf else MLPRegressor)(hidden_layer_sizes=(128, 64), early_stopping=True,
                                                         max_iter=200, random_state=a.seed)
        return run_sklearn(mlp, linear_pre(num, cat))

    candidates = [Candidate("baseline – " + ("רגרסיה לוגיסטית" if clf else "רגרסיה לינארית (Ridge)"), "baseline", baseline),
                  Candidate("GBM – " + ("LightGBM" if HAS_LGB else "HistGradientBoosting"), "gbm", gbm)]
    skipped = []
    if txt is not None:
        candidates.append(Candidate("DL – טקסט (" + text_note + ") + ראש MLP", "dl", dl_text))
        candidates.append(Candidate("שילוב – GBM על משתנים + embeddings מהטקסט", "hybrid", hybrid))
    else:
        skipped.append("שילוב (hybrid): אין עמודות טקסט/לא-מובנות – אין יציאות DL להזין ל-GBM.")
    if len(df) >= a.dl_min_rows or a.force_dl:
        note = "" if len(df) >= a.dl_min_rows else "הורץ כחריג (--force-dl) מתחת לסף הנפח"
        candidates.append(Candidate("DL – MLP טבלאי", "dl", dl_tabular, note))
    else:
        skipped.append(f"DL טבלאי (MLP/TabNet): {len(df):,} שורות < סף {a.dl_min_rows:,}. בנתונים טבלאיים בנפח הזה "
                       "GBM כמעט תמיד שווה או עדיף, זול יותר ומוסבר יותר (מטריצת הארכיטקטורה, כלל ברזל 2).")

    # ---------------- run
    results = []
    for c in candidates:
        model, pva, pte, secs, ms = c.fit_predict()
        c.model = model
        if clf:
            thr, _ = best_threshold(yva, pva, a.cost_fp, a.cost_fn)
            mv, mt = class_metrics(yva, pva, thr, a.cost_fp, a.cost_fn), class_metrics(yte, pte, thr, a.cost_fp, a.cost_fn)
        else:
            thr = None
            mv, mt = reg_metrics(yva, pva, a.unit_cost), reg_metrics(yte, pte, a.unit_cost)
        results.append(dict(cand=c, thr=thr, val=mv, test=mt, secs=secs, ms=ms, pte=pte))

    # current-state references on TEST (classification): act on nobody / everybody
    refs = {}
    if clf:
        refs["לא לפעול על אף מקרה"] = expected_cost(yte, np.zeros_like(yte), a.cost_fp, a.cost_fn)[0]
        refs["לפעול על כל המקרים"] = expected_cost(yte, np.ones_like(yte), a.cost_fp, a.cost_fn)[0]
    else:
        refs["חיזוי הממוצע מהאימון"] = reg_metrics(yte, np.full_like(yte, ytr.mean()), a.unit_cost)["business_cost"]

    # ---------------- selection on VALIDATION: simplest unless beaten by min_gain
    ordered = sorted(results, key=lambda r: COMPLEXITY[r["cand"].layer])
    chosen = ordered[0]
    reasons = [f"נקודת פתיחה: {chosen['cand'].name}"]
    for r in ordered[1:]:
        gain = (chosen["val"]["business_cost"] - r["val"]["business_cost"]) / max(chosen["val"]["business_cost"], 1e-9)
        if gain >= a.min_gain:
            reasons.append(f"{r['cand'].name} חוסך {gain:.1%} מול {chosen['cand'].name} ב-validation (≥ {a.min_gain:.0%}) – נבחר")
            chosen = r
        else:
            reasons.append(f"{r['cand'].name}: שיפור {gain:.1%} < {a.min_gain:.0%} – לא מצדיק את המורכבות")

    # ---------------- explanations for chosen model
    expl_lines, cm = [], chosen["cand"]
    try:
        if cm.layer in ("baseline", "gbm", "dl") and isinstance(cm.model, Pipeline) and "pre" in cm.model.named_steps:
            sample = Xte.sample(min(len(Xte), 2000), random_state=a.seed)
            ys = y.loc[sample.index].to_numpy()
            try:
                import shap
                pre = cm.model.named_steps["pre"]
                Z = pre.transform(sample)
                names = list(pre.get_feature_names_out())
                expl = shap.Explainer(cm.model.named_steps["m"], Z, feature_names=names)
                sv = expl(Z, check_additivity=False) if cm.layer == "gbm" else expl(Z)
                vals = np.abs(sv.values)
                if vals.ndim == 3:
                    vals = vals[:, :, -1]
                imp = pd.Series(vals.mean(0), index=names).sort_values(ascending=False)
                method = "SHAP (ממוצע ערך מוחלט)"
            except Exception:
                scoring = "roc_auc" if clf else "neg_mean_absolute_error"
                pi = permutation_importance(cm.model, sample, ys, scoring=scoring, n_repeats=5, random_state=a.seed)
                imp = pd.Series(pi.importances_mean, index=sample.columns).sort_values(ascending=False)
                method = "permutation importance (SHAP לא מותקן)"
            expl_lines = [f"שיטה: {method}", "", "| משתנה | חשיבות |", "|---|---|"]
            expl_lines += [f"| `{k}` | {v:.4f} |" for k, v in imp.head(15).items()]
        else:
            expl_lines = ["למודל המשולב: SHAP על ה-GBM מחזיר תרומה לכל משתנה טבלאי ולכל ממד embedding; "
                          "בכרטיס המקרה מציגים את הממדים הטבלאיים + 'תרומת הטקסט' כסכום ממדי ה-embedding."]
    except Exception as e:  # never fail the run on explanations
        expl_lines = [f"חישוב הסברים נכשל: {e}"]

    # ---------------- bias report (test set, chosen model)
    bias_lines = []
    if a.group_cols:
        te_df = df.loc[te]
        pte = chosen["pte"]
        hdr = ("| קבוצה | ערך | n | שיעור מטרה | שיעור סימון | TPR | FPR |" if clf else "| קבוצה | ערך | n | ממוצע אמת | MAE |")
        bias_lines = [hdr, "|" + "|".join(["---"] * (hdr.count("|") - 1)) + "|"]
        flags = []
        for g in a.group_cols:
            if g not in te_df.columns:
                continue
            for lvl, idx in te_df.groupby(te_df[g].astype(str)).groups.items():
                pos = te_df.index.get_indexer(idx)
                yt, pp = yte[pos], pte[pos]
                if clf:
                    pred = (pp >= chosen["thr"]).astype(int)
                    tpr = pred[yt == 1].mean() if (yt == 1).any() else float("nan")
                    fpr = pred[yt == 0].mean() if (yt == 0).any() else float("nan")
                    bias_lines.append(f"| `{g}` | {lvl} | {len(pos):,} | {yt.mean():.2%} | {pred.mean():.2%} | {tpr:.2%} | {fpr:.2%} |")
                else:
                    bias_lines.append(f"| `{g}` | {lvl} | {len(pos):,} | {yt.mean():.2f} | {mean_absolute_error(yt, pp):.2f} |")
            if clf:
                rates = te_df.assign(_p=(pte >= chosen["thr"]).astype(int)).groupby(te_df[g].astype(str))["_p"].mean()
                if len(rates) > 1 and rates.max() > 0:
                    ratio = rates.min() / rates.max()
                    if ratio < 0.8:
                        flags.append(f"`{g}`: יחס שיעורי סימון {ratio:.2f} < 0.8 (כלל ארבע-חמישיות) – נדרשת בדיקה")
        bias_lines += [""] + ([f"- ⚠️ {f}" for f in flags] or ["- לא נמצאו פערים מעל סף ארבע-חמישיות."])
    else:
        bias_lines = ["⚠️ לא הוגדרו קבוצות (--group-cols). בדיקת הטיה חובה לפני מסירה."]

    # ---------------- persist models + experiment log
    run_id = datetime.now().strftime("%Y%m%d-%H%M%S")
    a.models_dir.mkdir(parents=True, exist_ok=True)
    try:
        import joblib
        for r in results:
            joblib.dump({"model": r["cand"].model, "threshold": r["thr"], "features": feat_cols,
                         "text_cols": a.text_cols, "task": task},
                        a.models_dir / f"{run_id}_{r['cand'].layer}.joblib")
    except Exception:
        pass
    a.log.parent.mkdir(parents=True, exist_ok=True)
    new = not a.log.exists()
    with a.log.open("a", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        if new:
            w.writerow(["run_id", "timestamp", "data", "data_hash", "rows", "split", "model", "layer", "params",
                        "threshold", "val_business_cost", "test_business_cost", "test_metrics", "train_sec", "ms_per_row",
                        "chosen", "seed"])
        for r in results:
            w.writerow([run_id, datetime.now().isoformat(timespec="seconds"), str(a.data), data_hash, len(df), split_info,
                        r["cand"].name, r["cand"].layer, json.dumps(tuned.get(r["cand"].layer, {})),
                        r["thr"], r["val"]["business_cost"], r["test"]["business_cost"],
                        json.dumps({k: round(v, 5) if isinstance(v, float) else v for k, v in r["test"].items()}),
                        round(r["secs"], 2), round(r["ms"], 4), r is chosen, a.seed])
    try:
        import mlflow
        for r in results:
            with mlflow.start_run(run_name=f"{run_id}-{r['cand'].layer}"):
                mlflow.log_params({"model": r["cand"].name, "data_hash": data_hash, "seed": a.seed,
                                   **tuned.get(r["cand"].layer, {})})
                mlflow.log_metrics({f"test_{k}": float(v) for k, v in r["test"].items() if isinstance(v, (int, float))})
    except Exception:
        pass

    # ---------------- report
    L = ["# השוואת מודלים", "",
         "<!-- כתוב כאן המלצה עסקית ב-3–5 שורות: איזה מודל, כמה הוא חוסך מול המצב הקיים, מה הסיכונים. -->", "",
         f"**ריצה:** `{run_id}` · **נתונים:** `{a.data}` (hash `{data_hash}`) · **שורות:** {len(df):,} · **משימה:** {task}",
         f"**פיצול:** {split_info} · אימון {len(tr):,} / validation {len(va):,} / test {len(te):,}",
         f"**עמודות שהוצאו:** {', '.join(f'`{c}`' for c in sorted(excluded)) or '—'}",
         ]
    if clf:
        L.append(f"**מחיר הטעות:** חיובי שגוי = {a.cost_fp:,.0f}, שלילי שגוי = {a.cost_fn:,.0f} · סף ההחלטה נקבע על validation למזעור עלות")
    L += ["", f"## המודל הנבחר: {chosen['cand'].name}", ""] + [f"- {x}" for x in reasons]
    L += ["", "## טבלת השוואה (סט הבדיקה – נמדד פעם אחת)", ""]
    if clf:
        L += ["| מודל | עלות עסקית | עלות למקרה | סף | שיעור סימון | ROC-AUC | PR-AUC | Brier | ECE | ms/רשומה | שניות אימון | הסבריות |",
              "|---|---|---|---|---|---|---|---|---|---|---|---|"]
        for r in results:
            t = r["test"]
            mark = " ⭐" if r is chosen else ""
            L.append(f"| {r['cand'].name}{mark} | {t['business_cost']:,.0f} | {t['cost_per_case']:,.2f} | {r['thr']:.3f} | "
                     f"{t['flag_rate']:.1%} | {t['roc_auc']:.3f} | {t['pr_auc']:.3f} | {t['brier']:.4f} | {t['ece']:.3f} | "
                     f"{r['ms']:.3f} | {r['secs']:.1f} | {EXPLAIN[r['cand'].layer]} |")
    else:
        L += ["| מודל | עלות עסקית | עלות למקרה | MAE | RMSE | ms/רשומה | שניות אימון | הסבריות |", "|---|---|---|---|---|---|---|---|"]
        for r in results:
            t = r["test"]
            mark = " ⭐" if r is chosen else ""
            L.append(f"| {r['cand'].name}{mark} | {t['business_cost']:,.0f} | {t['cost_per_case']:,.2f} | {t['mae']:.3f} | "
                     f"{t['rmse']:.3f} | {r['ms']:.3f} | {r['secs']:.1f} | {EXPLAIN[r['cand'].layer]} |")
    L += ["", "**נקודות ייחוס (מצב קיים פשוט, על סט הבדיקה):**"] + [f"- {k}: {v:,.0f}" for k, v in refs.items()]
    L += ["", "## שכבות שלא הורצו"] + ([f"- {s}" for s in skipped] or ["- כל השכבות הרלוונטיות הורצו."])
    for r in results:
        if r["cand"].note:
            L.append(f"- הערה ל-{r['cand'].name}: {r['cand'].note}")
    L += ["", "## הסברים – המודל הנבחר", ""] + expl_lines
    L += ["", "## בדיקת הטיה – המודל הנבחר (סט הבדיקה)", ""] + bias_lines
    L += ["", "## נספח: validation", "| מודל | עלות עסקית (validation) |", "|---|---|"]
    L += [f"| {r['cand'].name} | {r['val']['business_cost']:,.0f} |" for r in results]
    if tuned:
        L += ["", "**פרמטרים שנבחרו בכיוונון:** " + json.dumps(tuned, ensure_ascii=False)]
    L += ["", f"מודלים נשמרו ב-`{a.models_dir}/{run_id}_*.joblib` · ניסויים נרשמו ב-`{a.log}`", "",
          "✅ אושר: <תאריך> – <מי אישר>", ""]
    a.out.parent.mkdir(parents=True, exist_ok=True)
    a.out.write_text("\n".join(L), encoding="utf-8")
    print(f"chosen: {chosen['cand'].name} | report: {a.out}")
    for r in results:
        print(f"  {r['cand'].name}: test cost {r['test']['business_cost']:,.0f}")


if __name__ == "__main__":
    main()
