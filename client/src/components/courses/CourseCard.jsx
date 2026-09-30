export default function CourseCard({ course, index = 0 }) {
  const imported = Boolean(course.playlistId);
  return (
    <article className={`course-card accent-${course.accent || "cyan"}`}>
      <div className="course-art">
        <span>{String(index + 1).padStart(2, "0")}</span>
        <strong>{course.category || "Course"}</strong>
        <i>{imported ? "▶" : "•"}</i>
      </div>
      <div className="course-body">
        <div className="course-meta">
          <span>{course.level || "All levels"}</span>
          <span>{course.duration || "Self-paced"}</span>
          <span>{course.items?.length || course.lessons || 0} lessons</span>
          {imported && <span>Imported from YouTube</span>}
        </div>
        <h2>{course.title}</h2>
        <p>{course.description}</p>
        <div className="course-footer">
          {imported ? (
            <a
              className="button button-primary button-small"
              href={`#/course/${course.id}`}
            >
              View learning path <span aria-hidden="true">→</span>
            </a>
          ) : (
            <span className="muted-label">Awaiting published content</span>
          )}
        </div>
      </div>
    </article>
  );
}
