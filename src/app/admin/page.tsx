"use client";
import { useAuth } from "@/components/AuthProvider";
import AdminProtected from "@/components/AdminProtected";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, limit, addDoc } from "firebase/firestore";
import { useEffect, useState } from "react";
import Link from "next/link";

type Stats = {
  totalUsers: number;
  totalTrips: number;
  recentUsers: Array<{ email: string; username: string; createdAt: number }>;
  recentTrips: Array<{ name: string; ownerId: string; createdAt: number }>;
};

export default function AdminDashboard() {
  return (
    <AdminProtected>
      <AdminDashboardInner />
    </AdminProtected>
  );
}

function AdminDashboardInner() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalTrips: 0,
    recentUsers: [],
    recentTrips: [],
  });
  const [loading, setLoading] = useState(true);
  const [showTutorialModal, setShowTutorialModal] = useState(false);
  const [tutorialTitle, setTutorialTitle] = useState("");
  const [tutorialUrl, setTutorialUrl] = useState("");
  const [tutorialDescription, setTutorialDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadStats() {
      try {
        // Get total users count
        const usersSnapshot = await getDocs(collection(db, "users"));
        const totalUsers = usersSnapshot.size;

        // Get recent users
        const recentUsersQuery = query(
          collection(db, "users"),
          orderBy("createdAt", "desc"),
          limit(5)
        );
        const recentUsersSnapshot = await getDocs(recentUsersQuery);
        const recentUsers = recentUsersSnapshot.docs.map((doc) => ({
          email: doc.data().email || "N/A",
          username: doc.data().username || "N/A",
          createdAt: doc.data().createdAt || 0,
        }));

        // Get total trips count
        const tripsSnapshot = await getDocs(collection(db, "trips"));
        const totalTrips = tripsSnapshot.size;

        // Get recent trips
        const recentTripsQuery = query(
          collection(db, "trips"),
          orderBy("createdAt", "desc"),
          limit(5)
        );
        const recentTripsSnapshot = await getDocs(recentTripsQuery);
        const recentTrips = recentTripsSnapshot.docs.map((doc) => ({
          name: doc.data().name || "Untitled Trip",
          ownerId: doc.data().ownerId || "N/A",
          createdAt: doc.data().createdAt || 0,
        }));

        setStats({
          totalUsers,
          totalTrips,
          recentUsers,
          recentTrips,
        });
      } catch (error) {
        console.error("Error loading stats:", error);
      } finally {
        setLoading(false);
      }
    }

    loadStats();
  }, []);

  const formatDate = (timestamp: number) => {
    if (!timestamp) return "N/A";
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  async function handleAddTutorial(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      await addDoc(collection(db, "tutorials"), {
        title: tutorialTitle,
        url: tutorialUrl,
        description: tutorialDescription,
        createdAt: Date.now(),
        createdBy: user?.uid,
      });

      // Reset form and close modal
      setTutorialTitle("");
      setTutorialUrl("");
      setTutorialDescription("");
      setShowTutorialModal(false);
      alert("Tutorial added successfully!");
    } catch (error) {
      console.error("Error adding tutorial:", error);
      alert("Failed to add tutorial. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Admin Header */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-haiti-900">
                Admin Dashboard
              </h1>
              <p className="text-sm text-muted-foreground">
                Welcome back, {profile?.username || user?.email}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/" className="btn">
                View Site
              </Link>
              <button
                onClick={() => setShowTutorialModal(true)}
                className="btn bg-blue-600 text-white hover:bg-blue-700"
              >
                Add Tutorial
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
              <p className="mt-2 text-muted-foreground">Loading statistics...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
                <h3 className="text-sm font-medium opacity-90">Total Users</h3>
                <p className="text-3xl font-bold mt-2">{stats.totalUsers}</p>
              </div>

              <div className="card bg-gradient-to-br from-green-500 to-green-600 text-white">
                <h3 className="text-sm font-medium opacity-90">Total Trips</h3>
                <p className="text-3xl font-bold mt-2">{stats.totalTrips}</p>
              </div>

              <div className="card bg-gradient-to-br from-purple-500 to-purple-600 text-white">
                <h3 className="text-sm font-medium opacity-90">Avg Trips/User</h3>
                <p className="text-3xl font-bold mt-2">
                  {stats.totalUsers > 0
                    ? (stats.totalTrips / stats.totalUsers).toFixed(1)
                    : "0"}
                </p>
              </div>

              <div className="card bg-gradient-to-br from-orange-500 to-orange-600 text-white">
                <h3 className="text-sm font-medium opacity-90">System Status</h3>
                <p className="text-lg font-semibold mt-2">
                  <span className="inline-block w-2 h-2 bg-green-300 rounded-full mr-2"></span>
                  Active
                </p>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Users */}
              <div className="card">
                <h2 className="text-xl font-semibold mb-4">Recent Users</h2>
                <div className="space-y-3">
                  {stats.recentUsers.length > 0 ? (
                    stats.recentUsers.map((user, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-surface rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{user.username}</p>
                          <p className="text-sm text-muted-foreground">
                            {user.email}
                          </p>
                        </div>
                        <div className="text-right text-sm text-muted-foreground">
                          {formatDate(user.createdAt)}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-sm">No users yet</p>
                  )}
                </div>
              </div>

              {/* Recent Trips */}
              <div className="card">
                <h2 className="text-xl font-semibold mb-4">Recent Trips</h2>
                <div className="space-y-3">
                  {stats.recentTrips.length > 0 ? (
                    stats.recentTrips.map((trip, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-surface rounded-lg"
                      >
                        <div>
                          <p className="font-medium">{trip.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Owner ID: {trip.ownerId.substring(0, 8)}...
                          </p>
                        </div>
                        <div className="text-right text-sm text-muted-foreground">
                          {formatDate(trip.createdAt)}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-sm">No trips yet</p>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="card">
              <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Link href="/admin/tutorials" className="btn text-left flex items-center gap-3 p-4">
                  <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center text-red-600">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium">Manage Tutorials</div>
                    <div className="text-sm text-muted-foreground">
                      View, edit, and delete tutorials
                    </div>
                  </div>
                </Link>

                <Link href="/admin/users" className="btn text-left flex items-center gap-3 p-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                      />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium">Manage Users</div>
                    <div className="text-sm text-muted-foreground">
                      View and edit user accounts
                    </div>
                  </div>
                </Link>

                <Link href="/admin/analytics" className="btn text-left flex items-center gap-3 p-4">
                  <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center text-green-600">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      />
                    </svg>
                  </div>
                  <div>
                    <div className="font-medium">View Analytics</div>
                    <div className="text-sm text-muted-foreground">
                      Detailed usage statistics
                    </div>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Tutorial Modal */}
      {showTutorialModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-semibold">Add New Tutorial</h2>
                <button
                  onClick={() => setShowTutorialModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleAddTutorial} className="space-y-4">
                <div>
                  <label className="label" htmlFor="tutorial-title">
                    Tutorial Title
                  </label>
                  <input
                    id="tutorial-title"
                    type="text"
                    className="input"
                    value={tutorialTitle}
                    onChange={(e) => setTutorialTitle(e.target.value)}
                    placeholder="e.g., How to Create Your First Trip"
                    required
                  />
                </div>

                <div>
                  <label className="label" htmlFor="tutorial-url">
                    YouTube Video URL
                  </label>
                  <input
                    id="tutorial-url"
                    type="url"
                    className="input"
                    value={tutorialUrl}
                    onChange={(e) => setTutorialUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Enter the full YouTube video URL
                  </p>
                </div>

                <div>
                  <label className="label" htmlFor="tutorial-description">
                    Description (Optional)
                  </label>
                  <textarea
                    id="tutorial-description"
                    className="input min-h-[100px]"
                    value={tutorialDescription}
                    onChange={(e) => setTutorialDescription(e.target.value)}
                    placeholder="Brief description of what this tutorial covers..."
                    rows={4}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowTutorialModal(false)}
                    className="btn flex-1"
                    disabled={submitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn bg-blue-600 text-white hover:bg-blue-700 flex-1"
                    disabled={submitting}
                  >
                    {submitting ? "Adding..." : "Add Tutorial"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
