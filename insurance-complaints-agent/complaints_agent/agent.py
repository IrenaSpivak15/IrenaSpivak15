"""Insurance complaints analysis agent.

Claude explores the complaint data through tools (overview, cross-tabs, trends,
keyword search, product catalog), identifies unmet customer needs, and submits a
structured report with new-product recommendations via the `submit_report` tool.
"""

from __future__ import annotations

import json
from typing import Callable

import anthropic

from .data import DIMENSIONS, ComplaintStore

MODEL = "claude-opus-5-5"
MAX_TURNS = 30

SYSTEM_PROMPT = """\
You are a senior product strategist at an Israeli insurance company. Your job is to
analyze customer complaints and turn them into concrete recommendations for NEW
insurance products (or major new product extensions) that the company should build.

How to work:
- Start with the overview, then dig in: cross-tabulate dimensions, look at monthly
  trends, and read the actual complaint texts with search. Base every claim on data
  you have actually seen through the tools; cite complaint IDs as evidence.
- Separate two kinds of findings: (1) service/operational problems that a new product
  will not fix (e.g. slow claims handling) and (2) product gaps - needs that no current
  product covers, or that the pricing model does not fit. Recommendations focus on (2),
  but operational issues belong in the report too.
- Check the product catalog so you do not recommend something that already exists.
- For each recommended product describe: the target segment, the need it answers,
  key coverages, pricing model, supporting evidence (complaint IDs and counts),
  estimated demand signal, risks/regulatory considerations, and a priority.
- Prefer a few well-supported recommendations over many weak ones. Say plainly when
  the evidence is thin.

Write all report content in Hebrew. When the analysis is complete, call the
`submit_report` tool exactly once with the full report; that ends the task.
"""

_FILTERS_SCHEMA = {
    "type": "array",
    "description": "Exact-match filters, combined with AND. Use an empty array for no filter.",
    "items": {
        "type": "object",
        "properties": {
            "dimension": {"type": "string", "enum": DIMENSIONS},
            "value": {"type": "string"},
        },
        "required": ["dimension", "value"],
        "additionalProperties": False,
    },
}

_STR_LIST = {"type": "array", "items": {"type": "string"}}

TOOLS = [
    {
        "name": "get_overview",
        "description": "Total complaint count, date range, total compensation paid, and the distribution of complaints over every dimension "
        f"({', '.join(DIMENSIONS)}). Call this first.",
        "strict": True,
        "input_schema": {"type": "object", "properties": {}, "required": [], "additionalProperties": False},
    },
    {
        "name": "crosstab",
        "description": "Count complaints for each combination of two dimensions, e.g. product_line x category, to find where problems concentrate.",
        "strict": True,
        "input_schema": {
            "type": "object",
            "properties": {
                "row_dimension": {"type": "string", "enum": DIMENSIONS},
                "column_dimension": {"type": "string", "enum": DIMENSIONS},
            },
            "required": ["row_dimension", "column_dimension"],
            "additionalProperties": False,
        },
    },
    {
        "name": "monthly_trend",
        "description": "Complaints per month (YYYY-MM), optionally filtered, to see whether an issue is growing.",
        "strict": True,
        "input_schema": {
            "type": "object",
            "properties": {"filters": _FILTERS_SCHEMA},
            "required": ["filters"],
            "additionalProperties": False,
        },
    },
    {
        "name": "search_complaints",
        "description": "Return full complaint records (including the free text). Matches complaints whose text contains ANY of the keywords "
        "(case-insensitive substring; Hebrew works) AND all filters. Empty keywords means no text filter.",
        "strict": True,
        "input_schema": {
            "type": "object",
            "properties": {
                "keywords": _STR_LIST,
                "filters": _FILTERS_SCHEMA,
                "limit": {"type": "integer", "description": "Max records to return (1-100)."},
            },
            "required": ["keywords", "filters", "limit"],
            "additionalProperties": False,
        },
    },
    {
        "name": "get_product_catalog",
        "description": "The company's current products and what they cover/exclude. Use it to check that a recommendation is genuinely new.",
        "strict": True,
        "input_schema": {"type": "object", "properties": {}, "required": [], "additionalProperties": False},
    },
    {
        "name": "submit_report",
        "description": "Submit the final analysis report. Call exactly once, when the analysis is complete. All text in Hebrew.",
        "strict": True,
        "input_schema": {
            "type": "object",
            "properties": {
                "executive_summary": {"type": "string"},
                "key_findings": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "title": {"type": "string"},
                            "details": {"type": "string"},
                            "complaint_count": {"type": "integer"},
                            "evidence_ids": _STR_LIST,
                            "kind": {"type": "string", "enum": ["product_gap", "pricing_gap", "service_issue", "digital_experience"]},
                        },
                        "required": ["title", "details", "complaint_count", "evidence_ids", "kind"],
                        "additionalProperties": False,
                    },
                },
                "product_recommendations": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string"},
                            "product_line": {"type": "string"},
                            "priority": {"type": "string", "enum": ["high", "medium", "low"]},
                            "target_segment": {"type": "string"},
                            "customer_need": {"type": "string"},
                            "key_coverages": _STR_LIST,
                            "pricing_model": {"type": "string"},
                            "evidence_ids": _STR_LIST,
                            "demand_signal": {"type": "string"},
                            "risks_and_regulation": {"type": "string"},
                            "next_steps": _STR_LIST,
                        },
                        "required": [
                            "name", "product_line", "priority", "target_segment", "customer_need", "key_coverages",
                            "pricing_model", "evidence_ids", "demand_signal", "risks_and_regulation", "next_steps",
                        ],
                        "additionalProperties": False,
                    },
                },
                "operational_recommendations": _STR_LIST,
                "data_limitations": {"type": "string"},
            },
            "required": [
                "executive_summary", "key_findings", "product_recommendations",
                "operational_recommendations", "data_limitations",
            ],
            "additionalProperties": False,
        },
    },
]


def _filters_to_dict(filters: list[dict]) -> dict:
    return {f["dimension"]: f["value"] for f in filters or []}


def run_tool(store: ComplaintStore, name: str, args: dict) -> dict:
    """Execute a data tool. Raises on bad input; the caller turns that into an is_error result."""
    if name == "get_overview":
        return store.overview()
    if name == "crosstab":
        return store.crosstab(args["row_dimension"], args["column_dimension"])
    if name == "monthly_trend":
        return store.monthly_trend(_filters_to_dict(args.get("filters", [])))
    if name == "search_complaints":
        limit = max(1, min(int(args.get("limit", 25)), 100))
        return store.search(args.get("keywords"), _filters_to_dict(args.get("filters", [])), limit)
    if name == "get_product_catalog":
        return store.product_catalog()
    raise ValueError(f"Unknown tool: {name}")


class AgentError(RuntimeError):
    pass


def run_agent(
    store: ComplaintStore,
    question: str | None = None,
    *,
    client: anthropic.Anthropic | None = None,
    model: str = MODEL,
    effort: str = "high",
    on_event: Callable[[str], None] = lambda _msg: None,
) -> dict:
    """Run the agent loop until Claude submits its report. Returns the report dict."""
    client = client or anthropic.Anthropic()
    task = question or "Analyze all complaints and recommend new insurance products the company should develop."
    messages: list = [{"role": "user", "content": task}]

    for turn in range(1, MAX_TURNS + 1):
        response = client.beta.messages.create(
            model=model,
            max_tokens=16000,
            system=SYSTEM_PROMPT,
            tools=TOOLS,
            messages=messages,
            thinking={"type": "adaptive"},
            output_config={"effort": effort},
            # On a safety-classifier decline, the API retries on Anthropic's recommended fallback model.
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
        )

        if response.stop_reason == "refusal":
            details = getattr(response, "stop_details", None)
            raise AgentError(f"Request declined by the model (category: {getattr(details, 'category', None)}).")
        if response.stop_reason == "max_tokens":
            raise AgentError("Response hit max_tokens before completing; try a smaller dataset or lower effort.")

        # Append the full content (thinking + tool_use blocks), unchanged.
        messages.append({"role": "assistant", "content": response.content})

        if response.stop_reason == "pause_turn":
            continue

        tool_uses = [b for b in response.content if b.type == "tool_use"]
        if not tool_uses:
            # Model ended without submitting; nudge it once per turn.
            messages.append({"role": "user", "content": "Please finish by calling the submit_report tool with the full report."})
            continue

        results = []
        for block in tool_uses:
            if block.name == "submit_report":
                on_event(f"[turn {turn}] report submitted")
                return block.input
            on_event(f"[turn {turn}] {block.name}({json.dumps(block.input, ensure_ascii=False)})")
            try:
                content = json.dumps(run_tool(store, block.name, block.input), ensure_ascii=False)
                results.append({"type": "tool_result", "tool_use_id": block.id, "content": content})
            except Exception as e:  # report tool errors back to the model so it can correct itself
                results.append({"type": "tool_result", "tool_use_id": block.id, "content": f"Error: {e}", "is_error": True})
        messages.append({"role": "user", "content": results})

    raise AgentError(f"Agent did not submit a report within {MAX_TURNS} turns.")
