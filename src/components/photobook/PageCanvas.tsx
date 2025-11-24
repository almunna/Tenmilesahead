"use client";

import { useState } from "react";
import { useDrop } from "react-dnd";
import { getLayoutById } from "@/lib/photobook-layouts";
import PhotoFrame from "./PhotoFrame";
import type { PhotobookPage, MediaItem, PagePhoto } from "@/lib/types";

type PageCanvasProps = {
  page: PhotobookPage;
  photos: MediaItem[];
  onUpdatePage: (updates: Partial<PhotobookPage>) => void;
  showGrid?: boolean;
};

export default function PageCanvas({
  page,
  photos,
  onUpdatePage,
  showGrid = true,
}: PageCanvasProps) {
  const layout = getLayoutById(page.layoutId);
  const [selectedPhotoIndex, setSelectedPhotoIndex] =
    (useState<number | null>(null));

  const [{ isOver }, drop] = useDrop(() => ({
    accept: "photo",
    drop: (item: { mediaId: string; downloadURL: string }, monitor) => {
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset || !layout) return;

      // Find which slot the photo was dropped into
      // For now, just add to the first available slot
      const usedSlots = new Set(page.photos.map((p) => p.slotIndex));
      const availableSlotIndex = layout.slots.findIndex(
        (_, idx) => !usedSlots.has(idx)
      );

      if (availableSlotIndex === -1) {
        alert("All photo slots are filled. Choose a different layout or remove a photo.");
        return;
      }

      const newPhoto: PagePhoto = {
        mediaId: item.mediaId,
        slotIndex: availableSlotIndex,
        position: {
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          rotation: 0,
        },
        cropBox: null,
      };

      onUpdatePage({
        photos: [...page.photos, newPhoto],
      });
    },
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
    }),
  }));

  const handleRemovePhoto = (index: number) => {
    const newPhotos = page.photos.filter((_, idx) => idx !== index);
    onUpdatePage({ photos: newPhotos });
    setSelectedPhotoIndex(null);
  };

  const handleUpdatePhotoPosition = (
    photoIndex: number,
    position: Partial<PagePhoto["position"]>
  ) => {
    const newPhotos = [...page.photos];
    newPhotos[photoIndex] = {
      ...newPhotos[photoIndex],
      position: {
        ...newPhotos[photoIndex].position,
        ...position,
      },
    };
    onUpdatePage({ photos: newPhotos });
  };

  if (!layout) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
        Invalid layout
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center p-8">
      <div
        ref={drop as any}
        className={`
          relative bg-white shadow-2xl
          ${isOver ? "ring-4 ring-[#5eb9b3]" : ""}
          ${showGrid ? "bg-grid" : ""}
        `}
        style={{
          width: "8.5in",
          height: "11in",
          backgroundColor: page.backgroundColor,
        }}
      >
        {/* Grid overlay */}
        {showGrid && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `
                linear-gradient(to right, rgba(0,0,0,0.05) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(0,0,0,0.05) 1px, transparent 1px)
              `,
              backgroundSize: "0.5in 0.5in",
            }}
          />
        )}

        {/* Layout slots - show empty slots */}
        {layout.slots.map((slot, idx) => {
          const photoInSlot = page.photos.find((p) => p.slotIndex === idx);

          if (photoInSlot) {
            const mediaItem = photos.find((m) => m.id === photoInSlot.mediaId);
            if (!mediaItem) return null;

            return (
              <PhotoFrame
                key={idx}
                photo={photoInSlot}
                photoURL={mediaItem.downloadURL}
                slotBounds={slot}
                isSelected={selectedPhotoIndex === page.photos.indexOf(photoInSlot)}
                onSelect={() => setSelectedPhotoIndex(page.photos.indexOf(photoInSlot))}
                onUpdatePosition={(pos) =>
                  handleUpdatePhotoPosition(page.photos.indexOf(photoInSlot), pos)
                }
              />
            );
          }

          // Empty slot
          return (
            <div
              key={idx}
              className="absolute border-2 border-dashed border-gray-300 bg-gray-50/50 flex items-center justify-center"
              style={{
                left: `${slot.x}%`,
                top: `${slot.y}%`,
                width: `${slot.width}%`,
                height: `${slot.height}%`,
              }}
            >
              <div className="text-gray-400 text-sm">
                Drag photo here
              </div>
            </div>
          );
        })}

        {/* Hint text when no layout slots */}
        {layout.slots.length === 0 && page.photos.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400">
            Blank canvas - Choose a layout or drag photos here
          </div>
        )}
      </div>

      {/* Photo controls */}
      {selectedPhotoIndex !== null && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/80 text-white rounded-lg px-4 py-2 flex gap-3">
          <button
            onClick={() => handleRemovePhoto(selectedPhotoIndex)}
            className="text-sm hover:text-red-400"
          >
            Remove Photo
          </button>
        </div>
      )}
    </div>
  );
}
