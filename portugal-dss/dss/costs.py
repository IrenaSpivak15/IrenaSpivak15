"""Acquisition-cost and holding-cost estimator for a non-resident buyer.

All rates are editable, illustrative defaults (roughly aligned with published
Portuguese IMT/Imposto de Selo/IMI brackets for a *second home / investment*
purchase of urban property in mainland Portugal). Tax brackets are updated
periodically by the Portuguese state budget -- ALWAYS verify current figures
with a local advogado / contabilista before transacting. Nothing here is tax
or legal advice.
"""
from __future__ import annotations

# (upper_bound_eur, marginal_rate, deductible_amount) for "segunda habitação"
# (non-primary-residence) urban property, progressive bracket + deduction model.
IMT_BRACKETS_SECOND_HOME = [
    (97064, 0.01, 0),
    (132774, 0.02, 970.64),
    (181034, 0.05, 4953.86),
    (301688, 0.07, 8574.54),
    (603289, 0.08, 11591.42),
    (1050400, 0.06, 0.0),   # flat, no deduction, up to this ceiling
    (float("inf"), 0.075, 0.0),  # flat above ceiling
]

STAMP_DUTY_RATE = 0.008  # Imposto de Selo on the deed, 0.8% of price
DEFAULT_IMI_RATE = 0.004  # annual municipal property tax, urban avg ~0.3%-0.45%
DEFAULT_LEGAL_NOTARY_PCT = 0.015  # lawyer + notary + registration, rule of thumb
DEFAULT_OPEX_PCT_OF_RENT = 0.25  # condo fees + maintenance + management + vacancy reserve


def estimate_imt(price: float, second_home: bool = True) -> float:
    if price <= 0:
        return 0.0
    if not second_home:
        # Primary-residence brackets are more favourable; not modelled in detail
        # since this tool targets investment purchases. Fall back to the same
        # table as a conservative estimate.
        pass
    for upper, rate, deduction in IMT_BRACKETS_SECOND_HOME:
        if price <= upper:
            return max(price * rate - deduction, 0.0)
    return 0.0


def estimate_acquisition_costs(
    price: float,
    imt_override_rate: float | None = None,
    stamp_duty_rate: float = STAMP_DUTY_RATE,
    legal_notary_pct: float = DEFAULT_LEGAL_NOTARY_PCT,
) -> dict:
    imt = price * imt_override_rate if imt_override_rate is not None else estimate_imt(price)
    stamp_duty = price * stamp_duty_rate
    legal_notary = price * legal_notary_pct
    total = imt + stamp_duty + legal_notary
    return {
        "IMT (מס רכישה)": round(imt, 0),
        "Imposto de Selo (בול)": round(stamp_duty, 0),
        "עו״ד + נוטריון + רישום": round(legal_notary, 0),
        "סה״כ עלויות רכישה חד-פעמיות": round(total, 0),
        "מחיר + עלויות רכישה": round(price + total, 0),
    }


def estimate_annual_holding_costs(
    price: float,
    annual_rent: float,
    imi_rate: float = DEFAULT_IMI_RATE,
    opex_pct_of_rent: float = DEFAULT_OPEX_PCT_OF_RENT,
) -> dict:
    imi = price * imi_rate
    opex = annual_rent * opex_pct_of_rent
    net_rent = annual_rent - imi - opex
    total_investment = price  # simplistic base for yield-on-price
    net_yield_pct = (net_rent / total_investment * 100) if total_investment else 0.0
    return {
        "IMI שנתי (מס רכוש)": round(imi, 0),
        "הוצאות תפעול/ניהול/תחזוקה משוערות": round(opex, 0),
        "הכנסה נטו שנתית משוערת": round(net_rent, 0),
        "תשואה נטו משוערת (%)": round(net_yield_pct, 2),
    }
