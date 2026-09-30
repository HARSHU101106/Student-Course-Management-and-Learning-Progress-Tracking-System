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
    Promise.all([coursesApi.getCourses(), coursesApi.getMyEnrollments()])
      .then(([items, enrollments]) => {
        if (!active) return;
        setCourses(items);
        setEnrollmentData(enrollments);
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

  return (
    <CourseContext.Provider
      value={{
        publishedCourses,
        setPublishedCourses: updateCourses,
        enrollmentData,
        loading,
        error,
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
