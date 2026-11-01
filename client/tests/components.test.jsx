import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import TutorPanel from "../src/components/TutorPanel.jsx";
import { Pagination, ProgressBar } from "../src/components/ui.jsx";
import * as apiModule from "../src/lib/api.js";
import Quiz from "../src/pages/Quiz.jsx";

describe("ui kit", () => {
  it("clamps progress values and exposes them to assistive tech", () => {
    render(<ProgressBar value={140} label="Course" />);
    expect(screen.getByRole("progressbar", { name: "Course" })).toHaveAttribute("aria-valuenow", "100");
  });

  it("renders no pagination for a single page and wires the buttons otherwise", async () => {
    const { container, rerender } = render(<Pagination meta={{ page: 1, pages: 1 }} onPage={() => {}} />);
    expect(container).toBeEmptyDOMElement();
    const onPage = vi.fn();
    rerender(<Pagination meta={{ page: 2, pages: 3 }} onPage={onPage} />);
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(screen.getByRole("button", { name: "Previous" }));
    expect(onPage).toHaveBeenNthCalledWith(1, 3);
    expect(onPage).toHaveBeenNthCalledWith(2, 1);
  });
});

describe("TutorPanel", () => {
  const renderPanel = () => render(<MemoryRouter><TutorPanel courseId="c1" lessonId="l1" /></MemoryRouter>);

  it("shows a grounded answer with its sources and sends recent history", async () => {
    const post = vi.spyOn(apiModule.api, "post").mockResolvedValue({
      data: { data: { answer: "Leaves are linked. [1]", grounded: true, refused: false, citations: [{ lessonId: "l9", title: "B+ trees on Disks", snippet: "Leaf nodes are linked" }], suggestions: [] } },
    });
    renderPanel();
    await userEvent.type(screen.getByLabelText("Your question"), "Why are leaves linked?");
    await userEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect(await screen.findByText("Leaves are linked. [1]")).toBeInTheDocument();
    expect(screen.getByText("From course material")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "B+ trees on Disks" })).toHaveAttribute("href", "/lessons/l9");
    expect(post).toHaveBeenCalledWith("/ai/tutor", { courseId: "c1", lessonId: "l1", question: "Why are leaves linked?", history: [] });
  });

  it("flags answers that are not in the course material", async () => {
    vi.spyOn(apiModule.api, "post").mockResolvedValue({ data: { data: { answer: "I couldn't find that.", grounded: false, refused: false, citations: [], suggestions: ["Hash Tables"] } } });
    renderPanel();
    await userEvent.type(screen.getByLabelText("Your question"), "What is a kernel?");
    await userEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect(await screen.findByText("Not in course material")).toBeInTheDocument();
    expect(screen.getByText(/Closest lessons: Hash Tables/)).toBeInTheDocument();
  });

  it("explains an unavailable AI service in plain language", async () => {
    vi.spyOn(apiModule.api, "post").mockRejectedValue(apiModule.toApiError({ response: { status: 503, data: { message: "The AI service is unreachable." } } }));
    renderPanel();
    await userEvent.type(screen.getByLabelText("Your question"), "Explain indexing");
    await userEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect(await screen.findByText(/AI tutor is not available/i)).toBeInTheDocument();
  });

  it("does not submit very short questions", () => {
    renderPanel();
    expect(screen.getByRole("button", { name: "Ask" })).toBeDisabled();
  });
});

describe("Quiz page", () => {
  const quiz = { id: "q1", course: "c1", title: "Check", questions: [
    { id: "a", prompt: "Pick b", options: ["a", "b"] },
    { id: "b", prompt: "Pick a", options: ["a", "b"] },
  ] };

  function renderQuiz() {
    vi.spyOn(apiModule.api, "get").mockResolvedValue({ data: { data: { quiz } } });
    return render(
      <MemoryRouter initialEntries={["/quizzes/q1"]}>
        <Routes><Route path="/quizzes/:id" element={<Quiz />} /></Routes>
      </MemoryRouter>,
    );
  }

  it("requires at least one answer, submits -1 for skipped questions and reveals the review afterwards", async () => {
    const post = vi.spyOn(apiModule.api, "post").mockResolvedValue({
      data: { data: {
        attempt: { id: "t1", score: 1, total: 2, percent: 50 },
        review: [
          { questionId: "a", prompt: "Pick b", options: ["a", "b"], selectedIndex: 1, correctIndex: 1, correct: true, explanation: "b is right" },
          { questionId: "b", prompt: "Pick a", options: ["a", "b"], selectedIndex: -1, correctIndex: 0, correct: false, explanation: "a is right" },
        ],
      } },
    });
    renderQuiz();
    const submit = await screen.findByRole("button", { name: "Submit answers" });
    expect(submit).toBeDisabled();
    await userEvent.click(screen.getAllByRole("radio")[1]);
    expect(submit).toBeEnabled();
    await userEvent.click(submit);

    expect(await screen.findByTestId("quiz-score")).toHaveTextContent("1 / 2");
    expect(post).toHaveBeenCalledWith("/quizzes/q1/attempts", { answers: [1, -1] });
    expect(screen.getByText("not answered")).toBeInTheDocument();
    expect(screen.getByText("b is right")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retake quiz" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Submit answers" })).toBeDisabled());
  });
});
