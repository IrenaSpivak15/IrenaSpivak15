"""Render the agent's structured report as Hebrew Markdown."""

from __future__ import annotations

PRIORITY_HE = {"high": "גבוהה", "medium": "בינונית", "low": "נמוכה"}
KIND_HE = {
    "product_gap": "פער מוצרי",
    "pricing_gap": "פער תמחור",
    "service_issue": "בעיית שירות",
    "digital_experience": "חוויה דיגיטלית",
}
_PRIORITY_ORDER = {"high": 0, "medium": 1, "low": 2}


def _bullets(items: list[str]) -> str:
    return "\n".join(f"- {i}" for i in items) if items else "- —"


def to_markdown(report: dict) -> str:
    out = ['<div dir="rtl">', "", "# דוח ניתוח תלונות והמלצות למוצרים חדשים", ""]
    out += ["## תקציר מנהלים", "", report.get("executive_summary", ""), ""]

    out += ["## ממצאים עיקריים", "", "| # | ממצא | סוג | מס' תלונות | תלונות לדוגמה |", "|---|---|---|---|---|"]
    for i, f in enumerate(report.get("key_findings", []), 1):
        out.append(
            f"| {i} | **{f['title']}** — {f['details']} | {KIND_HE.get(f['kind'], f['kind'])} "
            f"| {f['complaint_count']} | {', '.join(f['evidence_ids'])} |"
        )
    out.append("")

    out += ["## המלצות למוצרים חדשים", ""]
    recs = sorted(report.get("product_recommendations", []), key=lambda r: _PRIORITY_ORDER.get(r["priority"], 9))
    for i, r in enumerate(recs, 1):
        out += [
            f"### {i}. {r['name']}",
            "",
            f"- **תחום:** {r['product_line']}",
            f"- **עדיפות:** {PRIORITY_HE.get(r['priority'], r['priority'])}",
            f"- **קהל יעד:** {r['target_segment']}",
            f"- **הצורך:** {r['customer_need']}",
            f"- **מודל תמחור:** {r['pricing_model']}",
            f"- **אות ביקוש:** {r['demand_signal']}",
            f"- **תלונות תומכות:** {', '.join(r['evidence_ids'])}",
            "",
            "**כיסויים מרכזיים:**",
            _bullets(r["key_coverages"]),
            "",
            f"**סיכונים ורגולציה:** {r['risks_and_regulation']}",
            "",
            "**צעדים הבאים:**",
            _bullets(r["next_steps"]),
            "",
        ]

    out += ["## המלצות תפעוליות (שאינן מוצר חדש)", "", _bullets(report.get("operational_recommendations", [])), ""]
    out += ["## מגבלות הנתונים", "", report.get("data_limitations", ""), "", "</div>", ""]
    return "\n".join(out)
