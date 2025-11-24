"use client";
import { useAuth } from "@/components/AuthProvider";
import AdminProtected from "@/components/AdminProtected";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { useEffect, useState } from "react";
import Link from "next/link";

type AnalyticsData = {
  totalUsers: number;
  totalTrips: number;
  totalDestinations: number;
  totalActivities: number;
  totalAccommodations: number;
  totalRestaurants: number;
  totalMedia: number;
  userGrowth: Array<{ month: string; count: number }>;
  tripsByCountry: Array<{ country: string; count: number }>;
};

export default function Analytics() {
  return (
    <AdminProtected>
      <AnalyticsInner />
    </AdminProtected>
  );
}

function AnalyticsInner() {
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalUsers: 0,
    totalTrips: 0,
    totalDestinations: 0,
    totalActivities: 0,
    totalAccommodations: 0,
    totalRestaurants: 0,
    totalMedia: 0,
    userGrowth: [],
    tripsByCountry: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  async function loadAnalytics() {
    try {
      // Get total counts
      const usersSnapshot = await getDocs(collection(db, "users"));
      const totalUsers = usersSnapshot.size;

      const tripsSnapshot = await getDocs(collection(db, "trips"));
      const totalTrips = tripsSnapshot.size;

      // Calculate user growth by month
      const usersByMonth: { [key: string]: number } = {};
      usersSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.createdAt) {
          const date = new Date(data.createdAt);
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
          usersByMonth[monthKey] = (usersByMonth[monthKey] || 0) + 1;
        }
      });

      const userGrowth = Object.entries(usersByMonth)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-6) // Last 6 months
        .map(([month, count]) => ({
          month: new Date(month + "-01").toLocaleDateString("en-US", { month: "short", year: "numeric" }),
          count,
        }));

      // Calculate trips by country
      const tripsByCountryMap: { [key: string]: number } = {};
      tripsSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.country) {
          tripsByCountryMap[data.country] = (tripsByCountryMap[data.country] || 0) + 1;
        }
      });

      const tripsByCountry = Object.entries(tripsByCountryMap)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10) // Top 10 countries
        .map(([country, count]) => ({ country, count }));

      // Count subcollections (approximate - would need to iterate through all trips)
      let totalDestinations = 0;
      let totalActivities = 0;
      let totalAccommodations = 0;
      let totalRestaurants = 0;
      let totalMedia = 0;

      for (const tripDoc of tripsSnapshot.docs) {
        const destSnapshot = await getDocs(collection(db, "trips", tripDoc.id, "destinations"));
        totalDestinations += destSnapshot.size;

        const actSnapshot = await getDocs(collection(db, "trips", tripDoc.id, "activities"));
        totalActivities += actSnapshot.size;

        const accSnapshot = await getDocs(collection(db, "trips", tripDoc.id, "accommodations"));
        totalAccommodations += accSnapshot.size;

        const restSnapshot = await getDocs(collection(db, "trips", tripDoc.id, "restaurants"));
        totalRestaurants += restSnapshot.size;

        const mediaSnapshot = await getDocs(collection(db, "trips", tripDoc.id, "media"));
        totalMedia += mediaSnapshot.size;
      }

      setAnalytics({
        totalUsers,
        totalTrips,
        totalDestinations,
        totalActivities,
        totalAccommodations,
        totalRestaurants,
        totalMedia,
        userGrowth,
        tripsByCountry,
      });
    } catch (error) {
      console.error("Error loading analytics:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-haiti-900">Analytics</h1>
              <p className="text-sm text-muted-foreground">
                Detailed platform statistics and insights
              </p>
            </div>
            <Link href="/admin" className="btn">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
              <p className="mt-2 text-muted-foreground">Loading analytics...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Overview Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                <h3 className="text-sm font-medium opacity-90">Total Users</h3>
                <p className="text-3xl font-bold mt-2">{analytics.totalUsers}</p>
              </div>

              <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
                <h3 className="text-sm font-medium opacity-90">Total Trips</h3>
                <p className="text-3xl font-bold mt-2">{analytics.totalTrips}</p>
              </div>

              <div className="card bg-gradient-to-br from-purple-500 to-purple-600 text-white">
                <h3 className="text-sm font-medium opacity-90">Total Media</h3>
                <p className="text-3xl font-bold mt-2">{analytics.totalMedia}</p>
              </div>

              <div className="card bg-gradient-to-br from-orange-500 to-orange-600 text-white">
                <h3 className="text-sm font-medium opacity-90">Avg Items/Trip</h3>
                <p className="text-3xl font-bold mt-2">
                  {analytics.totalTrips > 0
                    ? (
                        (analytics.totalDestinations +
                          analytics.totalActivities +
                          analytics.totalAccommodations +
                          analytics.totalRestaurants) /
                        analytics.totalTrips
                      ).toFixed(1)
                    : "0"}
                </p>
              </div>
            </div>

            {/* Content Stats */}
            <div className="card">
              <h2 className="text-xl font-semibold mb-4">Content Breakdown</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 bg-surface rounded-lg">
                  <p className="text-sm text-muted-foreground">Destinations</p>
                  <p className="text-2xl font-bold mt-1">{analytics.totalDestinations}</p>
                </div>
                <div className="p-4 bg-surface rounded-lg">
                  <p className="text-sm text-muted-foreground">Activities</p>
                  <p className="text-2xl font-bold mt-1">{analytics.totalActivities}</p>
                </div>
                <div className="p-4 bg-surface rounded-lg">
                  <p className="text-sm text-muted-foreground">Accommodations</p>
                  <p className="text-2xl font-bold mt-1">{analytics.totalAccommodations}</p>
                </div>
                <div className="p-4 bg-surface rounded-lg">
                  <p className="text-sm text-muted-foreground">Restaurants</p>
                  <p className="text-2xl font-bold mt-1">{analytics.totalRestaurants}</p>
                </div>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* User Growth */}
              <div className="card">
                <h2 className="text-xl font-semibold mb-4">User Growth (Last 6 Months)</h2>
                {analytics.userGrowth.length > 0 ? (
                  <div className="space-y-3">
                    {analytics.userGrowth.map((item) => (
                      <div key={item.month} className="flex items-center justify-between">
                        <span className="text-sm font-medium">{item.month}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-48 bg-surface rounded-full h-6">
                            <div
                              className="bg-blue-500 h-6 rounded-full flex items-center justify-end px-2"
                              style={{
                                width: `${(item.count / Math.max(...analytics.userGrowth.map((u) => u.count))) * 100}%`,
                              }}
                            >
                              <span className="text-xs text-white font-semibold">{item.count}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No data available</p>
                )}
              </div>

              {/* Trips by Country */}
              <div className="card">
                <h2 className="text-xl font-semibold mb-4">Top 10 Countries by Trips</h2>
                {analytics.tripsByCountry.length > 0 ? (
                  <div className="space-y-3">
                    {analytics.tripsByCountry.map((item) => (
                      <div key={item.country} className="flex items-center justify-between">
                        <span className="text-sm font-medium">{item.country}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-48 bg-surface rounded-full h-6">
                            <div
                              className="bg-green-500 h-6 rounded-full flex items-center justify-end px-2"
                              style={{
                                width: `${(item.count / Math.max(...analytics.tripsByCountry.map((t) => t.count))) * 100}%`,
                              }}
                            >
                              <span className="text-xs text-white font-semibold">{item.count}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No trips yet</p>
                )}
              </div>
            </div>

            {/* Additional Stats */}
            <div className="card">
              <h2 className="text-xl font-semibold mb-4">Platform Metrics</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-surface rounded-lg">
                  <p className="text-sm text-muted-foreground">Avg Trips per User</p>
                  <p className="text-2xl font-bold mt-1">
                    {analytics.totalUsers > 0
                      ? (analytics.totalTrips / analytics.totalUsers).toFixed(2)
                      : "0"}
                  </p>
                </div>
                <div className="p-4 bg-surface rounded-lg">
                  <p className="text-sm text-muted-foreground">Avg Media per Trip</p>
                  <p className="text-2xl font-bold mt-1">
                    {analytics.totalTrips > 0
                      ? (analytics.totalMedia / analytics.totalTrips).toFixed(1)
                      : "0"}
                  </p>
                </div>
                <div className="p-4 bg-surface rounded-lg">
                  <p className="text-sm text-muted-foreground">Total Content Items</p>
                  <p className="text-2xl font-bold mt-1">
                    {analytics.totalDestinations +
                      analytics.totalActivities +
                      analytics.totalAccommodations +
                      analytics.totalRestaurants +
                      analytics.totalMedia}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
