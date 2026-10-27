import { http, HttpResponse } from "msw";

const courses = [
  {
    id: "youtube-demo-dbms",
    playlistId: "demo-dbms",
    title: "Database Management Systems",
    description: "Build a strong foundation in relational database design.",
    category: "Computer Science",
    level: "Intermediate",
    duration: "6 weeks",
    lessons: 2,
    accent: "cyan",
    items: [
      {
        videoId: "HXV3zeQKqGY",
        title: "Database Design and Normalization",
        description: "Learn relational design and normal forms.",
        durationSec: 1800,
      },
      {
        videoId: "7S_tz1z_5bA",
        title: "SQL Joins and Queries",
        description: "Practice querying related tables.",
        durationSec: 2100,
      },
    ],
  },
  {
    id: "youtube-demo-python",
    playlistId: "demo-python",
    title: "Python for Data Analysis",
    description: "Explore data with Python and practical examples.",
    category: "Data Science",
    level: "Beginner",
    duration: "4 weeks",
    lessons: 1,
    accent: "coral",
    items: [
      {
        videoId: "r-uOLxNrNk8",
        title: "Getting Started with Pandas",
        description: "Load, inspect, and transform tabular data.",
        durationSec: 1500,
      },
    ],
  },
];

const enrollments = [];
const learningProgress = new Map();

const users = [
  {
    id: "student-demo",
    name: "Alex Student",
    email: "student@demo.com",
    password: "demo1234",
    role: "student",
  },
  {
    id: "admin-demo",
    name: "AdaptLearn Admin",
    email: "admin@demo.com",
    password: "demo1234",
    role: "admin",
  },
];

const studyPlan = [
  {
    type: "Revisit",
    title: "Normalization",
    reason: "Mastery is at 42%. Rewatch the key section, then retake the quiz.",
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
    reason: "You are ready for the next lecture.",
    time: "60 min",
    accent: "cyan",
  },
];

function publicUser(user) {
  const { password, ...safeUser } = user;
  return safeUser;
}

async function createCourse(request) {
  const denied = authError(request, "admin");
  if (denied) return denied;
  const { title, description, category } = await request.json();
  if (
    typeof title !== "string" ||
    typeof description !== "string" ||
    typeof category !== "string" ||
    !title.trim() ||
    !description.trim() ||
    !category.trim()
  ) {
    return HttpResponse.json(
      { message: "Title, description, and category are required." },
      { status: 400 },
    );
  }
  const course = {
    id: `mock-course-${Date.now()}`,
    title: title.trim(),
    description: description.trim(),
    category: category.trim(),
    items: [],
    lessons: 0,
    level: "Beginner",
    duration: "1 week",
  };
  courses.push(course);
  return HttpResponse.json(course, { status: 201 });
}

async function updateCourse(request, courseId) {
  const denied = authError(request, "admin");
  if (denied) return denied;
  const index = courses.findIndex((course) => course.id === courseId);
  if (index < 0) {
    return HttpResponse.json({ message: "Course not found." }, { status: 404 });
  }
  const updates = await request.json();
  for (const field of ["title", "description", "category"]) {
    if (
      field in updates &&
      (typeof updates[field] !== "string" || !updates[field].trim())
    ) {
      return HttpResponse.json(
        { message: `${field} must be a non-empty string.` },
        { status: 400 },
      );
    }
  }
  courses[index] = {
    ...courses[index],
    ...Object.fromEntries(
      Object.entries(updates).map(([field, value]) => [
        field,
        typeof value === "string" ? value.trim() : value,
      ]),
    ),
  };
  return HttpResponse.json(courses[index]);
}

async function deleteCourse(request, courseId) {
  const denied = authError(request, "admin");
  if (denied) return denied;
  const index = courses.findIndex((course) => course.id === courseId);
  if (index < 0) {
    return HttpResponse.json({ message: "Course not found." }, { status: 404 });
  }
  const [course] = courses.splice(index, 1);
  for (let enrollmentIndex = enrollments.length - 1; enrollmentIndex >= 0; enrollmentIndex -= 1) {
    if (enrollments[enrollmentIndex].courseId === courseId) {
      learningProgress.delete(
        `${enrollments[enrollmentIndex].studentId}:${courseId}`,
      );
      enrollments.splice(enrollmentIndex, 1);
    }
  }
  return HttpResponse.json({ deleted: true, course });
}

function listMyEnrollments(request) {
  const denied = authError(request, "student");
  if (denied) return denied;
  const user = userFromRequest(request);
  const items = enrollments
    .filter((enrollment) => enrollment.studentId === user.id)
    .map((enrollment) => ({
      ...enrollment,
      course: courses.find((course) => course.id === enrollment.courseId)
        ? {
            id: enrollment.courseId,
            title:
              courses.find((course) => course.id === enrollment.courseId)
                .title,
          }
        : null,
    }));
  return HttpResponse.json({
    message: "Enrolled courses fetched successfully",
    student: { id: user.id, name: user.name },
    totalEnrollments: items.length,
    enrollments: items,
    items: items.map((item) => ({
      courseId: item.courseId,
      courseTitle: item.course?.title || item.courseTitle,
      status: item.status,
      progress: item.progress,
    })),
  });
}

async function enroll(request) {
  const denied = authError(request, "student");
  if (denied) return denied;
  const user = userFromRequest(request);
  const { courseId } = await request.json();
  const course = courses.find((item) => item.id === courseId);
  if (!course) {
    return HttpResponse.json({ message: "Course not found." }, { status: 404 });
  }
  if (
    enrollments.some(
      (item) => item.studentId === user.id && item.courseId === courseId,
    )
  ) {
    return HttpResponse.json(
      { message: "Student is already enrolled in this course." },
      { status: 409 },
    );
  }
  const enrollment = {
    id: `enrollment-${Date.now()}-${enrollments.length}`,
    studentId: user.id,
    courseId,
    courseTitle: course.title,
    status: "active",
    progress: 0,
    enrolledAt: new Date().toISOString(),
  };
  enrollments.push(enrollment);
  return HttpResponse.json(
    { message: "Course enrollment successful", enrollment },
    { status: 201 },
  );
}

async function unenroll(request, courseId) {
  const denied = authError(request, "student");
  if (denied) return denied;
  const user = userFromRequest(request);
  const index = enrollments.findIndex(
    (item) => item.studentId === user.id && item.courseId === courseId,
  );
  if (index < 0) {
    return HttpResponse.json(
      { message: "You are not enrolled in this course." },
      { status: 404 },
    );
  }
  enrollments.splice(index, 1);
  learningProgress.delete(`${user.id}:${courseId}`);
  return HttpResponse.json({ message: "Successfully unenrolled from course." });
}

async function updateProgress(request) {
  const denied = authError(request, "student");
  if (denied) return denied;
  const user = userFromRequest(request);
  const { courseId, completedLessons, totalLessons } = await request.json();
  const enrollment = enrollments.find(
    (item) => item.studentId === user.id && item.courseId === courseId,
  );
  if (!enrollment || enrollment.status !== "active") {
    return HttpResponse.json(
      { message: "You must be actively enrolled in this course." },
      { status: 403 },
    );
  }
  const course = courses.find((item) => item.id === courseId);
  const expectedLessons = course?.items?.length || course?.lessons || 0;
  if (
    !Number.isInteger(completedLessons) ||
    !Number.isInteger(totalLessons) ||
    totalLessons !== expectedLessons ||
    expectedLessons < 1 ||
    completedLessons < 0 ||
    completedLessons > totalLessons
  ) {
    return HttpResponse.json(
      { message: "Enter valid completed and total lesson counts." },
      { status: 400 },
    );
  }
  const progress = {
    id: `${user.id}:${courseId}`,
    studentId: user.id,
    courseId,
    completedLessons,
    totalLessons,
    progressPercentage: Math.round((completedLessons / totalLessons) * 100),
    updatedAt: new Date().toISOString(),
  };
  learningProgress.set(`${user.id}:${courseId}`, progress);
  enrollment.progress = progress.progressPercentage;
  if (progress.progressPercentage === 100) enrollment.status = "completed";
  return HttpResponse.json({
    message: "Learning progress updated successfully",
    progress,
  });
}

function playlistIdFromUrl(url) {
  return new URL(url).searchParams.get("list") || "adaptlearn-demo";
}

function userFromRequest(request) {
  const token = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  return users.find((user) => token === `mock-${user.id}`);
}

function authError(request, requiredRole) {
  const user = userFromRequest(request);
  if (!user) {
    return HttpResponse.json(
      { message: "Authentication token is required." },
      { status: 401 },
    );
  }
  if (requiredRole && user.role !== requiredRole) {
    return HttpResponse.json(
      { message: "Access denied. Insufficient permissions." },
      { status: 403 },
    );
  }
  return null;
}

async function login(request) {
  const { email, password } = await request.json();
  const user = users.find(
    (candidate) =>
      candidate.email.toLowerCase() === email?.toLowerCase() &&
      candidate.password === password,
  );

  if (!user) {
    return HttpResponse.json(
      { message: "Invalid email or password." },
      { status: 401 },
    );
  }

  return HttpResponse.json({
    user: publicUser(user),
    student: publicUser(user),
    token: `mock-${user.id}`,
    tokenType: "Bearer",
    expiresIn: "1h",
  });
}

async function register(request, requireDepartment = false) {
  const details = await request.json();
  if (
    !details.name ||
    !details.email ||
    !details.password ||
    (requireDepartment && !details.department)
  ) {
    return HttpResponse.json(
      {
        message: requireDepartment
          ? "Name, email, password, and department are required."
          : "Name, email, and password are required.",
      },
      { status: 400 },
    );
  }
  if (
    users.some(
      (user) => user.email.toLowerCase() === details.email.toLowerCase(),
    )
  ) {
    return HttpResponse.json(
      { message: "An account with this email already exists." },
      { status: 409 },
    );
  }

  const user = {
    id: `student-${Date.now()}`,
    name: details.name,
    email: details.email,
    department: details.department || "",
    password: details.password,
    role: "student",
  };
  users.push(user);
  const publicDetails = publicUser(user);
  return HttpResponse.json(
    {
      message: "Student registered successfully",
      student: publicDetails,
      user: publicDetails,
      token: `mock-${user.id}`,
    },
    { status: 201 },
  );
}

export const handlers = [
  http.get("/api/courses", () =>
    HttpResponse.json({ items: courses, data: courses, count: courses.length }),
  ),
  http.get("/api/v1/courses", () =>
    HttpResponse.json({ items: courses, data: courses, count: courses.length }),
  ),
  http.get("/api/courses/:courseId", ({ params }) => {
    const course = courses.find((item) => item.id === params.courseId);
    return course
      ? HttpResponse.json(course)
      : HttpResponse.json({ message: "Course not found." }, { status: 404 });
  }),
  http.get("/api/v1/courses/:courseId", ({ params }) => {
    const course = courses.find((item) => item.id === params.courseId);
    return course
      ? HttpResponse.json(course)
      : HttpResponse.json({ message: "Course not found." }, { status: 404 });
  }),
  http.post("/api/courses", ({ request }) => createCourse(request)),
  http.post("/api/v1/courses", ({ request }) => createCourse(request)),
  http.put("/api/courses/:courseId", ({ request, params }) =>
    updateCourse(request, params.courseId),
  ),
  http.put("/api/v1/courses/:courseId", ({ request, params }) =>
    updateCourse(request, params.courseId),
  ),
  http.delete("/api/courses/:courseId", ({ request, params }) =>
    deleteCourse(request, params.courseId),
  ),
  http.delete("/api/v1/courses/:courseId", ({ request, params }) =>
    deleteCourse(request, params.courseId),
  ),
  http.get("/api/v1/enrollments/my-courses", ({ request }) =>
    listMyEnrollments(request),
  ),
  http.get("/api/v1/enrollments/me", ({ request }) =>
    listMyEnrollments(request),
  ),
  http.post("/api/v1/enrollments", ({ request }) => enroll(request)),
  http.delete("/api/v1/enrollments/:courseId", ({ request, params }) =>
    unenroll(request, params.courseId),
  ),
  http.get("/api/v1/progress/my-progress", ({ request }) => {
    const denied = authError(request, "student");
    if (denied) return denied;
    const user = userFromRequest(request);
    const progress = enrollments
      .filter((item) => item.studentId === user.id)
      .map((enrollment) => {
        const course = courses.find((item) => item.id === enrollment.courseId);
        const saved = learningProgress.get(`${user.id}:${enrollment.courseId}`);
        return course
          ? {
              ...(saved || {
                id: null,
                studentId: user.id,
                courseId: enrollment.courseId,
                completedLessons: 0,
                totalLessons: course.items?.length || course.lessons || 0,
                progressPercentage: 0,
              }),
              course: { id: course.id, title: course.title },
              status: enrollment.status,
            }
          : null;
      })
      .filter(Boolean);
    return HttpResponse.json({
      message: "Learning progress fetched successfully",
      totalCourses: progress.length,
      progress,
    });
  }),
  http.put("/api/v1/progress", ({ request }) => updateProgress(request)),
  http.post("/api/auth/login", ({ request }) => login(request)),
  http.post("/api/v1/auth/login", ({ request }) => login(request)),
  http.post("/api/auth/register", ({ request }) => register(request)),
  http.post("/api/v1/auth/register", ({ request }) =>
    register(request, true),
  ),
  http.get("/api/ai/plan/:courseId", () =>
    HttpResponse.json({ courseId: "youtube-demo-dbms", items: studyPlan }),
  ),
  http.post("/api/ai/plan/:courseId/regenerate", () =>
    HttpResponse.json({ courseId: "youtube-demo-dbms", items: studyPlan }),
  ),
  http.post("/api/ai/tutor", async ({ request }) => {
    const { question = "" } = await request.json();
    const answer = question.toLowerCase().includes("2nf")
      ? "2NF removes partial dependencies. 3NF also removes transitive dependencies."
      : "The course material covers this topic in the database design lecture.";
    return HttpResponse.json({
      answer,
      citations: [
        { lesson: "Database Design and Normalization", timestamp: 570 },
      ],
    });
  }),
  http.post("/api/ai/quiz/generate", () =>
    HttpResponse.json({
      questions: [
        {
          question: "Which normal form removes partial dependencies?",
          options: ["1NF", "2NF", "3NF", "BCNF"],
          answer: 1,
        },
      ],
    }),
  ),
  http.post("/api/progress/watch", async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(
      { accepted: body.events?.length ?? 1 },
      { status: 202 },
    );
  }),
  http.post("/api/admin/playlists/import", async ({ request }) => {
    const { url } = await request.json();
    try {
      const playlistId = playlistIdFromUrl(url);
      return HttpResponse.json({
        playlistId,
        title: "AdaptLearn Sample Playlist",
        description: "A sample course imported from a YouTube playlist.",
        items: courses[0].items,
      });
    } catch {
      return HttpResponse.json(
        { message: "Enter a valid YouTube playlist URL." },
        { status: 400 },
      );
    }
  }),
];
