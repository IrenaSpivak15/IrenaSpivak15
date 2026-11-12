#!/usr/bin/env python3
"""Data readiness profile for a decision-support model.

Runs the standard checks of the data-validation skill and writes a Markdown
report with pass / warn / fail per check and an overall readiness score
(green / yellow / red). Read-only: never modifies the input file.

Requires: pandas, numpy (pyarrow for parquet input).

Example:
    python profile_data.py data/interim/dataset.parquet --target defaulted \
        --date-col decision_date --id-col customer_id --group-cols gender region \
        --text-cols call_notes --out work/04_data_report.md
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
import pandas as pd

PASS, WARN, FAIL = "✅ עבר", "⚠️ אזהרה", "❌ נכשל"
SENTINELS = [-1, -9, -99, -999, -9999, 98, 99, 999, 9999, 99999]
MISSING_WARN, MISSING_FAIL = 0.20, 0.60
MINORITY_WARN = 0.05
LEAK_AUC_WARN, LEAK_AUC_FAIL = 0.85, 0.95
PSI_WARN, PSI_FAIL = 0.10, 0.25
MIN_GROUP_SHARE, MIN_GROUP_N = 0.05, 30


@dataclass
class Check:
    name: str
    status: str
    finding: str
    suggestion: str = ""
    details: list[str] = field(default_factory=list)


def load(path: Path) -> pd.DataFrame:
    suffix = path.suffix.lower()
    if suffix == ".parquet":
        return pd.read_parquet(path)
    if suffix in (".csv", ".txt"):
        return pd.read_csv(path, low_memory=False)
    if suffix in (".xlsx", ".xls"):
        return pd.read_excel(path)
    sys.exit(f"Unsupported file type: {suffix}")


def worst(statuses: list[str]) -> str:
    if FAIL in statuses:
        return FAIL
    if WARN in statuses:
        return WARN
    return PASS


def auc_score(y: np.ndarray, s: np.ndarray) -> float:
    """Rank-based ROC AUC (no sklearn dependency). Returns nan if undefined."""
    mask = ~(pd.isna(y) | pd.isna(s))
    y, s = np.asarray(y)[mask], np.asarray(s, dtype=float)[mask]
    n_pos = int((y == 1).sum())
    n_neg = int((y == 0).sum())
    if n_pos == 0 or n_neg == 0:
        return float("nan")
    ranks = pd.Series(s).rank(method="average").to_numpy()
    return float((ranks[y == 1].sum() - n_pos * (n_pos + 1) / 2) / (n_pos * n_neg))


def psi(expected: pd.Series, actual: pd.Series, bins: int = 10) -> float:
    expected, actual = expected.dropna(), actual.dropna()
    if expected.empty or actual.empty:
        return float("nan")
    if pd.api.types.is_numeric_dtype(expected) and expected.nunique() > bins:
        edges = np.unique(np.quantile(expected, np.linspace(0, 1, bins + 1)))
        if len(edges) < 3:
            return 0.0
        edges[0], edges[-1] = -np.inf, np.inf
        e = pd.cut(expected, edges).value_counts(normalize=True, sort=False)
        a = pd.cut(actual, edges).value_counts(normalize=True, sort=False)
    else:
        e = expected.astype(str).value_counts(normalize=True)
        a = actual.astype(str).value_counts(normalize=True)
        e, a = e.align(a, fill_value=0)
    e, a = e.to_numpy() + 1e-6, a.to_numpy() + 1e-6
    return float(np.sum((a - e) * np.log(a / e)))


def encode_target(y: pd.Series) -> pd.Series | None:
    """Return a 0/1 target if binary, else None."""
    vals = y.dropna().unique()
    if len(vals) != 2:
        return None
    if set(map(str, vals)) <= {"0", "1", "0.0", "1.0", "True", "False"}:
        return y.map(lambda v: np.nan if pd.isna(v) else int(float(v) == 1 or str(v) == "True"))
    minority = y.value_counts().idxmin()
    return (y == minority).astype(float).where(y.notna())


# ----------------------------------------------------------------- checks
def check_missing(df: pd.DataFrame) -> Check:
    rates = df.isna().mean().sort_values(ascending=False)
    bad = rates[rates > MISSING_WARN]
    very_bad = rates[rates > MISSING_FAIL]
    status = FAIL if len(very_bad) else WARN if len(bad) else PASS
    details = [f"`{c}`: {r:.1%} חסרים" for c, r in bad.items()]
    return Check(
        "שלמות", status,
        f"{len(bad)} עמודות עם יותר מ-{MISSING_WARN:.0%} חסרים" if len(bad) else "אין עמודות עם חסרים משמעותיים",
        "בדקו אם החוסר אקראי או נושא משמעות (למשל 'אין הכנסה מדווחת'). הוסיפו דגל חוסר לפני השלמה; עמודה מעל 60% חסרים – שקלו להוציא.",
        details,
    )


def check_duplicates(df: pd.DataFrame, id_col: str | None, date_col: str | None) -> Check:
    full_dupes = int(df.duplicated().sum())
    details = [f"שורות כפולות לחלוטין: {full_dupes:,}"]
    status = WARN if full_dupes else PASS
    if id_col and id_col in df.columns:
        key = [id_col] + ([date_col] if date_col and date_col in df.columns else [])
        key_dupes = int(df.duplicated(subset=key).sum())
        details.append(f"מפתח {key} לא ייחודי ב-{key_dupes:,} שורות")
        if key_dupes:
            status = FAIL if key_dupes / len(df) > 0.01 else WARN
        if id_col and df[id_col].isna().any():
            details.append(f"מזהים חסרים: {int(df[id_col].isna().sum()):,}")
            status = worst([status, WARN])
    return Check(
        "כפילויות ומזהים", status,
        "נמצאו כפילויות" if status != PASS else "אין כפילויות",
        "הסירו כפילויות מלאות. מזהה שחוזר באותו תאריך – בדקו את ה-join בקליטה. אותו לקוח בתאריכים שונים – פצלו לפי מזהה כדי שלא יופיע גם באימון וגם בבדיקה.",
        details,
    )


def check_impossible(df: pd.DataFrame, skip: set[str]) -> Check:
    details = []
    for c in df.select_dtypes(include="number").columns:
        if c in skip:
            continue
        s = df[c].dropna()
        if s.empty:
            continue
        for v in SENTINELS:
            share = float((s == v).mean())
            if share > 0.001 and (s == v).sum() >= 5:
                # sentinel only if it sits outside the bulk of the distribution
                rest = s[s != v]
                if rest.empty or v > rest.quantile(0.99) or v < rest.quantile(0.01):
                    details.append(f"`{c}`: הערך {v} מופיע ב-{share:.2%} מהשורות – חשד לקוד מיוחד")
        lowered = c.lower()
        if any(k in lowered for k in ("age", "גיל")):
            n_bad = int(((s < 0) | (s > 120)).sum())
            if n_bad:
                details.append(f"`{c}`: {n_bad} ערכי גיל מחוץ לטווח 0–120")
        if any(k in lowered for k in ("amount", "income", "price", "salary", "הכנסה", "סכום", "מחיר")):
            n_neg = int((s < 0).sum())
            if n_neg:
                details.append(f"`{c}`: {n_neg} ערכים שליליים")
        q1, q99 = s.quantile(0.01), s.quantile(0.99)
        spread = q99 - q1
        if spread > 0:
            extreme = int(((s > q99 + 10 * spread) | (s < q1 - 10 * spread)).sum())
            if extreme:
                details.append(f"`{c}`: {extreme} ערכים קיצוניים מאוד (מעבר ל-10 טווחים מאחוזון 1–99)")
    status = WARN if details else PASS
    return Check(
        "ערכים בלתי אפשריים וקודים מיוחדים", status,
        f"{len(details)} ממצאים" if details else "לא נמצאו",
        "אמתו מול בעל המקור מה משמעות הקוד. החליפו קודים מיוחדים ב-NaN + דגל, וחתכו קצוות (winsorize) רק אחרי אישור.",
        details,
    )


def check_target(df: pd.DataFrame, target: str | None) -> tuple[Check, pd.Series | None]:
    if not target:
        return Check("איזון משתנה המטרה", WARN, "לא הוגדר משתנה מטרה (--target)", "הגדירו את המטרה מ-work/02_data_requirements.md."), None
    if target not in df.columns:
        return Check("איזון משתנה המטרה", FAIL, f"עמודת המטרה `{target}` לא קיימת", "בדקו את מיפוי הקליטה."), None
    y = df[target]
    miss = float(y.isna().mean())
    yb = encode_target(y)
    details = [f"חסרים במטרה: {miss:.1%}"]
    if yb is None:
        details.append(f"מטרה לא בינארית: {y.nunique()} ערכים שונים, ממוצע {y.mean() if pd.api.types.is_numeric_dtype(y) else '—'}")
        status = WARN if miss > 0 else PASS
        return Check("איזון משתנה המטרה", status, "מטרה רציפה / רב-מחלקתית", "לרגרסיה: בדקו זנב ארוך ושקלו טרנספורמציה לוגריתמית.", details), None
    rate = float(yb.mean())
    minority = min(rate, 1 - rate)
    details.append(f"שיעור המחלקה החיובית: {rate:.2%} ({int(yb.sum()):,} מקרים)")
    status = FAIL if minority == 0 or yb.sum() < 30 else WARN if minority < MINORITY_WARN or miss > 0 else PASS
    return Check(
        "איזון משתנה המטרה", status,
        f"מחלקה קטנה: {minority:.2%}",
        "מתחת ל-5%: אל תשתמשו בדיוק (accuracy); קבעו סף לפי מחיר הטעות ומדדו PR-AUC. אל תאזנו בדגימה את סט הבדיקה.",
        details,
    ), yb


def check_leakage(df: pd.DataFrame, yb: pd.Series | None, skip: set[str], date_col: str | None,
                  post_cols: list[str]) -> Check:
    details, statuses = [], []
    for c in post_cols:
        if c in df.columns:
            details.append(f"`{c}`: הוגדרה כנרשמת אחרי רגע ההחלטה – חובה להוציא")
            statuses.append(FAIL)
    # date columns later than the decision moment
    if date_col and date_col in df.columns:
        dd = pd.to_datetime(df[date_col], errors="coerce")
        for c in df.columns:
            if c in skip or c == date_col:
                continue
            if pd.api.types.is_datetime64_any_dtype(df[c]) or re.search(r"date|time|_at$|_dt$|תאריך", c, re.I):
                other = pd.to_datetime(df[c], errors="coerce")
                if other.notna().mean() < 0.5:
                    continue
                after = float((other > dd).mean())
                if after > 0.05:
                    details.append(f"`{c}`: ב-{after:.1%} מהשורות התאריך מאוחר מרגע ההחלטה")
                    statuses.append(FAIL if after > 0.5 else WARN)
    # suspicious univariate predictive power
    if yb is not None:
        for c in df.columns:
            if c in skip:
                continue
            s = df[c]
            if pd.api.types.is_numeric_dtype(s):
                score = s
            elif s.nunique() <= 50:
                means = yb.groupby(s.astype(str)).mean()
                score = s.astype(str).map(means)
            else:
                continue
            a = auc_score(yb.to_numpy(), score.to_numpy())
            if np.isnan(a):
                continue
            a = max(a, 1 - a)
            if a >= LEAK_AUC_WARN:
                details.append(f"`{c}`: AUC חד-משתני {a:.3f} – חזק באופן חשוד")
                statuses.append(FAIL if a >= LEAK_AUC_FAIL else WARN)
            # missingness pattern that reveals the outcome
            if s.isna().any() and s.notna().any():
                rate_na, rate_ok = yb[s.isna()].mean(), yb[s.notna()].mean()
                if (rate_na in (0.0, 1.0) and s.isna().sum() >= 30) or (rate_ok in (0.0, 1.0) and s.notna().sum() >= 30):
                    details.append(f"`{c}`: דפוס החוסר מנבא את המטרה באופן מושלם")
                    statuses.append(WARN)
        for c in df.columns:
            if c in skip:
                continue
            if re.search(r"(default|churn|fraud|outcome|result|status|closed|collect|recover|write.?off|כשל|גבייה|תוצאה)", c, re.I):
                details.append(f"`{c}`: השם מרמז על מידע מהתוצאה – אמתו מתי הוא נרשם")
                statuses.append(WARN)
    status = worst(statuses) if statuses else PASS
    return Check(
        "דליפת מידע (leakage)", status,
        f"{len(details)} משתנים חשודים" if details else "לא נמצאו משתנים חשודים",
        "לכל משתנה חשוד: בררו מתי הוא נרשם ביחס לרגע ההחלטה. נרשם אחרי – מוציאים. לא ברור – מוציאים עד הבירור.",
        details,
    )


def check_stability(df: pd.DataFrame, date_col: str | None, skip: set[str]) -> Check:
    if not date_col or date_col not in df.columns:
        return Check("יציבות לאורך זמן (PSI)", WARN, "אין עמודת תאריך – לא ניתן לבדוק יציבות", "הוסיפו חותמת זמן של רגע ההחלטה.")
    d = pd.to_datetime(df[date_col], errors="coerce")
    if d.notna().sum() < 100:
        return Check("יציבות לאורך זמן (PSI)", WARN, "מעט מדי תאריכים תקינים", "בדקו את פורמט התאריך.")
    cut = d.quantile(0.7)
    early, late = df[d <= cut], df[d > cut]
    details, statuses = [f"תקופת השוואה: עד {cut.date()} מול אחרי (70/30)"], []
    for c in df.columns:
        if c in skip:
            continue
        if not pd.api.types.is_numeric_dtype(df[c]) and df[c].nunique() > 50:
            continue
        v = psi(early[c], late[c])
        if np.isnan(v):
            continue
        if v >= PSI_WARN:
            details.append(f"`{c}`: PSI={v:.3f}")
            statuses.append(FAIL if v >= PSI_FAIL else WARN)
    status = WARN if FAIL in statuses else worst(statuses) if statuses else PASS
    return Check(
        "יציבות לאורך זמן (PSI)", status,
        f"{len(statuses)} משתנים זזו בין התקופות" if statuses else "התפלגויות יציבות",
        "PSI>0.25 – בררו אם הייתה הגדרה מחדש, שינוי מערכת או שינוי מדיניות. ייתכן שצריך לאמן רק על התקופה האחרונה.",
        details,
    )


def check_groups(df: pd.DataFrame, groups: list[str], yb: pd.Series | None) -> Check:
    if not groups:
        return Check("ייצוג קבוצות (הטיה)", WARN, "לא הוגדרו קבוצות לבדיקת הטיה (--group-cols)",
                     "הגדירו קבוצות רלוונטיות (מגדר, גיל, אזור) – לבדיקה בלבד, לא כקלט למודל.")
    details, statuses = [], []
    for g in groups:
        if g not in df.columns:
            details.append(f"`{g}`: לא קיימת בנתונים")
            statuses.append(WARN)
            continue
        vc = df[g].astype(str).value_counts()
        for level, n in vc.items():
            share = n / len(df)
            rate = f", שיעור מטרה {yb[df[g].astype(str) == level].mean():.2%}" if yb is not None else ""
            flag = ""
            if share < MIN_GROUP_SHARE or n < MIN_GROUP_N:
                flag = " ← ייצוג נמוך"
                statuses.append(WARN)
            details.append(f"`{g}`={level}: {n:,} ({share:.1%}){rate}{flag}")
    status = worst(statuses) if statuses else PASS
    return Check(
        "ייצוג קבוצות (הטיה)", status,
        "יש קבוצות בייצוג נמוך" if status != PASS else "כל הקבוצות מיוצגות",
        "קבוצה בייצוג נמוך – מדדי הביצוע שלה לא יהיו אמינים. דווחו זאת ב-model card. העמודות הרגישות לא נכנסות כקלט למודל.",
        details[:60],
    )


def check_text(df: pd.DataFrame, text_cols: list[str]) -> Check | None:
    if not text_cols:
        return None
    details, statuses = [], []
    for c in text_cols:
        if c not in df.columns:
            details.append(f"`{c}`: לא קיימת")
            statuses.append(WARN)
            continue
        s = df[c].astype("string")
        empty = float((s.isna() | (s.str.strip() == "")).mean())
        lens = s.dropna().str.len()
        sample = s.dropna().head(2000)
        heb = sample.str.count(r"[֐-׿]").sum()
        lat = sample.str.count(r"[A-Za-z]").sum()
        tot = max(heb + lat, 1)
        garbled = float(sample.str.contains("�|Ã|×", regex=True).mean()) if len(sample) else 0.0
        details.append(
            f"`{c}`: ריקים {empty:.1%}, אורך חציוני {lens.median() if len(lens) else 0:.0f} תווים "
            f"(אחוזון 95: {lens.quantile(0.95) if len(lens) else 0:.0f}), עברית {heb / tot:.0%} / לטינית {lat / tot:.0%}, קידוד פגום {garbled:.1%}"
        )
        if empty > MISSING_WARN or garbled > 0.01:
            statuses.append(WARN)
    return Check(
        "נתונים לא מובנים", worst(statuses) if statuses else PASS,
        "נמצאו בעיות בטקסט" if statuses else "הטקסטים תקינים",
        "קידוד פגום – קראו מחדש ב-UTF-8 / cp1255. לעברית בחרו מודל embeddings שתומך בעברית (רב-לשוני). טקסטים ארוכים מאוד – חיתוך או סיכום לפני embeddings.",
        details,
    )


def overall(checks: list[Check]) -> tuple[str, str]:
    critical = {"דליפת מידע (leakage)", "איזון משתנה המטרה", "כפילויות ומזהים"}
    if any(c.status == FAIL and c.name in critical for c in checks) or sum(c.status == FAIL for c in checks) >= 2:
        return "🔴 אדום", "לא מאמנים עד שהממצאים הקריטיים נפתרים."
    if any(c.status in (FAIL, WARN) for c in checks):
        return "🟡 צהוב", "אפשר להמשיך עם הסתייגויות – בכפוף לאישור הניקוי המוצע."
    return "🟢 ירוק", "הנתונים כשירים לאימון."


def render(path: Path, df: pd.DataFrame, checks: list[Check], score: tuple[str, str]) -> str:
    out = [
        "# דוח בדיקת נתונים",
        "",
        f"**קובץ:** `{path}`  ",
        f"**היקף:** {len(df):,} שורות × {df.shape[1]} עמודות",
        "",
        f"## ציון כשירות: {score[0]}",
        score[1],
        "",
        "## סיכום",
        "| בדיקה | סטטוס | ממצא |",
        "|---|---|---|",
    ]
    out += [f"| {c.name} | {c.status} | {c.finding} |" for c in checks]
    out += ["", "## פירוט והצעות ניקוי", "_הצעות בלבד – ניקוי שמשנה משמעות מתבצע רק אחרי אישור._", ""]
    for c in checks:
        out += [f"### {c.name} – {c.status}", c.finding, ""]
        out += [f"- {d}" for d in c.details]
        if c.suggestion:
            out += ["", f"**הצעה:** {c.suggestion}"]
        out.append("")
    out += ["## נספח: פרופיל עמודות", "| עמודה | סוג | חסרים | ערכים ייחודיים | דוגמה |", "|---|---|---|---|---|"]
    for col in df.columns:
        s = df[col]
        ex = s.dropna().iloc[0] if s.notna().any() else ""
        ex = str(ex)[:30].replace("|", "/")
        out.append(f"| `{col}` | {s.dtype} | {s.isna().mean():.1%} | {s.nunique():,} | {ex} |")
    out += ["", "✅ אושר: <תאריך> – <מי אישר>", ""]
    return "\n".join(out)


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("data", type=Path)
    p.add_argument("--target")
    p.add_argument("--date-col")
    p.add_argument("--id-col")
    p.add_argument("--group-cols", nargs="*", default=[])
    p.add_argument("--text-cols", nargs="*", default=[])
    p.add_argument("--post-decision-cols", nargs="*", default=[], help="columns known to be recorded after the decision moment")
    p.add_argument("--out", type=Path, default=Path("work/04_data_report.md"))
    p.add_argument("--json", type=Path, help="optional machine-readable output")
    a = p.parse_args()

    df = load(a.data)
    skip = {c for c in [a.target, a.id_col, a.date_col] if c} | set(a.group_cols) | set(a.text_cols)

    checks = [check_missing(df), check_duplicates(df, a.id_col, a.date_col), check_impossible(df, skip)]
    tcheck, yb = check_target(df, a.target)
    checks.append(tcheck)
    checks.append(check_leakage(df, yb, skip, a.date_col, a.post_decision_cols))
    checks.append(check_stability(df, a.date_col, skip | set(a.post_decision_cols)))
    checks.append(check_groups(df, a.group_cols, yb))
    t = check_text(df, a.text_cols)
    if t:
        checks.append(t)
    score = overall(checks)

    a.out.parent.mkdir(parents=True, exist_ok=True)
    a.out.write_text(render(a.data, df, checks, score), encoding="utf-8")
    if a.json:
        a.json.write_text(json.dumps({"score": score[0], "checks": [c.__dict__ for c in checks]}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"{score[0]} – report written to {a.out}")
    for c in checks:
        print(f"  {c.status}  {c.name}: {c.finding}")


if __name__ == "__main__":
    main()
