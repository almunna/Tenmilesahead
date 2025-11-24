import { NextRequest, NextResponse } from "next/server";
import { jsPDF } from "jspdf";
import { doc, getDoc, collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Photobook, MediaItem } from "@/lib/types";
import { getLayoutById } from "@/lib/photobook-layouts";

export async function POST(req: NextRequest) {
  try {
    const { tripId, photobookId } = await req.json();

    if (!tripId || !photobookId) {
      return NextResponse.json(
        { error: "Missing tripId or photobookId" },
        { status: 400 }
      );
    }

    // Fetch photobook data
    const photobookRef = doc(db, "trips", tripId, "photobooks", photobookId);
    const photobookSnap = await getDoc(photobookRef);

    if (!photobookSnap.exists()) {
      return NextResponse.json(
        { error: "Photobook not found" },
        { status: 404 }
      );
    }

    const photobook = {
      id: photobookSnap.id,
      ...photobookSnap.data(),
    } as Photobook;

    // Fetch all media
    const mediaSnap = await getDocs(collection(db, "trips", tripId, "media"));
    const mediaItems: MediaItem[] = [];
    mediaSnap.forEach((doc) => {
      mediaItems.push({ id: doc.id, ...doc.data() } as MediaItem);
    });

    // Create PDF
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "in",
      format: photobook.pageSize === "8x11" ? [8.5, 11] : photobook.pageSize === "8x10" ? [8, 10] : [7, 10],
    });

    let isFirstPage = true;

    for (const page of photobook.pages) {
      if (!isFirstPage) {
        pdf.addPage();
      }
      isFirstPage = false;

      // Set background color
      if (page.backgroundColor && page.backgroundColor !== "#ffffff") {
        pdf.setFillColor(page.backgroundColor);
        pdf.rect(0, 0, pdf.internal.pageSize.width, pdf.internal.pageSize.height, "F");
      }

      // Get layout
      const layout = getLayoutById(page.layoutId);
      if (!layout) continue;

      // Add photos to slots
      for (const pagePhoto of page.photos) {
        const slot = layout.slots[pagePhoto.slotIndex];
        if (!slot) continue;

        const mediaItem = mediaItems.find((m) => m.id === pagePhoto.mediaId);
        if (!mediaItem || mediaItem.type !== "image") continue;

        try {
          // Fetch image
          const imageResponse = await fetch(mediaItem.downloadURL);
          const imageBlob = await imageResponse.blob();
          const imageDataUrl = await blobToDataURL(imageBlob);

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
        } catch (error) {
          console.error("Error adding image to PDF:", error);
        }
      }
    }

    // Generate PDF buffer
    const pdfBuffer = pdf.output("arraybuffer");

    // Return PDF
    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${photobook.title || "photobook"}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Error generating PDF:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 }
    );
  }
}

// Helper function to convert Blob to Data URL
function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
