<div dir="rtl">

# סוכן לניתוח תלונות בחברת ביטוח והמלצה על מוצרים חדשים

סוכן מבוסס Claude שקורא תלונות לקוחות, מחפש בהן צרכים שאף מוצר קיים לא מכסה, וכותב דוח בעברית עם המלצות למוצרי ביטוח חדשים.

## איך זה עובד

הסוכן מנתח את הנתונים בעצמו בעזרת כלים מקומיים (הנתונים לא עוברים עיבוד מראש):

| כלי | מה הוא עושה |
|---|---|
| `get_overview` | סך התלונות והתפלגות לפי תחום, מוצר, ערוץ, קטגוריה, פלח, גיל, חומרה וסטטוס |
| `crosstab` | טבלה צולבת של שני ממדים, למשל תחום × קטגוריה |
| `monthly_trend` | מגמה חודשית, עם סינון אופציונלי |
| `search_complaints` | חיפוש לפי מילות מפתח בטקסט ולפי מסננים, ומחזיר את התלונות המלאות |
| `get_product_catalog` | קטלוג המוצרים הקיים, כדי לא להמליץ על מוצר שכבר קיים |
| `submit_report` | הגשת הדוח הסופי במבנה קבוע |

הסוכן מבדיל בין **פערים מוצריים** (צורך שאין לו מוצר, או מודל תמחור שלא מתאים) לבין **בעיות שירות** (למשל זמן טיפול בתביעה), שמוצר חדש לא יפתור. כל המלצה כוללת קהל יעד, צורך, כיסויים, מודל תמחור, מספרי תלונות כראיה, אות ביקוש, סיכונים ורגולציה, עדיפות וצעדים הבאים.

## התקנה והרצה

</div>

```bash
cd insurance-complaints-agent
pip install -r requirements.txt
export ANTHROPIC_API_KEY=...
```

```bash
python -m complaints_agent --out complaints_report.md --json-out complaints_report.json
```

```bash
python -m complaints_agent --complaints my_complaints.csv --catalog my_catalog.json --question "התמקד בלקוחות צעירים בתחום הרכב"
```

<div dir="rtl">

פרמטרים: `--effort` (ברירת מחדל `high`) קובע את עומק החשיבה; `--model` מאפשר להחליף מודל (ברירת מחדל `claude-opus-5-5`).

## פורמט הנתונים

קובץ CSV ב-UTF-8. עמודות חובה: `id`, `text`, `product_line`, `category`.
עמודות רשות: `date` (YYYY-MM-DD), `product`, `channel`, `customer_segment`, `age_group`, `severity`, `status`, `compensation_ils`.
קטלוג המוצרים (רשות) הוא קובץ JSON: רשימה של `{product, product_line, description}`.

בתיקייה `data/` יש 40 תלונות לדוגמה (פיקטיביות) וקטלוג לדוגמה.

## שימוש מקוד

</div>

```python
from complaints_agent import ComplaintStore, run_agent, to_markdown

store = ComplaintStore.from_files("data/sample_complaints.csv", "data/product_catalog.json")
report = run_agent(store)          # dict במבנה של submit_report
print(to_markdown(report))
```

<div dir="rtl">

## בדיקות

הבדיקות רצות בלי מפתח API (הלולאה נבדקת מול לקוח מדומה):

</div>

```bash
python -m unittest discover -s tests -t .
```

<div dir="rtl">

## הערות

- אם מסווגי הבטיחות דוחים בקשה, ה-API מריץ אותה מחדש על מודל חלופי (`fallbacks: "default"`).
- כשכלי נכשל, השגיאה חוזרת לסוכן כדי שיתקן את הקריאה, במקום שהריצה תיעצר.
- כשיש אלפי תלונות, ריצה עולה יותר כסף ונמשכת יותר זמן. החיפוש מחזיר עד 100 תלונות בכל קריאה.

</div>
