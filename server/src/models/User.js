import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { cleanJson } from "./plugins.js";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ["student", "admin"], default: "student" },
    department: { type: String, trim: true, maxlength: 80, default: "" },
    weeklyHours: { type: Number, min: 1, max: 80, default: 6 },
    isActive: { type: Boolean, default: true },
    passwordChangedAt: { type: Date, select: false },
    lastLoginAt: { type: Date },
  },
  { timestamps: true },
);

userSchema.index({ role: 1, createdAt: -1 });
userSchema.index({ name: 1 });

userSchema.pre("save", async function hashPassword() {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, env.bcryptRounds);
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

cleanJson(userSchema);

export const User = mongoose.models.User || mongoose.model("User", userSchema);

// A real hash computed once, used to keep login timing uniform when the email is unknown.
export const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", env.bcryptRounds);
