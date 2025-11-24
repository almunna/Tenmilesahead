"use client";

import { useDrag } from "react-dnd";
import type { MediaItem } from "@/lib/types";

type PhotoGalleryProps = {
  photos: MediaItem[];
  onAddPhotos?: () => void;
};

function DraggablePhoto({ photo }: { photo: MediaItem }) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: "photo",
    item: { mediaId: photo.id, downloadURL: photo.downloadURL },
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }));

  if (photo.type !== "image") return null;

  return (
    <div
      ref={drag as any}
      className={`
        flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden border-2 border-border
        cursor-grab active:cursor-grabbing hover:border-[#5eb9b3]
        ${isDragging ? "opacity-50" : "opacity-100"}
      `}
    >
      <img
        src={photo.downloadURL}
        alt={photo.caption || "Photo"}
        className="w-full h-full object-cover"
        draggable={false}
      />
    </div>
  );
}

export default function PhotoGallery({
  photos,
  onAddPhotos,
}: PhotoGalleryProps) {
  const imagePhotos = photos.filter((p) => p.type === "image");

  return (
    <div className="h-40 bg-surface border-t border-border flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="flex items-center gap-3">
          <button
            onClick={onAddPhotos}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-[#5eb9b3] text-white rounded-lg hover:bg-[#4ea9a3]"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Photos
          </button>
          <span className="text-sm text-muted-foreground">
            {imagePhotos.length} photo{imagePhotos.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Sort by:</label>
          <select className="text-xs border border-border rounded px-2 py-1">
            <option>Oldest to newest</option>
            <option>Newest to oldest</option>
          </select>
        </div>
      </div>
      <div className="flex-1 overflow-x-auto overflow-y-hidden px-4 py-3">
        <div className="flex gap-3 h-full">
          {imagePhotos.length === 0 ? (
            <div className="flex items-center justify-center w-full text-sm text-muted-foreground">
              No photos available. Upload photos to get started.
            </div>
          ) : (
            imagePhotos.map((photo) => (
              <DraggablePhoto key={photo.id} photo={photo} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
