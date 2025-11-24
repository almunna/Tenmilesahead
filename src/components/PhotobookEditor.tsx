"use client";

import { useState, useEffect } from "react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { getLayoutById } from "@/lib/photobook-layouts";
import LayoutPanel from "./photobook/LayoutPanel";
import BackgroundPanel from "./photobook/BackgroundPanel";
import PageCanvas from "./photobook/PageCanvas";
import PhotoGallery from "./photobook/PhotoGallery";
import PhotobookPreview from "./photobook/PhotobookPreview";
import type {
  Photobook,
  PhotobookPage,
  MediaItem,
  LayoutType,
  PageSize,
  BindingType,
} from "@/lib/types";

type PhotobookEditorProps = {
  tripId: string;
  photobookId: string;
  onClose?: () => void;
};

type SidebarTab = "layouts" | "backgrounds" | "pages";

export default function PhotobookEditor({
  tripId,
  photobookId,
  onClose,
}: PhotobookEditorProps) {
  const [photobook, setPhotobook] = useState<Photobook | null>(null);
  const [photos, setPhotos] = useState<MediaItem[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("layouts");
  const [showGrid, setShowGrid] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Load photobook
  useEffect(() => {
    const photobookRef = doc(db, "trips", tripId, "photobooks", photobookId);
    const unsub = onSnapshot(photobookRef, (snap) => {
      if (snap.exists()) {
        setPhotobook({ id: snap.id, ...snap.data() } as Photobook);
      } else {
        // Initialize new photobook
        const newPhotobook: Photobook = {
          id: photobookId,
          tripId,
          ownerId: auth.currentUser?.uid || "",
          title: "Untitled Photobook",
          pageSize: "8x11",
          binding: "hardcover",
          pages: [
            {
              pageNumber: 1,
              layoutId: "single-full",
              backgroundColor: "#ffffff",
              backgroundPattern: null,
              photos: [],
              textBoxes: [],
            },
          ],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        setDoc(photobookRef, newPhotobook);
        setPhotobook(newPhotobook);
      }
    });
    return () => unsub();
  }, [tripId, photobookId]);

  // Load trip photos
  useEffect(() => {
    const photosQuery = collection(db, "trips", tripId, "media");
    const unsub = onSnapshot(photosQuery, (snap) => {
      const items: MediaItem[] = [];
      snap.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as MediaItem);
      });
      setPhotos(items);
    });
    return () => unsub();
  }, [tripId]);

  const savePhotobook = async (updates: Partial<Photobook>) => {
    if (!photobook) return;
    setIsSaving(true);
    try {
      const photobookRef = doc(db, "trips", tripId, "photobooks", photobookId);
      await updateDoc(photobookRef, {
        ...updates,
        updatedAt: Date.now(),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const updateCurrentPage = (updates: Partial<PhotobookPage>) => {
    if (!photobook) return;
    const newPages = [...photobook.pages];
    newPages[currentPageIndex] = {
      ...newPages[currentPageIndex],
      ...updates,
    };
    savePhotobook({ pages: newPages });
  };

  const addPage = () => {
    if (!photobook) return;
    const newPage: PhotobookPage = {
      pageNumber: photobook.pages.length + 1,
      layoutId: "single-full",
      backgroundColor: "#ffffff",
      backgroundPattern: null,
      photos: [],
      textBoxes: [],
    };
    savePhotobook({ pages: [...photobook.pages, newPage] });
    setCurrentPageIndex(photobook.pages.length);
  };

  const deletePage = (index: number) => {
    if (!photobook || photobook.pages.length <= 1) {
      alert("You must have at least one page.");
      return;
    }
    const newPages = photobook.pages.filter((_, i) => i !== index);
    // Renumber pages
    newPages.forEach((page, i) => {
      page.pageNumber = i + 1;
    });
    savePhotobook({ pages: newPages });
    if (currentPageIndex >= newPages.length) {
      setCurrentPageIndex(newPages.length - 1);
    }
  };

  const generatePDF = async () => {
    if (!photobook) return;

    console.log("[Photobook] Starting PDF generation...");
    console.log("[Photobook] Pages:", photobook.pages.length);
    console.log("[Photobook] Photos available:", photos.length);

    try {
      setIsSaving(true);
      console.log("[Photobook] Loading jsPDF library...");
      const { jsPDF } = await import("jspdf");

      // Create PDF
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "in",
        format: photobook.pageSize === "8x11" ? [8.5, 11] : photobook.pageSize === "8x10" ? [8, 10] : [7, 10],
      });

      console.log("[Photobook] PDF created, processing pages...");
      let isFirstPage = true;
      let totalPhotosAdded = 0;

      for (const page of photobook.pages) {
        if (!isFirstPage) {
          pdf.addPage();
        }
        isFirstPage = false;

        console.log(`[Photobook] Processing page ${page.pageNumber}, layout: ${page.layoutId}, photos: ${page.photos.length}`);

        // Set background color
        if (page.backgroundColor && page.backgroundColor !== "#ffffff") {
          const color = page.backgroundColor;
          // Convert hex to RGB
          const r = parseInt(color.slice(1, 3), 16);
          const g = parseInt(color.slice(3, 5), 16);
          const b = parseInt(color.slice(5, 7), 16);
          pdf.setFillColor(r, g, b);
          pdf.rect(0, 0, pdf.internal.pageSize.width, pdf.internal.pageSize.height, "F");
        }

        // Get layout
        const layout = getLayoutById(page.layoutId);
        if (!layout) {
          console.warn(`[Photobook] Layout not found: ${page.layoutId}`);
          continue;
        }

        // Add photos to slots
        for (const pagePhoto of page.photos) {
          const slot = layout.slots[pagePhoto.slotIndex];
          if (!slot) {
            console.warn(`[Photobook] Slot ${pagePhoto.slotIndex} not found in layout`);
            continue;
          }

          const mediaItem = photos.find((m) => m.id === pagePhoto.mediaId);
          if (!mediaItem || mediaItem.type !== "image") {
            console.warn(`[Photobook] Media item not found or not an image: ${pagePhoto.mediaId}`);
            continue;
          }

          try {
            console.log(`[Photobook] Fetching image: ${mediaItem.downloadURL.substring(0, 100)}...`);
            // Fetch image
            const imageResponse = await fetch(mediaItem.downloadURL);
            if (!imageResponse.ok) {
              throw new Error(`Failed to fetch image: ${imageResponse.status}`);
            }
            const imageBlob = await imageResponse.blob();

            // Convert blob to data URL
            const imageDataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(imageBlob);
            });

            // Calculate position and size
            const pageWidth = pdf.internal.pageSize.width;
            const pageHeight = pdf.internal.pageSize.height;
            const x = (slot.x / 100) * pageWidth;
            const y = (slot.y / 100) * pageHeight;
            const width = (slot.width / 100) * pageWidth;
            const height = (slot.height / 100) * pageHeight;

            // Add image to PDF
            pdf.addImage(
              imageDataUrl,
              "JPEG",
              x,
              y,
              width,
              height,
              undefined,
              "FAST"
            );
            totalPhotosAdded++;
            console.log(`[Photobook] Image added successfully at slot ${pagePhoto.slotIndex}`);
          } catch (error) {
            console.error("[Photobook] Error adding image to PDF:", error);
          }
        }
      }

      console.log(`[Photobook] PDF generation complete! Total photos: ${totalPhotosAdded}`);

      // Download PDF
      const filename = `${photobook.title || "photobook"}.pdf`;
      pdf.save(filename);
      console.log(`[Photobook] PDF saved as: ${filename}`);

      // Show success message
      alert(`PDF generated successfully!\n\nPages: ${photobook.pages.length}\nPhotos: ${totalPhotosAdded}\n\nCheck your downloads folder for: ${filename}`);
    } catch (error) {
      console.error("[Photobook] Error generating PDF:", error);
      alert(`Failed to generate PDF.\n\nError: ${error instanceof Error ? error.message : "Unknown error"}\n\nCheck the browser console for details.`);
    } finally {
      setIsSaving(false);
    }
  };

  if (!photobook) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-lg">Loading photobook...</div>
      </div>
    );
  }

  const currentPage = photobook.pages[currentPageIndex];

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="h-screen flex flex-col bg-gray-100">
        {/* Top Toolbar */}
        <div className="h-14 bg-white border-b border-border flex items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onClose}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              ← Back
            </button>
            <input
              type="text"
              value={photobook.title}
              onChange={(e) => savePhotobook({ title: e.target.value })}
              className="text-lg font-semibold border-none outline-none bg-transparent"
              placeholder="Photobook Title"
            />
          </div>
          <div className="flex items-center gap-3">
            <select
              value={photobook.pageSize}
              onChange={(e) =>
                savePhotobook({ pageSize: e.target.value as PageSize })
              }
              className="text-sm border border-border rounded px-2 py-1"
            >
              <option value="8x11">8x11" Hard photo cover</option>
              <option value="8x10">8x10" Hard photo cover</option>
              <option value="7x10">7x10" Hard photo cover</option>
            </select>
            <select
              value={photobook.binding}
              onChange={(e) =>
                savePhotobook({ binding: e.target.value as BindingType })
              }
              className="text-sm border border-border rounded px-2 py-1"
            >
              <option value="hardcover">Hardcover</option>
              <option value="looseleaf">Loose leaf</option>
            </select>
            <div className="h-6 w-px bg-border" />
            <button className="text-sm text-muted-foreground hover:text-foreground">
              Undo
            </button>
            <button className="text-sm text-muted-foreground hover:text-foreground">
              Redo
            </button>
            <button
              onClick={() => setShowPreview(true)}
              className="px-4 py-2 bg-[#5eb9b3] text-white rounded-lg hover:bg-[#4ea9a3] font-medium"
            >
              Preview
            </button>
            <button
              onClick={generatePDF}
              disabled={isSaving}
              className="px-4 py-2 bg-[#ff6b35] text-white rounded-lg hover:bg-[#e55a2b] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? "Generating PDF..." : "Download PDF"}
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar */}
          <div className="w-64 bg-white border-r border-border flex flex-col">
            {/* Tabs */}
            <div className="flex border-b border-border">
              <button
                onClick={() => setSidebarTab("layouts")}
                className={`flex-1 px-3 py-2 text-xs font-medium ${
                  sidebarTab === "layouts"
                    ? "border-b-2 border-[#5eb9b3] text-[#5eb9b3]"
                    : "text-muted-foreground"
                }`}
              >
                Layouts
              </button>
              <button
                onClick={() => setSidebarTab("backgrounds")}
                className={`flex-1 px-3 py-2 text-xs font-medium ${
                  sidebarTab === "backgrounds"
                    ? "border-b-2 border-[#5eb9b3] text-[#5eb9b3]"
                    : "text-muted-foreground"
                }`}
              >
                Backgrounds
              </button>
              <button
                onClick={() => setSidebarTab("pages")}
                className={`flex-1 px-3 py-2 text-xs font-medium ${
                  sidebarTab === "pages"
                    ? "border-b-2 border-[#5eb9b3] text-[#5eb9b3]"
                    : "text-muted-foreground"
                }`}
              >
                Pages
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-hidden">
              {sidebarTab === "layouts" && (
                <LayoutPanel
                  selectedLayout={currentPage.layoutId}
                  onSelectLayout={(layoutId: LayoutType) =>
                    updateCurrentPage({ layoutId, photos: [] })
                  }
                />
              )}
              {sidebarTab === "backgrounds" && (
                <BackgroundPanel
                  selectedColor={currentPage.backgroundColor}
                  onSelectColor={(color) =>
                    updateCurrentPage({ backgroundColor: color })
                  }
                />
              )}
              {sidebarTab === "pages" && (
                <div className="p-4 space-y-2">
                  <button
                    onClick={addPage}
                    className="w-full px-3 py-2 bg-[#5eb9b3] text-white rounded-lg hover:bg-[#4ea9a3] text-sm"
                  >
                    + Add Page
                  </button>
                  <div className="space-y-1">
                    {photobook.pages.map((page, idx) => (
                      <div
                        key={idx}
                        className={`
                          flex items-center justify-between p-2 rounded cursor-pointer
                          ${
                            idx === currentPageIndex
                              ? "bg-[#5eb9b3]/10 border border-[#5eb9b3]"
                              : "hover:bg-gray-100"
                          }
                        `}
                        onClick={() => setCurrentPageIndex(idx)}
                      >
                        <span className="text-sm">Page {page.pageNumber}</span>
                        {photobook.pages.length > 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deletePage(idx);
                            }}
                            className="text-xs text-red-600 hover:text-red-800"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Center Canvas */}
          <div className="flex-1 overflow-auto bg-gray-100">
            <PageCanvas
              page={currentPage}
              photos={photos}
              onUpdatePage={updateCurrentPage}
              showGrid={showGrid}
            />
          </div>

          {/* Right Controls */}
          <div className="w-48 bg-white border-l border-border p-4 space-y-4">
            <div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showGrid}
                  onChange={(e) => setShowGrid(e.target.checked)}
                />
                Show Grid
              </label>
            </div>
            <div className="text-xs text-muted-foreground">
              Page {currentPageIndex + 1} of {photobook.pages.length}
            </div>
            {isSaving && (
              <div className="text-xs text-[#5eb9b3]">Saving...</div>
            )}
          </div>
        </div>

        {/* Bottom Photo Gallery */}
        <PhotoGallery photos={photos} />
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <PhotobookPreview
          photobook={photobook}
          photos={photos}
          onClose={() => setShowPreview(false)}
          onDownloadPDF={() => {
            setShowPreview(false);
            generatePDF();
          }}
        />
      )}
    </DndProvider>
  );
}
