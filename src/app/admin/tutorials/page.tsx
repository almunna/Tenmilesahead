"use client";
import { useAuth } from "@/components/AuthProvider";
import AdminProtected from "@/components/AdminProtected";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  orderBy,
  deleteDoc,
  doc,
  updateDoc,
  addDoc,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import Link from "next/link";

type Tutorial = {
  id: string;
  title: string;
  url: string;
  description?: string;
  createdAt: number;
  createdBy: string;
};

export default function ManageTutorials() {
  return (
    <AdminProtected>
      <ManageTutorialsInner />
    </AdminProtected>
  );
}

function ManageTutorialsInner() {
  const { user } = useAuth();
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTutorial, setEditingTutorial] = useState<Tutorial | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newDescription, setNewDescription] = useState("");

  useEffect(() => {
    loadTutorials();
  }, []);

  async function loadTutorials() {
    try {
      const q = query(collection(db, "tutorials"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const tutorialsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Tutorial[];
      setTutorials(tutorialsData);
    } catch (error) {
      console.error("Error loading tutorials:", error);
    } finally {
      setLoading(false);
    }
  }

  function getYouTubeThumbnail(url: string): string {
    try {
      const videoId = extractYouTubeVideoId(url);
      if (videoId) {
        return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      }
    } catch (error) {
      console.error("Error extracting YouTube ID:", error);
    }
    return "/placeholder-video.png";
  }

  function extractYouTubeVideoId(url: string): string | null {
    const patterns = [
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([^&]+)/,
      /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([^?]+)/,
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([^?]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  }

  async function handleDelete(tutorialId: string) {
    if (!confirm("Are you sure you want to delete this tutorial?")) {
      return;
    }

    try {
      await deleteDoc(doc(db, "tutorials", tutorialId));
      setTutorials(tutorials.filter((t) => t.id !== tutorialId));
      alert("Tutorial deleted successfully!");
    } catch (error) {
      console.error("Error deleting tutorial:", error);
      alert("Failed to delete tutorial. Please try again.");
    }
  }

  function openEditModal(tutorial: Tutorial) {
    setEditingTutorial(tutorial);
    setEditTitle(tutorial.title);
    setEditUrl(tutorial.url);
    setEditDescription(tutorial.description || "");
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTutorial) return;

    setSubmitting(true);

    try {
      await updateDoc(doc(db, "tutorials", editingTutorial.id), {
        title: editTitle,
        url: editUrl,
        description: editDescription,
      });

      // Update local state
      setTutorials(
        tutorials.map((t) =>
          t.id === editingTutorial.id
            ? { ...t, title: editTitle, url: editUrl, description: editDescription }
            : t
        )
      );

      setEditingTutorial(null);
      alert("Tutorial updated successfully!");
    } catch (error) {
      console.error("Error updating tutorial:", error);
      alert("Failed to update tutorial. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      const docRef = await addDoc(collection(db, "tutorials"), {
        title: newTitle,
        url: newUrl,
        description: newDescription,
        createdAt: Date.now(),
        createdBy: user?.uid,
      });

      // Add to local state
      const newTutorial: Tutorial = {
        id: docRef.id,
        title: newTitle,
        url: newUrl,
        description: newDescription,
        createdAt: Date.now(),
        createdBy: user?.uid || "",
      };

      setTutorials([newTutorial, ...tutorials]);

      // Reset form and close modal
      setNewTitle("");
      setNewUrl("");
      setNewDescription("");
      setShowAddModal(false);
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
      {/* Header */}
      <header className="bg-white border-b shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-haiti-900">
                Manage Tutorials
              </h1>
              <p className="text-sm text-muted-foreground">
                View, edit, and delete tutorial videos
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowAddModal(true)}
                className="btn bg-blue-600 text-white hover:bg-blue-700"
              >
                Add Tutorial
              </button>
              <Link href="/admin" className="btn">
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
              <p className="mt-2 text-muted-foreground">Loading tutorials...</p>
            </div>
          </div>
        ) : tutorials.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-muted-foreground mb-4">No tutorials yet</p>
            <Link href="/admin" className="btn">
              Add Your First Tutorial
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tutorials.map((tutorial) => (
              <div key={tutorial.id} className="card overflow-hidden">
                {/* Thumbnail */}
                <div className="relative h-48 bg-gray-200">
                  <img
                    src={getYouTubeThumbnail(tutorial.url)}
                    alt={tutorial.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <a
                      href={tutorial.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-white text-sm underline"
                    >
                      Watch on YouTube
                    </a>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 space-y-3">
                  <h3 className="font-semibold text-lg line-clamp-2">
                    {tutorial.title}
                  </h3>

                  {tutorial.description && (
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {tutorial.description}
                    </p>
                  )}

                  <div className="text-xs text-muted-foreground">
                    Added: {new Date(tutorial.createdAt).toLocaleDateString()}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => openEditModal(tutorial)}
                      className="btn flex-1 bg-blue-600 text-white hover:bg-blue-700"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(tutorial.id)}
                      className="btn flex-1 bg-red-600 text-white hover:bg-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingTutorial && (
        <div className="fixed inset-x-0 top-[60px] bottom-0 z-[100] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-semibold">Edit Tutorial</h2>
                <button
                  onClick={() => setEditingTutorial(null)}
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

              <form onSubmit={handleUpdate} className="space-y-4">
                <div>
                  <label className="label" htmlFor="edit-title">
                    Tutorial Title
                  </label>
                  <input
                    id="edit-title"
                    type="text"
                    className="input"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="label" htmlFor="edit-url">
                    YouTube Video URL
                  </label>
                  <input
                    id="edit-url"
                    type="url"
                    className="input"
                    value={editUrl}
                    onChange={(e) => setEditUrl(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="label" htmlFor="edit-description">
                    Description (Optional)
                  </label>
                  <textarea
                    id="edit-description"
                    className="input min-h-[100px]"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={4}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setEditingTutorial(null)}
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
                    {submitting ? "Updating..." : "Update Tutorial"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Add Tutorial Modal */}
      {showAddModal && (
        <div className="fixed inset-x-0 top-[60px] bottom-0 z-[100] flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-semibold">Add New Tutorial</h2>
                <button
                  onClick={() => setShowAddModal(false)}
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

              <form onSubmit={handleAdd} className="space-y-4">
                <div>
                  <label className="label" htmlFor="new-title">
                    Tutorial Title
                  </label>
                  <input
                    id="new-title"
                    type="text"
                    className="input"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g., How to Create Your First Trip"
                    required
                  />
                </div>

                <div>
                  <label className="label" htmlFor="new-url">
                    YouTube Video URL
                  </label>
                  <input
                    id="new-url"
                    type="url"
                    className="input"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Enter the full YouTube video URL
                  </p>
                </div>

                <div>
                  <label className="label" htmlFor="new-description">
                    Description (Optional)
                  </label>
                  <textarea
                    id="new-description"
                    className="input min-h-[100px]"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Brief description of what this tutorial covers..."
                    rows={4}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
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
