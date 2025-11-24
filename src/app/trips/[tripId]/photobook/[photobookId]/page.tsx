"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import PhotobookEditor from "@/components/PhotobookEditor";

export default function PhotobookEditorPage({
  params,
}: {
  params: Promise<{ tripId: string; photobookId: string }>;
}) {
  const { tripId, photobookId } = use(params);
  const router = useRouter();

  return (
    <PhotobookEditor
      tripId={tripId}
      photobookId={photobookId}
      onClose={() => router.push(`/trips/${tripId}`)}
    />
  );
}
