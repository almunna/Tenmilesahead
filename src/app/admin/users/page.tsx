"use client";
import { useAuth } from "@/components/AuthProvider";
import AdminProtected from "@/components/AdminProtected";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import Link from "next/link";

type User = {
  id: string;
  uid: string;
  email: string | null;
  username: string;
  role?: string;
  createdAt: number;
  updatedAt: number;
};

export default function ManageUsers() {
  return (
    <AdminProtected>
      <ManageUsersInner />
    </AdminProtected>
  );
}

function ManageUsersInner() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editRole, setEditRole] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  async function loadUsers() {
    try {
      const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const usersData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as User[];
      setUsers(usersData);
    } catch (error) {
      console.error("Error loading users:", error);
    } finally {
      setLoading(false);
    }
  }

  function openEditModal(user: User) {
    setEditingUser(user);
    setEditRole(user.role || "user");
  }

  async function handleUpdateRole(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;

    setSubmitting(true);

    try {
      await updateDoc(doc(db, "users", editingUser.id), {
        role: editRole,
        updatedAt: Date.now(),
      });

      // Update local state
      setUsers(
        users.map((u) =>
          u.id === editingUser.id ? { ...u, role: editRole } : u
        )
      );

      setEditingUser(null);
      alert("User role updated successfully!");
    } catch (error) {
      console.error("Error updating user:", error);
      alert("Failed to update user. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeleteUser(userId: string, userEmail: string) {
    if (
      !confirm(
        `Are you sure you want to delete user ${userEmail}? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      await deleteDoc(doc(db, "users", userId));
      setUsers(users.filter((u) => u.id !== userId));
      alert("User deleted successfully!");
    } catch (error) {
      console.error("Error deleting user:", error);
      alert("Failed to delete user. Please try again.");
    }
  }

  const formatDate = (timestamp: number) => {
    if (!timestamp) return "N/A";
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-haiti-900">
                Manage Users
              </h1>
              <p className="text-sm text-muted-foreground">
                View and manage user accounts
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
              <p className="mt-2 text-muted-foreground">Loading users...</p>
            </div>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-surface border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold">
                      Username
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">
                      Role
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">
                      Created
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b hover:bg-surface/50">
                      <td className="px-4 py-3 text-sm font-medium">
                        {user.username || "N/A"}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {user.email || "N/A"}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                            user.role === "admin"
                              ? "bg-orange-100 text-orange-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {user.role || "user"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex gap-2">
                          <button
                            onClick={() => openEditModal(user)}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Edit Role
                          </button>
                          <button
                            onClick={() =>
                              handleDeleteUser(user.id, user.email || "")
                            }
                            className="text-red-600 hover:text-red-800 font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {users.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  No users found
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Edit Role Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-semibold">Edit User Role</h2>
                <button
                  onClick={() => setEditingUser(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <div className="mb-4 p-3 bg-surface rounded-lg">
                <p className="text-sm text-muted-foreground">User</p>
                <p className="font-medium">{editingUser.username}</p>
                <p className="text-sm text-muted-foreground">
                  {editingUser.email}
                </p>
              </div>

              <form onSubmit={handleUpdateRole} className="space-y-4">
                <div>
                  <label className="label" htmlFor="role">
                    Role
                  </label>
                  <select
                    id="role"
                    className="input"
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    required
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Admins have access to the admin dashboard and all management
                    features.
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
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
                    {submitting ? "Updating..." : "Update Role"}
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
