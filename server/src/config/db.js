import mongoose from "mongoose";
import { env } from "./env.js";

mongoose.set("strictQuery", true);

export async function connectDatabase(uri = env.mongoUri) {
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10_000,
    maxPoolSize: 20,
    autoIndex: !env.isProduction || process.env.MONGO_AUTO_INDEX === "true",
  });
  return mongoose.connection;
}

export async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

export function databaseState() {
  return ["disconnected", "connected", "connecting", "disconnecting"][
    mongoose.connection.readyState
  ];
}
