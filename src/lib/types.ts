// lib/types.ts

export type Trip = {
  id?: string;
  ownerId: string;

  // Basic
  name: string; // Trip Title *
  city: string; // *
  state?: string | null; // optional
  country: string; // *

  // Logistics
  transportationType: string; // *
  accommodationType?: string | null; // optional

  // Location details
  specificAddress?: string | null;

  // Timing
  startDate: string; // ISO yyyy-MM-dd *
  endDate: string; // ISO yyyy-MM-dd *

  // Notes
  description?: string | null;

  // Media/meta
  coverMediaId?: string | null;
  createdAt: number;
  updatedAt: number;
};

export type MediaItem = {
  id?: string;
  tripId: string;
  ownerId: string;
  type: "image" | "video";
  storagePath: string;
  downloadURL: string;
  thumbURL?: string | null;
  width?: number | null;
  height?: number | null;
  durationSec?: number | null;
  caption?: string;
  createdAt: number;
};

export type UserProfile = {
  uid: string;
  email?: string | null;
  username: string; // required & editable
  photoURL?: string | null;
  createdAt: number;
  updatedAt: number;
};
