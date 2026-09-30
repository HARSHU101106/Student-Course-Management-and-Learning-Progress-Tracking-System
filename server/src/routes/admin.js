import { Router } from "express";
import { importYouTubePlaylist } from "../services/youtube.service.js";

const router = Router();

router.post("/playlists/import", async (request, response) => {
  const { url } = request.body || {};
  if (!url)
    return response
      .status(400)
      .json({ message: "A YouTube playlist URL is required." });
  try {
    const playlist = await importYouTubePlaylist(url);
    return response.json(playlist);
  } catch (error) {
    return response
      .status(422)
      .json({ message: error.message || "Playlist import failed." });
  }
});

export default router;
