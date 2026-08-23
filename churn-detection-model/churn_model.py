"""
Churn Detection Model from Scratch
===================================

End-to-end pipeline for predicting mobile network customer churn on a
synthetic telecom dataset:

  1. Generate a synthetic telecom dataset (3,333 customers, ~14.3% churn)
  2. Exploratory data analysis (churn rate by support calls / intl plan)
  3. Preprocessing: encode categoricals, scale numerics, stratified split
  4. Train a Random Forest classifier with class balancing
  5. Evaluate on a holdout test set (confusion matrix, precision/recall/F1, AUC)
  6. Find the optimal decision threshold via the ROC curve (Youden's J)
  7. Inspect feature importances
  8. Score new customers into risk tiers

Run with: python churn_model.py
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    roc_auc_score,
    roc_curve,
)
from sklearn.model_selection import cross_val_score, train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler

FEATURES = [
    "tenure",
    "monthly_charges",
    "total_charges",
    "customer_service_calls",
    "day_mins",
    "day_calls",
    "intl_mins",
    "number_vmail_msgs",
    "intl_plan_enc",
    "voice_plan_enc",
]


def generate_dataset(n: int = 3333, seed: int = 42) -> pd.DataFrame:
    """Create a synthetic telecom operator dataset with a logistic churn signal."""
    np.random.seed(seed)
    df = pd.DataFrame(
        {
            "tenure": np.random.randint(1, 72, n),
            "monthly_charges": np.round(np.random.uniform(18, 119, n), 2),
            "total_charges": np.round(np.random.uniform(18, 8700, n), 2),
            "customer_service_calls": np.random.randint(0, 10, n),
            "day_mins": np.round(np.random.normal(180, 55, n).clip(0), 1),
            "day_calls": np.random.randint(50, 165, n),
            "intl_mins": np.round(np.random.normal(10, 4, n).clip(0), 1),
            "intl_plan": np.random.choice(["yes", "no"], n, p=[0.1, 0.9]),
            "voice_mail_plan": np.random.choice(["yes", "no"], n, p=[0.28, 0.72]),
            "number_vmail_msgs": np.random.randint(0, 52, n),
        }
    )

    # Logistic churn signal: support calls, intl plan, charges, and short tenure drive churn
    logit = (
        -4.2
        + 0.35 * df["customer_service_calls"]
        + 2.20 * (df["intl_plan"] == "yes").astype(float)
        + 0.015 * df["monthly_charges"]
        - 0.030 * df["tenure"]
        + np.random.normal(0, 0.5, n)  # residual noise
    )
    churn_prob = 1 / (1 + np.exp(-logit))
    df["churn"] = (np.random.uniform(0, 1, n) < churn_prob).astype(int)
    return df


def explore(df: pd.DataFrame) -> None:
    cs_churn = df.groupby("customer_service_calls")["churn"].mean().reset_index()
    cs_churn.columns = ["calls", "churn_rate"]

    intl_churn = df.groupby("intl_plan")["churn"].agg(["mean", "count"])
    intl_churn.columns = ["churn_rate", "count"]

    print("=== Churn Rate by Customer Service Calls ===")
    print(cs_churn.to_string(index=False))

    print("\n=== Churn Rate by International Plan ===")
    print(intl_churn)


def preprocess(df: pd.DataFrame):
    le = LabelEncoder()
    df["intl_plan_enc"] = le.fit_transform(df["intl_plan"])  # no=0, yes=1
    df["voice_plan_enc"] = le.fit_transform(df["voice_mail_plan"])  # no=0, yes=1

    X = df[FEATURES]
    y = df["churn"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=6, stratify=y
    )

    scaler = StandardScaler()
    X_train_sc = scaler.fit_transform(X_train)
    X_test_sc = scaler.transform(X_test)  # transform only, never fit

    print(f"Train: {X_train.shape[0]} samples | Test: {X_test.shape[0]} samples")
    print(f"Train churn rate: {y_train.mean():.3f}")
    print(f"Test churn rate:  {y_test.mean():.3f}")

    return X_train, X_test, y_train, y_test, X_train_sc, X_test_sc, scaler


def train_model(X_train_sc, y_train) -> RandomForestClassifier:
    rf = RandomForestClassifier(
        n_estimators=200,
        max_depth=12,
        min_samples_leaf=5,
        class_weight="balanced",  # up-weights the minority churn class
        random_state=42,
        n_jobs=-1,
    )

    cv_scores = cross_val_score(rf, X_train_sc, y_train, cv=5, scoring="roc_auc")
    rf.fit(X_train_sc, y_train)

    print(f"CV ROC-AUC scores: {cv_scores.round(3)}")
    print(f"Mean CV AUC: {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")

    return rf


def evaluate(rf: RandomForestClassifier, X_test_sc, y_test):
    y_pred = rf.predict(X_test_sc)
    y_prob = rf.predict_proba(X_test_sc)[:, 1]

    cm = confusion_matrix(y_test, y_pred)
    report = classification_report(y_test, y_pred, target_names=["No Churn", "Churn"])
    test_auc = roc_auc_score(y_test, y_prob)

    print("Confusion Matrix:\n", cm)
    print("\nClassification Report:\n", report)
    print(f"Test ROC-AUC: {test_auc:.4f}")

    return y_pred, y_prob, test_auc


def optimal_threshold(y_test, y_prob, test_auc):
    fpr, tpr, thresholds = roc_curve(y_test, y_prob)

    # Youden's J statistic maximises TPR - FPR
    j_scores = tpr - fpr
    optimal_idx = np.argmax(j_scores)
    optimal_thr = thresholds[optimal_idx]

    print(f"AUC = {test_auc:.4f}")
    print(f"Optimal threshold: {optimal_thr:.3f}")
    print(f"At optimal → TPR={tpr[optimal_idx]:.3f}, FPR={fpr[optimal_idx]:.3f}")

    return optimal_thr


def feature_importance(rf: RandomForestClassifier):
    importances = pd.Series(rf.feature_importances_, index=FEATURES)
    importances = importances.sort_values(ascending=False)

    print("=== Feature Importances (Gini) ===")
    for feat, val in importances.items():
        bar = "█" * int(val * 200)
        print(f"  {feat:<30} {val:.4f}  {bar}")

    return importances


def score_customers(X_test: pd.DataFrame, y_test: pd.Series, y_prob, n: int = 10):
    sample = X_test.iloc[:n].copy()
    sample["churn_prob"] = (y_prob[:n] * 100).round(1)
    sample["actual_churn"] = y_test.values[:n]
    sample["risk_tier"] = pd.cut(
        sample["churn_prob"],
        bins=[0, 25, 50, 75, 100],
        labels=["Low", "Medium", "High", "Critical"],
    )

    display_cols = [
        "tenure",
        "customer_service_calls",
        "monthly_charges",
        "churn_prob",
        "risk_tier",
        "actual_churn",
    ]
    print(sample[display_cols].to_string())

    return sample


def main():
    np.random.seed(42)

    df = generate_dataset()
    print(df.shape)
    print(df["churn"].value_counts())
    print(df.head(3))
    print()

    explore(df)
    print()

    X_train, X_test, y_train, y_test, X_train_sc, X_test_sc, scaler = preprocess(df)
    print()

    rf = train_model(X_train_sc, y_train)
    print()

    y_pred, y_prob, test_auc = evaluate(rf, X_test_sc, y_test)
    print()

    optimal_threshold(y_test, y_prob, test_auc)
    print()

    feature_importance(rf)
    print()

    score_customers(X_test, y_test, y_prob)


if __name__ == "__main__":
    main()
