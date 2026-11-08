"""CLI: python -m complaints_agent --complaints data/sample_complaints.csv --out report.md"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import anthropic

from .agent import MODEL, AgentError, run_agent
from .data import ComplaintStore
from .report import to_markdown

DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="סוכן לניתוח תלונות ביטוח והמלצה על מוצרים חדשים")
    p.add_argument("--complaints", default=DATA_DIR / "sample_complaints.csv", help="CSV של תלונות")
    p.add_argument("--catalog", default=DATA_DIR / "product_catalog.json", help="JSON של קטלוג המוצרים הקיים")
    p.add_argument("--question", default=None, help="שאלה/מיקוד לניתוח (אופציונלי)")
    p.add_argument("--out", default="complaints_report.md", help="קובץ Markdown לפלט")
    p.add_argument("--json-out", default=None, help="שמירת הדוח המובנה גם כ-JSON")
    p.add_argument("--model", default=MODEL)
    p.add_argument("--effort", default="high", choices=["low", "medium", "high", "xhigh", "max"])
    args = p.parse_args(argv)

    store = ComplaintStore.from_files(args.complaints, args.catalog)
    print(f"נטענו {len(store.complaints)} תלונות. מתחיל ניתוח...", file=sys.stderr)

    try:
        report = run_agent(
            store, args.question, model=args.model, effort=args.effort,
            on_event=lambda m: print(m, file=sys.stderr),
        )
    except AgentError as e:
        print(f"שגיאה: {e}", file=sys.stderr)
        return 1
    except anthropic.AuthenticationError:
        print("שגיאת הזדהות: הגדירו ANTHROPIC_API_KEY.", file=sys.stderr)
        return 1
    except anthropic.RateLimitError:
        print("חריגה ממגבלת קצב. נסו שוב בעוד מספר דקות.", file=sys.stderr)
        return 1
    except anthropic.APIStatusError as e:
        print(f"שגיאת API ({e.status_code}): {e.message}", file=sys.stderr)
        return 1
    except anthropic.APIConnectionError:
        print("שגיאת רשת: לא ניתן להתחבר ל-API.", file=sys.stderr)
        return 1

    Path(args.out).write_text(to_markdown(report), encoding="utf-8")
    if args.json_out:
        Path(args.json_out).write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"הדוח נשמר: {args.out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
