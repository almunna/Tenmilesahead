export type Trip = {
  id?: string;
  ownerId: string;
  name: string;
  startDate: string; // ISO yyyy-MM-dd
  endDate: string;   // ISO yyyy-MM-dd
  country: string;
  transportationType: string;
  accommodationType: string;
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
