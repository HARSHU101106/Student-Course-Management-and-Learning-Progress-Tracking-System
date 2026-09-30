export default function VideoPlayer({
  videoId = "HXV3zeQKqGY",
  title = "Course lecture",
}) {
  return (
    <div className="embedded-video-frame">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?rel=0&controls=1`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  );
}
