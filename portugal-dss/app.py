"""
מערכת תומכת החלטה - השקעה בנדל"ן בפורטוגל ליזם ישראלי
Decision-Support System for Israeli investors evaluating residential property
purchases in Portugal.

Run with:
    streamlit run app.py
"""
from __future__ import annotations

import datetime as dt

import pandas as pd
import plotly.express as px
import streamlit as st

from dss.costs import (
    DEFAULT_IMI_RATE,
    DEFAULT_LEGAL_NOTARY_PCT,
    DEFAULT_OPEX_PCT_OF_RENT,
    STAMP_DUTY_RATE,
    estimate_acquisition_costs,
    estimate_annual_holding_costs,
    estimate_imt,
)
from dss.regional_data import DISTRICT_DEFAULTS, get_region_profile
from dss.schema import REQUIRED_COLUMNS, clean
from dss.scoring import DEFAULT_WEIGHTS, compute_scores

st.set_page_config(
    page_title="DSS השקעות נדל\"ן פורטוגל",
    page_icon="🏠",
    layout="wide",
)

st.markdown(
    """
    <style>
    html, body, [class*="css"]  { direction: rtl; text-align: right; }
    div[data-testid="stMetricValue"] { direction: ltr; text-align: right; }
    .stDataFrame { direction: ltr; }
    </style>
    """,
    unsafe_allow_html=True,
)

st.title("🏠 מערכת תומכת החלטה: השקעה בדירות בפורטוגל")
st.caption(
    "כלי עזר ליזם ישראלי לבחון, לדרג ולהשוות נכסים למגורים/השקעה בפורטוגל. "
    "המערכת אינה מהווה ייעוץ מס, משפטי או השקעות - יש לאמת נתונים מול עו״ד ורואה חשבון מקומיים."
)

# ---------------------------------------------------------------- Data input
with st.sidebar:
    st.header("1. נתוני נכסים")
    uploaded = st.file_uploader("העלה קובץ CSV של נכסים", type=["csv"])
    use_sample = st.checkbox("השתמש בדוגמה מובנית (60 נכסים)", value=uploaded is None)

    st.caption(
        "עמודות נתמכות: " + ", ".join(REQUIRED_COLUMNS)
    )

if uploaded is not None:
    raw_df = pd.read_csv(uploaded)
elif use_sample:
    raw_df = pd.read_csv("data/sample_listings.csv")
else:
    st.info("העלה קובץ CSV או סמן שימוש בדוגמה כדי להתחיל.")
    st.stop()

df = clean(raw_df)

if df.empty:
    st.error("לא נמצאו שורות תקינות (עם מחיר > 0) בקובץ שהוזן.")
    st.stop()

# ---------------------------------------------------------------- Sidebar controls
with st.sidebar:
    st.header("2. סינון")
    districts = sorted(df["District"].dropna().unique().tolist())
    sel_districts = st.multiselect("מחוז (District)", districts, default=districts)

    types = sorted(df["Type"].dropna().unique().tolist())
    sel_types = st.multiselect("סוג נכס", types, default=types)

    price_min, price_max = int(df["Price"].min()), int(df["Price"].max())
    sel_price = st.slider("טווח מחיר (€)", price_min, price_max, (price_min, price_max))

    st.header("3. אסטרטגיית השכרה")
    str_mode = st.toggle(
        "חשב תשואה לפי השכרה קצרת טווח (Alojamento Local)",
        value=False,
        help="כבוי = הנחת שכירות ארוכת טווח. מופעל = הנחת תיירות/Airbnb (רלוונטי בעיקר לאלגרבה/ליסבון/פורטו/מדיירה).",
    )

    st.header("4. משקלי ניקוד")
    st.caption("שנה כדי להתאים את מודל הדירוג להעדפות שלך. הסכום מנורמל אוטומטית.")
    w_price = st.slider("מחיר יחסי לאזור", 0.0, 1.0, DEFAULT_WEIGHTS["price"])
    w_yield = st.slider("תשואה משוערת", 0.0, 1.0, DEFAULT_WEIGHTS["yield"])
    w_location = st.slider("איכות מיקום/ביקוש", 0.0, 1.0, DEFAULT_WEIGHTS["location"])
    w_energy = st.slider("תעודת אנרגיה", 0.0, 1.0, DEFAULT_WEIGHTS["energy"])
    w_condition = st.slider("מצב/גיל הבניין", 0.0, 1.0, DEFAULT_WEIGHTS["condition"])
    w_amenities = st.slider("מתקנים (מעלית/חניה/טעינה)", 0.0, 1.0, DEFAULT_WEIGHTS["amenities"])
    w_space = st.slider("יעילות שטח לחדר", 0.0, 1.0, DEFAULT_WEIGHTS["space"])

weights = {
    "price": w_price, "yield": w_yield, "location": w_location, "energy": w_energy,
    "condition": w_condition, "amenities": w_amenities, "space": w_space,
}

filtered = df[
    df["District"].isin(sel_districts)
    & df["Type"].isin(sel_types)
    & df["Price"].between(*sel_price)
].copy()

if filtered.empty:
    st.warning("אין נכסים התואמים את הסינון הנוכחי.")
    st.stop()

scored = compute_scores(filtered, weights=weights, current_year=dt.date.today().year, str_mode=str_mode)

# ---------------------------------------------------------------- Golden Visa note
st.info(
    "⚠️ **תזכורת חשובה:** החל מאוקטובר 2023 השקעה בנדל\"ן **אינה** מזכה יותר בויזת הזהב הפורטוגזית "
    "(Golden Visa). אם המטרה כוללת ויזת זהב יש לבחון מסלולים אחרים (קרנות השקעה, יצירת מקומות עבודה וכו') בנפרד מהחלטת הנדל\"ן.",
    icon="⚠️",
)

tab_rank, tab_regional, tab_costs, tab_detail, tab_data = st.tabs(
    ["📊 דירוג והשוואה", "🗺️ תובנות אזוריות", "🧮 מחשבון עלויות ותשואה", "🔍 ניתוח נכס בודד", "📄 נתונים גולמיים"]
)

# ---------------------------------------------------------------- Ranking tab
with tab_rank:
    st.subheader(f"דירוג {len(scored)} נכסים לפי ציון השקעה")

    c1, c2, c3, c4 = st.columns(4)
    c1.metric("ציון ממוצע", f"{scored['OverallScore'].mean():.1f}")
    c2.metric("מחיר חציוני", f"€{scored['Price'].median():,.0f}")
    c3.metric("מחיר/מ״ר חציוני", f"€{scored['PricePerSqm'].median():,.0f}")
    c4.metric("תשואה שנתית חציונית משוערת", f"{(scored['EstAnnualRent']/scored['Price']*100).median():.1f}%")

    show_cols = [
        "District", "City", "Town", "Type", "Price", "EffectiveArea", "PricePerSqm",
        "Bedrooms", "Bathrooms", "EnergyCertificate", "ConstructionYear",
        "OverallScore", "Recommendation", "EstMonthlyRent",
    ]
    st.dataframe(
        scored.sort_values("OverallScore", ascending=False)[show_cols].rename(columns={
            "EffectiveArea": "שטח (מ״ר)",
            "PricePerSqm": "מחיר/מ״ר",
            "OverallScore": "ציון כולל",
            "Recommendation": "המלצה",
            "EstMonthlyRent": "שכ״ד חודשי משוער",
        }),
        use_container_width=True,
        height=420,
    )

    st.subheader("Top 10 המלצות")
    top10 = scored.sort_values("OverallScore", ascending=False).head(10)
    fig = px.bar(
        top10.assign(label=top10["Town"] + " · " + top10["Type"] + " · €" + top10["Price"].map("{:,.0f}".format)),
        x="OverallScore", y="label", orientation="h", color="OverallScore",
        color_continuous_scale="RdYlGn", range_color=(0, 100),
        labels={"OverallScore": "ציון כולל", "label": "נכס"},
    )
    fig.update_layout(yaxis={"categoryorder": "total ascending"}, height=420)
    st.plotly_chart(fig, use_container_width=True)

    fig2 = px.scatter(
        scored, x="PricePerSqm", y="OverallScore", color="District", size="Price",
        hover_data=["City", "Town", "Type", "Bedrooms"],
        labels={"PricePerSqm": "מחיר למ״ר (€)", "OverallScore": "ציון כולל"},
        title="מחיר למ״ר מול ציון השקעה",
    )
    st.plotly_chart(fig2, use_container_width=True)

# ---------------------------------------------------------------- Regional tab
with tab_regional:
    st.subheader("השוואה בין מחוזות")
    reg = (
        scored.groupby("District")
        .agg(
            נכסים=("Price", "count"),
            מחיר_חציוני=("Price", "median"),
            מחיר_למר_חציוני=("PricePerSqm", "median"),
            ציון_ממוצע=("OverallScore", "mean"),
        )
        .round(1)
        .sort_values("ציון_ממוצע", ascending=False)
    )
    st.dataframe(reg, use_container_width=True)

    fig3 = px.bar(
        reg.reset_index(), x="District", y="ציון_ממוצע", color="ציון_ממוצע",
        color_continuous_scale="RdYlGn", range_color=(0, 100), title="ציון השקעה ממוצע לפי מחוז",
    )
    st.plotly_chart(fig3, use_container_width=True)

    st.subheader("פרופיל אזורי (הנחות ברירת מחדל - ניתן לעדכן ידנית)")
    profile_rows = []
    for d in sel_districts:
        p = get_region_profile(d)
        profile_rows.append({
            "מחוז": d, "רמת ביקוש (1-3)": p["tier"],
            "תשואה משוערת - ארוך טווח %": p["yield_pct"],
            "תשואה משוערת - קצר טווח %": p["str_yield_pct"],
            "הערה": p["note"],
        })
    st.dataframe(pd.DataFrame(profile_rows), use_container_width=True, height=320)
    st.caption(
        "הערכים לעיל הם ברירות מחדל אילוסטרטיביות בלבד המבוססות על מגמות שוק כלליות, ולא על נתוני עסקאות מאומתים. "
        "מומלץ לעדכן אותם בהתאם לנתוני שמאי/מתווך מקומי לפני קבלת החלטה."
    )

# ---------------------------------------------------------------- Costs tab
with tab_costs:
    st.subheader("מחשבון עלות רכישה כוללת ותשואה נטו")
    st.caption(
        "מבוסס על מדרגות מס רכישה (IMT) והיטלים סטנדרטיים לרוכש שאינו תושב הרוכש דירה שנייה/להשקעה. "
        "המדרגות מתעדכנות מדי שנה - יש לאמת מול עו״ד/רואה חשבון פורטוגזי לפני חתימה."
    )

    prop_options = scored.assign(
        label=lambda d: d["Town"] + " · " + d["Type"] + " · €" + d["Price"].map("{:,.0f}".format)
    )
    choice = st.selectbox("בחר נכס מהרשימה המסוננת (או הזן מחיר ידנית למטה)", ["-- הזנה ידנית --"] + prop_options["label"].tolist())

    colp1, colp2 = st.columns(2)
    with colp1:
        if choice != "-- הזנה ידנית --":
            row = prop_options[prop_options["label"] == choice].iloc[0]
            price_input = float(row["Price"])
            annual_rent_input = float(row["EstAnnualRent"])
        else:
            price_input = st.number_input("מחיר הנכס (€)", min_value=0, value=250000, step=5000)
            annual_rent_input = st.number_input("הכנסת שכירות שנתית משוערת (€)", min_value=0, value=12500, step=500)
        st.write(f"**מחיר:** €{price_input:,.0f}  |  **שכ״ד שנתי משוער:** €{annual_rent_input:,.0f}")

    with colp2:
        stamp_rate = st.number_input("שיעור בול (Imposto de Selo) %", value=STAMP_DUTY_RATE * 100, step=0.1) / 100
        legal_pct = st.number_input("עו״ד + נוטריון + רישום, % ממחיר", value=DEFAULT_LEGAL_NOTARY_PCT * 100, step=0.1) / 100
        imi_rate = st.number_input("שיעור IMI שנתי %", value=DEFAULT_IMI_RATE * 100, step=0.05) / 100
        opex_pct = st.number_input("הוצאות תפעול/ניהול, % מהכנסה", value=DEFAULT_OPEX_PCT_OF_RENT * 100, step=1.0) / 100

    acq = estimate_acquisition_costs(price_input, stamp_duty_rate=stamp_rate, legal_notary_pct=legal_pct)
    hold = estimate_annual_holding_costs(price_input, annual_rent_input, imi_rate=imi_rate, opex_pct_of_rent=opex_pct)

    colc1, colc2 = st.columns(2)
    with colc1:
        st.markdown("##### עלויות רכישה חד-פעמיות")
        for k, v in acq.items():
            st.write(f"**{k}:** €{v:,.0f}")
    with colc2:
        st.markdown("##### תזרים שנתי משוער")
        for k, v in hold.items():
            if "%" in k:
                st.write(f"**{k}:** {v:.2f}%")
            else:
                st.write(f"**{k}:** €{v:,.0f}")

    st.warning(
        "המדרגות המוצגות למס רכישה (IMT) הן קירוב ל'דירה שנייה'/רכישה להשקעה בפורטוגל היבשתית, ואינן מחליפות ייעוץ מס פרטני. "
        "רוכש שאינו תושב עשוי לחוב גם ב-AIMI (היטל נוסף לבעלי נדל\"ן בשווי גבוה) ובמס רווח הון בעת מכירה - יש לתכנן זאת מראש עם יועץ מס."
    )

# ---------------------------------------------------------------- Single property detail
with tab_detail:
    st.subheader("פירוט ציון לנכס בודד")
    label2 = st.selectbox("בחר נכס", prop_options["label"].tolist(), key="detail_select")
    row = prop_options[prop_options["label"] == label2].iloc[0]

    cols = st.columns(4)
    cols[0].metric("ציון כולל", f"{row['OverallScore']:.1f}/100")
    cols[1].metric("המלצה", row["Recommendation"])
    cols[2].metric("מחיר/מ״ר", f"€{row['PricePerSqm']:,.0f}")
    cols[3].metric("שכ״ד חודשי משוער", f"€{row['EstMonthlyRent']:,.0f}")

    sub_scores = {
        "מחיר יחסי לאזור": row["Score_Price"],
        "תשואה משוערת": row["Score_Yield"],
        "מיקום/ביקוש": row["Score_Location"],
        "תעודת אנרגיה": row["Score_Energy"],
        "מצב/גיל": row["Score_Condition"],
        "מתקנים": row["Score_Amenities"],
        "יעילות שטח": row["Score_Space"],
    }
    fig4 = px.bar_polar(
        r=list(sub_scores.values()), theta=list(sub_scores.keys()),
        range_r=[0, 100], title="פירוט תתי-ציונים",
    )
    st.plotly_chart(fig4, use_container_width=True)

    st.json({k: (v.item() if hasattr(v, "item") else v) for k, v in row.to_dict().items()})

# ---------------------------------------------------------------- Raw data
with tab_data:
    st.subheader("נתונים גולמיים לאחר ניקוי")
    st.dataframe(scored, use_container_width=True, height=500)
    st.download_button(
        "הורד תוצאות מדורגות כ-CSV",
        scored.to_csv(index=False).encode("utf-8-sig"),
        file_name="portugal_scored_properties.csv",
        mime="text/csv",
    )
