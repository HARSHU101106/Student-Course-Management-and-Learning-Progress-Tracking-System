import { useEffect, useState } from "react";
import { studentApi } from "../api/student.api.js";

export default function MyCourses() {
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [removingCourseId, setRemovingCourseId] = useState("");

  useEffect(() => {
    let active = true;
    studentApi
      .getMyCourses()
      .then((items) => {
        if (active) setEnrollments(items);
      })
      .catch((requestError) => {
        if (active) {
          setError(
            requestError.response?.data?.message ||
              "Unable to load enrolled courses.",
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

  const unenroll = async (courseId) => {
    setError("");
    setNotice("");
    setRemovingCourseId(courseId);
    try {
      const result = await studentApi.unenroll(courseId);
      setEnrollments((current) =>
        current.filter((item) => item.courseId !== courseId),
      );
      setNotice(result.message || "Successfully unenrolled from course.");
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "Unable to unenroll from this course.",
      );
    } finally {
      setRemovingCourseId("");
    }
  };

  return (
    <div className="page-width page-section">
      <div className="page-intro">
        <div>
          <span className="eyebrow">Your learning space</span>
          <h1>My enrolled courses</h1>
          <p>Pick up a course or remove one from your learning list.</p>
        </div>
      </div>
      {error && <p className="workflow-error" role="alert">{error}</p>}
      {notice && <p className="inline-notice" role="status">{notice}</p>}
      {loading ? (
        <p>Loading enrolled courses...</p>
      ) : enrollments.length === 0 ? (
        <section className="panel empty-courses">
          <h2>No courses yet</h2>
          <p>You haven't enrolled in any courses yet.</p>
          <a className="button button-primary" href="#/courses">
            Browse courses
          </a>
        </section>
      ) : (
        <div className="student-course-list">
          {enrollments.map((enrollment) => (
            <article className="panel student-course-row" key={enrollment.id}>
              <div>
                <h2>{enrollment.course?.title || enrollment.courseTitle}</h2>
                <p>
                  Status: {enrollment.status} · Enrolled{" "}
                  {new Date(enrollment.enrolledAt).toLocaleDateString()}
                </p>
              </div>
              <button
                className="button button-quiet"
                disabled={removingCourseId === enrollment.courseId}
                onClick={() => unenroll(enrollment.courseId)}
              >
                {removingCourseId === enrollment.courseId
                  ? "Removing..."
                  : "Unenroll"}
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
