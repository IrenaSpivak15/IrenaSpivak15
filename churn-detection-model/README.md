# Churn Detection Model

A from-scratch, end-to-end churn prediction pipeline for a mobile network
operator, built on a synthetic telecom dataset (3,333 customers, ~14.3%
churn rate).

## Pipeline

1. **Generate the dataset** — synthetic customer records with a logistic
   churn signal driven by support calls, international plan, monthly
   charges, and tenure.
2. **Explore the data** — churn rate by customer service calls and by
   international plan.
3. **Preprocess** — encode categoricals, stratified 80/20 train/test split,
   scale numerics (fit on train only, to avoid data leakage).
4. **Train** a `RandomForestClassifier` with `class_weight='balanced'` to
   handle the class imbalance, validated with 5-fold cross-validation
   (ROC-AUC).
5. **Evaluate** on the holdout test set: confusion matrix, precision,
   recall, F1, ROC-AUC.
6. **Tune the decision threshold** using the ROC curve and Youden's J
   statistic, trading false positives for better churner recall.
7. **Inspect feature importance** to confirm the model has learned
   sensible, domain-consistent patterns.
8. **Score customers** into risk tiers (Low / Medium / High / Critical) for
   a retention workflow.

## Files

- `churn_model.py` — the pipeline as a plain runnable script.
- `scikit_learn_tutorial.ipynb` — a step-by-step teaching notebook (Hebrew)
  for students, built around Scikit-Learn's Estimator API (`fit`/`predict`)
  and Transformer API (`fit`/`transform`), using this churn scenario as the
  running example. Includes explanations, exercises, and a side-by-side
  comparison swapping Random Forest for Logistic Regression to show the
  unified API in action.

## Usage

```bash
pip install -r requirements.txt
python churn_model.py
# or open scikit_learn_tutorial.ipynb in Jupyter
```

## Notes

- Accuracy is misleading here: a model that always predicts "no churn"
  would score ~85.7% while being useless. Recall and ROC-AUC are the
  metrics that matter for churn.
- The default 0.5 classification threshold is rarely optimal for
  retention use cases; the optimal threshold found here trades some false
  positives for substantially better churner recall.
- This is a synthetic dataset for demonstration. Natural next steps for a
  production system: gradient-boosted trees (XGBoost/LightGBM), SMOTE for
  imbalance, time-aware/rolling-window features, and SHAP for per-customer
  explanations.
