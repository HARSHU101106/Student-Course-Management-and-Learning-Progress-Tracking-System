import { Link } from "react-router-dom";
import { pluralize } from "../lib/format.js";
import { Badge } from "./ui.jsx";

const STATUS_LABEL = { active: "Enrolled", completed: "Completed" };

export default function CourseCard({ course }) {
  const status = course.enrollmentStatus;
  return (
    <article className="card course-card">
      <div className="card-badges">
        <Badge>{course.category}</Badge>
        <Badge tone="muted">{course.level}</Badge>
        {course.status === "draft" && <Badge tone="warning">Draft</Badge>}
        {STATUS_LABEL[status] && <Badge tone="success">{STATUS_LABEL[status]}</Badge>}
      </div>
      <h3><Link to={`/courses/${course.slug}`}>{course.title}</Link></h3>
      <p className="muted clamp">{course.description}</p>
      <p className="card-meta">
        {pluralize(course.duration, "week")} · {pluralize(course.lessonCount, "lesson")}
        {course.instructor ? ` · ${course.instructor}` : ""}
      </p>
    </article>
  );
}
