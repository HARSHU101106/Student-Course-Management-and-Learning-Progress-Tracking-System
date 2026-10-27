import { createContext, useContext, useEffect, useState } from "react";
import { coursesApi } from "../api/courses.api.js";

export const CourseContext = createContext(null);

function getSavedCourses() {
  try {
    return JSON.parse(
      localStorage.getItem("adaptlearn-published-courses") || "[]",
    );
  } catch {
    return [];
  }
}

export function CourseProvider({ children }) {
  const [publishedCourses, setCourses] = useState(getSavedCourses);
  const [enrollmentData, setEnrollmentData] = useState({
    student: null,
    items: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    coursesApi.getCourses()
      .then((items) => {
        if (!active) return;
        setCourses(items);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || "Unable to load courses.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const refreshEnrollments = async () => {
    if (!sessionStorage.getItem("token")) {
      setEnrollmentData({ student: null, items: [] });
      return;
    }

    try {
      const data = await coursesApi.getMyEnrollments();
      setEnrollmentData({
        student: data.student || null,
        items: data.items || [],
        error: "",
      });
    } catch (requestError) {
      setEnrollmentData({
        student: null,
        items: [],
        error:
          requestError.response?.data?.message ||
          "Unable to load your enrollments.",
      });
    }
  };

  useEffect(() => {
    if (sessionStorage.getItem("token")) void refreshEnrollments();
  }, []);

  const updateCourses = (update) => {
    setCourses((current) => {
      const next = typeof update === "function" ? update(current) : update;
      localStorage.setItem(
        "adaptlearn-published-courses",
        JSON.stringify(next),
      );
      return next;
    });
  };

  const createCourse = async (course) => {
    const savedCourse = await coursesApi.createCourse(course);
    updateCourses((current) => [...current, savedCourse]);
    return savedCourse;
  };

  const updateCourse = async (courseId, course) => {
    const savedCourse = await coursesApi.updateCourse(courseId, course);
    updateCourses((current) =>
      current.map((item) => (item.id === savedCourse.id ? savedCourse : item)),
    );
    return savedCourse;
  };

  const deleteCourse = async (courseId) => {
    const result = await coursesApi.deleteCourse(courseId);
    updateCourses((current) => current.filter((item) => item.id !== courseId));
    return result;
  };

  return (
    <CourseContext.Provider
      value={{
        publishedCourses,
        setPublishedCourses: updateCourses,
        createCourse,
        updateCourse,
        deleteCourse,
        enrollmentData,
        loading,
        error,
        refreshEnrollments,
      }}
    >
      {children}
    </CourseContext.Provider>
  );
}

export function useCourses() {
  const context = useContext(CourseContext);
  if (!context)
    throw new Error("useCourses must be used within CourseProvider.");
  return context;
}
