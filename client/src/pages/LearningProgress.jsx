import { useEffect, useState } from "react";
import { studentApi } from "../api/student.api.js";

function ProgressUpdater({ item, onUpdate, disabled }) {
  const [completedLessons, setCompletedLessons] = useState(
    String(item.completedLessons),
  );

  const submit = (event) => {
    event.preventDefault();
    const completed = Number(completedLessons);
    if (
      !Number.isInteger(completed) ||
      completed < 0 ||
      completed > item.totalLessons
    ) {
      return;
    }
    onUpdate(item.course.id, completed, item.totalLessons);
  };

  return (
    <form className="progress-update-form" onSubmit={submit}>
      <label>
        Completed lessons
        <input
          type="number"
          min="0"
          max={item.totalLessons}
          step="1"
          required
          value={completedLessons}
          onChange={(event) => setCompletedLessons(event.target.value)}
        />
      </label>
      <button className="button button-secondary button-small" disabled={disabled}>
        Update progress
      </button>
    </form>
  );
}

export default function LearningProgress() {
  const [progress, setProgress] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingCourseId, setUpdatingCourseId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    studentApi
      .getMyProgress()
      .then((items) => {
        if (active) setProgress(items);
      })
      .catch((requestError) => {
        if (active) {
          setError(
            requestError.response?.data?.message ||
              "Unable to load learning progress.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const totalCourses = progress.length;
  const completedCourses = progress.filter(
    (item) => item.progressPercentage === 100,
  ).length;
  const averageProgress = totalCourses
    ? Math.round(
        progress.reduce((total, item) => total + item.progressPercentage, 0) /
          totalCourses,
      )
    : 0;

  const updateProgress = async (courseId, completedLessons, totalLessons) => {
    setError("");
    setNotice("");
    setUpdatingCourseId(courseId);
    try {
      const updated = await studentApi.updateProgress(
        courseId,
        completedLessons,
        totalLessons,
      );
      setProgress((current) =>
        current.map((item) =>
          item.course.id === courseId
            ? {
                ...item,
                ...updated,
                course: item.course,
                status:
                  updated.progressPercentage === 100 ? "completed" : "active",
              }
            : item,
        ),
      );
      setNotice("Learning progress updated successfully.");
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to update learning progress.",
      );
    } finally {
      setUpdatingCourseId("");
    }
  };

  return (
    <div className="page-width page-section">
      <div className="page-intro">
        <div>
          <span className="eyebrow">Your learning space</span>
          <h1>My learning progress</h1>
          <p>Track completed lessons and keep your learning goals in view.</p>
        </div>
      </div>
      {error && <p className="workflow-error" role="alert">{error}</p>}
      {notice && <p className="inline-notice" role="status">{notice}</p>}
      <div className="progress-summary-grid">
        <article className="panel summary-card">
          <h2>Total courses</h2>
          <strong>{totalCourses}</strong>
        </article>
        <article className="panel summary-card">
          <h2>Completed courses</h2>
          <strong>{completedCourses}</strong>
        </article>
        <article className="panel summary-card">
          <h2>Average progress</h2>
          <strong>{averageProgress}%</strong>
        </article>
      </div>
      {loading ? (
        <p>Loading learning progress...</p>
      ) : progress.length === 0 ? (
        <section className="panel empty-courses">
          <h2>No enrolled courses</h2>
          <p>Enroll in a course to start tracking your progress.</p>
          <a className="button button-primary" href="#/courses">
            Browse courses
          </a>
        </section>
      ) : (
        <div className="student-course-list">
          {progress.map((item) => (
            <article className="panel learning-progress-card" key={item.courseId}>
              <div className="panel-heading">
                <h2>{item.course.title}</h2>
                <span className="status-tag">
                  {item.progressPercentage === 100 ? "Completed" : "In progress"}
                </span>
              </div>
              <p>
                Completed {item.completedLessons} of {item.totalLessons} lessons
              </p>
              <progress
                aria-label={`${item.course.title} progress`}
                value={item.progressPercentage}
                max="100"
              />
              <p>{item.progressPercentage}% complete</p>
              {item.progressPercentage < 100 && item.totalLessons > 0 && (
                <ProgressUpdater
                  item={item}
                  onUpdate={updateProgress}
                  disabled={updatingCourseId === item.courseId}
                />
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
