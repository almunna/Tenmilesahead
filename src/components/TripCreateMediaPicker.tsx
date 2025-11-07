"use client";

import { useRef, useState } from "react";

type Props = {
  photos: File[];
  videos: File[];
  onPhotosChange: (files: File[]) => void;
  onVideosChange: (files: File[]) => void;
};

export default function TripCreateMediaPicker({
  photos,
  videos,
  onPhotosChange,
  onVideosChange,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // --- helpers for deduping across multiple picks ---
  function fileKey(f: File) {
    return `${f.name}__${f.size}__${f.lastModified}`;
  }

  function dedupeAppend(existing: File[], incoming: File[]) {
    if (!incoming.length) return existing.slice();
    const map = new Map(existing.map((f) => [fileKey(f), f]));
    for (const f of incoming) map.set(fileKey(f), f);
    return Array.from(map.values());
  }

  function splitAndAppend(files: File[]) {
    const imgs = files.filter((f) => f.type.startsWith("image/"));
    const vids = files.filter((f) => f.type.startsWith("video/"));

    // Only update the buckets that actually received files
    if (imgs.length) onPhotosChange(dedupeAppend(photos, imgs));
    if (vids.length) onVideosChange(dedupeAppend(videos, vids));
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    splitAndAppend(files);
    // allow picking the same files again later
    e.target.value = "";
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files || []);
    splitAndAppend(files);
  }

  function onDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  }
  function onDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  const hasSelection = photos.length > 0 || videos.length > 0;

  return (
    <div className="md:col-span-3">
      <label className="label block mb-2">Add Photos/Videos</label>

      <div
        className={[
          "rounded-2xl p-6 sm:p-8 bg-haiti-800/5",
          "border-2 border-dashed border-border",
          "transition-colors duration-150 ease-out",
          isDragging ? "bg-haiti-800/10 border-haiti-800/40" : "",
        ].join(" ")}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDragEnd={() => setIsDragging(false)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onClick={() => inputRef.current?.click()}
        aria-label="Add photos or videos by dropping files here or choosing files"
      >
        <div className="flex flex-col items-center justify-center text-center gap-3 select-none">
          <div className="text-base sm:text-lg font-medium">
            Drag &amp; drop photos/videos here
          </div>
          <div className="text-xs text-muted-foreground">or</div>

          <button
            type="button"
            className="btn"
            onClick={(e) => {
              e.stopPropagation();
              inputRef.current?.click();
            }}
          >
            Choose files
          </button>

          {/* hidden input that powers both click + drop */}
          <input
            ref={inputRef}
            className="hidden"
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={onInputChange}
          />
        </div>
      </div>

      {hasSelection && (
        <div className="mt-2 text-xs text-muted-foreground">
          {photos.length > 0 && (
            <span>
              {photos.length} photo{photos.length > 1 ? "s" : ""}
            </span>
          )}
          {photos.length > 0 && videos.length > 0 && <span> · </span>}
          {videos.length > 0 && (
            <span>
              {videos.length} video{videos.length > 1 ? "s" : ""}
            </span>
          )}
          <span> selected</span>
        </div>
      )}
    </div>
  );
}
