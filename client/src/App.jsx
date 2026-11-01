import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import RequireAuth from "./components/RequireAuth.jsx";
import { Spinner } from "./components/ui.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import AdminCourseEditor from "./pages/admin/AdminCourseEditor.jsx";
import AdminCourses from "./pages/admin/AdminCourses.jsx";
import AdminDashboard from "./pages/admin/AdminDashboard.jsx";
import AdminStudents from "./pages/admin/AdminStudents.jsx";
import AdminStudio from "./pages/admin/AdminStudio.jsx";
import Chat from "./pages/Chat.jsx";
import CourseDetail from "./pages/CourseDetail.jsx";
import Courses from "./pages/Courses.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Home from "./pages/Home.jsx";
import Lesson from "./pages/Lesson.jsx";
import Login from "./pages/Login.jsx";
import NotFound from "./pages/NotFound.jsx";
import Notifications from "./pages/Notifications.jsx";
import Profile from "./pages/Profile.jsx";
import Quiz from "./pages/Quiz.jsx";
import Register from "./pages/Register.jsx";

/** Signed-in users have no reason to see the login or register forms. */
function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner label="Checking your session" />;
  if (user) return <Navigate to={user.role === "admin" ? "/admin" : "/dashboard"} replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="courses" element={<Courses />} />
        <Route path="courses/:slug" element={<CourseDetail />} />
        <Route path="login" element={<GuestOnly><Login /></GuestOnly>} />
        <Route path="register" element={<GuestOnly><Register /></GuestOnly>} />

        <Route element={<RequireAuth />}>
          <Route path="lessons/:lessonId" element={<Lesson />} />
          <Route path="quizzes/:id" element={<Quiz />} />
          <Route path="chat" element={<Chat />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        <Route element={<RequireAuth role="student" />}>
          <Route path="dashboard" element={<Dashboard />} />
        </Route>

        <Route element={<RequireAuth role="admin" />}>
          <Route path="admin" element={<AdminDashboard />} />
          <Route path="admin/courses" element={<AdminCourses />} />
          <Route path="admin/courses/:id" element={<AdminCourseEditor />} />
          <Route path="admin/students" element={<AdminStudents />} />
          <Route path="admin/studio" element={<AdminStudio />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
