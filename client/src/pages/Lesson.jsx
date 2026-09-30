import ChatTutor from "../components/ai/ChatTutor.jsx";
import VideoPlayer from "../components/learning/VideoPlayer.jsx";

export default function Lesson() {
  return (
    <div className="page-width page-section lesson-layout">
      <section>
        <div className="lesson-breadcrumb">
          <a href="#/courses">Course library</a>
          <span>/</span> Database Management Systems
        </div>
        <div className="page-intro">
          <div>
            <span className="eyebrow">Lecture 1 · Database foundations</span>
            <h1>Database design and normalization</h1>
            <p>Review relational design, dependencies, and the normal forms.</p>
          </div>
        </div>
        <VideoPlayer
          videoId="HXV3zeQKqGY"
          title="Database design and normalization lecture"
        />
        <div className="lesson-tags">
          <span className="status-tag tag-coral">Course lesson</span>
          <span>Database design</span>
          <span>Mock watch tracking enabled</span>
        </div>
      </section>
      <aside className="lesson-aside panel">
        <ChatTutor lessonId="dbms-lesson-1" timestamp={570} />
      </aside>
    </div>
  );
}
