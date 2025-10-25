// app/tutorials/page.tsx
"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  orderBy,
  query,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";

type Tutorial = {
  id?: string;
  title: string;
  youtubeUrl: string;
  createdAt: number;
};

export default function TutorialsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Tutorial[]>([]);
  const [form, setForm] = useState({ title: "", youtubeUrl: "" });

  useEffect(() => {
    const q = query(collection(db, "tutorials"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const arr: Tutorial[] = [];
      snap.forEach((d) => arr.push({ id: d.id, ...(d.data() as any) }));
      setItems(arr);
    });
    return () => unsub();
  }, []);

  async function addTutorial(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    await addDoc(collection(db, "tutorials"), {
      title: form.title,
      youtubeUrl: form.youtubeUrl,
      createdAt: Date.now(),
    });
    setForm({ title: "", youtubeUrl: "" });
  }

  async function remove(id?: string) {
    if (!user || !id) return;
    await deleteDoc(doc(db, "tutorials", id));
  }

  async function saveEdit(id: string, title: string, youtubeUrl: string) {
    if (!user) return;
    await updateDoc(doc(db, "tutorials", id), { title, youtubeUrl });
  }

  return (
    <div className="container py-10 space-y-8">
      <h1 className="text-3xl font-bold">Tutorials</h1>
      <p className="text-slate-600">
        Add, edit, and delete your YouTube tutorial videos.
      </p>

      {user && (
        <form className="card grid md:grid-cols-3 gap-4" onSubmit={addTutorial}>
          <div>
            <label className="label">Title</label>
            <input
              className="input"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>
          <div className="md:col-span-2">
            <label className="label">YouTube URL</label>
            <input
              className="input"
              value={form.youtubeUrl}
              onChange={(e) => setForm({ ...form, youtubeUrl: e.target.value })}
              placeholder="https://www.youtube.com/watch?v=..."
              required
            />
          </div>
          <div className="md:col-span-3">
            <button className="btn" type="submit">
              Add Video
            </button>
          </div>
        </form>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {items.map((t) => (
          <TutorialCard
            key={t.id}
            t={t}
            canEdit={!!user}
            onDelete={() => remove(t.id!)}
            onSave={saveEdit}
          />
        ))}
        {items.length === 0 && (
          <div className="text-slate-600">No tutorials yet.</div>
        )}
      </div>
    </div>
  );
}

function TutorialCard({
  t,
  canEdit,
  onDelete,
  onSave,
}: {
  t: any;
  canEdit: boolean;
  onDelete: () => void;
  onSave: (id: string, title: string, youtubeUrl: string) => void;
}) {
  const [title, setTitle] = useState(t.title);
  const [url, setUrl] = useState(t.youtubeUrl);

  // Basic YouTube embed
  const videoId = new URL(t.youtubeUrl).searchParams.get("v") || "";
  const embed = videoId ? `https://www.youtube.com/embed/${videoId}` : "";

  return (
    <div className="card">
      {embed ? (
        <div className="aspect-video mb-3">
          <iframe
            className="w-full h-full rounded-xl"
            src={embed}
            title={t.title}
            allowFullScreen
          />
        </div>
      ) : (
        <div className="text-slate-500 mb-3">Invalid YouTube URL</div>
      )}

      {canEdit ? (
        <div className="space-y-3">
          <div>
            <label className="label">Title</label>
            <input
              className="input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <label className="label">YouTube URL</label>
            <input
              className="input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button className="btn" onClick={() => onSave(t.id, title, url)}>
              Save
            </button>
            <button
              className="btn bg-red-600 hover:bg-red-700"
              onClick={onDelete}
            >
              Delete
            </button>
          </div>
        </div>
      ) : (
        <div className="font-semibold">{t.title}</div>
      )}
    </div>
  );
}
