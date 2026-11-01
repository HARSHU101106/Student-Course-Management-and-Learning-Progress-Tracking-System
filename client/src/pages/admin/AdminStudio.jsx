import { useState } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, ErrorBanner, Field, Notice, PageHeader } from "../../components/ui.jsx";
import { useDocumentTitle } from "../../hooks.js";
import { fieldErrors, post } from "../../lib/api.js";

export default function AdminStudio() {
  useDocumentTitle("Course Studio");
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState(null);
  const [form, setForm] = useState({ title: "", category: "General", level: "Beginner", publish: false });
  const [created, setCreated] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState(null);
  const [errors, setErrors] = useState({});

  async function load(event) {
    event.preventDefault();
    setBusy("preview");
    setError(null);
    setCreated(null);
    try {
      const body = await post("/admin/playlists/preview", { url: url.trim() });
      setPreview(body.data);
      setForm((f) => ({ ...f, title: body.data.title }));
    } catch (err) {
      setPreview(null);
      setError(err);
    } finally {
      setBusy("");
    }
  }

  async function create(event) {
    event.preventDefault();
    setBusy("create");
    setError(null);
    setErrors({});
    try {
      const body = await post("/admin/courses/from-playlist", { url: url.trim(), title: form.title.trim(), category: form.category.trim() || "General", level: form.level, publish: form.publish });
      setCreated(body.data);
    } catch (err) {
      setError(err);
      setErrors(fieldErrors(err));
    } finally {
      setBusy("");
    }
  }

  return (
    <>
      <PageHeader title="Course Studio" subtitle="Turn a public YouTube playlist into a course in one step." />
      <form className="card form" onSubmit={load} noValidate>
        <Field label="YouTube playlist URL" type="url" placeholder="https://www.youtube.com/playlist?list=…" hint="Only public playlists on youtube.com are accepted." value={url} onChange={(e) => setUrl(e.target.value)} />
        <Button type="submit" loading={busy === "preview"} disabled={!url.trim()}>Preview playlist</Button>
      </form>
      <ErrorBanner error={error && !Object.keys(errors).length ? error : null} />

      {created && (
        <Notice tone="success">
          Created “{created.course.title}” with {created.lessonCount} lessons{created.enriched ? " (modules and topics suggested by the AI studio)" : ""}.{" "}
          <Link to={`/admin/courses/${created.course.id}`}>Open in the editor</Link> to add notes and quizzes.
        </Notice>
      )}

      {preview && !created && (
        <div className="grid grid-2 section">
          <form className="card form" onSubmit={create} noValidate>
            <h2>Create course</h2>
            <p className="muted">{preview.items.length} videos from {preview.channel || "this playlist"}.</p>
            <Field label="Course title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} error={errors.title} />
            <Field label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} error={errors.category} />
            <Field label="Level">{(props) => <select {...props} value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })}>{["Beginner", "Intermediate", "Advanced"].map((l) => <option key={l}>{l}</option>)}</select>}</Field>
            <label className="check-row"><input type="checkbox" checked={form.publish} onChange={(e) => setForm({ ...form, publish: e.target.checked })} /> Publish immediately (students are notified)</label>
            <Button type="submit" loading={busy === "create"}>Create course from playlist</Button>
          </form>
          <section className="card" aria-labelledby="videos-title">
            <h2 id="videos-title">Videos <Badge tone="muted">{preview.items.length}</Badge></h2>
            <ol className="lesson-list scroll">
              {preview.items.map((item) => <li key={item.videoId}>{item.title}</li>)}
            </ol>
          </section>
        </div>
      )}
    </>
  );
}
