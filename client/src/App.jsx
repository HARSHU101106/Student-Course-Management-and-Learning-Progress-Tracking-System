import { useContext, useEffect, useState } from "react";
import { Route, Routes, useLocation, useParams } from "react-router-dom";
import { importYouTubePlaylist } from "./api/ai.api.js";
import { authApi } from "./api/auth.api.js";
import { CourseContext } from "./context/CourseContext.jsx";
import { AIContext } from "./context/AIContext.jsx";
import AdminRoute from "./routes/AdminRoute.jsx";
import ProtectedRoute from "./routes/ProtectedRoute.jsx";
import LessonPage from "./pages/Lesson.jsx";
import CourseCard from "./components/courses/CourseCard.jsx";
import Footer from "./components/layout/Footer.jsx";
import Navbar from "./components/layout/Navbar.jsx";

const initialNotifications = [
  {
    text: "Your study plan for this week is ready.",
    time: "2 hours ago",
    unread: true,
  },
  {
    text: "Normalization quiz is due Friday.",
    time: "Yesterday",
    unread: true,
  },
  {
    text: "Operating Systems was added to the catalog.",
    time: "2 days ago",
    unread: false,
  },
];

function Icon({ name }) {
  const paths = {
    home: "⌂",
    book: "▤",
    plan: "◎",
    bell: "♢",
    menu: "☰",
    close: "×",
    play: "▶",
    arrow: "→",
    check: "✓",
    search: "⌕",
    sun: "☼",
    moon: "☾",
    send: "↗",
    clock: "◷",
    spark: "✦",
    logout: "↪",
    users: "♧",
    upload: "↑",
  };
  return (
    <span className={`icon icon-${name}`} aria-hidden="true">
      {paths[name] || "•"}
    </span>
  );
}

function go(path) {
  window.location.hash = path;
}

function Button({
  children,
  variant = "primary",
  onClick,
  type = "button",
  className = "",
  disabled = false,
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={`button button-${variant} ${className}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function getStoredUser() {
  try {
    const stored = JSON.parse(
      localStorage.getItem("adaptlearn-user") || "null",
    );
    return stored
      ? {
          ...stored,
          role:
            stored.role === true || stored.role === "admin"
              ? "admin"
              : "student",
        }
      : null;
  } catch {
    return null;
  }
}

function getCourseProgress(course) {
  try {
    const saved = JSON.parse(
      localStorage.getItem(`adaptlearn-progress-${course.id}`) || "[]",
    );
    return Array.isArray(saved)
      ? saved.filter((index) => Number.isInteger(index))
      : [];
  } catch {
    return [];
  }
}

function App() {
  const route = useLocation().pathname;
  const {
    publishedCourses,
    setPublishedCourses,
    enrollmentData,
    loading: coursesLoading,
    error: coursesError,
  } = useContext(CourseContext);
  const [user, setUser] = useState(getStoredUser);
  const [theme, setTheme] = useState(
    () => localStorage.getItem("adaptlearn-theme") || "light",
  );
  const [notifications, setNotifications] = useState(initialNotifications);
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => setMobileNav(false), [route]);

  const login = async (account) => {
    try {
      const payload = {
        ...account,
        email: account.email,
        password: account.password,
      };

      const response =
        account.mode === "register"
          ? await authApi.register(payload)
          : await authApi.login(payload);

      const nextUser = {
        ...response.user,
        role:
          response.user?.role === "admin" ||
          response.user?.email?.toLowerCase().startsWith("admin@")
            ? "admin"
            : "student",
      };

      setUser(nextUser);
      localStorage.setItem("adaptlearn-user", JSON.stringify(nextUser));
      go(nextUser.role === "admin" ? "/admin" : "/dashboard");
    } catch (error) {
      const message = error?.response?.data?.message || "Unable to sign in.";
      window.alert(message);
    }
  };
  const logout = () => {
    setUser(null);
    localStorage.removeItem("adaptlearn-user");
    go("/");
  };
  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    localStorage.setItem("adaptlearn-theme", next);
  };
  const unread = notifications.filter((item) => item.unread).length;

  const isAdmin = user?.role === "admin";

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="#/" onClick={() => setMobileNav(false)}>
            <span className="brand-mark">A</span>
            <span>
              Adapt<span>Learn</span>
            </span>
          </a>
          <Navbar
            user={user}
            isAdmin={isAdmin}
            route={route}
            mobileNav={mobileNav}
            logout={logout}
            Icon={Icon}
          />
          <div className="topbar-actions">
            <button
              className="icon-button"
              aria-label="Toggle theme"
              onClick={toggleTheme}
            >
              <Icon name={theme === "light" ? "moon" : "sun"} />
            </button>
            {user && !isAdmin && (
              <a
                className="icon-button notification-button"
                aria-label={`${unread} unread notifications`}
                href="#/notifications"
              >
                <Icon name="bell" />
                {unread > 0 && <b>{unread}</b>}
              </a>
            )}
            {user ? (
              <>
                <span className="avatar">{user.name[0]}</span>
                <button
                  className="button button-quiet desktop-only"
                  onClick={logout}
                >
                  <Icon name="logout" />
                  Log out
                </button>
              </>
            ) : (
              <>
                <a className="button button-quiet desktop-only" href="#/login">
                  Log in
                </a>
                <a
                  className="button button-primary desktop-only"
                  href="#/register"
                >
                  Get started
                </a>
              </>
            )}
            <button
              className="icon-button menu-toggle"
              aria-label="Toggle menu"
              onClick={() => setMobileNav(!mobileNav)}
            >
              <Icon name={mobileNav ? "close" : "menu"} />
            </button>
          </div>
        </div>
      </header>
      <main className="main-content">
        <Router
          user={user}
          login={login}
          notifications={notifications}
          setNotifications={setNotifications}
          publishedCourses={publishedCourses}
          setPublishedCourses={setPublishedCourses}
          enrollmentData={enrollmentData}
          coursesLoading={coursesLoading}
          coursesError={coursesError}
        />
      </main>
      <Footer />
    </div>
  );
}

function Router({
  user,
  login,
  notifications,
  setNotifications,
  publishedCourses,
  setPublishedCourses,
  enrollmentData,
  coursesLoading,
  coursesError,
}) {
  return (
    <Routes>
      <Route path="/" element={<Home user={user} />} />
      <Route path="/login" element={<Auth mode="login" onSubmit={login} />} />
      <Route
        path="/register"
        element={<Auth mode="register" onSubmit={login} />}
      />
      <Route element={<ProtectedRoute user={user} />}>
        <Route
          path="/courses"
          element={
            coursesLoading ? (
              <p className="page-width page-section">Loading courses...</p>
            ) : coursesError ? (
              <p className="page-width page-section" role="alert">
                {coursesError}
              </p>
            ) : (
              <Courses user={user} publishedCourses={publishedCourses} />
            )
          }
        />
        <Route
          path="/course/:courseId"
          element={<CoursePathRoute publishedCourses={publishedCourses} />}
        />
        <Route
          path="/dashboard"
          element={
            <Dashboard
              publishedCourses={publishedCourses}
              enrollmentData={enrollmentData}
              coursesLoading={coursesLoading}
              coursesError={coursesError}
            />
          }
        />
        <Route path="/plan" element={<StudyPlan />} />
        <Route
          path="/notifications"
          element={
            <Notifications
              notifications={notifications}
              setNotifications={setNotifications}
            />
          }
        />
        <Route path="/lesson" element={<LessonPage />} />
        <Route path="/lesson/:lessonId" element={<LessonPage />} />
        <Route
          path="/learn/:courseId"
          element={<LearningRoute publishedCourses={publishedCourses} />}
        />
        <Route
          path="/learn/:courseId/:index"
          element={<LearningRoute publishedCourses={publishedCourses} />}
        />
      </Route>
      <Route
        path="/admin"
        element={
          <AdminRoute user={user}>
            <Admin setPublishedCourses={setPublishedCourses} />
          </AdminRoute>
        }
      />
      <Route path="*" element={<EmptyState />} />
    </Routes>
  );
}

function CoursePathRoute({ publishedCourses }) {
  const { courseId } = useParams();
  const course = publishedCourses.find((item) => item.id === courseId);
  return course ? <ImportedCoursePath course={course} /> : <EmptyState />;
}

function LearningRoute({ publishedCourses }) {
  const { courseId, index } = useParams();
  if (!courseId.startsWith("youtube-")) return <LessonPage />;
  const course = publishedCourses.find((item) => item.id === courseId);
  return course ? (
    <ImportedLesson course={course} index={Number(index || 0)} />
  ) : (
    <EmptyState />
  );
}

function PageIntro({ eyebrow, title, children, action }) {
  return (
    <div className="page-intro">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {children && <p>{children}</p>}
      </div>
      {action}
    </div>
  );
}

function Home({ user }) {
  return (
    <>
      <section className="hero page-width">
        <div className="hero-copy">
          <h1>
            <span>Watch the lecture.</span>
            <span>Know what to study next.</span>
          </h1>
          <p>
            AdaptLearn turns free NPTEL courses into a path that bends around
            your quiz results and watch time.
          </p>
          <div className="hero-actions">
            <a
              className="button button-primary"
              href={user ? "#/dashboard" : "#/register"}
            >
              {user ? "Continue learning" : "Create free account"}
              <Icon name="arrow" />
            </a>
            <a className="text-link" href={user ? "#/courses" : "#/login"}>
              Browse courses <Icon name="arrow" />
            </a>
          </div>
          <div className="proof-row">
            <span>Free NPTEL lectures</span>
            <span>Quizzes that adapt</span>
          </div>
        </div>
        <LearningMap />
      </section>
      <section className="section page-width">
        <div className="section-heading">
          <h2>How the path adapts</h2>
        </div>
        <div className="steps">
          <Step
            number="01"
            title="Watch"
            text="Lectures play inside the lesson page. Your position and real watch time are saved automatically."
          />
          <Step
            number="02"
            title="Check"
            text="A short quiz after each lecture updates your mastery for every topic it covers."
          />
          <Step
            number="03"
            title="Adjust"
            text="Your weekly plan sends you back to weak topics, to practice for close ones, and forward when you are ready."
          />
        </div>
      </section>
      <section className="feature-band">
        <div className="page-width feature-grid">
          <div>
            <span className="eyebrow">Inside the portal</span>
            <h2>A tutor that earns your trust.</h2>
            <p>
              Ask while you watch. Every answer is tied to a lecture and
              timestamp, so you can follow the thread back to the source.
            </p>
            <a className="text-link" href={user ? "#/courses" : "#/login"}>
              See the course library <Icon name="arrow" />
            </a>
          </div>
          <div className="conversation">
            <div className="conversation-head">
              <span className="pip">P</span>
              <span>
                <strong>Pip, your course tutor</strong>
                <small>Only answers from your course material</small>
              </span>
              <i />
            </div>
            <div className="bubble bubble-you">
              What is the difference between 2NF and 3NF?
            </div>
            <div className="bubble bubble-tutor">
              2NF removes partial dependencies. 3NF also removes transitive
              dependencies.
              <div className="source-pill">
                <Icon name="clock" />
                Lecture 4 · 09:30
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function Step({ number, title, text }) {
  return (
    <article className="step">
      <span className="step-number">{number}</span>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}

function LearningMap() {
  return (
    <div className="learning-map">
      <div className="map-label">
        <span className="live-dot" />
        Your learning path <small>Tap a topic</small>
      </div>
      <div className="map-path">
        <span className="path-line" />
        {["done", "done", "done", "review", "next", "later"].map(
          (state, index) => (
            <span
              key={index}
              className={`map-node node-${state}`}
              style={{
                left: `${12 + index * 15}%`,
                top: `${56 - Math.sin(index * 1.2) * 25}%`,
              }}
            >
              {state === "done" ? (
                <Icon name="check" />
              ) : index === 4 ? (
                <span className="node-core" />
              ) : (
                ""
              )}
            </span>
          ),
        )}
        <div className="map-mascot">✦</div>
      </div>
      <div className="map-legend">
        <span>
          <i className="legend-green" />
          Complete
        </span>
        <span>
          <i className="legend-coral" />
          Revisit
        </span>
        <span>
          <i className="legend-amber" />
          Next up
        </span>
      </div>
    </div>
  );
}

function Auth({ mode, onSubmit }) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    department: "Computer Science",
  });
  const submit = (event) => {
    event.preventDefault();
    const email = form.email || "student@demo.com";
    onSubmit({
      mode,
      name:
        mode === "register"
          ? form.name || "Alex Student"
          : (email.split("@")[0] || "Alex").replace(/[._-]/g, " "),
      email,
      password: form.password,
      role: email.toLowerCase().startsWith("admin@") ? "admin" : "student",
    });
  };
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-mark">A</div>
        <span className="eyebrow">AdaptLearn</span>
        <h1>
          {mode === "login" ? "Welcome back" : "Start learning differently"}
        </h1>
        <p>
          {mode === "login"
            ? "Pick up where your curiosity left off."
            : "Build a study rhythm that responds to you."}
        </p>
        <form onSubmit={submit}>
          {mode === "register" && (
            <label>
              Full name
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Your name"
              />
            </label>
          )}
          <label>
            Email
            <input
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="you@college.edu"
            />
          </label>
          {mode === "register" && (
            <label>
              Department
              <input
                required
                value={form.department}
                onChange={(e) =>
                  setForm({ ...form, department: e.target.value })
                }
                placeholder="Your department"
              />
            </label>
          )}
          <label>
            Password
            <input
              required
              minLength="8"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="8+ characters"
            />
          </label>
          <Button type="submit">
            {mode === "login" ? "Log in" : "Create account"}
            <Icon name="arrow" />
          </Button>
        </form>
        <p className="form-note">
          Demo login: <strong>student@demo.com</strong> /{" "}
          <strong>demo1234</strong>. For the admin workspace, use{" "}
          <strong>admin@demo.com</strong> / <strong>demo1234</strong>.
        </p>
        <a
          className="text-link"
          href={mode === "login" ? "#/register" : "#/login"}
        >
          {mode === "login"
            ? "Create a free account"
            : "Already have an account? Log in"}
        </a>
      </div>
    </div>
  );
}

function Courses({ user, publishedCourses = [] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const allCourses = publishedCourses;
  const categories = ["All"];
  const filtered = allCourses.filter(
    (course) =>
      (category === "All" || course.category === category) &&
      `${course.title} ${course.description}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <div className="page-width page-section">
      <PageIntro eyebrow="Course library" title="Choose your next challenge">
        NPTEL lectures, organized into clear modules with quizzes that keep the
        path honest.
      </PageIntro>
      <div className="toolbar">
        <label className="search-field">
          <Icon name="search" />
          <input
            aria-label="Search courses"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search courses or topics"
          />
        </label>
        <div className="filter-row">
          {categories.map((item) => (
            <button
              key={item}
              className={`filter-chip ${category === item ? "selected" : ""}`}
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      <div className="course-grid">
        {filtered.map((course, index) => (
          <CourseCard
            key={course.id}
            course={course}
            index={index}
            user={user}
          />
        ))}
      </div>
      {!filtered.length && <EmptyState />}
    </div>
  );
}

function Dashboard({
  publishedCourses = [],
  enrollmentData,
  coursesLoading,
  coursesError,
}) {
  if (coursesLoading) {
    return <p className="page-width page-section">Loading your dashboard...</p>;
  }
  if (coursesError) {
    return (
      <p className="page-width page-section" role="alert">
        {coursesError}
      </p>
    );
  }
  const firstCourse = publishedCourses[0];
  if (!firstCourse) {
    return (
      <div className="page-width page-section">
        <PageIntro eyebrow="Your learning space" title="Your dashboard">
          Your dashboard will fill up when an admin publishes a course path.
        </PageIntro>
        <EmptyState />
      </div>
    );
  }
  const courseStats = publishedCourses.map((course) => {
    const total = course.items?.length || course.lessons || 0;
    const completed = getCourseProgress(course).filter(
      (index) => index < total,
    );
    return {
      course,
      total,
      completed,
      progress: total ? Math.round((completed.length / total) * 100) : 0,
    };
  });
  const totalModules = courseStats.reduce(
    (total, item) => total + item.total,
    0,
  );
  const completedModules = courseStats.reduce(
    (total, item) => total + item.completed.length,
    0,
  );
  const overallProgress = totalModules
    ? Math.round((completedModules / totalModules) * 100)
    : 0;
  const resume =
    courseStats.find((item) => item.progress < 100) || courseStats[0];
  const nextModule = resume.course.items?.[resume.completed.length];
  return (
    <div className="page-width page-section">
      <PageIntro
        eyebrow="Your learning space"
        title={`Welcome, ${enrollmentData?.student?.name || "learner"}`}
      >
        Continue one of your enrolled course paths.
      </PageIntro>
      <div className="dashboard-grid">
        <section className="dashboard-main">
          <div className="resume-card">
            <div className="resume-ring">
              <span>
                {resume.progress}
                <small>%</small>
              </span>
            </div>
            <div>
              <span className="status-tag">Next module</span>
              <h2>{resume.course.title}</h2>
              <p>
                {nextModule
                  ? `Next: ${nextModule.title}`
                  : "All available modules completed."}
              </p>
              <div className="resume-actions">
                <a
                  className="button button-primary"
                  href={
                    nextModule
                      ? `#/learn/${resume.course.id}/${resume.completed.length}`
                      : `#/course/${resume.course.id}`
                  }
                >
                  <Icon name="play" />
                  Open course path
                </a>
                <a className="text-link" href="#/courses">
                  Browse courses
                </a>
              </div>
            </div>
          </div>
          <div className="stat-grid">
            <Stat value={publishedCourses.length} label="Published courses" />
            <Stat value={totalModules} label="Available modules" />
            <Stat value={`${overallProgress}%`} label="Overall progress" />
            <Stat value={completedModules} label="Completed modules" />
          </div>
          <div className="panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Your shelf</span>
                <h2>Published course paths</h2>
              </div>
              <a className="text-link" href="#/courses">
                Browse all <Icon name="arrow" />
              </a>
            </div>
            {courseStats.map(({ course, progress, total }) => {
              const enrollment = enrollmentData?.items?.find(
                (item) => item.courseId === course.id,
              );
              return (
                <div className="course-row" key={course.id}>
                  <div className="course-icon accent-coral">▶</div>
                  <div>
                    <strong>{course.title}</strong>
                    <small>
                      {enrollment?.status || "not enrolled"} · {progress}%
                      complete · {total} modules
                    </small>
                  </div>
                  <div className="row-progress">
                    <span>{progress}%</span>
                    <div className="mini-progress">
                      <i style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                  <a
                    className="button button-secondary button-small"
                    href={`#/course/${course.id}`}
                  >
                    Open <Icon name="arrow" />
                  </a>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function DashboardLegacy() {
  return (
    <div className="page-width page-section">
      <PageIntro eyebrow="Monday, September 21" title="Good evening, Alex.">
        Here is the shape of your learning week.
      </PageIntro>
      <div className="dashboard-grid">
        <section className="dashboard-main">
          <div className="resume-card">
            <div className="resume-ring">
              <span>
                62<small>%</small>
              </span>
            </div>
            <div>
              <span className="status-tag">Continue learning</span>
              <h2>Database Management Systems</h2>
              <p>Lecture 4: Normalization · paused at 07:32</p>
              <div className="resume-actions">
                <a className="button button-primary" href="#/learn/dbms-4">
                  <Icon name="play" />
                  Resume lecture
                </a>
                <a className="text-link" href="#/courses">
                  Course overview
                </a>
              </div>
            </div>
          </div>
          <div className="stat-grid">
            <Stat value="3" label="Courses enrolled" />
            <Stat value="6" label="Day streak" accent="amber" />
            <Stat value="74%" label="Average mastery" />
            <Stat value="1,240" label="Total XP" />
          </div>
          <div className="panel">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">Your shelf</span>
                <h2>My courses</h2>
              </div>
              <a className="text-link" href="#/courses">
                Browse all <Icon name="arrow" />
              </a>
            </div>
            {courses.slice(0, 3).map((course, index) => (
              <div className="course-row" key={course.id}>
                <div className={`course-icon accent-${course.accent}`}>
                  {index + 1}
                </div>
                <div>
                  <strong>{course.title}</strong>
                  <small>
                    {index === 0
                      ? "Next: Normalization"
                      : index === 1
                        ? "Next: Decision trees"
                        : "Next: Graph traversal"}
                  </small>
                </div>
                <div className="row-progress">
                  <span>{[62, 35, 100][index]}%</span>
                  <div className="mini-progress">
                    <i style={{ width: `${[62, 35, 100][index]}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
        <aside className="dashboard-side">
          <div className="panel plan-preview">
            <div className="panel-heading">
              <div>
                <span className="eyebrow">This week</span>
                <h2>Study plan</h2>
              </div>
              <a className="icon-link" href="#/plan">
                <Icon name="arrow" />
              </a>
            </div>
            <div className="plan-item">
              <span className="plan-icon coral">↻</span>
              <div>
                <strong>Revisit Normalization</strong>
                <small>Lecture 4 · 45 min</small>
              </div>
            </div>
            <div className="plan-item">
              <span className="plan-icon amber">◇</span>
              <div>
                <strong>Practice relational algebra</strong>
                <small>10 questions · 30 min</small>
              </div>
            </div>
            <div className="plan-item">
              <span className="plan-icon cyan">→</span>
              <div>
                <strong>Advance to Transactions</strong>
                <small>Lecture 6 · 60 min</small>
              </div>
            </div>
            <a className="button button-secondary full-button" href="#/plan">
              Open full plan <Icon name="arrow" />
            </a>
          </div>
          <div className="streak-card">
            <div className="streak-flare">✦</div>
            <div>
              <strong>Six days in a row.</strong>
              <p>Keep the rhythm going today.</p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Stat({ value, label, accent = "cyan" }) {
  return (
    <div className={`stat-card stat-${accent}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function StudyPlan() {
  const { plan: remotePlan, loading, error, loadPlan } = useContext(AIContext);
  const [hours, setHours] = useState(4);
  const fallbackPlan = [
    {
      type: "Revisit",
      title: "Normalization",
      reason:
        "Mastery is at 42%. Rewatch the key section, then retake the quiz.",
      time: "45 min",
      accent: "coral",
    },
    {
      type: "Practice",
      title: "Relational algebra",
      reason: "You are close at 74%. Ten questions should lock it in.",
      time: "30 min",
      accent: "amber",
    },
    {
      type: "Advance",
      title: "Transactions and ACID",
      reason:
        "You are ready for the next lecture in Database Management Systems.",
      time: "60 min",
      accent: "cyan",
    },
  ];
  useEffect(() => {
    loadPlan("youtube-demo-dbms").catch(() => {});
  }, [loadPlan]);
  const plan = remotePlan?.items || fallbackPlan;
  return (
    <div className="page-width page-section">
      <PageIntro eyebrow="Built around your week" title="Your study plan">
        The planner balances revision, practice, and new material against the
        hours you actually have.
      </PageIntro>
      <div className="plan-layout">
        <section>
          {loading && <p role="status">Loading your personalized plan...</p>}
          {error && <p role="alert">{error}</p>}
          <div className="time-control panel">
            <div>
              <span className="eyebrow">Weekly capacity</span>
              <h2>{hours} hours available</h2>
            </div>
            <input
              type="range"
              min="1"
              max="8"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
            />
            <span className="range-value">{hours}h</span>
          </div>
          <div className="plan-list">
            {plan.map((item, index) => (
              <article className="plan-card" key={item.title}>
                <span className={`plan-number ${item.accent}`}>
                  0{index + 1}
                </span>
                <div>
                  <div className="plan-card-title">
                    <span className={`status-tag tag-${item.accent}`}>
                      {item.type}
                    </span>
                    <h2>{item.title}</h2>
                  </div>
                  <p>{item.reason}</p>
                  <small>
                    <Icon name="clock" />
                    {item.time}
                  </small>
                </div>
                <a
                  className="icon-link"
                  href={
                    index === 0 ? "#/learn/youtube-demo-dbms/0" : "#/courses"
                  }
                >
                  <Icon name="arrow" />
                </a>
              </article>
            ))}
          </div>
        </section>
        <aside className="panel mastery-panel">
          <span className="eyebrow">Signals from your quizzes</span>
          <h2>Topic mastery</h2>
          {[
            ["ER model", 88, "mint"],
            ["SQL and joins", 82, "mint"],
            ["Relational algebra", 74, "amber"],
            ["Indexing", 55, "coral"],
            ["Normalization", 42, "coral"],
          ].map(([name, value, tone]) => (
            <div className="mastery-row" key={name}>
              <div>
                <span>{name}</span>
                <strong>{value}%</strong>
              </div>
              <div className="mastery-track">
                <i className={tone} style={{ width: `${value}%` }} />
              </div>
            </div>
          ))}
          <div className="legend-note">
            <i className="legend-coral" />
            Needs a revisit&nbsp;&nbsp; <i className="legend-amber" />
            Almost there&nbsp;&nbsp; <i className="legend-green" />
            Strong
          </div>
        </aside>
      </div>
    </div>
  );
}

function ImportedCoursePath({ course }) {
  const [completed, setCompleted] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem(`adaptlearn-progress-${course.id}`) || "[]",
      );
    } catch {
      return [];
    }
  });
  const progress = course.items.length
    ? Math.round((completed.length / course.items.length) * 100)
    : 0;
  const setLessonComplete = (index) => {
    const next = completed.includes(index)
      ? completed
      : [...completed, index].sort((a, b) => a - b);
    setCompleted(next);
    localStorage.setItem(
      `adaptlearn-progress-${course.id}`,
      JSON.stringify(next),
    );
  };

  return (
    <div className="page-width page-section imported-path-page">
      <div className="lesson-breadcrumb">
        <a href="#/courses">Course library</a>
        <span>/</span>
        {course.title}
      </div>
      <PageIntro eyebrow="Imported learning path" title={course.title}>
        {course.description ||
          "Work through the playlist in order. Your completed modules are saved to this device."}
      </PageIntro>
      <div className="path-overview panel">
        <div>
          <span className="eyebrow">Your progress</span>
          <h2>
            {completed.length} of {course.items.length} modules complete
          </h2>
        </div>
        <div className="path-progress">
          <i style={{ width: `${progress}%` }} />
        </div>
        <strong>{progress}%</strong>
      </div>
      <div className="module-list">
        {course.items.map((item, index) => {
          const done = completed.includes(index);
          return (
            <article
              className={`module-row ${done ? "complete" : ""}`}
              key={item.videoId}
            >
              <span className="module-number">
                {done ? (
                  <Icon name="check" />
                ) : (
                  String(index + 1).padStart(2, "0")
                )}
              </span>
              <div>
                <span className="eyebrow">Module {index + 1}</span>
                <h2>{item.title}</h2>
                <p>
                  {item.description?.slice(0, 150) ||
                    "Video lesson from the imported playlist."}
                </p>
              </div>
              <a
                className={`button button-small ${done ? "button-secondary" : "button-primary"}`}
                href={`#/learn/${course.id}/${index}`}
              >
                {done ? "Review module" : "Start module"}
                <Icon name="arrow" />
              </a>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function ImportedLesson({ course, index }) {
  const { recordWatchEvent } = useContext(AIContext);
  const [completedModules, setCompletedModules] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem(`adaptlearn-progress-${course.id}`) || "[]",
      );
    } catch {
      return [];
    }
  });
  const completed = completedModules.includes(index);
  const item = course.items[index];
  if (!item) return <EmptyState />;
  const markComplete = () => {
    const key = `adaptlearn-progress-${course.id}`;
    let progress = [];
    try {
      progress = JSON.parse(localStorage.getItem(key) || "[]");
    } catch {
      progress = [];
    }
    if (!progress.includes(index)) progress.push(index);
    progress.sort((a, b) => a - b);
    localStorage.setItem(key, JSON.stringify(progress));
    setCompletedModules(progress);
    recordWatchEvent({
      courseId: course.id,
      lessonId: item.videoId,
      watchedSec: item.durationSec || 0,
      event: "complete",
    }).catch(() => {});
  };
  const nextIndex = index + 1;

  return (
    <div className="page-width page-section imported-lesson-page">
      <div className="lesson-breadcrumb">
        <a href={`#/course/${course.id}`}>{course.title}</a>
        <span>/</span>Module {index + 1}
      </div>
      <div className="imported-lesson-layout">
        <section>
          <PageIntro
            eyebrow={`Module ${index + 1} of ${course.items.length}`}
            title={item.title}
          >
            {item.description ||
              "Watch the lesson, then mark this module complete to continue your path."}
          </PageIntro>
          <div className="embedded-video-frame">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(item.videoId)}?rel=0`}
              title={item.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>
          <div className="module-actions">
            <button
              className={`button ${completed ? "button-secondary" : "button-primary"}`}
              onClick={markComplete}
            >
              <Icon name={completed ? "check" : "play"} />
              {completed ? "Module completed" : "Mark module complete"}
            </button>
            <a className="text-link" href={`#/course/${course.id}`}>
              Back to path <Icon name="arrow" />
            </a>
            {completed && course.items[nextIndex] && (
              <a
                className="button button-primary"
                href={`#/learn/${course.id}/${nextIndex}`}
              >
                Next module <Icon name="arrow" />
              </a>
            )}
          </div>
        </section>
        <aside className="panel imported-lesson-sidebar">
          <span className="eyebrow">Course path</span>
          <h2>{course.title}</h2>
          <div className="sidebar-progress">
            <i
              style={{
                width: `${(completedModules.length / course.items.length) * 100}%`,
              }}
            />
          </div>
          <div className="lesson-path-list">
            {course.items.map((lesson, lessonIndex) => (
              <a
                className={lessonIndex === index ? "current" : ""}
                key={lesson.videoId}
                href={`#/learn/${course.id}/${lessonIndex}`}
              >
                <span>{lessonIndex + 1}</span>
                <strong>{lesson.title}</strong>
                <Icon
                  name={
                    completedModules.includes(lessonIndex) ? "check" : "arrow"
                  }
                />
              </a>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Lesson() {
  const [playing, setPlaying] = useState(false);
  const [tab, setTab] = useState("tutor");
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState([]);
  const ask = (event) => {
    event.preventDefault();
    if (!message.trim()) return;
    setChat([
      ...chat,
      { from: "you", text: message },
      {
        from: "tutor",
        text: message.toLowerCase().includes("2nf")
          ? "2NF removes partial dependencies. 3NF also removes transitive dependencies."
          : "That topic is covered in the course material. Try asking about normalization, joins, or indexes.",
      },
    ]);
    setMessage("");
  };
  return (
    <div className="page-width page-section lesson-layout">
      <section>
        <div className="lesson-breadcrumb">
          Dashboard <span>/</span> Database Management Systems
        </div>
        <PageIntro eyebrow="Lecture 4 · 18:00" title="Normalization">
          Understand how a well-designed schema keeps data reliable.
        </PageIntro>
        <div className="video-frame">
          <div className="video-slide">
            <span>LECTURE 04</span>
            <h2>Normalization</h2>
            <div className="slide-lines">
              <i />
              <i />
              <i />
            </div>
            <div className="slide-grid">
              <span>1NF</span>
              <span>2NF</span>
              <span>3NF</span>
            </div>
          </div>
          <div className="video-controls">
            <button
              className="play-control"
              onClick={() => setPlaying(!playing)}
            >
              <Icon name={playing ? "pause" : "play"} />
            </button>
            <div className="video-progress">
              <i style={{ width: "42%" }} />
            </div>
            <span>07:32 / 18:00</span>
            <button className="speed-control">1×</button>
          </div>
        </div>
        <div className="lesson-tags">
          <span className="status-tag tag-coral">Needs a revisit</span>
          <span>Normalization</span>
          <span>Last watched today</span>
        </div>
        <div className="quiz-card">
          <div>
            <span className="eyebrow">Quick check</span>
            <h2>Ready to test your understanding?</h2>
            <p>
              Three questions will update your mastery and reshape this week’s
              plan.
            </p>
          </div>
          <a className="button button-primary" href="#/plan">
            Take the quiz <Icon name="arrow" />
          </a>
        </div>
      </section>
      <aside className="lesson-aside panel">
        <div className="lesson-tabs">
          {[
            ["tutor", "Tutor"],
            ["class", "Class chat"],
            ["lessons", "Lectures"],
          ].map(([key, label]) => (
            <button
              className={tab === key ? "selected" : ""}
              key={key}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === "tutor" && (
          <>
            <div className="tutor-head">
              <span className="pip">P</span>
              <div>
                <strong>Pip</strong>
                <small>Course tutor</small>
              </div>
              <span className="online-dot" />
            </div>
            <div className="chat-log">
              <div className="bubble bubble-tutor">
                Hi, I’m Pip. Ask me about this lecture and I’ll show you where
                the answer came from.
              </div>
              {chat.map((item, index) => (
                <div
                  key={index}
                  className={`bubble ${item.from === "you" ? "bubble-you" : "bubble-tutor"}`}
                >
                  {item.text}
                  {item.from === "tutor" && (
                    <div className="source-pill">
                      <Icon name="clock" />
                      Lecture 4 · 09:30
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="prompt-row">
              <button
                onClick={() =>
                  setMessage("What is the difference between 2NF and 3NF?")
                }
              >
                2NF vs 3NF
              </button>
              <button onClick={() => setMessage("What is normalization?")}>
                What is normalization?
              </button>
            </div>
            <form className="chat-form" onSubmit={ask}>
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ask about this lecture"
              />
              <button aria-label="Send">
                <Icon name="send" />
              </button>
            </form>
          </>
        )}
        {tab === "class" && (
          <div className="empty-panel">
            <Icon name="users" />
            <h2>Class discussion</h2>
            <p>
              Three classmates are online. The live discussion will appear here.
            </p>
            <Button variant="secondary">Join discussion</Button>
          </div>
        )}
        {tab === "lessons" && (
          <div className="lesson-list">
            {lessons.map((lesson) => (
              <a
                className={lesson.number === 4 ? "current" : ""}
                key={lesson.id}
                href={`#/learn/${lesson.id}`}
              >
                <span>{lesson.number}</span>
                <div>
                  <strong>{lesson.title}</strong>
                  <small>{lesson.duration}</small>
                </div>
                <Icon name={lesson.progress >= 1 ? "check" : "arrow"} />
              </a>
            ))}
          </div>
        )}
      </aside>
    </div>
  );
}

function Notifications({ notifications, setNotifications }) {
  return (
    <div className="page-width page-section narrow-page">
      <PageIntro eyebrow="Stay in the loop" title="Notifications">
        Reminders, plan updates, and the small signals that keep learning
        moving.
      </PageIntro>
      <div className="notification-list panel">
        {notifications.map((item, index) => (
          <div
            className={`notification-row ${item.unread ? "unread" : ""}`}
            key={index}
          >
            <span className="notification-icon">
              <Icon name={item.unread ? "spark" : "check"} />
            </span>
            <div>
              <strong>{item.text}</strong>
              <small>{item.time}</small>
            </div>
            {item.unread && <i />}
          </div>
        ))}
        <button
          className="text-link"
          onClick={() =>
            setNotifications(
              notifications.map((item) => ({ ...item, unread: false })),
            )
          }
        >
          Mark all as read
        </button>
      </div>
    </div>
  );
}

function Admin({ setPublishedCourses }) {
  const [playlistUrl, setPlaylistUrl] = useState("");
  const [workflow, setWorkflow] = useState("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [importedCourse, setImportedCourse] = useState(null);
  const [draftQuizzes, setDraftQuizzes] = useState([]);
  const approvedCount = draftQuizzes.filter(
    (quiz) => quiz.status === "approved",
  ).length;

  const importPlaylist = async (event) => {
    event.preventDefault();
    setErrorMessage("");
    setWorkflow("importing");
    try {
      const playlist = await importYouTubePlaylist(playlistUrl.trim());
      setImportedCourse(playlist);
      setDraftQuizzes(
        playlist.items.slice(0, 3).map((video, index) => ({
          id: index + 1,
          title: video.title,
          questions: 5,
          topic: `Lecture ${index + 1}`,
          status: "pending",
        })),
      );
      setWorkflow("ready");
    } catch (error) {
      setErrorMessage(
        error.response?.data?.message ||
          error.message ||
          "Playlist import failed.",
      );
      setWorkflow("error");
    }
  };

  const updateQuiz = (id, status) => {
    setDraftQuizzes((items) =>
      items.map((quiz) => (quiz.id === id ? { ...quiz, status } : quiz)),
    );
  };

  const publishDraft = () => {
    if (!approvedCount || !importedCourse) return;
    setPublishedCourses((existing) => [
      ...existing.filter(
        (course) => course.playlistId !== importedCourse.playlistId,
      ),
      {
        id: `youtube-${importedCourse.playlistId}`,
        title: importedCourse.title,
        category: "Imported",
        level: "All levels",
        duration: `${Math.max(1, Math.ceil(importedCourse.items.length / 4))} weeks`,
        lessons: importedCourse.items.length,
        accent: "coral",
        description:
          importedCourse.description || "Imported from a YouTube playlist.",
        playlistId: importedCourse.playlistId,
        items: importedCourse.items,
      },
    ]);
    setWorkflow("published");
  };

  return (
    <div className="page-width page-section">
      <PageIntro eyebrow="Admin workspace" title="Course operations">
        Keep the learning library healthy and spot the students who need a
        nudge.
      </PageIntro>
      <div className="stat-grid admin-stats">
        <Stat value="1,284" label="Total students" />
        <Stat value="3,910" label="Active enrollments" accent="amber" />
        <Stat value="58%" label="Average completion" />
        <Stat value="24" label="Need attention" accent="coral" />
      </div>
      <div className="admin-grid">
        <section className="panel studio-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Course studio</span>
              <h2>Import an NPTEL playlist</h2>
            </div>
            <span
              className={`status-tag ${workflow === "published" ? "tag-mint" : workflow === "importing" ? "tag-amber" : "tag-mint"}`}
            >
              {workflow === "importing"
                ? "Importing"
                : workflow === "published"
                  ? "Published"
                  : "Ready"}
            </span>
          </div>
          <p>
            Paste a playlist URL and AdaptLearn will draft modules, topics, and
            quiz questions for review.
          </p>
          <form className="import-field" onSubmit={importPlaylist}>
            <input
              value={playlistUrl}
              onChange={(event) => {
                setPlaylistUrl(event.target.value);
                setWorkflow("idle");
              }}
              placeholder="https://youtube.com/playlist?list=..."
              aria-label="NPTEL playlist URL"
            />
            <Button type="submit" disabled={workflow === "importing"}>
              <Icon name="upload" />
              {workflow === "importing" ? "Importing..." : "Import playlist"}
            </Button>
            {workflow === "error" && (
              <small className="workflow-error">{errorMessage}</small>
            )}
          </form>
          {(workflow === "ready" || workflow === "reviewing") && (
            <div className="import-result">
              <Icon name="check" />
              <div>
                <strong>Draft ready for review</strong>
                <p>
                  {importedCourse.title} · {importedCourse.items.length}{" "}
                  lectures · {draftQuizzes.length} quiz drafts ·{" "}
                  {importedCourse.source === "youtube-api"
                    ? "YouTube API"
                    : "Public YouTube feed"}
                </p>
              </div>
              {workflow === "ready" && (
                <Button
                  variant="secondary"
                  onClick={() => setWorkflow("reviewing")}
                >
                  Review draft
                </Button>
              )}
            </div>
          )}
          {workflow === "published" && (
            <div className="import-result published-result">
              <Icon name="check" />
              <div>
                <strong>Course published successfully</strong>
                <p>The draft is now available in the course catalog.</p>
              </div>
              <span className="status-tag tag-mint">Live</span>
              <a
                className="button button-secondary button-small"
                href="#/courses"
              >
                View course catalog <Icon name="arrow" />
              </a>
            </div>
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Weekly activity</span>
              <h2>New enrollments</h2>
            </div>
            <span className="chart-total">
              124 <small>this week</small>
            </span>
          </div>
          <div className="bar-chart">
            {[42, 58, 35, 72, 56, 88, 66].map((height, index) => (
              <div key={index}>
                <i style={{ height: `${height}%` }} />
                <small>{["M", "T", "W", "T", "F", "S", "S"][index]}</small>
              </div>
            ))}
          </div>
        </section>
      </div>
      {workflow === "reviewing" && (
        <section className="panel draft-review-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Course studio · Review</span>
              <h2>Approve quiz drafts</h2>
              <p className="review-summary">
                {approvedCount} of {draftQuizzes.length} drafts approved. Review
                each draft before publishing.
              </p>
            </div>
            <Button onClick={publishDraft} disabled={!approvedCount}>
              <Icon name="upload" />
              Publish course
            </Button>
          </div>
          <div className="draft-list">
            {draftQuizzes.map((quiz) => (
              <div className={`draft-row ${quiz.status}`} key={quiz.id}>
                <div className="draft-index">0{quiz.id}</div>
                <div className="draft-copy">
                  <strong>{quiz.title}</strong>
                  <span>
                    {quiz.topic} · {quiz.questions} questions
                  </span>
                </div>
                <span
                  className={`status-tag ${quiz.status === "approved" ? "tag-mint" : quiz.status === "rejected" ? "tag-coral" : "tag-amber"}`}
                >
                  {quiz.status}
                </span>
                <div className="draft-actions">
                  {quiz.status !== "approved" && (
                    <Button
                      variant="secondary"
                      className="button-small"
                      onClick={() => updateQuiz(quiz.id, "approved")}
                    >
                      <Icon name="check" />
                      Approve
                    </Button>
                  )}
                  {quiz.status !== "rejected" && quiz.status !== "approved" && (
                    <button
                      className="text-link reject-link"
                      onClick={() => updateQuiz(quiz.id, "rejected")}
                    >
                      Reject
                    </button>
                  )}
                  {quiz.status === "rejected" && (
                    <button
                      className="text-link"
                      onClick={() => updateQuiz(quiz.id, "pending")}
                    >
                      Restore
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      <section className="panel risk-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Requires attention</span>
            <h2>Students who may need help</h2>
          </div>
          <span className="muted-label">
            Mastery below 50% or inactive 5+ days
          </span>
        </div>
        <div className="risk-table">
          {[
            ["Ravi K.", "Database Management Systems", "31%", "9 days ago"],
            [
              "Sneha P.",
              "Introduction to Machine Learning",
              "38%",
              "6 days ago",
            ],
            ["Imran S.", "Programming in Python", "44%", "8 days ago"],
          ].map(([name, course, mastery, active]) => (
            <div className="risk-row" key={name}>
              <strong>{name}</strong>
              <span>{course}</span>
              <b>{mastery}</b>
              <small>{active}</small>
              <button className="text-link">Send nudge</button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="empty-state">
      <span className="empty-mark">A</span>
      <h1>That page is not here</h1>
      <p>Let’s get you back to your learning path.</p>
      <a className="button button-primary" href="#/">
        Back home <Icon name="arrow" />
      </a>
    </div>
  );
}

export default App;
