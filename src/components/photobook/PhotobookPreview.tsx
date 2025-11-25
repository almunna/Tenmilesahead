"use client";

import { useState, useEffect } from "react";
import { getLayoutById } from "@/lib/photobook-layouts";
import type { Photobook, MediaItem } from "@/lib/types";

type PhotobookPreviewProps = {
  photobook: Photobook;
  photos: MediaItem[];
  onClose: () => void;
  onDownloadPDF: () => void;
};

export default function PhotobookPreview({
  photobook,
  photos,
  onClose,
  onDownloadPDF,
}: PhotobookPreviewProps) {
  const [currentPageIndex, setCurrentPageIndex] = useState(0);

  const currentPage = photobook.pages[currentPageIndex];
  const layout = currentPage ? getLayoutById(currentPage.layoutId) : null;

  const goToNextPage = () => {
    if (currentPageIndex < photobook.pages.length - 1) {
      setCurrentPageIndex(currentPageIndex + 1);
    }
  };

  const goToPrevPage = () => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex(currentPageIndex - 1);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        goToPrevPage();
      } else if (e.key === "ArrowRight") {
        goToNextPage();
      } else if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentPageIndex, onClose]);

  return (
    <div className="fixed inset-x-0 top-[60px] bottom-0 z-[100] bg-black/90 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-black/50">
        <div className="text-white">
          <h2 className="text-xl font-semibold">{photobook.title}</h2>
          <p className="text-sm text-white/70">
            Page {currentPageIndex + 1} of {photobook.pages.length}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onDownloadPDF}
            className="px-4 py-2 bg-[#ff6b35] text-white rounded-lg hover:bg-[#e55a2b] font-medium"
          >
            Download PDF
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20"
          >
            Close Preview
          </button>
        </div>
      </div>

      {/* Preview Content */}
      <div className="flex-1 flex items-center justify-center p-8 overflow-hidden">
        <div className="relative">
          {/* Page */}
          <div
            className="relative bg-white shadow-2xl"
            style={{
              width: photobook.pageSize === "8x11" ? "8.5in" : photobook.pageSize === "8x10" ? "8in" : "7in",
              height: photobook.pageSize === "8x11" ? "11in" : photobook.pageSize === "8x10" ? "10in" : "10in",
              backgroundColor: currentPage?.backgroundColor || "#ffffff",
            }}
          >
            {/* Photos in layout slots */}
            {layout?.slots.map((slot, idx) => {
              const pagePhoto = currentPage?.photos.find((p) => p.slotIndex === idx);
              if (!pagePhoto) {
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
                    <span className="text-gray-400 text-xs">Empty</span>
                  </div>
                );
              }

              const mediaItem = photos.find((m) => m.id === pagePhoto.mediaId);
              if (!mediaItem || mediaItem.type !== "image") return null;

              return (
                <div
                  key={idx}
                  className="absolute overflow-hidden"
                  style={{
                    left: `${slot.x}%`,
                    top: `${slot.y}%`,
                    width: `${slot.width}%`,
                    height: `${slot.height}%`,
                  }}
                >
                  <img
                    src={mediaItem.downloadURL}
                    alt="Photo"
                    className="w-full h-full object-cover"
                  />
                </div>
              );
            })}

            {/* If no layout or no photos */}
            {(!layout || layout.slots.length === 0) && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                Blank page
              </div>
            )}
          </div>

          {/* Navigation Arrows */}
          {photobook.pages.length > 1 && (
            <>
              <button
                onClick={goToPrevPage}
                disabled={currentPageIndex === 0}
                className="absolute left-[-60px] top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white rounded-full w-12 h-12 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                onClick={goToNextPage}
                disabled={currentPageIndex === photobook.pages.length - 1}
                className="absolute right-[-60px] top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 text-white rounded-full w-12 h-12 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Page Thumbnails */}
      <div className="bg-black/50 border-t border-white/10 px-6 py-4">
        <div className="flex gap-3 overflow-x-auto">
          {photobook.pages.map((page, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentPageIndex(idx)}
              className={`flex-shrink-0 relative ${
                idx === currentPageIndex
                  ? "ring-2 ring-[#5eb9b3]"
                  : "opacity-60 hover:opacity-100"
              }`}
              style={{
                width: "80px",
                height: "100px",
                backgroundColor: page.backgroundColor || "#ffffff",
              }}
            >
              {/* Thumbnail preview */}
              {getLayoutById(page.layoutId)?.slots.map((slot, slotIdx) => {
                const pagePhoto = page.photos.find((p) => p.slotIndex === slotIdx);
                if (!pagePhoto) return null;
                const mediaItem = photos.find((m) => m.id === pagePhoto.mediaId);
                if (!mediaItem) return null;

                return (
                  <div
                    key={slotIdx}
                    className="absolute overflow-hidden"
                    style={{
                      left: `${slot.x}%`,
                      top: `${slot.y}%`,
                      width: `${slot.width}%`,
                      height: `${slot.height}%`,
                    }}
                  >
                    <img
                      src={mediaItem.downloadURL}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                );
              })}
              <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] text-center py-0.5">
                {idx + 1}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Keyboard navigation hint */}
      <div className="absolute bottom-24 left-1/2 -translate-x-1/2 text-white/50 text-xs">
        Use arrow keys to navigate
      </div>
    </div>
  );
}
