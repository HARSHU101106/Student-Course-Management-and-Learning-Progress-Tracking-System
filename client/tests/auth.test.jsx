import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import RequireAuth from "../src/components/RequireAuth.jsx";
import * as apiModule from "../src/lib/api.js";
import Login from "../src/pages/Login.jsx";
import Register from "../src/pages/Register.jsx";
import { renderWithRouter } from "./helpers.jsx";

const admin = { id: "a1", name: "Ada Admin", email: "a@x.io", role: "admin" };
const student = { id: "s1", name: "Sam Student", email: "s@x.io", role: "student" };

describe("Login", () => {
  it("shows the server's error and keeps the user on the form", async () => {
    vi.spyOn(apiModule.api, "post").mockRejectedValue(apiModule.toApiError({ response: { status: 401, data: { message: "Invalid email or password." } } }));
    renderWithRouter(<Login />);
    await userEvent.type(screen.getByLabelText("Email"), "sam@x.io");
    await userEvent.type(screen.getByLabelText("Password"), "wrong-password");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password.");
    expect(localStorage.getItem(apiModule.TOKEN_KEY)).toBeNull();
  });

  it("stores the token and routes a student to the dashboard", async () => {
    vi.spyOn(apiModule.api, "post").mockResolvedValue({ data: { data: { token: "jwt-123", user: student } } });
    renderWithRouter(
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<p>Student dashboard</p>} />
        <Route path="/admin" element={<p>Admin console</p>} />
      </Routes>,
    );
    await userEvent.type(screen.getByLabelText("Email"), "s@x.io");
    await userEvent.type(screen.getByLabelText("Password"), "a-long-enough-password");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Student dashboard")).toBeInTheDocument();
    expect(localStorage.getItem(apiModule.TOKEN_KEY)).toBe("jwt-123");
  });

  it("keeps the button disabled until both fields are filled", async () => {
    renderWithRouter(<Login />);
    expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();
  });
});

describe("Register", () => {
  it("validates on the client before calling the API", async () => {
    const post = vi.spyOn(apiModule.api, "post");
    renderWithRouter(<Register />);
    await userEvent.type(screen.getByLabelText("Full name"), "A");
    await userEvent.type(screen.getByLabelText("Email"), "not-an-email");
    await userEvent.type(screen.getByLabelText("Password"), "short");
    await userEvent.type(screen.getByLabelText("Confirm password"), "different");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText("Use at least 12 characters.")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.getByText("Passwords do not match.")).toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it("surfaces field errors returned by the server", async () => {
    vi.spyOn(apiModule.api, "post").mockRejectedValue(
      apiModule.toApiError({ response: { status: 400, data: { message: "Validation failed.", details: [{ path: "email", message: "Email already registered." }] } } }),
    );
    renderWithRouter(<Register />);
    await userEvent.type(screen.getByLabelText("Full name"), "Sam Student");
    await userEvent.type(screen.getByLabelText("Email"), "sam@x.io");
    await userEvent.type(screen.getByLabelText("Password"), "a-long-enough-password");
    await userEvent.type(screen.getByLabelText("Confirm password"), "a-long-enough-password");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(screen.getByText("Email already registered.")).toBeInTheDocument());
  });
});

describe("RequireAuth", () => {
  const routes = (
    <Routes>
      <Route path="/login" element={<p>Login page</p>} />
      <Route path="/dashboard" element={<p>Student home</p>} />
      <Route path="/admin" element={<p>Admin home</p>} />
      <Route element={<RequireAuth />}><Route path="/chat" element={<p>Chat page</p>} /></Route>
      <Route element={<RequireAuth role="admin" />}><Route path="/admin/students" element={<p>Students admin</p>} /></Route>
    </Routes>
  );

  it("sends anonymous visitors to the login page", async () => {
    renderWithRouter(routes, { route: "/chat" });
    expect(await screen.findByText("Login page")).toBeInTheDocument();
  });

  it("lets signed-in users through", async () => {
    localStorage.setItem(apiModule.TOKEN_KEY, "jwt");
    vi.spyOn(apiModule.api, "get").mockResolvedValue({ data: { data: { user: student } } });
    renderWithRouter(routes, { route: "/chat" });
    expect(await screen.findByText("Chat page")).toBeInTheDocument();
  });

  it("keeps students out of admin pages", async () => {
    localStorage.setItem(apiModule.TOKEN_KEY, "jwt");
    vi.spyOn(apiModule.api, "get").mockResolvedValue({ data: { data: { user: student } } });
    renderWithRouter(routes, { route: "/admin/students" });
    expect(await screen.findByText("Student home")).toBeInTheDocument();
  });

  it("admits admins to admin pages", async () => {
    localStorage.setItem(apiModule.TOKEN_KEY, "jwt");
    vi.spyOn(apiModule.api, "get").mockResolvedValue({ data: { data: { user: admin } } });
    renderWithRouter(routes, { route: "/admin/students" });
    expect(await screen.findByText("Students admin")).toBeInTheDocument();
  });

  it("drops an invalid stored token and requires sign-in again", async () => {
    localStorage.setItem(apiModule.TOKEN_KEY, "expired");
    vi.spyOn(apiModule.api, "get").mockRejectedValue(apiModule.toApiError({ response: { status: 401, data: { message: "Invalid or expired token." } } }));
    renderWithRouter(routes, { route: "/chat" });
    expect(await screen.findByText("Login page")).toBeInTheDocument();
    expect(localStorage.getItem(apiModule.TOKEN_KEY)).toBeNull();
  });
});
