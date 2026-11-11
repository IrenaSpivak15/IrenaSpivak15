"""Loading complaint data and the analysis functions the agent calls as tools.

Everything here is plain Python (no API calls), so it can be tested offline.
"""

from __future__ import annotations

import csv
import json
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from pathlib import Path

# Columns the agent can group or filter by.
DIMENSIONS = [
    "product_line",
    "product",
    "channel",
    "category",
    "customer_segment",
    "age_group",
    "severity",
    "status",
]

REQUIRED_COLUMNS = {"id", "text", "product_line", "category"}


@dataclass
class ComplaintStore:
    complaints: list[dict]
    catalog: list[dict] = field(default_factory=list)

    @classmethod
    def from_files(cls, complaints_csv: str | Path, catalog_json: str | Path | None = None) -> "ComplaintStore":
        with open(complaints_csv, encoding="utf-8-sig", newline="") as f:
            rows = list(csv.DictReader(f))
        if not rows:
            raise ValueError(f"No complaints found in {complaints_csv}")
        missing = REQUIRED_COLUMNS - set(rows[0].keys())
        if missing:
            raise ValueError(f"Complaints file is missing required columns: {sorted(missing)}")
        catalog: list[dict] = []
        if catalog_json and Path(catalog_json).exists():
            with open(catalog_json, encoding="utf-8") as f:
                catalog = json.load(f)
        return cls(complaints=rows, catalog=catalog)

    # ------------------------------------------------------------------ tools

    def overview(self) -> dict:
        """Totals and distributions over every dimension."""
        out: dict = {"total_complaints": len(self.complaints)}
        dates = sorted(c["date"] for c in self.complaints if c.get("date"))
        if dates:
            out["date_range"] = {"from": dates[0], "to": dates[-1]}
        for dim in DIMENSIONS:
            values = [c.get(dim) for c in self.complaints if c.get(dim)]
            if values:
                out[dim] = dict(Counter(values).most_common())
        comp = [_to_float(c.get("compensation_ils")) for c in self.complaints]
        out["total_compensation_ils"] = sum(comp)
        return out

    def crosstab(self, row_dimension: str, column_dimension: str) -> dict:
        """Count complaints for each pair of values of two dimensions."""
        for d in (row_dimension, column_dimension):
            if d not in DIMENSIONS:
                raise ValueError(f"Unknown dimension '{d}'. Valid: {DIMENSIONS}")
        table: dict[str, Counter] = defaultdict(Counter)
        for c in self.complaints:
            table[c.get(row_dimension) or "?"][c.get(column_dimension) or "?"] += 1
        return {
            "rows": row_dimension,
            "columns": column_dimension,
            "table": {r: dict(cnt.most_common()) for r, cnt in sorted(table.items(), key=lambda kv: -sum(kv[1].values()))},
        }

    def monthly_trend(self, filters: dict | None = None) -> dict:
        """Complaints per month (YYYY-MM), optionally restricted by exact-match filters."""
        rows = self._filter(filters or {})
        counts = Counter((c.get("date") or "")[:7] for c in rows if c.get("date"))
        return {"filter": filters or None, "per_month": dict(sorted(counts.items()))}

    def search(self, keywords: list[str] | None = None, filters: dict | None = None, limit: int = 25) -> dict:
        """Full complaint records matching ANY keyword in the text and ALL filters."""
        rows = self._filter(filters or {})
        if keywords:
            kws = [k.lower() for k in keywords if k.strip()]
            rows = [c for c in rows if any(k in c["text"].lower() for k in kws)]
        return {
            "match_count": len(rows),
            "returned": min(len(rows), limit),
            "complaints": [_compact(c) for c in rows[:limit]],
        }

    def product_catalog(self) -> dict:
        return {"products": self.catalog or "No product catalog was provided."}

    # ---------------------------------------------------------------- helpers

    def _filter(self, filters: dict) -> list[dict]:
        rows = self.complaints
        for key, val in filters.items():
            if key not in DIMENSIONS:
                raise ValueError(f"Unknown filter '{key}'. Valid: {DIMENSIONS}")
            rows = [c for c in rows if (c.get(key) or "") == val]
        return rows


def _to_float(v) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def _compact(c: dict) -> dict:
    keep = ["id", "date", "product_line", "product", "category", "customer_segment", "age_group", "severity", "status", "text"]
    return {k: c[k] for k in keep if c.get(k)}
