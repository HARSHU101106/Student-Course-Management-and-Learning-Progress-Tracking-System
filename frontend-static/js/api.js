// api.js — mock backend. Every function returns a Promise and has the
// same shape the real Express endpoints from the project plan will have,
// so pages don't need to change when the mocks are swapped for fetch calls.

const delay = (ms = 350) => new Promise((r) => setTimeout(r, ms));

export const COURSES = [
  { id: 'dbms', title: 'Database Management Systems', cat: 'Core CS', weeks: 12, modules: 6,
    blurb: 'Relational model, SQL, normalization, indexing and transactions.' },
  { id: 'ml', title: 'Introduction to Machine Learning', cat: 'AI and ML', weeks: 12, modules: 8,
    blurb: 'Regression, classification, trees, kernels and evaluation.' },
  { id: 'py', title: 'Programming and Data Structures in Python', cat: 'Programming', weeks: 12, modules: 7,
    blurb: 'Python fundamentals, recursion, lists, trees and graphs.' },
  { id: 'web', title: 'Web Technologies', cat: 'Web', weeks: 8, modules: 6,
    blurb: 'HTML, CSS, JavaScript, HTTP and building small web apps.' }
];

export const LESSONS = [
  { id: 'dbms-4', n: 4, title: 'Normalization', dur: 1080, topic: 'Normalization' },
  { id: 'dbms-5', n: 5, title: 'Indexing and B+ trees', dur: 980, topic: 'Indexing' }
];

// POST /api/auth/login
export async function apiLogin(email, password) {
  await delay();
  if (!email || password.length < 8) {
    const err = new Error('Invalid email or password'); err.status = 400; throw err;
  }
  const admin = /^admin@/i.test(email);
  const name = admin ? 'Admin' : email.split('@')[0].replace(/[._-]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
  return { name, email, role: admin ? 'admin' : 'student' };
}

// POST /api/auth/register
export async function apiRegister({ name, email, phone, dept, password }) {
  await delay();
  return { name, email, role: 'student', dept };
}

// GET /api/courses
export async function apiGetCourses() {
  await delay(250);
  return COURSES;
}

// POST /api/enrollments
export async function apiEnroll(courseId) {
  await delay(300);
  return { courseId, progress: 0, enrolledAt: new Date().toISOString() };
}

// GET /api/lessons/:id
export async function apiGetLesson(id) {
  await delay(200);
  return LESSONS.find((l) => l.id === id) || LESSONS[0];
}
