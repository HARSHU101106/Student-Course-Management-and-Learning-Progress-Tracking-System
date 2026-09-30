import { env } from "../config/env.js";

const YOUTUBE_API = "https://www.googleapis.com/youtube/v3";

function playlistIdFromUrl(value) {
  try {
    const url = new URL(value);
    if (url.hostname === "youtu.be") return url.searchParams.get("list");
    if (url.hostname.endsWith("youtube.com"))
      return url.searchParams.get("list");
  } catch {
    return null;
  }
  return null;
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
  const match = block.match(
    new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`),
  );
  return match ? decodeXml(match[1]) : "";
}

async function requestJson(url) {
  const response = await fetch(url);
  const body = await response.json();
  if (!response.ok)
    throw new Error(body?.error?.message || "YouTube API request failed.");
  return body;
}

async function importWithApi(playlistId) {
  const params = new URLSearchParams({
    part: "snippet,status",
    id: playlistId,
    key: env.youtubeApiKey,
  });
  const playlist = await requestJson(`${YOUTUBE_API}/playlists?${params}`);
  const playlistItem = playlist.items?.[0];
  if (!playlistItem)
    throw new Error("That YouTube playlist was not found or is not public.");

  const items = [];
  let pageToken = "";
  do {
    const itemParams = new URLSearchParams({
      part: "snippet,contentDetails",
      playlistId,
      maxResults: "50",
      key: env.youtubeApiKey,
    });
    if (pageToken) itemParams.set("pageToken", pageToken);
    const page = await requestJson(
      `${YOUTUBE_API}/playlistItems?${itemParams}`,
    );
    items.push(
      ...(page.items || [])
        .filter((item) => item.snippet?.title !== "Private video")
        .map((item) => ({
          videoId: item.contentDetails?.videoId,
          title: item.snippet?.title,
          description: item.snippet?.description || "",
          position: item.snippet?.position ?? items.length,
          publishedAt:
            item.contentDetails?.videoPublishedAt || item.snippet?.publishedAt,
          thumbnail:
            item.snippet?.thumbnails?.medium?.url ||
            item.snippet?.thumbnails?.default?.url ||
            null,
        })),
    );
    pageToken = page.nextPageToken || "";
  } while (pageToken);

  return {
    playlistId,
    title: playlistItem.snippet.title,
    description: playlistItem.snippet.description || "",
    channel: playlistItem.snippet.channelTitle || "",
    source: "youtube-api",
    items,
  };
}

async function importWithFeed(playlistId) {
  const response = await fetch(
    `https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(playlistId)}`,
  );
  if (!response.ok)
    throw new Error(
      "That YouTube playlist could not be loaded. Check that it is public.",
    );
  const xml = await response.text();
  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)]
    .map((match, position) => {
      const block = match[1];
      return {
        videoId: tagValue(block, "yt:videoId"),
        title: tagValue(block, "title"),
        description: tagValue(block, "media:description"),
        position,
        publishedAt: tagValue(block, "published"),
        thumbnail: null,
      };
    })
    .filter((item) => item.videoId && item.title);
  if (!entries.length)
    throw new Error("No public videos were found in that playlist.");
  const title = tagValue(xml, "title") || "Imported YouTube playlist";
  return {
    playlistId,
    title,
    description: "Imported from the public YouTube playlist feed.",
    channel: "",
    source: "youtube-feed",
    items: entries,
  };
}

export async function importYouTubePlaylist(url) {
  const playlistId = playlistIdFromUrl(url);
  if (!playlistId)
    throw new Error(
      "Enter a valid YouTube playlist URL containing a playlist ID.",
    );
  return env.youtubeApiKey
    ? importWithApi(playlistId)
    : importWithFeed(playlistId);
}
