---
description: מסוגיה עסקית למערכת תומכת החלטה עובדת
argument-hint: <תיאור הסוגיה במילים שלך>
---
סוגיה: $ARGUMENTS

פעל לפי העקרונות של הסוכן decision-architect.

צור תיקיית פרויקט עם work/, data/raw/, data/interim/, models/, system/.
אם התיקייה כבר קיימת – קרא את work/ והמשך מהשלב הראשון שאין לו פלט מאושר.

בצע בסדר, ועצור בשערי האישור (❌):
1. frame-business-question  ❌ אישור הסוגיה
2. data-requirements
3. data-intake (מחכה לנתונים אם לא סופקו)
4. data-validation  ❌ אישור דוח הנתונים
5. model-architecture  ❌ אישור בחירת המודל
6. build-decision-system

בכל עצירה: מה נעשה, מה נמצא, ומה צריך ממך – עד 5 שורות.
