import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import TutorPanel from "../components/TutorPanel.jsx";
import YouTubePlayer from "../components/YouTubePlayer.jsx";
import { Badge, Button, ErrorBanner, Notice, Spinner } from "../components/ui.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useAsync, useDocumentTitle } from "../hooks.js";
import { get, put } from "../lib/api.js";

export default function Lesson() {
  const { lessonId } = useParams();
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState("notes");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const { data, loading, error, reload, setData } = useAsync(() => get(`/lessons/${lessonId}`).then((b) => b.data), [lessonId]);
  useDocumentTitle(data?.lesson?.title);

  if (loading && !data) return <Spinner label="Loading lesson" />;
  if (error) {
    return (
      <>
        <ErrorBanner error={error} onRetry={reload} />
        <Link to="/courses">Back to courses</Link>
      </>
    );
  }

  const { lesson, course, previous, next, position, completed, resumeAtSec } = data;

  async function setCompleted(value) {
    if (isAdmin) return;
    setSaving(true);
    setSaveError(null);
    try {
      await put(`/progress/${lesson.course}/lessons/${lesson.id}`, { completed: value });
      setData({ ...data, completed: value });
    } catch (err) {
      setSaveError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <nav aria-label="Breadcrumb" className="breadcrumb">
        <Link to={`/courses/${course.slug}`}>{course.title}</Link> / <span>Lesson {position.index} of {position.total}</span>
      </nav>
      <div className="lesson-layout">
        <div>
          <h1>{lesson.title}</h1>
          <div className="card-badges">
            {lesson.module && <Badge tone="muted">{lesson.module}</Badge>}
            {lesson.topics.map((topic) => <Badge key={topic}>{topic}</Badge>)}
            {completed && <Badge tone="success">Completed</Badge>}
          </div>

          {lesson.videoId ? (
            <YouTubePlayer
              key={lesson.id}
              videoId={lesson.videoId}
              courseId={lesson.course}
              lessonId={lesson.id}
              startAt={resumeAtSec}
              title={lesson.title}
              onEnded={() => !completed && setCompleted(true)}
            />
          ) : (
            <Notice>No video is attached to this lesson yet. The study notes below cover the material.</Notice>
          )}

          <ErrorBanner error={saveError} />
          <div className="lesson-actions">
            {!isAdmin && (
              <Button variant={completed ? "secondary" : "primary"} loading={saving} onClick={() => setCompleted(!completed)}>
                {completed ? "Mark as not complete" : "Mark as complete"}
              </Button>
            )}
            <span className="spacer" />
            {previous && <Link className="btn btn-secondary" to={`/lessons/${previous.id}`}>← {previous.title}</Link>}
            {next && <Link className="btn btn-secondary" to={`/lessons/${next.id}`}>{next.title} →</Link>}
          </div>
        </div>

        <aside className="card lesson-side" aria-label="Lesson tools">
          <div className="tabs" role="tablist">
            {[["notes", "Study notes"], ["tutor", "Ask the tutor"]].map(([id, label]) => (
              <button key={id} role="tab" id={`tab-${id}`} aria-selected={tab === id} aria-controls={`panel-${id}`} className={tab === id ? "tab active" : "tab"} onClick={() => setTab(id)}>
                {label}
              </button>
            ))}
          </div>
          <div role="tabpanel" id="panel-notes" aria-labelledby="tab-notes" hidden={tab !== "notes"}>
            {lesson.notes ? <p className="notes">{lesson.notes}</p> : <p className="muted">No study notes have been added for this lesson.</p>}
          </div>
          <div role="tabpanel" id="panel-tutor" aria-labelledby="tab-tutor" hidden={tab !== "tutor"}>
            <TutorPanel courseId={lesson.course} lessonId={lesson.id} />
          </div>
        </aside>
      </div>
    </>
  );
}
