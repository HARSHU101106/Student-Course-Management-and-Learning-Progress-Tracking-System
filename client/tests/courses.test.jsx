import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import * as apiModule from "../src/lib/api.js";
import Courses from "../src/pages/Courses.jsx";

const page = (data, meta = { page: 1, pages: 1, total: data.length, categories: ["Computer Science"] }) => ({ data: { data, meta } });
const course = (n) => ({ id: `c${n}`, slug: `course-${n}`, title: `Course ${n}`, description: "d", category: "Computer Science", level: "Beginner", duration: 4, lessonCount: 3, status: "published" });

describe("Courses page", () => {
  it("sends search and filter values to the API and resets paging", async () => {
    const get = vi.spyOn(apiModule.api, "get").mockResolvedValue(page([course(1)]));
    render(<MemoryRouter initialEntries={["/courses?page=3"]}><Courses /></MemoryRouter>);
    await screen.findByText("Course 1");

    await userEvent.type(screen.getByLabelText("Search"), "database");
    await waitFor(() => expect(get).toHaveBeenLastCalledWith("/courses", { params: expect.objectContaining({ q: "database", page: 1 }) }));

    await userEvent.selectOptions(screen.getByLabelText("Level"), "Advanced");
    await waitFor(() => expect(get).toHaveBeenLastCalledWith("/courses", { params: expect.objectContaining({ q: "database", level: "Advanced", page: 1 }) }));
  });

  it("shows an empty state, and a retry button after a network failure", async () => {
    const get = vi.spyOn(apiModule.api, "get").mockResolvedValueOnce(page([])).mockRejectedValueOnce(apiModule.toApiError({ message: "Network Error" })).mockResolvedValue(page([course(2)]));
    render(<MemoryRouter><Courses /></MemoryRouter>);
    expect(await screen.findByText("No courses match your search")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Search"), "x");
    expect(await screen.findByText(/cannot reach the server/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Course 2")).toBeInTheDocument();
    expect(get).toHaveBeenCalledTimes(3);
  });
});
