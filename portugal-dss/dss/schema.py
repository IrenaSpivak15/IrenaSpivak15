"""Expected dataset schema for Portuguese property listings and cleaning helpers."""
from __future__ import annotations

import pandas as pd

REQUIRED_COLUMNS = [
    "Price",
    "District",
    "City",
    "Town",
    "Type",
    "EnergyCertificate",
    "GrossPrivateArea",
    "UsableArea",
    "LivingArea",
    "LotSize",
    "BuiltArea",
    "Rooms",
    "Bedrooms",
    "Bathrooms",
    "WCs",
    "Floor",
    "Parking",
    "Garage",
    "Elevator",
    "ElectricCarCharging",
    "ConstructionYear",
    "PublishDate",
]

NUMERIC_COLUMNS = [
    "Price",
    "GrossPrivateArea",
    "UsableArea",
    "LivingArea",
    "LotSize",
    "BuiltArea",
    "Rooms",
    "Bedrooms",
    "Bathrooms",
    "WCs",
    "ConstructionYear",
]

BOOLISH_COLUMNS = ["Parking", "Garage", "Elevator", "ElectricCarCharging"]

ENERGY_ORDER = ["A+", "A", "B+", "B", "B-", "C", "D", "E", "F", "G", "Isento", "N/D"]


def ensure_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Add any missing expected columns as empty/NaN so downstream code is safe."""
    df = df.copy()
    for col in REQUIRED_COLUMNS:
        if col not in df.columns:
            df[col] = pd.NA
    return df


def _to_bool(series: pd.Series) -> pd.Series:
    truthy = {"1", "true", "yes", "sim", "y", "s", "כן"}
    falsy = {"0", "false", "no", "não", "nao", "n", "לא", ""}

    def conv(v):
        if isinstance(v, bool):
            return v
        if pd.isna(v):
            return False
        s = str(v).strip().lower()
        if s in truthy:
            return True
        if s in falsy:
            return False
        try:
            return float(s) > 0
        except ValueError:
            return False

    return series.apply(conv)


def clean(df: pd.DataFrame) -> pd.DataFrame:
    """Normalize types, coerce numerics, fill sensible defaults."""
    df = ensure_columns(df)

    for col in NUMERIC_COLUMNS:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    for col in BOOLISH_COLUMNS:
        df[col] = _to_bool(df[col])

    for col in ["District", "City", "Town", "Type", "EnergyCertificate"]:
        df[col] = df[col].astype(str).str.strip()
        df.loc[df[col].isin(["nan", "None", ""]), col] = "לא ידוע"

    df["EnergyCertificate"] = df["EnergyCertificate"].str.upper().replace(
        {"ISENTO": "Isento", "N/A": "N/D", "NAN": "N/D"}
    )

    df["PublishDate"] = pd.to_datetime(df["PublishDate"], errors="coerce")

    # Best-available livable area, in priority order.
    area_priority = ["LivingArea", "UsableArea", "GrossPrivateArea", "BuiltArea"]
    df["EffectiveArea"] = pd.NA
    for col in area_priority:
        df["EffectiveArea"] = df["EffectiveArea"].fillna(df[col])
    df["EffectiveArea"] = pd.to_numeric(df["EffectiveArea"], errors="coerce")

    df = df[df["Price"].notna() & (df["Price"] > 0)].copy()

    df["PricePerSqm"] = df["Price"] / df["EffectiveArea"].replace({0: float("nan")})

    return df.reset_index(drop=True)
