"use client";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";

type Tutorial = {
  id: string;
  title: string;
  url: string;
  description?: string;
  createdAt: number;
};

export default function TutorialsPage() {
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [filteredTutorials, setFilteredTutorials] = useState<Tutorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadTutorials();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredTutorials(tutorials);
    } else {
      const filtered = tutorials.filter((tutorial) =>
        tutorial.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tutorial.description?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredTutorials(filtered);
    }
  }, [searchQuery, tutorials]);

  async function loadTutorials() {
    try {
      const q = query(collection(db, "tutorials"), orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);
      const tutorialsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Tutorial[];
      setTutorials(tutorialsData);
      setFilteredTutorials(tutorialsData);
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
        return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
      }
    } catch (error) {
      console.error("Error extracting YouTube ID:", error);
    }
    return "/placeholder-video.png";
  }

  function getYouTubeEmbedUrl(url: string): string {
    try {
      const videoId = extractYouTubeVideoId(url);
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
      }
    } catch (error) {
      console.error("Error extracting YouTube ID:", error);
    }
    return "";
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

  function formatDate(timestamp: number) {
    return new Date(timestamp).toLocaleDateString("en-US", {
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
    });
  }

  return (
    <div className="min-h-screen">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Tutorials</h1>
              <p className="text-gray-600">
                Watch step-by-step videos to get the most out of your travel planning.
              </p>
            </div>
            <div className="w-80">
              <input
                type="text"
                placeholder="Search tutorials..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Tutorials Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
              <p className="mt-2 text-muted-foreground">Loading tutorials...</p>
            </div>
          </div>
        ) : filteredTutorials.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500 text-lg">
              {searchQuery ? "No tutorials found matching your search." : "No tutorials available yet. Check back soon!"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {filteredTutorials.map((tutorial) => {
              const embedUrl = getYouTubeEmbedUrl(tutorial.url);

              return (
                <div
                  key={tutorial.id}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-xl transition-shadow"
                >
                  {/* Embedded Video Player */}
                  <div className="relative aspect-video bg-gray-900">
                    {embedUrl ? (
                      <iframe
                        className="w-full h-full"
                        src={embedUrl}
                        title={tutorial.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white">
                        Invalid video URL
                      </div>
                    )}
                  </div>

                  {/* Card Content */}
                  <div className="p-6">
                    <h3 className="font-semibold text-xl text-gray-900 mb-3 line-clamp-2">
                      {tutorial.title}
                    </h3>
                    {tutorial.description && (
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                        {tutorial.description}
                      </p>
                    )}
                    <p className="text-sm text-gray-500">
                      {formatDate(tutorial.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
