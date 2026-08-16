"""Investment scoring engine.

Produces a 0-100 sub-score per dimension and a weighted overall score per
listing, plus a categorical recommendation. All weights and reference tables
are parameters so the app can expose them as sliders.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from .regional_data import get_region_profile

ENERGY_SCORE_MAP = {
    "A+": 100, "A": 90, "B+": 82, "B": 74, "B-": 66,
    "C": 55, "D": 42, "E": 30, "F": 18, "G": 8,
    "ISENTO": 60, "N/D": 50,
}

DEFAULT_WEIGHTS = {
    "price": 0.25,
    "yield": 0.20,
    "location": 0.15,
    "energy": 0.10,
    "condition": 0.10,
    "amenities": 0.10,
    "space": 0.10,
}


def _clip(s: pd.Series, lo=0, hi=100) -> pd.Series:
    return s.clip(lower=lo, upper=hi)


def score_price(df: pd.DataFrame) -> pd.Series:
    """Cheaper-per-sqm relative to the district's own median scores higher.

    Uses a sigmoid-ish transform around the district median so being ~30%
    below median tops out near 100 and ~30% above bottoms out near 0.
    """
    median_by_district = df.groupby("District")["PricePerSqm"].transform("median")
    ratio = df["PricePerSqm"] / median_by_district
    ratio = ratio.fillna(1.0)
    score = 100 - (ratio - 1.0) * 150
    return _clip(score)


def score_yield(df: pd.DataFrame, str_mode: bool = False) -> pd.Series:
    """Estimated gross rental yield (region default) mapped to 0-100.

    3% yield -> ~10, 8%+ -> ~100 (roughly linear in between).
    """
    key = "str_yield_pct" if str_mode else "yield_pct"
    yields = df["District"].apply(lambda d: get_region_profile(d)[key])
    score = (yields - 3.0) / (8.0 - 3.0) * 100
    return _clip(score)


def score_location(df: pd.DataFrame) -> pd.Series:
    tiers = df["District"].apply(lambda d: get_region_profile(d)["tier"])
    return tiers.map({1: 40, 2: 70, 3: 95}).fillna(40)


def score_energy(df: pd.DataFrame) -> pd.Series:
    return df["EnergyCertificate"].map(lambda e: ENERGY_SCORE_MAP.get(str(e).upper(), 50))


def score_condition(df: pd.DataFrame, current_year: int) -> pd.Series:
    age = current_year - df["ConstructionYear"]
    age = age.clip(lower=0)
    score = 100 - age * 1.2
    score = score.fillna(55)  # unknown age -> neutral
    return _clip(score)


def score_amenities(df: pd.DataFrame) -> pd.Series:
    score = (
        df["Elevator"].astype(int) * 25
        + df["Parking"].astype(int) * 25
        + df["Garage"].astype(int) * 30
        + df["ElectricCarCharging"].astype(int) * 20
    )
    return _clip(score)


def score_space(df: pd.DataFrame) -> pd.Series:
    """Rewards a sensible bedroom-to-area ratio (not too cramped, not wasteful)."""
    per_bedroom = df["EffectiveArea"] / df["Bedrooms"].replace({0: np.nan})
    per_bedroom = per_bedroom.fillna(df["EffectiveArea"])
    # sweet spot ~ 30-45 sqm per bedroom
    score = 100 - (per_bedroom - 37.5).abs() * 1.5
    return _clip(score)


def compute_scores(
    df: pd.DataFrame,
    weights: dict | None = None,
    current_year: int = 2026,
    str_mode: bool = False,
) -> pd.DataFrame:
    df = df.copy()
    weights = {**DEFAULT_WEIGHTS, **(weights or {})}
    total_w = sum(weights.values()) or 1.0

    df["Score_Price"] = score_price(df)
    df["Score_Yield"] = score_yield(df, str_mode=str_mode)
    df["Score_Location"] = score_location(df)
    df["Score_Energy"] = score_energy(df)
    df["Score_Condition"] = score_condition(df, current_year)
    df["Score_Amenities"] = score_amenities(df)
    df["Score_Space"] = score_space(df)

    df["OverallScore"] = (
        df["Score_Price"] * weights["price"]
        + df["Score_Yield"] * weights["yield"]
        + df["Score_Location"] * weights["location"]
        + df["Score_Energy"] * weights["energy"]
        + df["Score_Condition"] * weights["condition"]
        + df["Score_Amenities"] * weights["amenities"]
        + df["Score_Space"] * weights["space"]
    ) / total_w

    df["OverallScore"] = df["OverallScore"].round(1)
    df["Recommendation"] = df["OverallScore"].apply(recommendation_label)

    yield_key = "str_yield_pct" if str_mode else "yield_pct"
    assumed_yield = df["District"].apply(lambda d: get_region_profile(d)[yield_key])
    df["EstAnnualRent"] = (df["Price"] * assumed_yield / 100).round(0)
    df["EstMonthlyRent"] = (df["EstAnnualRent"] / 12).round(0)

    return df


def recommendation_label(score: float) -> str:
    if pd.isna(score):
        return "אין מספיק נתונים"
    if score >= 75:
        return "קנייה מומלצת מאוד"
    if score >= 60:
        return "כדאי לבחון לעומק"
    if score >= 45:
        return "ניטרלי - נדרשת בדיקה נוספת"
    return "לא מומלץ"
