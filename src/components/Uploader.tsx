"use client";
import { useState, useRef } from "react";
import { storage, db } from "@/lib/firebase";
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from "firebase/storage";
import { addDoc, collection, serverTimestamp, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";

type Uploading = {
  id: string;
  name: string;
  progress: number;
  status: "uploading" | "done" | "error";
  error?: string;
};

export default function Uploader({ ownerId, tripId }: { ownerId: string; tripId: string; }) {
  const [uploads, setUploads] = useState<Uploading[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  function onDropFiles(files: FileList | null) {
    if (!files) return;
    Array.from(files).forEach((file) => startUpload(file));
  }

  function startUpload(file: File) {
    const id = uuidv4();
    const storagePath = `trip_media/${ownerId}/${tripId}/${id}-${file.name}`;
    const storageRef = ref(storage, storagePath);
    const task = uploadBytesResumable(storageRef, file, { contentType: file.type });

    setUploads((prev) => [...prev, { id, name: file.name, progress: 0, status: "uploading" }]);

    task.on("state_changed", (snap) => {
      const pct = snap.totalBytes ? Math.round((snap.bytesTransferred / snap.totalBytes) * 100) : 0;
      setUploads((prev) => prev.map(u => u.id === id ? { ...u, progress: pct } : u));
    }, (err) => {
      setUploads((prev) => prev.map(u => u.id === id ? { ...u, status: "error", error: err.message } : u));
    }, async () => {
      const url = await getDownloadURL(task.snapshot.ref);
      // Determine type by mimetype
      const type = file.type.startsWith("video/") ? "video" : "image";
      const media = {
        tripId,
        ownerId,
        type,
        storagePath,
        downloadURL: url,
        caption: "",
        createdAt: Date.now(),
      };
      await addDoc(collection(db, "trips", tripId, "media"), media);
      setUploads((prev) => prev.map(u => u.id === id ? { ...u, status: "done", progress: 100 } : u));
    });
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const files = e.dataTransfer.files;
    onDropFiles(files);
  }

  return (
    <div>
      <div
        className="border-2 border-dashed rounded-2xl p-6 text-center bg-slate-50"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <p className="mb-2 font-semibold">Drag & drop photos/videos here</p>
        <p className="mb-4 text-sm text-slate-600">or</p>
        <button className="btn" onClick={() => fileInput.current?.click()}>Choose files</button>
        <input ref={fileInput} type="file" multiple className="hidden" accept="image/*,video/*"
          onChange={(e) => onDropFiles(e.target.files)} />
      </div>

      {uploads.length > 0 && (
        <div className="mt-4 space-y-2">
          {uploads.map(u => (
            <div key={u.id} className="card">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{u.name}</div>
                  <div className="text-xs text-slate-500">{u.status === "uploading" ? "Uploading…" : u.status}</div>
                </div>
                <div className="w-48 bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div className="h-full bg-brand" style={{ width: `${u.progress}%` }} />
                </div>
              </div>
              {u.error && <div className="text-red-600 text-sm mt-2">{u.error}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
