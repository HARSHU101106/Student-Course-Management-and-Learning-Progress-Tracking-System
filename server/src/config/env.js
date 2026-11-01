import "dotenv/config";
import { z } from "zod";

const bool = z
  .enum(["true", "false", "1", "0"])
  .transform((value) => value === "true" || value === "1");

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  MONGO_URI: z.string().min(1, "MONGO_URI is required"),
  JWT_SECRET: z
    .string()
    .refine((value) => Buffer.byteLength(value, "utf8") >= 32, {
      message: "JWT_SECRET must be at least 32 bytes",
    }),
  JWT_EXPIRES_IN: z.string().default("1h"),
  CLIENT_URL: z.string().default("http://localhost:5173"),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
  TRUST_PROXY: z.coerce.number().int().min(0).default(1),
  ADMIN_EMAIL: z.string().trim().optional().default(""),
  ADMIN_PASSWORD: z.string().optional().default(""),
  AI_SERVICE_URL: z.string().optional().default(""),
  AI_SERVICE_TOKEN: z.string().optional().default(""),
  AI_TIMEOUT_MS: z.coerce.number().int().min(1000).default(30000),
  YOUTUBE_API_KEY: z.string().optional().default(""),
  RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(300),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(10),
  AI_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(30),
  SEED_ON_BOOT: bool.optional().default(false),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const problems = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".") || "env"}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid environment configuration:\n${problems}`);
}

const raw = parsed.data;

if (Boolean(raw.ADMIN_EMAIL) !== Boolean(raw.ADMIN_PASSWORD)) {
  throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be configured together.");
}

export const env = Object.freeze({
  nodeEnv: raw.NODE_ENV,
  isProduction: raw.NODE_ENV === "production",
  isTest: raw.NODE_ENV === "test",
  port: raw.PORT,
  mongoUri: raw.MONGO_URI,
  jwtSecret: raw.JWT_SECRET,
  jwtExpiresIn: raw.JWT_EXPIRES_IN,
  clientOrigins: raw.CLIENT_URL.split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean),
  bcryptRounds: raw.BCRYPT_ROUNDS,
  trustProxy: raw.TRUST_PROXY,
  adminEmail: raw.ADMIN_EMAIL.toLowerCase(),
  adminPassword: raw.ADMIN_PASSWORD,
  aiServiceUrl: raw.AI_SERVICE_URL.replace(/\/+$/, ""),
  aiServiceToken: raw.AI_SERVICE_TOKEN,
  aiTimeoutMs: raw.AI_TIMEOUT_MS,
  youtubeApiKey: raw.YOUTUBE_API_KEY,
  rateLimitMax: raw.RATE_LIMIT_MAX,
  authRateLimitMax: raw.AUTH_RATE_LIMIT_MAX,
  aiRateLimitMax: raw.AI_RATE_LIMIT_MAX,
  seedOnBoot: raw.SEED_ON_BOOT,
});
