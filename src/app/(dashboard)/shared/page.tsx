"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

interface SharedFile {
  shareId: string;
  permission: "VIEW" | "EDIT";
  sharedAt: string;
  sharedBy: {
    id: string;
    username: string;
    name: string | null;
    email?: string | null;
  };
  file: {
    id: string;
    title: string;
    content: string;
    isFavorite: boolean;
    isTrashed: boolean;
    isShared: boolean;
    canEdit: boolean;
    owner: {
      id: string;
      username: string;
      name: string | null;
      email: string | null;
    };
    createdAt: string;
    updatedAt: string;
  };
}

export default function SharedPage() {
  const { user } = useAuth();
  const [sharedFiles, setSharedFiles] = useState<SharedFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [actionStatus, setActionStatus] = useState("");
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareFileId, setShareFileId] = useState<string | null>(null);
  const [shareWith, setShareWith] = useState("");
  const [sharePermission, setSharePermission] = useState<"VIEW" | "EDIT">(
    "VIEW"
  );
  const [shareError, setShareError] = useState("");
  const [shareSuccess, setShareSuccess] = useState("");

  useEffect(() => {
    fetchSharedFiles();
  }, []);

  const fetchSharedFiles = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/shares/with-me");
      if (!response.ok) {
        throw new Error("Failed to fetch shared files");
      }
      const data = await response.json();
      setSharedFiles(data.shares || []);
      setError("");
    } catch (err) {
      setError("Failed to load shared files");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveShare = async (shareId: string) => {
    setActionStatus("");
    try {
      const res = await fetch(`/api/shares/${shareId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        setActionStatus("Share removed!");
        setSharedFiles(sharedFiles.filter((s) => s.shareId !== shareId));
      } else {
        setActionStatus(data.error || "Failed to remove share");
      }
    } catch {
      setActionStatus("Failed to remove share");
    }
  };

  const handleFavorite = async (fileId: string) => {
    setActionStatus("");
    try {
      const res = await fetch(`/api/files/${fileId}/favorite`, {
        method: "PATCH",
      });
      const data = await res.json();
      if (res.ok) {
        setActionStatus(
          data.isFavorite ? "Added to favorites!" : "Removed from favorites!"
        );
        setSharedFiles((prev) =>
          prev.map((s) =>
            s.file.id === fileId
              ? { ...s, file: { ...s.file, isFavorite: data.isFavorite } }
              : s
          )
        );
      } else {
        setActionStatus(data.error || "Failed to update favorite");
      }
    } catch {
      setActionStatus("Failed to update favorite");
    }
  };

  const handleOpenShareModal = (fileId: string) => {
    setShareFileId(fileId);
    setShareWith("");
    setSharePermission("VIEW");
    setShareError("");
    setShareSuccess("");
    setShowShareModal(true);
  };

  const handleShareFile = async (e: React.FormEvent) => {
    e.preventDefault();
    setShareError("");
    setShareSuccess("");
    if (!shareWith.trim()) {
      setShareError("Please enter a username or email to share with.");
      return;
    }
    try {
      const res = await fetch("/api/shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileId: shareFileId,
          identifier: shareWith,
          permission: sharePermission,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setShareSuccess("File shared successfully!");
        setShowShareModal(false);
        fetchSharedFiles();
      } else {
        setShareError(data.error || "Failed to share file");
      }
    } catch {
      setShareError("Failed to share file");
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const truncateText = (text: string, maxLength: number = 50) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  // Filter shared files based on search
  const filteredFiles = sharedFiles.filter((share) => {
    const file = share.file;
    const matchesSearch =
      file.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      file.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (share.sharedBy.name?.toLowerCase().includes(searchQuery.toLowerCase()) ??
        false) ||
      share.sharedBy.username.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-[#1a1d29] to-gray-900 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <svg
                  className="w-7 h-7 text-blue-400"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-white">Shared With Me</h1>
            </div>
            <p className="text-gray-400">Files others have shared with you</p>
          </div>
          <Link
            href="/files"
            className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
          >
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
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Back to Files
          </Link>
        </div>

        {/* Search */}
        <div className="bg-[#1a1d29] border border-gray-800 rounded-xl p-4 mb-6">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg
                className="w-5 h-5 text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search shared files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-800/50 border border-gray-700 text-white rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
        </div>

        {/* Shared Files Table */}
        <div className="bg-[#1a1d29] border border-gray-800 rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-red-400 flex items-center gap-2">
                {error}
              </div>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-20 h-20 rounded-full bg-blue-500/10 flex items-center justify-center mb-4">
                <svg
                  className="w-10 h-10 text-blue-400"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </div>
              <p className="text-gray-400 text-lg mb-2 font-medium">
                No shared files yet
              </p>
              <p className="text-gray-500 text-sm mb-6">
                Files shared with you by others will appear here.
              </p>
              {!searchQuery && (
                <Link
                  href="/files"
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                >
                  Browse Files
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-800/50 text-gray-300 text-left">
                    <th className="px-4 py-2 font-semibold">Title</th>
                    <th className="px-4 py-2 font-semibold">Shared By</th>
                    <th className="px-4 py-2 font-semibold">Permission</th>
                    <th className="px-4 py-2 font-semibold">Shared At</th>
                    <th className="px-4 py-2 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFiles.map((share) => (
                    <tr
                      key={share.shareId}
                      className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors"
                    >
                      <td className="px-4 py-2">
                        <Link
                          href={`/files/${share.file.id}`}
                          className="text-blue-400 hover:underline"
                        >
                          {truncateText(share.file.title, 40)}
                        </Link>
                      </td>
                      <td className="px-4 py-2">
                        {share.sharedBy.name || share.sharedBy.username}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            share.permission === "EDIT"
                              ? "bg-green-500/20 text-green-400"
                              : "bg-yellow-500/20 text-yellow-400"
                          }`}
                        >
                          {share.permission}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        {formatDate(share.sharedAt)}
                      </td>
                      <td className="px-4 py-2 flex gap-2">
                        <Link
                          href={`/files/${share.file.id}`}
                          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-lg text-xs font-medium transition-colors"
                        >
                          View
                        </Link>
                        {share.permission === "EDIT" && (
                          <Link
                            href={`/files/${share.file.id}/edit`}
                            className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white px-4 py-1.5 rounded-lg text-xs font-medium transition-colors"
                          >
                            Edit
                          </Link>
                        )}
                        <button
                          onClick={() => handleFavorite(share.file.id)}
                          className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                            share.file.isFavorite
                              ? "bg-yellow-500/20 text-yellow-400"
                              : "bg-gray-700/50 text-gray-300"
                          }`}
                          title={
                            share.file.isFavorite
                              ? "Remove from favorites"
                              : "Add to favorites"
                          }
                        >
                          {share.file.isFavorite ? "★" : "☆"}
                        </button>
                        <button
                          onClick={() => handleRemoveShare(share.shareId)}
                          className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-4 py-1.5 rounded-lg text-xs font-medium transition-colors"
                        >
                          Remove
                        </button>
                        <button
                          onClick={() => handleOpenShareModal(share.file.id)}
                          className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-4 py-1.5 rounded-lg text-xs font-medium transition-colors"
                        >
                          Share
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Results Count */}
        {!isLoading && !error && filteredFiles.length > 0 && (
          <div className="mt-4 text-center text-sm text-gray-400">
            Showing {filteredFiles.length} shared file
            {filteredFiles.length !== 1 ? "s" : ""}
          </div>
        )}

        {/* Action Status */}
        {actionStatus && (
          <div className="mt-2 text-center text-green-400 text-sm">
            {actionStatus}
          </div>
        )}

        {/* Share Modal */}
        {showShareModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-[#1a1d29] border border-gray-800 rounded-xl max-w-md w-full p-6">
              <h2 className="text-xl font-semibold text-white mb-4">
                Share File
              </h2>
              <form onSubmit={handleShareFile} className="space-y-4">
                <input
                  type="text"
                  placeholder="Username or email"
                  value={shareWith}
                  onChange={(e) => setShareWith(e.target.value)}
                  className="w-full bg-gray-800/50 border border-gray-700 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  required
                />
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="permission"
                      value="VIEW"
                      checked={sharePermission === "VIEW"}
                      onChange={() => setSharePermission("VIEW")}
                    />
                    <span className="text-gray-300">View</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="permission"
                      value="EDIT"
                      checked={sharePermission === "EDIT"}
                      onChange={() => setSharePermission("EDIT")}
                    />
                    <span className="text-gray-300">Edit</span>
                  </label>
                </div>
                {shareError && (
                  <div className="text-red-400 text-sm">{shareError}</div>
                )}
                {shareSuccess && (
                  <div className="text-green-400 text-sm">{shareSuccess}</div>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowShareModal(false)}
                    className="px-4 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors"
                  >
                    Share
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Info Card */}
        <div className="mt-6 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <h3 className="text-sm font-medium text-blue-400 mb-1">
                About Shared Files
              </h3>
              <ul className="text-xs text-gray-400 space-y-1">
                <li>
                  <b>Shared By</b> shows who shared the file with you.
                </li>
                <li>
                  <b>Permission</b> indicates if you can only view or also edit
                  the file.
                </li>
                <li>
                  Use the search box to filter by file title, content, or
                  sharer.
                </li>
                <li>
                  Click <b>View</b> to open the file, or <b>Edit</b> if you have
                  edit permission.
                </li>
                <li>
                  You can favorite, remove, or share files from your list.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
