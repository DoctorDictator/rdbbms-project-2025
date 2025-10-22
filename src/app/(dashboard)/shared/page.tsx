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
    isFavorite?: boolean;
    isTrashed?: boolean;
    isShared?: boolean;
    canEdit?: boolean;
    owner?: {
      id: string;
      username: string;
      name: string | null;
      email: string | null;
    };
    createdAt: string;
    updatedAt: string;
  };
}

interface ShareByMe {
  shareId: string;
  permission: "VIEW" | "EDIT";
  sharedAt: string;
  sharedWith: {
    id: string;
    username: string;
    name: string | null;
    email?: string | null;
  };
  file: {
    id: string;
    title: string;
    content: string;
    createdAt: string;
    updatedAt: string;
  };
}

interface MyFile {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export default function SharePage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"with-me" | "by-me">("with-me");
  const [sharedWithMe, setSharedWithMe] = useState<SharedFile[]>([]);
  const [sharedByMe, setSharedByMe] = useState<ShareByMe[]>([]);
  const [myFiles, setMyFiles] = useState<MyFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [actionStatus, setActionStatus] = useState("");

  // Share modal state
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareFileId, setShareFileId] = useState<string | null>(null);
  const [shareWith, setShareWith] = useState("");
  const [sharePermission, setSharePermission] = useState<"VIEW" | "EDIT">(
    "VIEW"
  );
  const [shareError, setShareError] = useState("");
  const [shareSuccess, setShareSuccess] = useState("");
  const [isSharing, setIsSharing] = useState(false);

  // Edit permission modal state
  const [showEditPermissionModal, setShowEditPermissionModal] = useState(false);
  const [editShareId, setEditShareId] = useState<string | null>(null);
  const [editPermission, setEditPermission] = useState<"VIEW" | "EDIT">("VIEW");

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      if (activeTab === "with-me") {
        await fetchSharedWithMe();
      } else {
        await fetchSharedByMe();
        await fetchMyFiles();
      }
      setError("");
    } catch (err) {
      setError("Failed to load data");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSharedWithMe = async () => {
    const response = await fetch("/api/shares/with-me");
    if (!response.ok) throw new Error("Failed to fetch shared files");
    const data = await response.json();
    setSharedWithMe(data.shares || []);
  };

  const fetchSharedByMe = async () => {
    const response = await fetch("/api/shares/by-me");
    if (!response.ok) throw new Error("Failed to fetch shares");
    const data = await response.json();
    setSharedByMe(data.shares || []);
  };

  const fetchMyFiles = async () => {
    const response = await fetch("/api/files");
    if (!response.ok) throw new Error("Failed to fetch files");
    const data = await response.json();
    setMyFiles(data.files || []);
  };

  const handleRemoveShare = async (shareId: string) => {
    setActionStatus("");
    try {
      const res = await fetch(`/api/shares/${shareId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        setActionStatus("Share removed successfully!");
        fetchData();
        setTimeout(() => setActionStatus(""), 3000);
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
        setSharedWithMe((prev) =>
          prev.map((s) =>
            s.file.id === fileId
              ? { ...s, file: { ...s.file, isFavorite: data.isFavorite } }
              : s
          )
        );
        setTimeout(() => setActionStatus(""), 3000);
      } else {
        setActionStatus(data.error || "Failed to update favorite");
      }
    } catch {
      setActionStatus("Failed to update favorite");
    }
  };

  const handleOpenShareModal = (fileId: string | null = null) => {
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
    setIsSharing(true);

    if (!shareWith.trim()) {
      setShareError("Please enter a username or email to share with.");
      setIsSharing(false);
      return;
    }

    if (!shareFileId) {
      setShareError("Please select a file to share.");
      setIsSharing(false);
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
        setTimeout(() => {
          setShowShareModal(false);
          fetchData();
        }, 1500);
      } else {
        setShareError(data.error || "Failed to share file");
      }
    } catch {
      setShareError("Failed to share file");
    } finally {
      setIsSharing(false);
    }
  };

  const handleOpenEditPermission = (
    shareId: string,
    currentPermission: "VIEW" | "EDIT"
  ) => {
    setEditShareId(shareId);
    setEditPermission(currentPermission);
    setShowEditPermissionModal(true);
  };

  const handleUpdatePermission = async () => {
    if (!editShareId) return;
    setActionStatus("");
    try {
      const res = await fetch(`/api/shares/${editShareId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permission: editPermission }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionStatus("Permission updated successfully!");
        setShowEditPermissionModal(false);
        fetchData();
        setTimeout(() => setActionStatus(""), 3000);
      } else {
        setActionStatus(data.error || "Failed to update permission");
      }
    } catch {
      setActionStatus("Failed to update permission");
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

  // Filter files based on search
  const filteredWithMe = sharedWithMe.filter((share) => {
    const matchesSearch =
      share.file.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      share.file.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (share.sharedBy.name?.toLowerCase().includes(searchQuery.toLowerCase()) ??
        false) ||
      share.sharedBy.username.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const filteredByMe = sharedByMe.filter((share) => {
    const matchesSearch =
      share.file.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      share.file.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (share.sharedWith.name
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ??
        false) ||
      share.sharedWith.username
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
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
              <h1 className="text-3xl font-bold text-white">
                Share Management
              </h1>
            </div>
            <p className="text-gray-400">
              Manage all your file shares in one place
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleOpenShareModal()}
              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-medium transition-colors"
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
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Share File
            </button>
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
              Back
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab("with-me")}
            className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all ${
              activeTab === "with-me"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                : "bg-[#1a1d29] text-gray-400 hover:text-white border border-gray-800"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
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
                  d="M7 16l-4-4m0 0l4-4m-4 4h18"
                />
              </svg>
              Shared With Me
              {sharedWithMe.length > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-white/20 rounded-full text-xs">
                  {sharedWithMe.length}
                </span>
              )}
            </div>
          </button>
          <button
            onClick={() => setActiveTab("by-me")}
            className={`flex-1 px-6 py-3 rounded-lg font-medium transition-all ${
              activeTab === "by-me"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                : "bg-[#1a1d29] text-gray-400 hover:text-white border border-gray-800"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
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
                  d="M17 8l4 4m0 0l-4 4m4-4H3"
                />
              </svg>
              Shared By Me
              {sharedByMe.length > 0 && (
                <span className="ml-2 px-2 py-0.5 bg-white/20 rounded-full text-xs">
                  {sharedByMe.length}
                </span>
              )}
            </div>
          </button>
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
              placeholder={`Search ${
                activeTab === "with-me"
                  ? "files shared with you"
                  : "your shared files"
              }...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-800/50 border border-gray-700 text-white rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
        </div>

        {/* Action Status */}
        {actionStatus && (
          <div
            className={`mb-4 p-4 rounded-lg ${
              actionStatus.includes("Failed") || actionStatus.includes("error")
                ? "bg-red-500/10 border border-red-500/30 text-red-400"
                : "bg-green-500/10 border border-green-500/30 text-green-400"
            }`}
          >
            <div className="flex items-center gap-2">
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
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {actionStatus}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="bg-[#1a1d29] border border-gray-800 rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-red-400 flex items-center gap-2">
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
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                {error}
              </div>
            </div>
          ) : activeTab === "with-me" ? (
            filteredWithMe.length === 0 ? (
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
                  {searchQuery
                    ? "No matching files found"
                    : "No shared files yet"}
                </p>
                <p className="text-gray-500 text-sm mb-6">
                  {searchQuery
                    ? "Try adjusting your search"
                    : "Files shared with you by others will appear here"}
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
                    <tr className="bg-gray-800/50 text-gray-300 text-left text-sm">
                      <th className="px-6 py-4 font-semibold">File Title</th>
                      <th className="px-6 py-4 font-semibold">Shared By</th>
                      <th className="px-6 py-4 font-semibold">Permission</th>
                      <th className="px-6 py-4 font-semibold">Shared At</th>
                      <th className="px-6 py-4 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredWithMe.map((share) => (
                      <tr
                        key={share.shareId}
                        className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <Link
                            href={`/files/${share.file.id}`}
                            className="text-blue-400 hover:text-blue-300 hover:underline font-medium"
                          >
                            {truncateText(share.file.title, 40)}
                          </Link>
                        </td>
                        <td className="px-6 py-4 text-gray-300">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-semibold">
                              {(share.sharedBy.name || share.sharedBy.username)
                                .charAt(0)
                                .toUpperCase()}
                            </div>
                            <span>
                              {share.sharedBy.name || share.sharedBy.username}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
                              share.permission === "EDIT"
                                ? "bg-green-500/20 text-green-400"
                                : "bg-yellow-500/20 text-yellow-400"
                            }`}
                          >
                            {share.permission === "EDIT" ? (
                              <svg
                                className="w-3 h-3"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                />
                              </svg>
                            ) : (
                              <svg
                                className="w-3 h-3"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                />
                              </svg>
                            )}
                            {share.permission}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-400 text-sm">
                          {formatDate(share.sharedAt)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            <Link
                              href={`/files/${share.file.id}`}
                              className="inline-flex items-center gap-1 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                            >
                              <svg
                                className="w-3 h-3"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                              </svg>
                              View
                            </Link>
                            {share.permission === "EDIT" && (
                              <Link
                                href={`/files/${share.file.id}/edit`}
                                className="inline-flex items-center gap-1 bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                              >
                                <svg
                                  className="w-3 h-3"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                  />
                                </svg>
                                Edit
                              </Link>
                            )}
                            <button
                              onClick={() => handleFavorite(share.file.id)}
                              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                share.file.isFavorite
                                  ? "bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30"
                                  : "bg-gray-700/50 text-gray-300 hover:bg-gray-700"
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
                              className="inline-flex items-center gap-1 bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                            >
                              <svg
                                className="w-3 h-3"
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
                              Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : filteredByMe.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-20 h-20 rounded-full bg-purple-500/10 flex items-center justify-center mb-4">
                <svg
                  className="w-10 h-10 text-purple-400"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
              </div>
              <p className="text-gray-400 text-lg mb-2 font-medium">
                {searchQuery
                  ? "No matching shares found"
                  : "You haven't shared any files yet"}
              </p>
              <p className="text-gray-500 text-sm mb-6">
                {searchQuery
                  ? "Try adjusting your search"
                  : "Start sharing your files with others"}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => handleOpenShareModal()}
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-lg font-medium transition-colors"
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
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Share a File
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-800/50 text-gray-300 text-left text-sm">
                    <th className="px-6 py-4 font-semibold">File Title</th>
                    <th className="px-6 py-4 font-semibold">Shared With</th>
                    <th className="px-6 py-4 font-semibold">Permission</th>
                    <th className="px-6 py-4 font-semibold">Shared At</th>
                    <th className="px-6 py-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredByMe.map((share) => (
                    <tr
                      key={share.shareId}
                      className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <Link
                          href={`/files/${share.file.id}`}
                          className="text-blue-400 hover:text-blue-300 hover:underline font-medium"
                        >
                          {truncateText(share.file.title, 40)}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-gray-300">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-sm font-semibold">
                            {(
                              share.sharedWith.name || share.sharedWith.username
                            )
                              .charAt(0)
                              .toUpperCase()}
                          </div>
                          <span>
                            {share.sharedWith.name || share.sharedWith.username}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() =>
                            handleOpenEditPermission(
                              share.shareId,
                              share.permission
                            )
                          }
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                            share.permission === "EDIT"
                              ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                              : "bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30"
                          }`}
                        >
                          {share.permission === "EDIT" ? (
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                          ) : (
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                              />
                            </svg>
                          )}
                          {share.permission}
                          <svg
                            className="w-3 h-3 ml-1"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </button>
                      </td>
                      <td className="px-6 py-4 text-gray-400 text-sm">
                        {formatDate(share.sharedAt)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <Link
                            href={`/files/${share.file.id}`}
                            className="inline-flex items-center gap-1 bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                          >
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                              />
                            </svg>
                            View
                          </Link>
                          <button
                            onClick={() => handleRemoveShare(share.shareId)}
                            className="inline-flex items-center gap-1 bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                            title="Revoke share"
                          >
                            <svg
                              className="w-3 h-3"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
                            </svg>
                            Revoke
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Results Count */}
        {!isLoading && !error && (
          <div className="mt-4 text-center text-sm text-gray-400">
            {activeTab === "with-me"
              ? filteredWithMe.length > 0 && (
                  <>
                    Showing {filteredWithMe.length} file
                    {filteredWithMe.length !== 1 ? "s" : ""} shared with you
                  </>
                )
              : filteredByMe.length > 0 && (
                  <>
                    Showing {filteredByMe.length} share
                    {filteredByMe.length !== 1 ? "s" : ""} you created
                  </>
                )}
          </div>
        )}

        {/* Share Modal */}
        {showShareModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-[#1a1d29] border border-gray-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white">Share File</h2>
                <button
                  onClick={() => setShowShareModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
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

              <form onSubmit={handleShareFile} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Select File
                  </label>
                  <select
                    value={shareFileId || ""}
                    onChange={(e) => setShareFileId(e.target.value)}
                    className="w-full bg-gray-800/50 border border-gray-700 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    required
                  >
                    <option value="">Choose a file...</option>
                    {myFiles.map((file) => (
                      <option key={file.id} value={file.id}>
                        {file.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Share with (Username or Email)
                  </label>
                  <input
                    type="text"
                    placeholder="Enter username or email"
                    value={shareWith}
                    onChange={(e) => setShareWith(e.target.value)}
                    className="w-full bg-gray-800/50 border border-gray-700 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Permission
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="permission"
                        value="VIEW"
                        checked={sharePermission === "VIEW"}
                        onChange={() => setSharePermission("VIEW")}
                        className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-300 flex items-center gap-1">
                        <svg
                          className="w-4 h-4 text-yellow-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                        View Only
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="permission"
                        value="EDIT"
                        checked={sharePermission === "EDIT"}
                        onChange={() => setSharePermission("EDIT")}
                        className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-gray-300 flex items-center gap-1">
                        <svg
                          className="w-4 h-4 text-green-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                        Can Edit
                      </span>
                    </label>
                  </div>
                </div>

                {shareError && (
                  <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    {shareError}
                  </div>
                )}

                {shareSuccess && (
                  <div className="bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    {shareSuccess}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowShareModal(false)}
                    className="px-4 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                    disabled={isSharing}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    disabled={isSharing}
                  >
                    {isSharing ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></div>
                        Sharing...
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                          />
                        </svg>
                        Share File
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Permission Modal */}
        {showEditPermissionModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-[#1a1d29] border border-gray-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white">
                  Edit Permission
                </h2>
                <button
                  onClick={() => setShowEditPermissionModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
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

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    Select Permission Level
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-700 cursor-pointer hover:bg-gray-800/50 transition-colors">
                      <input
                        type="radio"
                        name="editPermission"
                        value="VIEW"
                        checked={editPermission === "VIEW"}
                        onChange={() => setEditPermission("VIEW")}
                        className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-gray-200 font-medium">
                          <svg
                            className="w-4 h-4 text-yellow-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                          </svg>
                          View Only
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          User can only view the file
                        </p>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-700 cursor-pointer hover:bg-gray-800/50 transition-colors">
                      <input
                        type="radio"
                        name="editPermission"
                        value="EDIT"
                        checked={editPermission === "EDIT"}
                        onChange={() => setEditPermission("EDIT")}
                        className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-gray-200 font-medium">
                          <svg
                            className="w-4 h-4 text-green-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                          Can Edit
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          User can view and edit the file
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowEditPermissionModal(false)}
                    className="px-4 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdatePermission}
                    className="px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors flex items-center gap-2"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    Update
                  </button>
                </div>
              </div>
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
                {activeTab === "with-me"
                  ? "Files Shared With You"
                  : "Your Shared Files"}
              </h3>
              <ul className="text-xs text-gray-400 space-y-1">
                {activeTab === "with-me" ? (
                  <>
                    <li>
                      • <b>View</b> files shared with you by other users
                    </li>
                    <li>
                      • <b>Edit</b> files if you have edit permission
                    </li>
                    <li>
                      • <b>Remove</b> shares you no longer need access to
                    </li>
                    <li>
                      • Add shared files to your <b>favorites</b> for quick
                      access
                    </li>
                  </>
                ) : (
                  <>
                    <li>
                      • View all files you&apos;ve <b>shared with others</b>
                    </li>
                    <li>
                      • <b>Edit permissions</b> by clicking on the permission
                      badge
                    </li>
                    <li>
                      • <b>Revoke access</b> to remove shares at any time
                    </li>
                    <li>• Track who has access to each of your files</li>
                  </>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
