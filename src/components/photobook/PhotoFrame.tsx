"use client";

import { useState, useRef } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import type { PagePhoto } from "@/lib/types";

type PhotoFrameProps = {
  photo: PagePhoto;
  photoURL: string;
  slotBounds: { x: number; y: number; width: number; height: number };
  isSelected: boolean;
  onSelect: () => void;
  onUpdatePosition: (position: Partial<PagePhoto["position"]>) => void;
};

export default function PhotoFrame({
  photo,
  photoURL,
  slotBounds,
  isSelected,
  onSelect,
  onUpdatePosition,
}: PhotoFrameProps) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <div
      className={`
        absolute border-2 overflow-hidden cursor-pointer
        ${isSelected ? "border-[#5eb9b3] ring-2 ring-[#5eb9b3]/30" : "border-transparent hover:border-[#5eb9b3]/50"}
      `}
      style={{
        left: `${slotBounds.x}%`,
        top: `${slotBounds.y}%`,
        width: `${slotBounds.width}%`,
        height: `${slotBounds.height}%`,
      }}
      onClick={onSelect}
      onDoubleClick={() => setIsEditing(!isEditing)}
    >
      {isEditing ? (
        <TransformWrapper
          initialScale={1}
          minScale={0.5}
          maxScale={3}
          centerOnInit
        >
          <TransformComponent
            wrapperClass="w-full h-full"
            contentClass="w-full h-full"
          >
            <img
              src={photoURL}
              alt="Photo"
              className="w-full h-full object-contain"
              draggable={false}
            />
          </TransformComponent>
        </TransformWrapper>
      ) : (
        <img
          src={photoURL}
          alt="Photo"
          className="w-full h-full object-cover"
          draggable={false}
        />
      )}

      {isSelected && !isEditing && (
        <div className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded">
          Double-click to reposition
        </div>
      )}

      {isEditing && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-black/80 text-white text-xs px-3 py-1.5 rounded flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(false);
            }}
            className="hover:text-[#5eb9b3]"
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}
