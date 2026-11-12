# תבנית מערכת תומכת החלטה

## מבנה system/
```
system/
├── config.yaml            ← ספים, פעולות, גרסת מודל (מקור אמת אחד)
├── decision_layer.py      ← ציון → פעולה + 3 נימוקים + ודאות
├── api.py                 ← FastAPI: POST /score
├── dashboard.py           ← Streamlit למקבל ההחלטה (או dashboard.html סטטי)
├── monitoring.py          ← PSI, ביצועים, דריסות, טריגר לאימון מחדש
├── decisions_log.csv      ← כל המלצה + החלטת האדם (נוצר בריצה)
├── model_card.md
└── executive_summary.md   ← עמוד אחד להנהלה
```

## config.yaml
```yaml
model_path: models/<run_id>_<layer>.joblib
model_version: "<run_id>"
threshold: 0.23            # מ-05_model_comparison (סף מבוסס עלות)
grey_zone: [0.18, 0.30]    # בין הערכים → "לבדיקה ידנית"
actions:                   # רשימה סגורה מהקנבס
  high: "<פעולה לסיכון גבוה>"
  low:  "<פעולה לסיכון נמוך>"
  grey: "העברה לבדיקה ידנית"
monitoring:
  psi_warn: 0.10
  psi_retrain: 0.25
  override_rate_warn: 0.20      # מעל – מקבלי ההחלטה לא סומכים על המודל
  performance_drop_retrain: 0.10 # ירידה יחסית בעלות העסקית מול validation
```

## decision_layer.py
```python
import joblib, numpy as np, pandas as pd, yaml

cfg = yaml.safe_load(open("system/config.yaml", encoding="utf-8"))
bundle = joblib.load(cfg["model_path"])
model, features = bundle["model"], bundle["features"]

def certainty(score: float) -> str:
    lo, hi = cfg["grey_zone"]
    if lo <= score <= hi:
        return "נמוכה"
    dist = min(abs(score - lo), abs(score - hi))  # מרחק מהתחום האפור
    return "גבוהה" if dist > 0.15 else "בינונית"

def top_reasons(row: pd.DataFrame, k: int = 3) -> list[str]:
    """SHAP לרשומה בודדת → 3 תרומות גדולות, בשפה עסקית."""
    import shap
    pre, est = model.named_steps["pre"], model.named_steps["m"]
    z = pre.transform(row)
    sv = shap.Explainer(est, feature_names=list(pre.get_feature_names_out()))(z)
    vals = sv.values[0] if sv.values.ndim == 2 else sv.values[0, :, -1]
    order = np.argsort(-np.abs(vals))[:k]
    names = sv.feature_names
    return [f"{names[i]} {'מעלה' if vals[i] > 0 else 'מוריד'} את הסיכון" for i in order]

def decide(record: dict) -> dict:
    row = pd.DataFrame([record])[features]
    score = float(model.predict_proba(row)[:, 1][0])
    lo, hi = cfg["grey_zone"]
    if lo <= score <= hi:
        action = cfg["actions"]["grey"]
    else:
        action = cfg["actions"]["high"] if score >= cfg["threshold"] else cfg["actions"]["low"]
    return {"score": round(score, 4), "action": action, "reasons": top_reasons(row),
            "certainty": certainty(score), "model_version": cfg["model_version"],
            "note": "המלצה בלבד – ההחלטה בידי הגורם המוסמך"}
```

## api.py
```python
from fastapi import FastAPI
from decision_layer import decide
app = FastAPI(title="Decision Support API")

@app.post("/score")
def score(record: dict) -> dict:
    return decide(record)
# הרצה: uvicorn system.api:app --port 8000
```

## dashboard.py (Streamlit)
- **רשימת מקרים מדורגת:** מקרים פתוחים ממוינים לפי ציון/עלות צפויה, עם עמודת פעולה מומלצת וודאות. סינון לפי תחום אפור.
- **כרטיס מקרה:** ציון, פעולה מומלצת, 3 נימוקים, רמת ודאות, נתוני המקרה (ללא מידע אישי גלוי).
- **אישור / דחייה:** שני כפתורים + שדה נימוק חובה בדחייה. כל לחיצה נרשמת ב-decisions_log.csv:
  `timestamp, case_id_hash, model_version, score, recommended_action, human_action, override(bool), reason, user`.

## monitoring.py – מה נבדק ובאיזו תדירות
| מדד | איך | תדירות | סף אזהרה | סף אימון מחדש |
|---|---|---|---|---|
| סחיפת נתונים | PSI לכל משתנה מול תקופת האימון | שבועי | 0.10 | 0.25 בשלושה משתנים מרכזיים |
| סחיפת ציון | PSI על התפלגות הציונים | שבועי | 0.10 | 0.25 |
| ביצועים | עלות עסקית מול תוצאות בפועל (כשמגיעות) | חודשי | ירידה 5% | ירידה 10% |
| דריסות | שיעור override של מקבלי ההחלטה | שבועי | 20% | בירור עם המשתמשים לפני אימון |
| הוגנות | שיעור סימון לפי קבוצה (ארבע-חמישיות) | חודשי | יחס < 0.8 | עצירה ובירור |

חציית סף אימון מחדש → הפעלת `/retrain`.

## model_card.md
```markdown
# Model Card – <שם>
- **מטרה:** <משפט הסוגיה>
- **מקבל ההחלטה ושימוש מותר:** ... · **שימוש אסור:** החלטה אוטומטית ללא אדם
- **נתונים:** מקורות, תקופה, מספר שורות, hash
- **מודל:** סוג, גרסה, פרמטרים, סף, תאריך אימון
- **ביצועים (test):** עלות עסקית, AUC, כיול – מול baseline
- **הטיות:** טבלת קבוצות + ממצאים
- **מגבלות:** אוכלוסיות שלא נראו, הנחות, תלות בשדות
- **ניטור ואימון מחדש:** ספים, תדירות
- **בעלים:** עסקי / טכני / נתונים
```

## executive_summary.md – עמוד אחד, בלי ז'רגון
1. הבעיה וההחלטה (2 שורות)
2. מה המערכת עושה (2 שורות)
3. התועלת הצפויה: חיסכון בש"ח / שיפור במדד מול המצב הקיים
4. סיכונים ומגבלות (3 נקודות)
5. מה צריך מההנהלה: אישור, בעלים, לוח זמנים
