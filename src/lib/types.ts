// lib/types.ts

export type Trip = {
  id?: string;
  ownerId: string;

  // Basic
  name: string; // Trip Title *
  city: string; // Destination city *
  state?: string | null; // Destination state (optional)
  country: string; // Destination country *

  // Origin location (where trip started from)
  originCity?: string | null;
  originState?: string | null;
  originCountry?: string | null;
  originAddress?: string | null;
  originTransportationType?: string | null; // Mode of transportation from origin

  // Logistics
  transportationType?: string | null; // Deprecated - use originTransportationType instead
  cruiseLine?: string | null; // Cruise line name (when originTransportationType is "Cruise")
  cruiseShip?: string | null; // Ship name (when originTransportationType is "Cruise")
  accommodationType?: string | null; // optional

  // Location details
  specificAddress?: string | null;

  // Trip stats
  totalMiles?: number | null; // Total miles traveled

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

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired";

export type UserSubscription = {
  status: SubscriptionStatus;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  plan?: "trial" | "monthly" | "annual";
  currentPeriodEnd?: number;
  cancelAtPeriodEnd?: boolean;
};

export type UserProfile = {
  uid: string;
  email?: string | null;
  username: string; // required & editable
  photoURL?: string | null;
  role?: "admin" | "user"; // optional role field for admin access
  subscription?: UserSubscription; // Stripe subscription data
  createdAt: number;
  updatedAt: number;
};

// Photobook types
export type PageSize = "8x11" | "8x10" | "7x10";
export type BindingType = "looseleaf" | "hardcover";
export type LayoutType =
  | "single-full"
  | "two-horizontal"
  | "two-vertical"
  | "three-mixed-left"
  | "three-mixed-right"
  | "four-grid"
  | "six-collage"
  | "blank";

export type PhotoPosition = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

export type PhotoCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PagePhoto = {
  mediaId: string;
  slotIndex: number; // which slot in the layout (0, 1, 2, etc.)
  position: PhotoPosition;
  cropBox?: PhotoCrop | null;
};

export type TextBox = {
  id: string;
  text: string;
  position: PhotoPosition;
  fontSize: number;
  fontFamily: string;
  color: string;
  align: "left" | "center" | "right";
};

export type PhotobookPage = {
  pageNumber: number;
  layoutId: LayoutType;
  backgroundColor: string;
  backgroundPattern?: string | null;
  photos: PagePhoto[];
  textBoxes: TextBox[];
};

export type Photobook = {
  id?: string;
  tripId: string;
  ownerId: string;
  title: string;
  pageSize: PageSize;
  binding: BindingType;
  pages: PhotobookPage[];
  createdAt: number;
  updatedAt: number;
};

// Global Reviews types
export type ReviewType = "Activities" | "Accommodations" | "Restaurants" | "Destinations" | "Cruises";

export type Review = {
  id?: string;
  tripId: string;
  ownerId: string;
  ownerName?: string;
  type: ReviewType;

  // Place details
  placeName: string;
  city: string;
  state?: string | null;
  country: string;
  address?: string | null;

  // Review content
  ratings: {
    overall?: number;
    cleanliness?: number;
    comfort?: number;
    value?: number;
    service?: number;
    safety?: number;
    organization?: number;
    funFactor?: number;
  };
  notes?: string | null;

  // Media
  coverMediaId?: string | null;
  mediaIds?: string[];

  // Dates
  visitDate?: string | null; // ISO date
  createdAt: number;
  updatedAt: number;
};
