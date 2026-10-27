import "dotenv/config";

export const env = {
  port: Number(process.env.PORT ?? 4000),
  youtubeApiKey: process.env.YOUTUBE_API_KEY ?? "",
  jwtSecret: process.env.JWT_SECRET ?? "",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "1h",
  adminEmail: process.env.ADMIN_EMAIL?.trim() ?? "",
  adminPassword: process.env.ADMIN_PASSWORD ?? "",
};
