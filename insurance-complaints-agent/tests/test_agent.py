"""Offline tests: data tools, report rendering, and the agent loop with a fake client."""

import unittest
from pathlib import Path
from types import SimpleNamespace as NS

from complaints_agent.agent import TOOLS, run_agent, run_tool
from complaints_agent.data import ComplaintStore
from complaints_agent.report import to_markdown

DATA = Path(__file__).resolve().parent.parent / "data"

SAMPLE_REPORT = {
    "executive_summary": "סיכום",
    "key_findings": [{"title": "רכב חשמלי", "details": "אין כיסוי סוללה", "complaint_count": 2,
                      "evidence_ids": ["C002", "C003"], "kind": "product_gap"}],
    "product_recommendations": [{
        "name": "מגן EV", "product_line": "רכב", "priority": "high", "target_segment": "בעלי רכב חשמלי",
        "customer_need": "כיסוי סוללה", "key_coverages": ["סוללה", "עמדת טעינה"], "pricing_model": "חודשי",
        "evidence_ids": ["C002", "C003"], "demand_signal": "2 תלונות", "risks_and_regulation": "חיתום",
        "next_steps": ["פיילוט"],
    }],
    "operational_recommendations": ["לקצר זמני תביעה"],
    "data_limitations": "מדגם קטן",
}


def store():
    return ComplaintStore.from_files(DATA / "sample_complaints.csv", DATA / "product_catalog.json")


class DataToolsTest(unittest.TestCase):
    def test_overview(self):
        o = store().overview()
        self.assertEqual(o["total_complaints"], 40)
        self.assertIn("כיסוי חסר", o["category"])

    def test_search_keyword_and_filter(self):
        r = run_tool(store(), "search_complaints", {
            "keywords": ["סוללה"], "filters": [{"dimension": "product_line", "value": "רכב"}], "limit": 10})
        self.assertEqual({c["id"] for c in r["complaints"]}, {"C002", "C003"})

    def test_crosstab_and_trend(self):
        s = store()
        t = run_tool(s, "crosstab", {"row_dimension": "product_line", "column_dimension": "category"})
        self.assertIn("רכב", t["table"])
        m = run_tool(s, "monthly_trend", {"filters": []})
        self.assertEqual(sum(m["per_month"].values()), 40)

    def test_bad_dimension_raises(self):
        with self.assertRaises(ValueError):
            run_tool(store(), "crosstab", {"row_dimension": "nope", "column_dimension": "category"})

    def test_tool_schemas_are_strict(self):
        for t in TOOLS:
            self.assertTrue(t["strict"])
            self.assertFalse(t["input_schema"]["additionalProperties"])


class FakeMessages:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []

    def create(self, **kwargs):
        self.calls.append({**kwargs, "messages": list(kwargs["messages"])})
        return self.responses.pop(0)


def tool_use(id_, name, inp):
    return NS(type="tool_use", id=id_, name=name, input=inp)


class AgentLoopTest(unittest.TestCase):
    def test_loop_runs_tools_then_returns_report(self):
        msgs = FakeMessages([
            NS(stop_reason="tool_use", content=[tool_use("t1", "get_overview", {})]),
            NS(stop_reason="tool_use", content=[tool_use("t2", "crosstab", {"row_dimension": "bad", "column_dimension": "category"})]),
            NS(stop_reason="tool_use", content=[tool_use("t3", "submit_report", SAMPLE_REPORT)]),
        ])
        client = NS(beta=NS(messages=msgs))
        report = run_agent(store(), client=client)
        self.assertEqual(report, SAMPLE_REPORT)
        self.assertEqual(len(msgs.calls), 3)
        # error from the bad crosstab was returned to the model as is_error
        last_user = msgs.calls[2]["messages"][-1]["content"][0]
        self.assertTrue(last_user["is_error"])
        self.assertEqual(msgs.calls[0]["fallbacks"], "default")

    def test_refusal_raises(self):
        from complaints_agent.agent import AgentError
        client = NS(beta=NS(messages=FakeMessages([NS(stop_reason="refusal", content=[], stop_details=NS(category=None))])))
        with self.assertRaises(AgentError):
            run_agent(store(), client=client)


class ReportTest(unittest.TestCase):
    def test_markdown(self):
        md = to_markdown(SAMPLE_REPORT)
        self.assertIn("מגן EV", md)
        self.assertIn("גבוהה", md)
        self.assertIn('dir="rtl"', md)


if __name__ == "__main__":
    unittest.main()
