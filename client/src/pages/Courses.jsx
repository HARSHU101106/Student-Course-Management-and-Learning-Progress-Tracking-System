import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import CourseCard from "../components/CourseCard.jsx";
import { EmptyState, ErrorBanner, PageHeader, Pagination, Spinner } from "../components/ui.jsx";
import { useAsync, useDebounced, useDocumentTitle } from "../hooks.js";
import { get } from "../lib/api.js";

export default function Courses() {
  useDocumentTitle("Courses");
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const category = params.get("category") ?? "";
  const level = params.get("level") ?? "";
  const sort = params.get("sort") ?? "newest";
  const page = Number(params.get("page") ?? 1) || 1;

  const [search, setSearch] = useState(q);
  const debounced = useDebounced(search, 300);

  // Changing any filter resets to the first page (an empty page value removes the param).
  const update = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries({ page: "", ...changes }).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
    setParams(next, { replace: true });
  };

  useEffect(() => {
    if (debounced !== q) update({ q: debounced });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  const { data, loading, error, reload } = useAsync(
    () => get("/courses", { q: q || undefined, category: category || undefined, level: level || undefined, sort, page, limit: 9 }),
    [q, category, level, sort, page],
  );
  const courses = data?.data ?? [];
  const meta = data?.meta;

  return (
    <>
      <PageHeader title="Courses" subtitle="Find a course and start learning." />
      <form className="filters card" role="search" onSubmit={(e) => e.preventDefault()}>
        <div className="field">
          <label htmlFor="course-search">Search</label>
          <input id="course-search" type="search" placeholder="Title, topic or tag" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="course-category">Category</label>
          <select id="course-category" value={category} onChange={(e) => update({ category: e.target.value })}>
            <option value="">All categories</option>
            {(meta?.categories ?? []).map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="course-level">Level</label>
          <select id="course-level" value={level} onChange={(e) => update({ level: e.target.value })}>
            <option value="">Any level</option>
            {["Beginner", "Intermediate", "Advanced"].map((name) => <option key={name}>{name}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="course-sort">Sort by</label>
          <select id="course-sort" value={sort} onChange={(e) => update({ sort: e.target.value })}>
            <option value="newest">Newest</option>
            <option value="title">Title</option>
            <option value="duration">Shortest first</option>
          </select>
        </div>
      </form>

      <ErrorBanner error={error} onRetry={reload} />
      {loading && !data ? <Spinner label="Loading courses" /> : courses.length === 0 && !error ? (
        <EmptyState title="No courses match your search">Try a different keyword or clear the filters.</EmptyState>
      ) : (
        <div className="grid grid-3" aria-busy={loading}>
          {courses.map((course) => <CourseCard key={course.id} course={course} />)}
        </div>
      )}
      <Pagination meta={meta} onPage={(next) => update({ page: String(next) })} />
    </>
  );
}
