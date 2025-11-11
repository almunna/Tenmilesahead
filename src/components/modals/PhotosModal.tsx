"use client";

import { useState, useEffect } from "react";
import {
  collection,
  doc,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { db, storage, auth } from "@/lib/firebase";
import ModalShell from "./ModalShell";

export default function PhotosModal({
  tripId,
  onClose,
}: {
  tripId: string;
  onClose: () => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [captions, setCaptions] = useState<Record<string, string>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [coverKey, setCoverKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fileKey = (f: File) => `${f.name}__${f.size}__${f.lastModified}`;

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const fs = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...fs]);
  }

  useEffect(() => {
    setPreviews((prev) => {
      const next = { ...prev };
      for (const f of files) {
        const k = fileKey(f);
        if (!next[k]) next[k] = URL.createObjectURL(f);
      }
      for (const k of Object.keys(next)) {
        if (!files.find((f) => fileKey(f) === k)) {
          URL.revokeObjectURL(next[k]);
          delete next[k];
        }
      }
      return next;
    });
  }, [files]);

  useEffect(
    () => () => Object.values(previews).forEach((u) => URL.revokeObjectURL(u)),
    [previews]
  );

  async function save() {
    if (files.length === 0) return;
    setSaving(true);
    try {
      let chosenCoverMediaId: string | null = null;
      let firstImageMediaId: string | null = null;

      for (const f of files) {
        const k = fileKey(f);
        const isImage = f.type.startsWith("image/");
        const isVideo = f.type.startsWith("video/");
        const kind = isImage ? "image" : isVideo ? "video" : "other";
        if (kind === "other") continue;

        const mediaRef = doc(collection(db, "trips", tripId, "media"));
        const mediaId = mediaRef.id;

        const safeName = f.name.replace(/[^\w.\-]+/g, "_");
        const path = `trip_media/${auth.currentUser?.uid}/${tripId}/${mediaId}/${safeName}`;
        const sref = storageRef(storage, path);
        await uploadBytes(sref, f);
        const url = await getDownloadURL(sref);

        await setDoc(mediaRef, {
          tripId,
          type: kind,
          storagePath: path,
          downloadURL: url,
          createdAt: Date.now(),
          caption: captions[k] || "",
          fileName: f.name,
          size: f.size,
          contentType: f.type,
        } as any);

        if (isImage) {
          if (!firstImageMediaId) firstImageMediaId = mediaId;
          if (coverKey === k) chosenCoverMediaId = mediaId;
        }
      }

      const coverId = chosenCoverMediaId || firstImageMediaId;
      if (coverId) {
        await updateDoc(doc(db, "trips", tripId), {
          coverMediaId: coverId,
          updatedAt: Date.now(),
        } as any);
      }

      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalShell title="Photos" onClose={onClose}>
      <div className="space-y-3">
        <input
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={onPick}
        />
        {files.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No media selected.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {files.map((f) => {
              const k = fileKey(f);
              const url = previews[k];
              const isImage = f.type.startsWith("image/");
              return (
                <div key={k} className="card space-y-2">
                  <div className="w-full h-56 rounded-xl overflow-hidden bg-haiti-800/5">
                    {isImage ? (
                      <img
                        src={url}
                        alt={f.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <video
                        src={url}
                        className="w-full h-full object-cover"
                        controls
                        preload="metadata"
                      />
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      className={
                        coverKey === k
                          ? "text-sm text-green-600"
                          : "text-sm link"
                      }
                      onClick={() => setCoverKey(k)}
                    >
                      {coverKey === k ? "✓ Cover" : "Set as cover"}
                    </button>
                    <button
                      type="button"
                      className="text-sm text-red-600"
                      onClick={() =>
                        setFiles((prev) => prev.filter((x) => fileKey(x) !== k))
                      }
                    >
                      Remove
                    </button>
                  </div>
                  <div>
                    <label className="label">Caption</label>
                    <textarea
                      className="input h-auto min-h-[44px]"
                      rows={1}
                      value={captions[k] || ""}
                      onChange={(e) =>
                        setCaptions((p) => ({ ...p, [k]: e.target.value }))
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="pt-2 flex justify-end gap-2">
          <button className="navlink" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn"
            onClick={save}
            disabled={saving || files.length === 0}
          >
            {saving ? "Saving..." : "Save Photos"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
