---
description: בדיקת סחיפה ואימון מחדש על נתונים חדשים
argument-hint: <שם פרויקט>
---
פרויקט: $ARGUMENTS

1. data-intake על הנתונים החדשים.
2. data-validation עם השוואת PSI לתקופת האימון הקודמת.
3. אימון מחדש של הארכיטקטורה המאושרת בלבד (מתוך work/05_model_comparison.md – אותם פרמטרים, אותן עמודות מוצאות, אותו מחיר טעות).
4. השוואה למודל הפעיל על אותה תקופת בדיקה. החלפה – רק אחרי אישור.
   באישור: עדכן model_path ו-model_version ב-system/config.yaml ואת model_card.md.
