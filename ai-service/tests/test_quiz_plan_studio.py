import json

import pytest

from .conftest import HEADERS, LESSONS, FakeLLM


def gen(client, **body):
    return client.post("/v1/quiz/generate", json={"courseId": "c1", **body}, headers=HEADERS)


class TestQuiz:
    def test_offline_questions_are_valid_and_verifiable_against_the_source(self, indexed):
        response = gen(indexed, count=5)
        body = response.json()
        assert response.status_code == 200 and body["generatedBy"] == "offline-cloze" and body["questions"]
        source = " ".join(l["text"] for l in LESSONS)
        for q in body["questions"]:
            assert 2 <= len(q["options"]) <= 6 and len(set(o.lower() for o in q["options"])) == len(q["options"])
            assert 0 <= q["answerIndex"] < len(q["options"])
            correct = q["options"][q["answerIndex"]]
            assert correct.lower() in q["explanation"].lower(), "the answer must be a word from the explanation sentence"
            assert q["explanation"] in source
            assert q["prompt"].count("______") >= 1 and correct.lower() not in q["prompt"].lower().replace("fill in the blank:", "")

    def test_generation_is_deterministic(self, indexed):
        assert gen(indexed, count=4).json() == gen(indexed, count=4).json()

    def test_lesson_scope_and_topic(self, indexed):
        body = gen(indexed, lessonId="l3", count=3).json()
        assert body["questions"] and all(q["topic"] == "SQL" for q in body["questions"])

    def test_count_is_respected_and_bounded(self, indexed):
        assert len(gen(indexed, count=2).json()["questions"]) <= 2
        assert gen(indexed, count=50).status_code == 422

    def test_unindexed_course_is_a_clear_404(self, client):
        response = client.post("/v1/quiz/generate", json={"courseId": "missing"}, headers=HEADERS)
        assert response.status_code == 404 and "indexed" in response.json()["detail"]

    def test_llm_questions_are_validated_and_bad_ones_dropped(self, make_client):
        reply = json.dumps({"questions": [
            {"prompt": "Which property means all or nothing?", "options": ["Atomicity", "Durability", "Isolation", "Consistency"], "answerIndex": 0, "explanation": "Atomicity.", "topic": "Transactions"},
            {"prompt": "Duplicate options here?", "options": ["a", "A", "b"], "answerIndex": 0},
            {"prompt": "Index out of range for this?", "options": ["x", "y"], "answerIndex": 7},
            {"prompt": "x", "options": ["x", "y"], "answerIndex": 0},
            "garbage",
        ]})
        llm = FakeLLM(reply)
        body = gen(make_client(llm), count=5).json()
        assert body["generatedBy"] == "fake:model" and len(body["questions"]) == 5
        assert llm.calls[0]["json_mode"] is True

    def test_short_llm_output_is_filled_to_requested_count(self, make_client):
        reply = json.dumps({"questions": [{
            "prompt": "Which property means all or nothing?",
            "options": ["Atomicity", "Durability", "Isolation", "Consistency"],
            "answerIndex": 0,
            "explanation": "Atomicity is all or nothing.",
            "topic": "Transactions",
        }]})
        body = gen(make_client(FakeLLM(reply)), count=4).json()
        assert body["generatedBy"] == "fake:model"
        assert len(body["questions"]) == 4

    @pytest.mark.parametrize("reply", ["not json at all", "{}", "[]", '{"questions": "nope"}'])
    def test_unusable_llm_output_falls_back_to_offline_generation(self, make_client, reply):
        body = gen(make_client(FakeLLM(reply)), count=3).json()
        assert body["generatedBy"] == "offline-cloze" and body["questions"]


def lessons():
    return [
        {"id": "a", "title": "Intro", "order": 1, "topics": ["Basics"]},
        {"id": "b", "title": "Indexes", "order": 2, "topics": ["Indexing"]},
        {"id": "c", "title": "Transactions", "order": 3, "topics": ["Transactions"]},
        {"id": "d", "title": "Locking", "order": 4, "topics": ["Concurrency"]},
        {"id": "e", "title": "Recovery", "order": 5, "topics": ["Recovery"]},
    ]


def plan(client, **overrides):
    body = {"courseId": "c1", "courseTitle": "DB", "weeklyHours": 6, "lessons": lessons(), "completedLessonIds": [], "mastery": [], **overrides}
    response = client.post("/v1/plan", json=body, headers=HEADERS)
    assert response.status_code == 200, response.text
    return response.json()


class TestPlanner:
    def test_new_student_just_advances(self, client):
        body = plan(client)
        assert [i["type"] for i in body["items"]] == ["advance"] * 3
        assert body["items"][0]["lessonId"] == "a" and body["generatedBy"] == "rules"

    def test_weak_topics_come_first_and_cite_the_evidence(self, client):
        body = plan(client, completedLessonIds=["a", "b", "c"], mastery=[
            {"topic": "Indexing", "score": 0.25, "attempts": 4},
            {"topic": "Transactions", "score": 0.9, "attempts": 5},
        ])
        first = body["items"][0]
        assert first["type"] == "revisit" and first["lessonId"] == "b" and "25%" in first["reason"] and "4" in first["reason"]
        assert "Indexing" in body["summary"] and "Locking" in body["summary"]
        assert all(i["lessonId"] != "c" for i in body["items"] if i["type"] == "revisit"), "strong topics are not revisited"

    def test_more_urgent_topics_rank_higher(self, client):
        body = plan(client, completedLessonIds=["a", "b", "c"], weeklyHours=20, mastery=[
            {"topic": "Indexing", "score": 0.5, "attempts": 2},
            {"topic": "Transactions", "score": 0.1, "attempts": 2},
        ])
        revisits = [i for i in body["items"] if i["type"] == "revisit"]
        assert [r["topic"] for r in revisits] == ["Transactions", "Indexing"]

    def test_unassessed_completed_topics_get_a_practice_item(self, client):
        body = plan(client, completedLessonIds=["a"], mastery=[])
        assert any(i["type"] == "practice" and i["topic"] == "Basics" for i in body["items"])

    def test_time_budget_is_respected_but_never_empty(self, client):
        tight = plan(client, weeklyHours=1, completedLessonIds=["a", "b", "c"], mastery=[
            {"topic": "Indexing", "score": 0.2, "attempts": 3}, {"topic": "Transactions", "score": 0.2, "attempts": 3}])
        assert sum(i["minutes"] for i in tight["items"]) <= 60 and tight["items"]
        assert plan(client, weeklyHours=1)["items"], "even a tiny budget keeps the single most important item"

    def test_completed_course_with_strong_mastery_has_a_closing_summary(self, client):
        body = plan(client, completedLessonIds=[l["id"] for l in lessons()], mastery=[{"topic": "Indexing", "score": 0.95, "attempts": 5}])
        assert body["items"] == [] or all(i["type"] != "advance" for i in body["items"])
        assert "completed every lesson" in body["summary"]

    def test_llm_only_rephrases_the_summary(self, make_client):
        client = make_client(FakeLLM("Nice work! Focus on Indexing, then move on."))
        body = plan(client, completedLessonIds=["a", "b"], mastery=[{"topic": "Indexing", "score": 0.3, "attempts": 3}])
        assert body["generatedBy"] == "llm" and body["summary"].startswith("Nice work")
        assert body["items"][0]["type"] == "revisit", "item selection stays rule-based"

    def test_llm_failure_keeps_the_rule_based_summary(self, make_client):
        from app.services.llm import LLMError
        body = plan(make_client(FakeLLM(error=LLMError("x"))))
        assert body["generatedBy"] == "rules" and "minutes" in body["summary"]

    def test_input_limits(self, client):
        bad = client.post("/v1/plan", json={"courseId": "c1", "weeklyHours": 500, "lessons": []}, headers=HEADERS)
        assert bad.status_code == 422


class TestStudio:
    def outline(self, client, titles):
        items = [{"id": f"id{i}", "title": t, "description": ""} for i, t in enumerate(titles)]
        response = client.post("/v1/studio/outline", json={"title": "Course", "items": items}, headers=HEADERS)
        assert response.status_code == 200, response.text
        return response.json()

    def test_explicit_week_markers_define_modules(self, client):
        body = self.outline(client, ["Week 1: Intro to Python", "Week 1: Variables", "Week 2: Functions", "Week 2: Recursion"])
        assert [m["name"] for m in body["modules"]] == ["Week 1", "Week 2"]
        assert [len(m["lessonIds"]) for m in body["modules"]] == [2, 2]

    def test_unmarked_playlists_are_grouped_contiguously_in_parts_of_about_six(self, client):
        titles = [f"Lecture on topic{i} fundamentals" for i in range(14)]
        body = self.outline(client, titles)
        assert 2 <= len(body["modules"]) <= 3 and all(len(m["lessonIds"]) <= 6 for m in body["modules"])
        flattened = [i for m in body["modules"] for i in m["lessonIds"]]
        assert flattened == [f"id{i}" for i in range(14)], "order is preserved"

    def test_topics_are_specific_keywords_not_course_wide_words(self, client):
        body = self.outline(client, ["Database Systems: Normalization", "Database Systems: Indexing", "Database Systems: Transactions", "Database Systems: Recovery"])
        for lesson in body["lessons"]:
            assert lesson["topics"] and "Database" not in lesson["topics"]
        assert {t for l in body["lessons"] for t in l["topics"]} >= {"Normalization", "Indexing"}
