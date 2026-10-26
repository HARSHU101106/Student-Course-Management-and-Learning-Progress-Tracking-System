def build_planner_graph():
    """Create a lightweight planner graph definition for the adaptive study workflow.

    The project plan treats mastery calculation as deterministic code and the LLM as the
    explanation layer. This implementation keeps that separation explicit while providing
    useful default data for the API layer.
    """

    return {
        "nodes": [
            "load_signals",
            "compute_mastery",
            "select_items",
            "explain_plan",
            "validate_schema",
        ],
        "edges": [
            ("load_signals", "compute_mastery"),
            ("compute_mastery", "select_items"),
            ("select_items", "explain_plan"),
            ("explain_plan", "validate_schema"),
        ],
    }
