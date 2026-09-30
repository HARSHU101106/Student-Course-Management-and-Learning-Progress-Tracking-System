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

function playlistIdFromUrl(url) {
  return new URL(url).searchParams.get("list") || "adaptlearn-demo";
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
    token: `mock-${user.id}`,
  });
}

export const handlers = [
  http.get("/api/courses", () => HttpResponse.json({ items: courses })),
  http.get("/api/courses/:courseId", ({ params }) => {
    const course = courses.find((item) => item.id === params.courseId);
    return course
      ? HttpResponse.json(course)
      : HttpResponse.json({ message: "Course not found." }, { status: 404 });
  }),
  http.get("/api/enrollments/me", () =>
    HttpResponse.json({
      student: { id: "student-demo", name: "Alex Student" },
      items: courses.map((course, index) => ({
        courseId: course.id,
        courseTitle: course.title,
        status: index === 0 ? "active" : "enrolled",
        progress: 0,
      })),
    }),
  ),
  http.post("/api/auth/login", ({ request }) => login(request)),
  http.post("/api/auth/register", async ({ request }) => {
    const details = await request.json();
    if (!details.name || !details.email || !details.password) {
      return HttpResponse.json(
        { message: "Name, email, and password are required." },
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
      password: details.password,
      role: "student",
    };
    users.push(user);
    return HttpResponse.json(
      { user: publicUser(user), token: `mock-${user.id}` },
      { status: 201 },
    );
  }),
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
