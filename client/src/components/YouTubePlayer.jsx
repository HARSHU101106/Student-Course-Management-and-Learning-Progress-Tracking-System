import { useEffect, useRef, useState } from "react";
import { post } from "../lib/api.js";

let apiPromise;
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiPromise) {
    apiPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        apiPromise = undefined;
        reject(new Error("The video player could not be loaded."));
      }, 10000);
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        clearTimeout(timer);
        previous?.();
        resolve(window.YT);
      };
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => {
        clearTimeout(timer);
        apiPromise = undefined;
        reject(new Error("The video player could not be loaded."));
      };
      document.head.appendChild(script);
    });
  }
  return apiPromise;
}

const HEARTBEAT_MS = 15000;
const FLUSH_MS = 30000;

/**
 * Embeds a YouTube video, resumes from the saved position and reports watch heartbeats
 * (batched) so the server can track engagement and remember where the student stopped.
 */
export default function YouTubePlayer({ videoId, courseId, lessonId, startAt = 0, onEnded, title }) {
  const host = useRef(null);
  const player = useRef(null);
  const queue = useRef([]);
  const [failed, setFailed] = useState(null);

  useEffect(() => {
    let cancelled = false;
    let heartbeat;
    let flushTimer;

    const record = (event, deltaSec = 0) => {
      const positionSec = Math.max(0, Math.floor(player.current?.getCurrentTime?.() ?? 0));
      queue.current.push({ courseId, lessonId, event, positionSec, deltaSec });
    };
    const flush = () => {
      if (!queue.current.length) return;
      const events = queue.current.splice(0, 50);
      post("/progress/watch", { events }).catch(() => {});
    };

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !host.current) return;
        const mount = document.createElement("div");
        host.current.replaceChildren(mount);
        player.current = new YT.Player(mount, {
          videoId,
          width: "100%",
          height: "100%",
          playerVars: { rel: 0, modestbranding: 1, start: Math.floor(startAt), origin: window.location.origin },
          events: {
            onStateChange: ({ data }) => {
              if (data === YT.PlayerState.PLAYING) {
                record("play");
                heartbeat = setInterval(() => record("heartbeat", HEARTBEAT_MS / 1000), HEARTBEAT_MS);
              } else {
                clearInterval(heartbeat);
                if (data === YT.PlayerState.PAUSED) record("pause");
                if (data === YT.PlayerState.ENDED) {
                  record("ended");
                  flush();
                  onEnded?.();
                }
              }
            },
          },
        });
        flushTimer = setInterval(flush, FLUSH_MS);
      })
      .catch((error) => !cancelled && setFailed(error.message));

    const onHide = () => document.visibilityState === "hidden" && (record("pause"), flush());
    document.addEventListener("visibilitychange", onHide);

    return () => {
      cancelled = true;
      clearInterval(heartbeat);
      clearInterval(flushTimer);
      document.removeEventListener("visibilitychange", onHide);
      record("pause");
      flush();
      player.current?.destroy?.();
      player.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, courseId, lessonId]);

  if (failed) {
    return (
      <div className="video-frame video-fallback" role="alert">
        <p>{failed}</p>
        <a className="btn btn-secondary btn-sm" href={`https://www.youtube.com/watch?v=${videoId}`} target="_blank" rel="noopener noreferrer">
          Watch on YouTube
        </a>
      </div>
    );
  }
  return <div className="video-frame" ref={host} aria-label={title ?? "Lesson video"} />;
}
