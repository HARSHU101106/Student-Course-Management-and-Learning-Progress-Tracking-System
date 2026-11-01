import { env } from "../config/env.js";
import { User } from "../models/index.js";

/** Idempotently provision the admin account from ADMIN_EMAIL / ADMIN_PASSWORD. */
export async function ensureAdminAccount() {
  if (!env.adminEmail) return null;
  if (env.adminPassword.length < 12 || Buffer.byteLength(env.adminPassword, "utf8") > 72) {
    throw new Error("ADMIN_PASSWORD must be 12-72 bytes.");
  }

  const existing = await User.findOne({ email: env.adminEmail });
  if (existing) {
    if (existing.role !== "admin") {
      throw new Error(`ADMIN_EMAIL ${env.adminEmail} already belongs to a student account.`);
    }
    return existing;
  }
  return User.create({
    name: "Administrator",
    email: env.adminEmail,
    password: env.adminPassword,
    role: "admin",
  });
}
