import { Link } from "react-router-dom";
import CourseCard from "../components/CourseCard.jsx";
import { Spinner } from "../components/ui.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useAsync, useDocumentTitle } from "../hooks.js";
import { get } from "../lib/api.js";

const FEATURES = [
  ["Learn from video", "Structured courses built on YouTube playlists, with notes for every lesson and progress that follows you across devices."],
  ["Ask the AI tutor", "Answers come only from your course material and cite the lesson they came from. If it is not in the course, the tutor says so."],
  ["Adaptive study plans", "Quizzes feed a mastery model, and your plan revisits weak topics before moving on, sized to the hours you have each week."],
  ["Live classroom", "Course chat rooms, direct messages with classmates and instant notifications when something changes."],
];

export default function Home() {
  useDocumentTitle("");
  const { user, isAdmin } = useAuth();
  const featured = useAsync(() => get("/courses", { limit: 3, sort: "newest" }), []);

  return (
    <>
      <section className="hero">
        <p className="eyebrow">Student course management and learning portal</p>
        <h1>Learning that adapts to what you actually know.</h1>
        <p className="lead">Watch lessons, test yourself, get a study plan that targets your weak spots, and ask an AI tutor that never makes things up.</p>
        <div className="hero-actions">
          {user ? (
            <Link className="btn btn-primary" to={isAdmin ? "/admin" : "/dashboard"}>Go to your {isAdmin ? "admin console" : "dashboard"}</Link>
          ) : (
            <>
              <Link className="btn btn-primary" to="/register">Create a free account</Link>
              <Link className="btn btn-secondary" to="/courses">Browse courses</Link>
            </>
          )}
        </div>
      </section>

      <section aria-labelledby="features-title">
        <h2 id="features-title" className="visually-hidden">Features</h2>
        <div className="grid grid-4">
          {FEATURES.map(([title, text]) => (
            <article className="card" key={title}>
              <h3>{title}</h3>
              <p className="muted">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="featured-title" className="section">
        <div className="section-head">
          <h2 id="featured-title">Newest courses</h2>
          <Link to="/courses">View all</Link>
        </div>
        {featured.loading ? <Spinner /> : (
          <div className="grid grid-3">
            {(featured.data?.data ?? []).map((course) => <CourseCard key={course.id} course={course} />)}
          </div>
        )}
      </section>
    </>
  );
}
