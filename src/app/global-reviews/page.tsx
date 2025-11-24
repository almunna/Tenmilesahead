"use client";

import { useState, useEffect } from "react";
import { collection, getDocs, query, orderBy, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Star, MapPin, Phone, Calendar, ChevronDown, Image as ImageIcon, Hotel } from "lucide-react";
import type { Review, ReviewType, MediaItem } from "@/lib/types";
import Protected from "@/components/Protected";

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
};

export default function GlobalReviewsPage() {
  return (
    <Protected>
      <GlobalReviewsInner />
    </Protected>
  );
}

function GlobalReviewsInner() {
  const [allReviews, setAllReviews] = useState<ReviewWithMedia[]>([]);
  const [groupedReviews, setGroupedReviews] = useState<GroupedReview[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedLocation, setSelectedLocation] = useState<string>("All Locations");
  const [selectedType, setSelectedType] = useState<string>("All Types");
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);

  // Selected review for detail view
  const [selectedGroup, setSelectedGroup] = useState<GroupedReview | null>(null);

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

      for (const tripDoc of tripsSnapshot.docs) {
        const tripId = tripDoc.id;

        // Fetch destinations
        reviewPromises.push(
          fetchReviewsFromSubcollection(tripId, "destinations", "Destinations")
        );

        // Fetch activities
        reviewPromises.push(
          fetchReviewsFromSubcollection(tripId, "activities", "Activities")
        );

        // Fetch accommodations
        reviewPromises.push(
          fetchReviewsFromSubcollection(tripId, "accommodations", "Accommodations")
        );

        // Fetch restaurants
        reviewPromises.push(
          fetchReviewsFromSubcollection(tripId, "restaurants", "Restaurants")
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
    type: ReviewType
  ): Promise<ReviewWithMedia[]> => {
    const snapshot = await getDocs(
      query(collection(db, "trips", tripId, subcollection), orderBy("createdAt", "desc"))
    );

    const reviews: ReviewWithMedia[] = [];

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
        ownerId: data.ownerId || "",
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
        coverMediaId: mediaItems[0]?.id || null,
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
      const key = `${review.placeName}|${review.city}|${review.country}|${review.type}`;

      if (grouped.has(key)) {
        const existing = grouped.get(key)!;
        existing.reviews.push(review);
      } else {
        grouped.set(key, {
          placeName: review.placeName,
          city: review.city,
          state: review.state || undefined,
          country: review.country,
          type: review.type,
          reviews: [review],
          coverMediaUrl: review.mediaItems[0]?.downloadURL,
          averageRating: review.ratings.overall,
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

  // Filter grouped reviews based on selected filters
  const filteredReviews = groupedReviews.filter((group) => {
    const matchesLocation =
      selectedLocation === "All Locations" || group.city === selectedLocation;
    const matchesType = selectedType === "All Types" || group.type === selectedType;
    return matchesLocation && matchesType;
  });

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
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
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Star className="w-7 h-7 text-[#f4a261]" fill="#f4a261" />
              <h1 className="text-2xl font-bold text-white">Global Reviews</h1>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4">
              {/* Location Filter */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowLocationDropdown(!showLocationDropdown);
                    setShowTypeDropdown(false);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-[#3d5266] text-white rounded-lg hover:bg-[#4a5f77] transition-colors min-w-[200px] justify-between"
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
                  className="flex items-center gap-2 px-4 py-2 bg-[#3d5266] text-white rounded-lg hover:bg-[#4a5f77] transition-colors min-w-[200px] justify-between"
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
                  </div>
                )}
              </div>
            </div>
          </div>

          <p className="text-sm text-white/70 mt-2">
            Reviews are listed in chronological order.
          </p>
        </div>
      </div>

      {/* Reviews List */}
      <div className="container mx-auto px-4 py-8">
        {filteredReviews.length === 0 ? (
          <div className="text-center text-white/70 py-12">
            No reviews found matching your filters.
          </div>
        ) : (
          <div className="space-y-4">
            {filteredReviews.map((group, groupIndex) => (
              <div key={`${group.placeName}-${group.city}-${groupIndex}`} className="space-y-4">
                {group.reviews.map((review, reviewIndex) => (
                  <ReviewCard
                    key={`${review.id}-${reviewIndex}`}
                    review={review}
                    reviewCount={group.reviews.length}
                    onClick={() => setSelectedGroup(group)}
                  />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Review Detail Modal */}
      {selectedGroup && (
        <ReviewDetailModal
          group={selectedGroup}
          onClose={() => setSelectedGroup(null)}
        />
      )}
    </div>
  );
}

function ReviewCard({
  review,
  reviewCount,
  onClick,
}: {
  review: ReviewWithMedia;
  reviewCount: number;
  onClick: () => void;
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
      <div className="flex">
        {/* Left: Cover Image */}
        <div className="w-32 h-32 flex-shrink-0 bg-[#2c3e50] relative">
          {review.mediaItems.length > 0 ? (
            <img
              src={review.mediaItems[0].downloadURL}
              alt={review.placeName}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ImageIcon className="w-12 h-12 text-white/30" />
            </div>
          )}
        </div>

        {/* Right: Content */}
        <div className="flex-1 p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white mb-1">{review.placeName}</h3>

              <div className="flex items-center gap-2 text-sm text-white/70 mb-1">
                <MapPin className="w-4 h-4" />
                <span>
                  {review.address || `${review.city}, ${review.state || review.country}`}
                </span>
              </div>

              {review.phone && (
                <div className="flex items-center gap-2 text-sm text-white/70 mb-2">
                  <Phone className="w-4 h-4" />
                  <span>{review.phone}</span>
                </div>
              )}

              {review.notes && (
                <p className="text-sm text-white/80 italic mb-3">"{review.notes}"</p>
              )}

              {/* Ratings Grid */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-1">
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

            {/* Type Badge */}
            <div className="flex flex-col items-end gap-2 ml-4">
              <div className="flex items-center gap-2 bg-[#2c3e50] px-3 py-1 rounded">
                <Hotel className="w-4 h-4 text-white/70" />
                <span className="text-xs text-white/90">{review.type}</span>
              </div>
            </div>
          </div>

          {/* Bottom Row */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/10">
            <div className="flex items-center gap-2 text-sm text-white/60">
              {review.visitDate && (
                <>
                  <Calendar className="w-4 h-4" />
                  <span>{new Date(review.visitDate).toLocaleDateString()}</span>
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
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
      <div className="bg-[#2c3e50] rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-[#2c3e50] border-b border-white/10 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">{group.placeName}</h2>
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
              <span>Visited on {new Date(currentReview.visitDate).toLocaleDateString()}</span>
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
