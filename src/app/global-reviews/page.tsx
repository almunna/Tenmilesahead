"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { collection, getDocs, query, orderBy, where, doc, getDoc, deleteDoc, updateDoc, addDoc, setDoc } from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { Star, MapPin, Phone, Calendar, ChevronDown, Image as ImageIcon, Hotel, X } from "lucide-react";
import type { Review, ReviewType, MediaItem } from "@/lib/types";
import { getCruiseLineNames } from "@/lib/cruiseData";
import Protected from "@/components/Protected";
import SubscriptionRequiredModal from "@/components/SubscriptionRequiredModal";
import ConfirmModal from "@/components/modals/ConfirmModal";
import { useAuth } from "@/components/AuthProvider";

type ReviewWithMedia = Review & {
  mediaItems: MediaItem[];
  reviewCount?: number;
  address?: string;
  phone?: string;
  visitDate?: string;
  notes?: string;
  cleanliness?: number;
  comfort?: number;
  service?: number;
  value?: number;
  safety?: number;
  organization?: number;
  funFactor?: number;
  ownerUsername?: string; // Journal name of the owner
  coverPositionY?: number; // Cover photo vertical position (0-100%)
  // Cruise-specific fields
  cruiseLine?: string;
  shipName?: string;
  foodRating?: number;
  entertainmentRating?: number;
};

type GroupedReview = {
  placeName: string;
  city: string;
  state?: string;
  country: string;
  type: ReviewType;
  reviews: ReviewWithMedia[];
  coverMediaUrl?: string;
  averageRating?: number;
  // Cruise-specific fields
  cruiseLine?: string;
  shipName?: string;
};

// Helper function to format date strings without timezone conversion
function formatDateString(dateStr: string): string {
  // Parse YYYY-MM-DD format without timezone conversion
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (match) {
    const [, year, month, day] = match;
    return `${month}/${day}/${year}`;
  }
  // Fallback to default formatting
  return new Date(dateStr).toLocaleDateString();
}

export default function GlobalReviewsPage() {
  return (
    <Protected>
      <GlobalReviewsInner />
    </Protected>
  );
}

function GlobalReviewsInner() {
  const { user, profile } = useAuth();

  // Check if user has an active subscription
  const subscription = profile?.subscription;
  const isSubscribed =
    (subscription?.status === "active" || subscription?.status === "trialing") &&
    !subscription?.cancelAtPeriodEnd;

  // Show subscription required modal if not subscribed
  if (!isSubscribed) {
    return (
      <SubscriptionRequiredModal
        title="Global Reviews"
        description="Access to global reviews requires an active subscription."
      />
    );
  }

  const [allReviews, setAllReviews] = useState<ReviewWithMedia[]>([]);
  const [groupedReviews, setGroupedReviews] = useState<GroupedReview[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedLocation, setSelectedLocation] = useState<string>("All Locations");
  const [selectedType, setSelectedType] = useState<string>("All Types");
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);

  // Cruise-specific filters
  const [selectedCruiseLine, setSelectedCruiseLine] = useState<string>("All Cruise Lines");
  const [selectedShipName, setSelectedShipName] = useState<string>("All Ships");
  const [showCruiseLineDropdown, setShowCruiseLineDropdown] = useState(false);
  const [showShipNameDropdown, setShowShipNameDropdown] = useState(false);

  // Pagination
  const [visibleCount, setVisibleCount] = useState(10);

  // Selected review for detail view
  const [selectedGroup, setSelectedGroup] = useState<GroupedReview | null>(null);

  // Edit modal state
  const [editingReview, setEditingReview] = useState<ReviewWithMedia | null>(null);

  // Delete confirmation modal state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [reviewToDelete, setReviewToDelete] = useState<ReviewWithMedia | null>(null);

  // Add review modal state
  const [addingReviewForPlace, setAddingReviewForPlace] = useState<{ placeName: string; city: string; country: string; type: ReviewType } | null>(null);

  // Load all reviews
  useEffect(() => {
    loadReviews();
  }, []);

  const loadReviews = async () => {
    try {
      setLoading(true);

      // Get all reviews from Activities, Accommodations, and Restaurants subcollections
      const reviewPromises: Promise<ReviewWithMedia[]>[] = [];

      // Get all trips first
      const tripsSnapshot = await getDocs(collection(db, "trips"));

      // Cache trip owners for ownership checks
      const tripOwners = new Map<string, string>();

      for (const tripDoc of tripsSnapshot.docs) {
        const tripId = tripDoc.id;
        const tripData = tripDoc.data();
        tripOwners.set(tripId, tripData.ownerId || "");

        // Fetch destinations
        reviewPromises.push(
          fetchReviewsFromSubcollection(tripId, "destinations", "Destinations", tripOwners.get(tripId))
        );

        // Fetch activities
        reviewPromises.push(
          fetchReviewsFromSubcollection(tripId, "activities", "Activities", tripOwners.get(tripId))
        );

        // Fetch accommodations
        reviewPromises.push(
          fetchReviewsFromSubcollection(tripId, "accommodations", "Accommodations", tripOwners.get(tripId))
        );

        // Fetch restaurants
        reviewPromises.push(
          fetchReviewsFromSubcollection(tripId, "restaurants", "Restaurants", tripOwners.get(tripId))
        );

        // Fetch cruises
        reviewPromises.push(
          fetchReviewsFromSubcollection(tripId, "cruises", "Cruises", tripOwners.get(tripId))
        );
      }

      const results = await Promise.all(reviewPromises);
      const flatReviews = results.flat();

      setAllReviews(flatReviews);
      groupReviewsByPlace(flatReviews);
    } catch (error) {
      console.error("Error loading reviews:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchReviewsFromSubcollection = async (
    tripId: string,
    subcollection: string,
    type: ReviewType,
    ownerId?: string
  ): Promise<ReviewWithMedia[]> => {
    const snapshot = await getDocs(
      query(collection(db, "trips", tripId, subcollection), orderBy("createdAt", "desc"))
    );

    const reviews: ReviewWithMedia[] = [];

    // Fetch the owner's username/journal name if we have an ownerId
    let ownerUsername: string | undefined = undefined;
    if (ownerId) {
      try {
        const userDoc = await getDoc(doc(db, "users", ownerId));
        if (userDoc.exists()) {
          ownerUsername = userDoc.data().username;
        }
      } catch (error) {
        console.error("Error fetching username:", error);
      }
    }

    for (const doc of snapshot.docs) {
      const data = doc.data();

      // Fetch media for this review
      const mediaSnapshot = await getDocs(
        query(
          collection(db, "trips", tripId, "media"),
          where("linkedSubcollection", "==", subcollection),
          where("linkedId", "==", doc.id)
        )
      );

      const mediaItems: MediaItem[] = mediaSnapshot.docs.map((mediaDoc) => ({
        id: mediaDoc.id,
        ...mediaDoc.data(),
      } as MediaItem));

      reviews.push({
        id: doc.id,
        tripId,
        ownerId: ownerId || "",
        ownerUsername: ownerUsername,
        type,
        placeName: data.name || "Unnamed Place",
        city: data.city || "",
        state: data.state || null,
        country: data.country || "",
        address: data.address || null,
        phone: data.phoneNumber || null,
        ratings: {
          overall: calculateOverallRating(data),
          cleanliness: data.qualityRating || 0,
          comfort: data.qualityRating || 0,
          service: data.serviceRating || 0,
          value: data.valueRating || 0,
          safety: data.locationRating || 0,
          organization: 0,
          funFactor: 0,
        },
        notes: data.review || data.notes || null,
        coverMediaId: data.coverMediaId || mediaItems[0]?.id || null,
        mediaIds: mediaItems.map((m) => m.id || ""),
        visitDate: data.startDate || null,
        createdAt: data.createdAt || Date.now(),
        updatedAt: data.updatedAt || Date.now(),
        mediaItems,
        cleanliness: data.qualityRating || 0,
        comfort: data.qualityRating || 0,
        service: data.serviceRating || 0,
        value: data.valueRating || 0,
        safety: data.locationRating || 0,
        organization: 0,
        funFactor: 0,
        coverPositionY: data.coverPositionY ?? 50,
        // Cruise-specific fields
        cruiseLine: data.cruiseLine || undefined,
        shipName: data.shipName || undefined,
        foodRating: data.foodRating || 0,
        entertainmentRating: data.entertainmentRating || 0,
      });
    }

    return reviews;
  };

  const calculateOverallRating = (data: any): number => {
    const ratings: number[] = [];
    if (data.qualityRating) ratings.push(data.qualityRating);
    if (data.valueRating) ratings.push(data.valueRating);
    if (data.serviceRating) ratings.push(data.serviceRating);
    if (data.locationRating) ratings.push(data.locationRating);

    if (ratings.length === 0) return 0;
    return ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
  };

  const groupReviewsByPlace = (reviews: ReviewWithMedia[]) => {
    const grouped = new Map<string, GroupedReview>();

    reviews.forEach((review) => {
      // For cruises, include cruise line and ship name in the grouping key
      const key = review.type === "Cruises"
        ? `${review.placeName}|${review.cruiseLine || ""}|${review.shipName || ""}|${review.country}|${review.type}`
        : `${review.placeName}|${review.city}|${review.country}|${review.type}`;

      if (grouped.has(key)) {
        const existing = grouped.get(key)!;
        existing.reviews.push(review);
      } else {
        // Find the cover media using coverMediaId, fallback to first media item
        const coverMedia = review.coverMediaId
          ? review.mediaItems.find(m => m.id === review.coverMediaId)
          : review.mediaItems[0];

        grouped.set(key, {
          placeName: review.placeName,
          city: review.city,
          state: review.state || undefined,
          country: review.country,
          type: review.type,
          reviews: [review],
          coverMediaUrl: coverMedia?.downloadURL,
          averageRating: review.ratings.overall,
          // Cruise-specific fields
          cruiseLine: review.cruiseLine,
          shipName: review.shipName,
        });
      }
    });

    // Calculate average ratings for groups
    grouped.forEach((group) => {
      const validRatings = group.reviews
        .map((r) => r.ratings.overall || 0)
        .filter((r) => r > 0);

      group.averageRating = validRatings.length > 0
        ? validRatings.reduce((sum, r) => sum + r, 0) / validRatings.length
        : 0;
    });

    setGroupedReviews(Array.from(grouped.values()));
  };

  // Get unique locations from reviews
  const uniqueLocations = Array.from(
    new Set(allReviews.map((r) => r.city).filter((c) => c))
  ).sort();

  // Get unique cruise lines and ship names from reviews
  const uniqueCruiseLines = Array.from(
    new Set(allReviews.filter((r) => r.type === "Cruises" && r.cruiseLine).map((r) => r.cruiseLine!))
  ).sort();

  const uniqueShipNames = Array.from(
    new Set(
      allReviews
        .filter((r) => r.type === "Cruises" && r.shipName)
        .filter((r) => selectedCruiseLine === "All Cruise Lines" || r.cruiseLine === selectedCruiseLine)
        .map((r) => r.shipName!)
    )
  ).sort();

  // Filter grouped reviews based on selected filters
  const filteredReviews = groupedReviews.filter((group) => {
    const matchesLocation =
      selectedLocation === "All Locations" || group.city === selectedLocation;
    const matchesType = selectedType === "All Types" || group.type === selectedType;

    // Apply cruise-specific filters only when Cruises type is selected
    if (selectedType === "Cruises") {
      const matchesCruiseLine =
        selectedCruiseLine === "All Cruise Lines" || group.cruiseLine === selectedCruiseLine;
      const matchesShipName =
        selectedShipName === "All Ships" || group.shipName === selectedShipName;
      return matchesLocation && matchesType && matchesCruiseLine && matchesShipName;
    }

    return matchesLocation && matchesType;
  });

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleCount(10);
  }, [selectedLocation, selectedType, selectedCruiseLine, selectedShipName]);

  // Flatten filtered reviews to individual review cards for pagination
  const allFilteredReviewCards = filteredReviews.flatMap((group) =>
    group.reviews.map((review) => ({ group, review }))
  );

  // Get visible review cards based on pagination
  const visibleReviewCards = allFilteredReviewCards.slice(0, visibleCount);

  const hasMore = visibleCount < allFilteredReviewCards.length;

  const handleDeleteReview = (review: ReviewWithMedia) => {
    setReviewToDelete(review);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteReview = async () => {
    if (!reviewToDelete) return;

    try {
      // Determine subcollection name based on review type
      const subcollectionMap: Record<ReviewType, string> = {
        "Destinations": "destinations",
        "Activities": "activities",
        "Accommodations": "accommodations",
        "Restaurants": "restaurants",
        "Cruises": "cruises",
      };

      const subcollection = subcollectionMap[reviewToDelete.type];
      await deleteDoc(doc(db, "trips", reviewToDelete.tripId, subcollection, reviewToDelete.id!));

      setDeleteConfirmOpen(false);
      setReviewToDelete(null);
      loadReviews(); // Reload reviews
    } catch (error) {
      console.error("Error deleting review:", error);
      setDeleteConfirmOpen(false);
      setReviewToDelete(null);
    }
  };

  const handleEditReview = (review: ReviewWithMedia) => {
    setEditingReview(review);
  };

  const handleSaveEdit = async (updatedReview: ReviewWithMedia) => {
    try {
      const subcollectionMap: Record<ReviewType, string> = {
        "Destinations": "destinations",
        "Activities": "activities",
        "Accommodations": "accommodations",
        "Restaurants": "restaurants",
        "Cruises": "cruises",
      };

      const subcollection = subcollectionMap[updatedReview.type];
      const reviewRef = doc(db, "trips", updatedReview.tripId, subcollection, updatedReview.id!);

      // Update the review document
      await updateDoc(reviewRef, {
        review: updatedReview.notes,
        notes: updatedReview.notes,
        qualityRating: updatedReview.ratings.cleanliness,
        valueRating: updatedReview.ratings.value,
        serviceRating: updatedReview.ratings.service,
        locationRating: updatedReview.ratings.safety,
        coverMediaId: updatedReview.coverMediaId || null,
        coverPositionY: updatedReview.coverPositionY ?? 50,
        updatedAt: Date.now(),
      });

      setEditingReview(null);
      loadReviews(); // Reload reviews
    } catch (error) {
      console.error("Error updating review:", error);
      alert("Failed to update review. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="container py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-lg text-muted-foreground">Loading reviews...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-[#2c3e50] border-b border-white/10">
        <div className="container py-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Star className="w-6 h-6 sm:w-7 sm:h-7 text-[#f4a261]" fill="#f4a261" />
              <h1 className="text-xl sm:text-2xl font-bold text-white">Global Reviews</h1>
            </div>

            {/* Filters */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
              {/* Location Filter */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowLocationDropdown(!showLocationDropdown);
                    setShowTypeDropdown(false);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-[#3d5266] text-white rounded-lg hover:bg-[#4a5f77] transition-colors w-full sm:min-w-[200px] justify-between"
                >
                  <span className="text-sm">{selectedLocation}</span>
                  <ChevronDown className="w-4 h-4" />
                </button>

                {showLocationDropdown && (
                  <div className="absolute top-full mt-2 w-full bg-[#2c3e50] rounded-lg shadow-xl border border-white/10 overflow-hidden z-50">
                    <button
                      onClick={() => {
                        setSelectedLocation("All Locations");
                        setShowLocationDropdown(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-white hover:bg-[#3d5266] transition-colors"
                    >
                      ✓ All Locations
                    </button>
                    {uniqueLocations.map((location) => (
                      <button
                        key={location}
                        onClick={() => {
                          setSelectedLocation(location);
                          setShowLocationDropdown(false);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-white hover:bg-[#3d5266] transition-colors"
                      >
                        {location}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Type Filter */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowTypeDropdown(!showTypeDropdown);
                    setShowLocationDropdown(false);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-[#3d5266] text-white rounded-lg hover:bg-[#4a5f77] transition-colors w-full sm:min-w-[200px] justify-between"
                >
                  <span className="text-sm">{selectedType}</span>
                  <ChevronDown className="w-4 h-4" />
                </button>

                {showTypeDropdown && (
                  <div className="absolute top-full mt-2 w-full bg-[#2c3e50] rounded-lg shadow-xl border border-white/10 overflow-hidden z-50">
                    <button
                      onClick={() => {
                        setSelectedType("All Types");
                        setShowTypeDropdown(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-white hover:bg-[#3d5266] transition-colors"
                    >
                      ✓ All Types
                    </button>
                    <button
                      onClick={() => {
                        setSelectedType("Destinations");
                        setShowTypeDropdown(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-white hover:bg-[#3d5266] transition-colors"
                    >
                      Destinations
                    </button>
                    <button
                      onClick={() => {
                        setSelectedType("Activities");
                        setShowTypeDropdown(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-white hover:bg-[#3d5266] transition-colors"
                    >
                      Activities
                    </button>
                    <button
                      onClick={() => {
                        setSelectedType("Accommodations");
                        setShowTypeDropdown(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-white hover:bg-[#3d5266] transition-colors"
                    >
                      Accommodations
                    </button>
                    <button
                      onClick={() => {
                        setSelectedType("Restaurants");
                        setShowTypeDropdown(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-white hover:bg-[#3d5266] transition-colors"
                    >
                      Restaurants
                    </button>
                    <button
                      onClick={() => {
                        setSelectedType("Cruises");
                        setShowTypeDropdown(false);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-white hover:bg-[#3d5266] transition-colors"
                    >
                      Cruises
                    </button>
                  </div>
                )}
              </div>
            </div>

              {/* Cruise-specific filters (only shown when Cruises is selected) */}
              {selectedType === "Cruises" && (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4 mt-4 pt-4 border-t border-white/10">
                  {/* Cruise Line Filter */}
                  <div className="relative">
                    <button
                      onClick={() => {
                        setShowCruiseLineDropdown(!showCruiseLineDropdown);
                        setShowShipNameDropdown(false);
                        setShowLocationDropdown(false);
                        setShowTypeDropdown(false);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-[#3d5266] text-white rounded-lg hover:bg-[#4a5f77] transition-colors w-full sm:min-w-[200px] justify-between"
                    >
                      <span className="text-sm">{selectedCruiseLine}</span>
                      <ChevronDown className="w-4 h-4" />
                    </button>

                    {showCruiseLineDropdown && (
                      <div className="absolute top-full mt-2 w-full bg-[#2c3e50] rounded-lg shadow-xl border border-white/10 overflow-hidden z-50 max-h-64 overflow-y-auto">
                        <button
                          onClick={() => {
                            setSelectedCruiseLine("All Cruise Lines");
                            setSelectedShipName("All Ships");
                            setShowCruiseLineDropdown(false);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-white hover:bg-[#3d5266] transition-colors"
                        >
                          ✓ All Cruise Lines
                        </button>
                        {uniqueCruiseLines.map((line) => (
                          <button
                            key={line}
                            onClick={() => {
                              setSelectedCruiseLine(line);
                              setSelectedShipName("All Ships");
                              setShowCruiseLineDropdown(false);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-white hover:bg-[#3d5266] transition-colors"
                          >
                            {line}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Ship Name Filter */}
                  <div className="relative">
                    <button
                      onClick={() => {
                        setShowShipNameDropdown(!showShipNameDropdown);
                        setShowCruiseLineDropdown(false);
                        setShowLocationDropdown(false);
                        setShowTypeDropdown(false);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-[#3d5266] text-white rounded-lg hover:bg-[#4a5f77] transition-colors w-full sm:min-w-[200px] justify-between"
                    >
                      <span className="text-sm">{selectedShipName}</span>
                      <ChevronDown className="w-4 h-4" />
                    </button>

                    {showShipNameDropdown && (
                      <div className="absolute top-full mt-2 w-full bg-[#2c3e50] rounded-lg shadow-xl border border-white/10 overflow-hidden z-50 max-h-64 overflow-y-auto">
                        <button
                          onClick={() => {
                            setSelectedShipName("All Ships");
                            setShowShipNameDropdown(false);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-white hover:bg-[#3d5266] transition-colors"
                        >
                          ✓ All Ships
                        </button>
                        {uniqueShipNames.map((ship) => (
                          <button
                            key={ship}
                            onClick={() => {
                              setSelectedShipName(ship);
                              setShowShipNameDropdown(false);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-white hover:bg-[#3d5266] transition-colors"
                          >
                            {ship}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
          </div>

          <p className="text-sm text-white/70 mt-2">
            Reviews are listed in chronological order.
          </p>
        </div>
      </div>

      {/* Reviews List */}
      <div className="container py-8">
        {allFilteredReviewCards.length === 0 ? (
          <div className="text-center text-white/70 py-12">
            No reviews found matching your filters.
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {visibleReviewCards.map(({ group, review }, index) => (
                <ReviewCard
                  key={`${review.id}-${index}`}
                  review={review}
                  reviewCount={group.reviews.length}
                  currentUserId={user?.uid}
                  onClick={() => setSelectedGroup(group)}
                  onEdit={() => handleEditReview(review)}
                  onDelete={() => handleDeleteReview(review)}
                  onAddReview={() => setAddingReviewForPlace({
                    placeName: review.placeName,
                    city: review.city,
                    country: review.country,
                    type: review.type
                  })}
                />
              ))}
            </div>

            {/* See More Button */}
            {hasMore && (
              <div className="flex justify-center mt-8">
                <button
                  onClick={() => setVisibleCount((prev) => prev + 5)}
                  className="px-6 py-3 bg-[#66bfcc] text-white rounded-lg hover:bg-[#5aa8b5] transition-colors font-medium"
                >
                  See More ({allFilteredReviewCards.length - visibleCount} remaining)
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Review Detail Modal */}
      {selectedGroup && (
        <ReviewDetailModal
          group={selectedGroup}
          onClose={() => setSelectedGroup(null)}
        />
      )}

      {/* Edit Review Modal */}
      {editingReview && (
        <EditReviewModal
          review={editingReview}
          onClose={() => setEditingReview(null)}
          onSave={handleSaveEdit}
        />
      )}

      {/* Add Review Modal */}
      {addingReviewForPlace && user && (
        <AddReviewModal
          placeName={addingReviewForPlace.placeName}
          city={addingReviewForPlace.city}
          country={addingReviewForPlace.country}
          type={addingReviewForPlace.type}
          userId={user.uid}
          onClose={() => setAddingReviewForPlace(null)}
          onSave={async () => {
            setAddingReviewForPlace(null);
            await loadReviews();
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteConfirmOpen}
        title="Delete Review"
        message={reviewToDelete ? `Are you sure you want to delete your review for "${reviewToDelete.placeName}"?` : ""}
        confirmText="Delete"
        cancelText="Cancel"
        confirmVariant="danger"
        onConfirm={confirmDeleteReview}
        onCancel={() => {
          setDeleteConfirmOpen(false);
          setReviewToDelete(null);
        }}
      />
    </div>
  );
}

function ReviewCard({
  review,
  reviewCount,
  currentUserId,
  onClick,
  onEdit,
  onDelete,
  onAddReview,
}: {
  review: ReviewWithMedia;
  reviewCount: number;
  currentUserId?: string;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddReview: () => void;
}) {
  const renderStars = (rating: number) => {
    return [...Array(5)].map((_, i) => (
      <Star
        key={i}
        className="w-4 h-4"
        fill={i < rating ? "#f4a261" : "none"}
        stroke={i < rating ? "#f4a261" : "#888"}
      />
    ));
  };

  return (
    <div
      onClick={onClick}
      className="bg-[#3d5266] rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-[#66bfcc] transition-all"
    >
      <div className="flex flex-col sm:flex-row">
        {/* Left: Cover Image */}
        <div className="w-full h-48 sm:w-32 sm:h-32 flex-shrink-0 bg-[#2c3e50] relative">
          {review.mediaItems.length > 0 ? (
            <img
              src={(review.coverMediaId ? review.mediaItems.find(m => m.id === review.coverMediaId)?.downloadURL : null) || review.mediaItems[0].downloadURL}
              alt={review.placeName}
              className="w-full h-full object-cover"
              style={{ objectPosition: `50% ${review.coverPositionY ?? 50}%` }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="w-12 h-12 text-white/30" />
            </div>
          )}
        </div>

        {/* Right: Content */}
        <div className="flex-1 p-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-2 gap-2">
            <div className="flex-1">
              <h3 className="text-base sm:text-lg font-semibold text-white mb-1">{review.placeName}</h3>

              {/* Journal Name */}
              {review.ownerUsername && (
                <div className="text-sm text-[#66bfcc] font-medium mb-1">
                  {review.ownerUsername}
                </div>
              )}

              <div className="flex items-center gap-2 text-sm text-white/70 mb-1">
                <MapPin className="w-4 h-4 flex-shrink-0" />
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                    review.address || `${review.placeName}, ${review.city}, ${review.state || review.country}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="truncate hover:text-[#66bfcc] hover:underline transition-colors"
                  title="Open in Google Maps"
                >
                  {review.address || `${review.city}, ${review.state || review.country}`}
                </a>
              </div>

              {review.phone && (
                <div className="flex items-center gap-2 text-sm text-white/70 mb-2">
                  <Phone className="w-4 h-4 flex-shrink-0" />
                  <a
                    href={`tel:${review.phone.replace(/[^\d+]/g, '')}`}
                    onClick={(e) => e.stopPropagation()}
                    className="hover:text-[#66bfcc] hover:underline transition-colors"
                  >
                    {review.phone}
                  </a>
                </div>
              )}

              {review.notes && (
                <p className="text-sm text-white/80 italic mb-3 line-clamp-2">"{review.notes}"</p>
              )}

              {/* Ratings Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                {review.cleanliness > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/90">Quality:</span>
                    <div className="flex gap-0.5">{renderStars(review.cleanliness)}</div>
                  </div>
                )}
                {review.service > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/90">Service:</span>
                    <div className="flex gap-0.5">{renderStars(review.service)}</div>
                  </div>
                )}
                {review.value > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/90">Value:</span>
                    <div className="flex gap-0.5">{renderStars(review.value)}</div>
                  </div>
                )}
                {review.safety > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white/90">Location:</span>
                    <div className="flex gap-0.5">{renderStars(review.safety)}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Type Badge and Actions */}
            <div className="flex flex-row sm:flex-col items-start sm:items-end gap-2 sm:ml-4 flex-wrap">
              <div className="flex items-center gap-2 bg-[#2c3e50] px-3 py-1 rounded">
                <Hotel className="w-4 h-4 text-white/70" />
                <span className="text-xs text-white/90">{review.type}</span>
              </div>
              {/* Show edit/delete buttons if current user owns this review */}
              {currentUserId && review.ownerId === currentUserId && (
                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit();
                    }}
                    className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors whitespace-nowrap"
                    title="Edit this review"
                  >
                    Edit
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete();
                    }}
                    className="text-xs px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700 transition-colors whitespace-nowrap"
                    title="Delete this review"
                  >
                    Delete
                  </button>
                </div>
              )}
              {/* Show "Add Your Review" button for all logged-in users */}
              {currentUserId && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddReview();
                  }}
                  className="text-xs px-3 py-1.5 rounded bg-[#66bfcc] text-white hover:bg-[#5aa8b5] transition-colors font-medium whitespace-nowrap"
                  title="Add your own review for this place"
                >
                  Add Your Review
                </button>
              )}
            </div>
          </div>

          {/* Bottom Row */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/10">
            <div className="flex items-center gap-2 text-sm text-white/60">
              {review.visitDate && (
                <>
                  <Calendar className="w-4 h-4" />
                  <span>{formatDateString(review.visitDate)}</span>
                </>
              )}
            </div>
            {reviewCount > 1 && (
              <div className="text-sm text-[#66bfcc]">
                {reviewCount} more review{reviewCount > 2 ? 's' : ''}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewDetailModal({
  group,
  onClose,
}: {
  group: GroupedReview;
  onClose: () => void;
}) {
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0);
  const [showPhotoFlipbook, setShowPhotoFlipbook] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  const currentReview = group.reviews[currentReviewIndex];
  const hasMultipleReviews = group.reviews.length > 1;

  return (
    <div className="fixed inset-x-0 top-[60px] bottom-0 z-[100] bg-black/90 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-[#2c3e50] rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[#2c3e50] border-b border-white/10 p-4 sm:p-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">{group.placeName}</h2>
            <div className="flex items-center gap-2 text-sm text-white/70 mt-1">
              <MapPin className="w-4 h-4" />
              <span>
                {group.city}, {group.country}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20"
          >
            Close
          </button>
        </div>

        {/* Review Navigation */}
        {hasMultipleReviews && (
          <div className="px-6 py-4 bg-[#3d5266] border-b border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-sm text-white/90">
                Review {currentReviewIndex + 1} of {group.reviews.length}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentReviewIndex(Math.max(0, currentReviewIndex - 1))}
                  disabled={currentReviewIndex === 0}
                  className="px-3 py-1 bg-[#2c3e50] text-white rounded hover:bg-[#1e2a3a] disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  ← Previous
                </button>
                <button
                  onClick={() =>
                    setCurrentReviewIndex(
                      Math.min(group.reviews.length - 1, currentReviewIndex + 1)
                    )
                  }
                  disabled={currentReviewIndex === group.reviews.length - 1}
                  className="px-3 py-1 bg-[#2c3e50] text-white rounded hover:bg-[#1e2a3a] disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Review Content */}
        <div className="p-6">
          {/* Rating */}
          {currentReview.ratings.overall && currentReview.ratings.overall > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-3">
                <div className="flex">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className="w-6 h-6"
                      fill={i < Math.round(currentReview.ratings.overall!) ? "#f4a261" : "none"}
                      stroke={
                        i < Math.round(currentReview.ratings.overall!) ? "#f4a261" : "#666"
                      }
                    />
                  ))}
                </div>
                <span className="text-lg font-semibold text-white">
                  {currentReview.ratings.overall.toFixed(1)}
                </span>
              </div>
            </div>
          )}

          {/* Visit Date */}
          {currentReview.visitDate && (
            <div className="flex items-center gap-2 text-sm text-white/70 mb-4">
              <Calendar className="w-4 h-4" />
              <span>Visited on {formatDateString(currentReview.visitDate)}</span>
            </div>
          )}

          {/* Notes */}
          {currentReview.notes && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white mb-2">Review Notes</h3>
              <p className="text-white/80 whitespace-pre-wrap">{currentReview.notes}</p>
            </div>
          )}

          {/* Photos */}
          {currentReview.mediaItems.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-3">
                Photos ({currentReview.mediaItems.length})
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {currentReview.mediaItems.map((media, index) => (
                  <div
                    key={media.id}
                    onClick={() => {
                      setCurrentPhotoIndex(index);
                      setShowPhotoFlipbook(true);
                    }}
                    className="relative aspect-square bg-[#3d5266] rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-[#66bfcc] transition-all"
                  >
                    <img
                      src={media.downloadURL}
                      alt={`Photo ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Photo Flipbook */}
      {showPhotoFlipbook && (
        <div className="fixed inset-0 z-[60] bg-black flex items-center justify-center">
          <button
            onClick={() => setShowPhotoFlipbook(false)}
            className="absolute top-4 right-4 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 z-10"
          >
            Close Photos
          </button>

          <button
            onClick={() =>
              setCurrentPhotoIndex(Math.max(0, currentPhotoIndex - 1))
            }
            disabled={currentPhotoIndex === 0}
            className="absolute left-4 top-1/2 -translate-y-1/2 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ←
          </button>

          <div className="max-w-5xl max-h-[90vh] flex items-center justify-center">
            <img
              src={currentReview.mediaItems[currentPhotoIndex]?.downloadURL}
              alt={`Photo ${currentPhotoIndex + 1}`}
              className="max-w-full max-h-[90vh] object-contain"
            />
          </div>

          <button
            onClick={() =>
              setCurrentPhotoIndex(
                Math.min(currentReview.mediaItems.length - 1, currentPhotoIndex + 1)
              )
            }
            disabled={currentPhotoIndex === currentReview.mediaItems.length - 1}
            className="absolute right-4 top-1/2 -translate-y-1/2 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            →
          </button>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm">
            Photo {currentPhotoIndex + 1} of {currentReview.mediaItems.length}
          </div>
        </div>
      )}
    </div>
  );
}

function EditReviewModal({
  review,
  onClose,
  onSave,
}: {
  review: ReviewWithMedia;
  onClose: () => void;
  onSave: (review: ReviewWithMedia) => Promise<void>;
}) {
  const [editedReview, setEditedReview] = useState<ReviewWithMedia>({ ...review });
  const [saving, setSaving] = useState(false);

  // Photo management state
  const [existingMedia, setExistingMedia] = useState<MediaItem[]>(review.mediaItems || []);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [coverMediaId, setCoverMediaId] = useState<string | null>(review.coverMediaId || (review.mediaItems[0]?.id || null));
  const [newCoverKey, setNewCoverKey] = useState<string | null>(null);
  const [coverPosY, setCoverPosY] = useState<number>(review.coverPositionY ?? 50);
  const draggingRef = useRef(false);

  const fileKey = (f: File) => `${f.name}__${f.size}__${f.lastModified}`;

  // Cover photo drag handlers
  function onCoverPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.stopPropagation();
    draggingRef.current = true;
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    onCoverPointerMove(e);
  }
  function onCoverPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
  }
  function onCoverPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    const box = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    const y = e.clientY - box.top;
    const pct = Math.max(0, Math.min(100, (y / box.height) * 100));
    setCoverPosY(pct);
  }

  // Generate previews for new files
  useEffect(() => {
    setPreviews((prev) => {
      const next = { ...prev };
      for (const f of newFiles) {
        const k = fileKey(f);
        if (!next[k]) next[k] = URL.createObjectURL(f);
      }
      for (const k of Object.keys(next)) {
        if (!newFiles.find((f) => fileKey(f) === k)) {
          URL.revokeObjectURL(next[k]);
          delete next[k];
        }
      }
      return next;
    });
  }, [newFiles]);

  // Cleanup previews on unmount
  useEffect(() => {
    return () => {
      Object.values(previews).forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setNewFiles((prev) => [...prev, ...files]);
  };

  const removeNewFile = (key: string) => {
    setNewFiles((prev) => prev.filter((f) => fileKey(f) !== key));
    if (newCoverKey === key) setNewCoverKey(null);
  };

  const removeExistingMedia = async (mediaId: string) => {
    // Mark for deletion (will be deleted on save)
    setExistingMedia((prev) => prev.filter((m) => m.id !== mediaId));
    if (coverMediaId === mediaId) {
      const remaining = existingMedia.filter((m) => m.id !== mediaId);
      setCoverMediaId(remaining[0]?.id || null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const subcollectionMap: Record<ReviewType, string> = {
        "Destinations": "destinations",
        "Activities": "activities",
        "Accommodations": "accommodations",
        "Restaurants": "restaurants",
        "Cruises": "cruises",
      };
      const subcollection = subcollectionMap[review.type];

      // Upload new files
      let finalCoverMediaId = coverMediaId;

      for (const file of newFiles) {
        const k = fileKey(file);
        const mediaRef = doc(collection(db, "trips", review.tripId, "media"));
        const mediaId = mediaRef.id;

        const safeName = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `trip_media/${review.ownerId}/${review.tripId}/${mediaId}/${safeName}`;

        const sref = storageRef(storage, path);
        await uploadBytes(sref, file, { contentType: file.type });
        const downloadURL = await getDownloadURL(sref);

        await setDoc(mediaRef, {
          tripId: review.tripId,
          type: file.type.startsWith("video/") ? "video" : "image",
          storagePath: path,
          downloadURL,
          createdAt: Date.now(),
          caption: `${review.type} • ${review.placeName}`,
          linkedSubcollection: subcollection,
          linkedId: review.id,
          fileName: file.name,
          size: file.size,
          contentType: file.type,
        });

        // If this new file is marked as cover
        if (newCoverKey === k) {
          finalCoverMediaId = mediaId;
        }

        // If no cover selected yet, use first uploaded image
        if (!finalCoverMediaId && file.type.startsWith("image/")) {
          finalCoverMediaId = mediaId;
        }
      }

      // Delete removed existing media
      const removedMedia = review.mediaItems.filter(
        (m) => !existingMedia.find((em) => em.id === m.id)
      );
      for (const media of removedMedia) {
        try {
          if (media.storagePath) {
            await deleteObject(storageRef(storage, media.storagePath));
          }
          await deleteDoc(doc(db, "trips", review.tripId, "media", media.id!));
        } catch (err) {
          console.error("Error deleting media:", err);
        }
      }

      // Update the review with new cover and position
      const updatedReview = {
        ...editedReview,
        coverMediaId: finalCoverMediaId,
        coverPositionY: coverPosY,
      };

      await onSave(updatedReview);
    } finally {
      setSaving(false);
    }
  };

  const renderStarRating = (value: number, onChange: (rating: number) => void, label: string) => {
    return (
      <div className="space-y-1">
        <label className="text-sm font-medium text-white">{label}</label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((rating) => (
            <button
              key={rating}
              type="button"
              onClick={() => onChange(rating)}
              className="focus:outline-none"
            >
              <Star
                className="w-6 h-6 cursor-pointer transition-colors"
                fill={rating <= value ? "#f4a261" : "none"}
                stroke={rating <= value ? "#f4a261" : "#888"}
              />
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-x-0 top-[60px] bottom-0 z-[100] bg-black/90 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-[#2c3e50] rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[#2c3e50] border-b border-white/10 p-4 sm:p-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">Edit Review</h2>
            <p className="text-sm text-white/70 mt-1">{review.placeName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Close"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Review Notes */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white">Your Review</label>
            <textarea
              value={editedReview.notes || ""}
              onChange={(e) =>
                setEditedReview({ ...editedReview, notes: e.target.value })
              }
              className="w-full px-4 py-3 bg-[#3d5266] text-white rounded-lg border border-white/10 focus:border-[#66bfcc] focus:outline-none resize-none"
              rows={5}
              placeholder="Share your experience..."
            />
          </div>

          {/* Ratings */}
          <div className="space-y-4">
            <h3 className="text-base sm:text-lg font-semibold text-white">Ratings</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renderStarRating(
                editedReview.ratings.cleanliness || 0,
                (rating) =>
                  setEditedReview({
                    ...editedReview,
                    ratings: { ...editedReview.ratings, cleanliness: rating },
                  }),
                "Quality"
              )}

              {renderStarRating(
                editedReview.ratings.service || 0,
                (rating) =>
                  setEditedReview({
                    ...editedReview,
                    ratings: { ...editedReview.ratings, service: rating },
                  }),
                "Service"
              )}

              {renderStarRating(
                editedReview.ratings.value || 0,
                (rating) =>
                  setEditedReview({
                    ...editedReview,
                    ratings: { ...editedReview.ratings, value: rating },
                  }),
                "Value"
              )}

              {renderStarRating(
                editedReview.ratings.safety || 0,
                (rating) =>
                  setEditedReview({
                    ...editedReview,
                    ratings: { ...editedReview.ratings, safety: rating },
                  }),
                "Location"
              )}
            </div>
          </div>

          {/* Photos Section */}
          <div className="space-y-4">
            <h3 className="text-base sm:text-lg font-semibold text-white">Photos</h3>

            {/* Cover Photo Preview with Drag to Reposition */}
            {(() => {
              const coverMedia = coverMediaId
                ? existingMedia.find(m => m.id === coverMediaId)
                : newCoverKey
                ? null // new file selected as cover
                : existingMedia[0];
              const coverUrl = coverMedia?.downloadURL || (newCoverKey ? previews[newCoverKey] : null);

              if (!coverUrl) return null;

              return (
                <div>
                  <h4 className="text-sm font-medium text-white/80 mb-2">Cover Photo Preview</h4>
                  <div className="text-xs text-white/50 mb-2">Drag to reposition the cover photo</div>
                  <div
                    className="relative w-full h-32 rounded-lg overflow-hidden bg-[#2c3e50] cursor-grab active:cursor-grabbing"
                    style={{ touchAction: 'none' }}
                    onPointerDown={onCoverPointerDown}
                    onPointerMove={onCoverPointerMove}
                    onPointerUp={onCoverPointerUp}
                  >
                    <img
                      src={coverUrl}
                      alt="Cover preview"
                      className="w-full h-full object-cover pointer-events-none select-none"
                      style={{ objectPosition: `50% ${coverPosY}%` }}
                      draggable={false}
                    />
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="bg-black/30 px-3 py-1 rounded-full text-xs text-white/80">
                        ↕ Drag to adjust
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Photo Upload */}
            <div
              className="rounded-lg p-4 text-center bg-[#3d5266] border-2 border-dashed border-white/20 hover:border-[#66bfcc] transition-colors cursor-pointer"
            >
              <label className="cursor-pointer block">
                <div className="text-sm font-medium text-white mb-1">
                  Click to add photos
                </div>
                <div className="text-xs text-white/60">
                  JPG, PNG, or video files
                </div>
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={handleFileSelect}
                  className="sr-only"
                />
              </label>
            </div>

            {/* Existing Photos */}
            {existingMedia.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-white/80 mb-2">Current Photos</h4>
                <div className="grid grid-cols-3 gap-2">
                  {existingMedia.map((media) => (
                    <div key={media.id} className="relative group">
                      <div className="aspect-square bg-[#3d5266] rounded-lg overflow-hidden">
                        {media.type === "image" ? (
                          <img
                            src={media.downloadURL}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <video
                            src={media.downloadURL}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex flex-col items-center justify-center gap-1">
                        {media.type === "image" && (
                          <button
                            type="button"
                            onClick={() => {
                              setCoverMediaId(media.id!);
                              setNewCoverKey(null);
                            }}
                            className={`text-xs px-2 py-1 rounded ${
                              coverMediaId === media.id && !newCoverKey
                                ? "bg-green-600 text-white"
                                : "bg-white/20 text-white hover:bg-white/30"
                            }`}
                          >
                            {coverMediaId === media.id && !newCoverKey ? "✓ Cover" : "Set Cover"}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => removeExistingMedia(media.id!)}
                          className="text-xs px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* New Photos to Upload */}
            {newFiles.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-white/80 mb-2">New Photos</h4>
                <div className="grid grid-cols-3 gap-2">
                  {newFiles.map((file) => {
                    const k = fileKey(file);
                    const isImage = file.type.startsWith("image/");
                    return (
                      <div key={k} className="relative group">
                        <div className="aspect-square bg-[#3d5266] rounded-lg overflow-hidden">
                          {isImage ? (
                            <img
                              src={previews[k]}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <video
                              src={previews[k]}
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex flex-col items-center justify-center gap-1">
                          {isImage && (
                            <button
                              type="button"
                              onClick={() => {
                                setNewCoverKey(k);
                                setCoverMediaId(null);
                              }}
                              className={`text-xs px-2 py-1 rounded ${
                                newCoverKey === k
                                  ? "bg-green-600 text-white"
                                  : "bg-white/20 text-white hover:bg-white/30"
                              }`}
                            >
                              {newCoverKey === k ? "✓ Cover" : "Set Cover"}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => removeNewFile(k)}
                            className="text-xs px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-[#66bfcc] text-white rounded-lg hover:bg-[#5aa8b5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddReviewModal({
  placeName,
  city,
  country,
  type,
  userId,
  onClose,
  onSave,
}: {
  placeName: string;
  city: string;
  country: string;
  type: ReviewType;
  userId: string;
  onClose: () => void;
  onSave: () => Promise<void>;
}) {
  const [notes, setNotes] = useState("");
  const [visitDate, setVisitDate] = useState("");
  const [qualityRating, setQualityRating] = useState(0);
  const [serviceRating, setServiceRating] = useState(0);
  const [valueRating, setValueRating] = useState(0);
  const [locationRating, setLocationRating] = useState(0);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Find or create a trip for this user to store the review
      const tripsSnapshot = await getDocs(
        query(collection(db, "trips"), where("ownerId", "==", userId))
      );

      let tripId: string;

      if (tripsSnapshot.empty) {
        // Create a new trip for this user's reviews
        const newTripRef = doc(collection(db, "trips"));
        await setDoc(newTripRef, {
          ownerId: userId,
          name: "My Reviews",
          country: country,
          startDate: visitDate || new Date().toISOString().split("T")[0],
          endDate: visitDate || new Date().toISOString().split("T")[0],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        tripId = newTripRef.id;
      } else {
        // Use the first existing trip (or we could find one matching the country)
        let matchingTrip = null;
        for (const tripDoc of tripsSnapshot.docs) {
          const tripData = tripDoc.data();
          if (tripData.country === country) {
            matchingTrip = tripDoc;
            break;
          }
        }

        tripId = matchingTrip ? matchingTrip.id : tripsSnapshot.docs[0].id;
      }

      // Determine the subcollection based on review type
      const subcollectionMap: Record<ReviewType, string> = {
        "Destinations": "destinations",
        "Activities": "activities",
        "Accommodations": "accommodations",
        "Restaurants": "restaurants",
        "Cruises": "cruises",
      };

      const subcollection = subcollectionMap[type];

      // Add the review to the appropriate subcollection
      await addDoc(collection(db, "trips", tripId, subcollection), {
        name: placeName,
        city: city,
        country: country,
        review: notes,
        notes: notes,
        qualityRating: qualityRating,
        serviceRating: serviceRating,
        valueRating: valueRating,
        locationRating: locationRating,
        startDate: visitDate || null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      await onSave();
    } catch (error) {
      console.error("Error adding review:", error);
      alert("Failed to add review. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const renderStarRating = (value: number, onChange: (rating: number) => void, label: string) => {
    return (
      <div className="space-y-1">
        <label className="text-sm font-medium text-white">{label}</label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((rating) => (
            <button
              key={rating}
              type="button"
              onClick={() => onChange(rating)}
              className="focus:outline-none"
            >
              <Star
                className="w-6 h-6 cursor-pointer transition-colors"
                fill={rating <= value ? "#f4a261" : "none"}
                stroke={rating <= value ? "#f4a261" : "#888"}
              />
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-x-0 top-[60px] bottom-0 z-[100] bg-black/90 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-[#2c3e50] rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[#2c3e50] border-b border-white/10 p-4 sm:p-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">Add Your Review</h2>
            <p className="text-sm text-white/70 mt-1">{placeName}</p>
            <p className="text-xs text-white/60 mt-0.5">{city}, {country}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Close"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Visit Date */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white">Visit Date (Optional)</label>
            <input
              type="date"
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
              className="w-full px-4 py-3 bg-[#3d5266] text-white rounded-lg border border-white/10 focus:border-[#66bfcc] focus:outline-none text-sm"
            />
          </div>

          {/* Review Notes */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-white">Your Review</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-3 bg-[#3d5266] text-white rounded-lg border border-white/10 focus:border-[#66bfcc] focus:outline-none resize-none"
              rows={5}
              placeholder="Share your experience..."
            />
          </div>

          {/* Ratings */}
          <div className="space-y-4">
            <h3 className="text-base sm:text-lg font-semibold text-white">Ratings</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renderStarRating(qualityRating, setQualityRating, "Quality")}
              {renderStarRating(serviceRating, setServiceRating, "Service")}
              {renderStarRating(valueRating, setValueRating, "Value")}
              {renderStarRating(locationRating, setLocationRating, "Location")}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-[#66bfcc] text-white rounded-lg hover:bg-[#5aa8b5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={saving}
            >
              {saving ? "Saving..." : "Add Review"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
