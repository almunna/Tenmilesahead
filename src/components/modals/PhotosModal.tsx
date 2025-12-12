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
import { getPhotoTakenAt } from "@/lib/utils";

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

        // Extract EXIF date for proper chronological ordering
        const takenAt = await getPhotoTakenAt(f);

        await setDoc(mediaRef, {
          tripId,
          type: kind,
          storagePath: path,
          downloadURL: url,
          createdAt: Date.now(),
          takenAt,
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
    <div
      className="fixed inset-x-0 top-[60px] bottom-0 z-[100] bg-black/50 flex items-stretch md:items-center justify-center p-0 md:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="
          w-full max-w-full md:max-w-2xl lg:max-w-3xl
          h-auto max-h-[80vh]
          bg-surface text-foreground border border-border shadow-lg
          md:rounded-xl
          flex flex-col
        "
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sticky header */}
        <div className="sticky top-0 z-10 bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/70 border-b border-border">
          <div className="flex items-center justify-between px-4 md:px-6 py-3">
            <h3 className="text-lg font-semibold">Add Photos/Videos</h3>
            <button className="navlink" onClick={onClose} aria-label="Close">
              Close
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 px-4 md:px-6 py-4 overflow-y-auto">
          <div className="space-y-4">
            {/* Picker block */}
            <div>
              <div className="label mb-2">Add Photos/Videos</div>
              <div
                className="rounded-[18px] p-6 text-center bg-[#f7fafd] border-2 border-dashed"
                style={{ borderColor: "#c7d7e6" }}
              >
                <div className="text-[15px] font-semibold text-foreground">
                  Drag &amp; drop photos/videos here
                </div>
                <div className="text-xs text-muted-foreground my-1">or</div>

                <label className="inline-block">
                  <span className="px-4 py-2 rounded-xl shadow-sm bg-[#5eb9b3] hover:bg-[#4ea9a3] text-white cursor-pointer select-none">
                    Choose files
                  </span>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    onChange={onPick}
                    className="sr-only"
                  />
                </label>
              </div>
            </div>

            {/* Grid */}
            {files.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No media selected yet. Use the picker above.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {files.map((f) => {
                  const k = fileKey(f);
                  const url = previews[k];
                  const isImage = f.type.startsWith("image/");
                  return (
                    <div key={k} className="card space-y-2">
                      <div className="w-full h-44 sm:h-56 md:h-60 xl:h-72 rounded-xl overflow-hidden bg-haiti-800/5">
                        {isImage ? (
                          <img
                            src={url}
                            alt={f.name}
                            className="w-full h-full object-cover"
                            draggable={false}
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
                              ? "text-sm text-green-600 cursor-default"
                              : "text-sm link"
                          }
                          onClick={() => coverKey !== k && setCoverKey(k)}
                          disabled={coverKey === k}
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
                          className="input h-9 min-h-[2.25rem] resize-none"
                          rows={1}
                          placeholder="Add a caption…"
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
          </div>
        </div>

        {/* Sticky footer */}
        <div className="sticky bottom-0 z-10 bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/70 border-t border-border">
          <div className="px-4 md:px-6 py-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              className="btn w-full sm:w-auto"
              onClick={save}
              disabled={saving || files.length === 0}
            >
              {saving ? "Saving…" : "Save Photos"}
            </button>
            <button
              className="navlink w-full sm:w-auto"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
