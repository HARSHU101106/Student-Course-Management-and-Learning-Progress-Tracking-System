import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

const YOUTUBE_API = "https://www.googleapis.com/youtube/v3";
const ALLOWED_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"]);
const PLAYLIST_ID = /^[A-Za-z0-9_-]{10,64}$/;
const MAX_ITEMS = 300;
const TIMEOUT_MS = 12_000;

/**
 * Extract a playlist id from a user-supplied URL. Only YouTube hosts are accepted and
 * the outbound request URL is always built from our own constants, so a caller can never
 * make the server fetch an arbitrary address (SSRF).
 */
export function playlistIdFromUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (!["https:", "http:"].includes(url.protocol)) return null;
  if (!ALLOWED_HOSTS.has(url.hostname.toLowerCase())) return null;
  const id = url.searchParams.get("list");
  return id && PLAYLIST_ID.test(id) ? id : null;
}

function decodeXml(value = "") {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function tagValue(block, tag) {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`));
  return match ? decodeXml(match[1]) : "";
}

async function getJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error?.message || "YouTube API request failed.");
  return body;
}

async function importWithApi(playlistId) {
  const meta = await getJson(
    `${YOUTUBE_API}/playlists?${new URLSearchParams({ part: "snippet", id: playlistId, key: env.youtubeApiKey })}`,
  );
  const playlist = meta.items?.[0];
  if (!playlist) throw new Error("That playlist was not found or is not public.");

  const items = [];
  let pageToken = "";
  do {
    const params = new URLSearchParams({
      part: "snippet,contentDetails",
      playlistId,
      maxResults: "50",
      key: env.youtubeApiKey,
    });
    if (pageToken) params.set("pageToken", pageToken);
    const page = await getJson(`${YOUTUBE_API}/playlistItems?${params}`);
    for (const item of page.items ?? []) {
      const videoId = item.contentDetails?.videoId;
      const title = item.snippet?.title;
      if (!videoId || !title || title === "Private video" || title === "Deleted video") continue;
      items.push({ videoId, title, description: item.snippet?.description ?? "", position: items.length });
    }
    pageToken = page.nextPageToken || "";
  } while (pageToken && items.length < MAX_ITEMS);

  return {
    playlistId,
    title: playlist.snippet.title,
    description: playlist.snippet.description ?? "",
    channel: playlist.snippet.channelTitle ?? "",
    source: "youtube-api",
    items: items.slice(0, MAX_ITEMS),
  };
}

async function importWithFeed(playlistId) {
  const response = await fetch(
    `https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(playlistId)}`,
    { signal: AbortSignal.timeout(TIMEOUT_MS) },
  );
  if (!response.ok) throw new Error("That playlist could not be loaded. Check that it is public.");
  const xml = await response.text();
  const items = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)]
    .map((match, position) => ({
      videoId: tagValue(match[1], "yt:videoId"),
      title: tagValue(match[1], "title"),
      description: tagValue(match[1], "media:description"),
      position,
    }))
    .filter((item) => item.videoId && item.title)
    .slice(0, MAX_ITEMS);
  if (!items.length) throw new Error("No public videos were found in that playlist.");

  // The first <title> in the feed is the playlist title (entries come after it).
  const header = xml.split("<entry>")[0];
  return {
    playlistId,
    title: tagValue(header, "title") || "Imported YouTube playlist",
    description: "",
    channel: tagValue(header, "name"),
    source: "youtube-feed",
    items,
  };
}

export async function importYouTubePlaylist(url) {
  const playlistId = playlistIdFromUrl(url);
  if (!playlistId) {
    throw ApiError.badRequest("Enter a valid YouTube playlist URL that contains a list= parameter.");
  }
  try {
    return env.youtubeApiKey ? await importWithApi(playlistId) : await importWithFeed(playlistId);
  } catch (error) {
    throw new ApiError(422, error.name === "TimeoutError" ? "YouTube did not respond in time." : error.message);
  }
}

const STOP = new Set(["the", "a", "an", "of", "to", "and", "in", "for", "on", "with", "using", "introduction"]);

function tokens(text) {
  return new Set(
    String(text)
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, " ")
      .split(/\s+/)
      .filter((word) => word && !STOP.has(word)),
  );
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const word of a) if (b.has(word)) shared += 1;
  return shared / (a.size + b.size - shared);
}

/**
 * Map playlist videos onto existing lessons by title similarity.
 * Returns [{ lessonId, videoId, score }] for confident matches plus the unmatched lesson ids.
 */
export function matchVideosToLessons(lessons, items, threshold = 0.34) {
  const used = new Set();
  const matches = [];
  const unmatched = [];

  for (const lesson of lessons) {
    const lessonTokens = tokens(lesson.title);
    let best = null;
    for (const item of items) {
      if (used.has(item.videoId)) continue;
      const score = jaccard(lessonTokens, tokens(item.title));
      if (score >= threshold && (!best || score > best.score)) best = { item, score };
    }
    if (best) {
      used.add(best.item.videoId);
      matches.push({ lessonId: String(lesson._id), videoId: best.item.videoId, title: best.item.title, score: Math.round(best.score * 100) / 100 });
    } else {
      unmatched.push(String(lesson._id));
    }
  }
  return { matches, unmatched };
}
