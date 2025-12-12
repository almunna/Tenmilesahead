import exifr from "exifr";

export function classNames(...args: Array<string | boolean | undefined | null>) {
  return args.filter(Boolean).join(" ");
}

/**
 * Extract the actual photo taken date from EXIF metadata.
 * Falls back to file.lastModified if no EXIF date is found.
 * Returns timestamp in milliseconds.
 */
export async function getPhotoTakenAt(file: File): Promise<number> {
  // Only process images
  if (!file.type.startsWith("image/")) {
    return file.lastModified;
  }

  try {
    // exifr.parse extracts EXIF data including DateTimeOriginal
    const exif = await exifr.parse(file, {
      pick: ["DateTimeOriginal", "CreateDate", "ModifyDate"],
    });

    if (exif) {
      // DateTimeOriginal is when the photo was actually taken
      // CreateDate is when the digital file was created
      // ModifyDate is when the file was last modified
      const takenDate = exif.DateTimeOriginal || exif.CreateDate || exif.ModifyDate;
      if (takenDate instanceof Date) {
        return takenDate.getTime();
      }
    }
  } catch {
    // EXIF parsing failed, fall back to lastModified
  }

  return file.lastModified;
}

export function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString();
  } catch {
    return iso;
  }
}
