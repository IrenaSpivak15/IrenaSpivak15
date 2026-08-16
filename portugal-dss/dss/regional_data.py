"""Illustrative regional assumptions for Portuguese districts.

These figures (demand tier, assumed gross rental yield range, tourism intensity)
are approximate, editable defaults meant to seed the model -- NOT verified market
data. Users should override them from the sidebar once they have local broker /
Confidencial Imobiliario / INE figures for the districts they care about.
"""
from __future__ import annotations

# tier: 3 = top-tier demand (Lisbon/Porto core, Algarve coast), 2 = strong secondary,
# 1 = regional/inland, lower liquidity.
# yield_pct: assumed long-term unfurnished rental gross yield, annual, illustrative.
# str_yield_pct: assumed short-term-rental (Alojamento Local) gross yield where tourism-relevant.
DISTRICT_DEFAULTS: dict[str, dict] = {
    "Lisboa":        {"tier": 3, "yield_pct": 5.0, "str_yield_pct": 7.0, "note": "שוק ליבה - נזילות גבוהה, תחרות גבוהה על נכסים איכותיים"},
    "Porto":         {"tier": 3, "yield_pct": 5.5, "str_yield_pct": 7.5, "note": "ביקוש חזק, מחירי כניסה נמוכים יותר מליסבון"},
    "Faro":          {"tier": 3, "yield_pct": 4.5, "str_yield_pct": 8.5, "note": "אלגרבה - תיירותי מאוד, תשואה עונתית גבוהה ב-STR"},
    "Setubal":       {"tier": 2, "yield_pct": 5.5, "str_yield_pct": 6.5, "note": "פרברי ליסבון, גדילה עם התרחבות המטרופולין"},
    "Braga":         {"tier": 2, "yield_pct": 6.0, "str_yield_pct": 6.0, "note": "עיר סטודנטים/הייטק, ביקוש שכירות יציב"},
    "Aveiro":        {"tier": 2, "yield_pct": 6.0, "str_yield_pct": 6.0, "note": "תעשייה וטכנולוגיה, מחירים סבירים"},
    "Coimbra":       {"tier": 2, "yield_pct": 6.0, "str_yield_pct": 5.5, "note": "עיר אוניברסיטאית - ביקוש שכירות סטודנטים"},
    "Leiria":        {"tier": 2, "yield_pct": 6.0, "str_yield_pct": 6.0, "note": "מרכז הארץ, קרבה לחוף"},
    "Viana do Castelo": {"tier": 1, "yield_pct": 5.5, "str_yield_pct": 6.0, "note": "צפון, שוק קטן יותר"},
    "Viseu":         {"tier": 1, "yield_pct": 6.5, "str_yield_pct": 5.0, "note": "פנים הארץ, מחירים נמוכים, נזילות מוגבלת"},
    "Santarem":      {"tier": 1, "yield_pct": 6.0, "str_yield_pct": 5.0, "note": "פנים הארץ, מחירים נמוכים"},
    "Evora":         {"tier": 1, "yield_pct": 5.5, "str_yield_pct": 6.5, "note": "אלנטז'ו - תיירות פנים, נזילות מוגבלת"},
    "Beja":          {"tier": 1, "yield_pct": 6.5, "str_yield_pct": 5.0, "note": "פנים הארץ, שוק דליל"},
    "Braganca":      {"tier": 1, "yield_pct": 7.0, "str_yield_pct": 4.5, "note": "פריפריה, תשואה גבוהה אך נזילות נמוכה"},
    "Castelo Branco": {"tier": 1, "yield_pct": 6.5, "str_yield_pct": 4.5, "note": "פנים הארץ"},
    "Guarda":        {"tier": 1, "yield_pct": 6.5, "str_yield_pct": 4.5, "note": "פנים הארץ"},
    "Portalegre":    {"tier": 1, "yield_pct": 6.5, "str_yield_pct": 4.5, "note": "פנים הארץ"},
    "Vila Real":     {"tier": 1, "yield_pct": 6.5, "str_yield_pct": 4.5, "note": "פנים הארץ"},
    "Madeira":       {"tier": 3, "yield_pct": 5.0, "str_yield_pct": 8.0, "note": "אי תיירותי, ביקוש STR גבוה כל השנה"},
    "Acores":        {"tier": 2, "yield_pct": 5.0, "str_yield_pct": 7.0, "note": "תיירות טבע צומחת, שוק קטן"},
}

DEFAULT_REGION_PROFILE = {"tier": 1, "yield_pct": 5.5, "str_yield_pct": 5.5, "note": "אין נתוני ברירת מחדל לאזור זה - יש להזין הערכה ידנית"}


def get_region_profile(district: str) -> dict:
    if not district:
        return DEFAULT_REGION_PROFILE
    key = district.strip()
    for name, profile in DISTRICT_DEFAULTS.items():
        if name.lower() == key.lower():
            return profile
    return DEFAULT_REGION_PROFILE
