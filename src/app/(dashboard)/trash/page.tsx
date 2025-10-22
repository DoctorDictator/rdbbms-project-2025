"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

interface File {
  id: string;
  title: string;
  content: string;
  isFavorite: boolean;
  isTrashed: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string;
  userId: string;
  trashId: string;
  owner: {
    id: string;
    username: string;
    name: string | null;
    email: string | null;
  };
}

interface TrashStats {
  totalTrashed: number;
  deletableFiles: number;
  nonDeletableFiles: number;
  approximateSize: string;
  approximateSizeBytes: number;
  oldestTrashedAt: string | null;
  newestTrashedAt: string | null;
  isEmpty: boolean;
  canEmpty: boolean;
}

export default function TrashPage() {
  const { user } = useAuth();
  const [files, setFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [showEmptyModal, setShowEmptyModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [trashStats, setTrashStats] = useState<TrashStats | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchTrashedFiles();
    fetchTrashStats();
  }, []);

  const fetchTrashedFiles = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/trash");

      if (!response.ok) {
        throw new Error("Failed to fetch trashed files");
      }

      const data = await response.json();
      setFiles(data.files);
      setError("");
    } catch (err) {
      setError("Failed to load trashed files");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTrashStats = async () => {
    try {
      const response = await fetch("/api/trash/empty");
      if (response.ok) {
        const data = await response.json();
        setTrashStats(data);
      }
    } catch (err) {
      console.error("Failed to fetch trash stats:", err);
    }
  };

  const handleSelectFile = (fileId: string) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(fileId)) {
      newSelected.delete(fileId);
    } else {
      newSelected.add(fileId);
    }
    setSelectedFiles(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedFiles.size === filteredFiles.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(filteredFiles.map((f) => f.id)));
    }
  };

  const handleRestoreSelected = async () => {
    if (selectedFiles.size === 0) return;

    setIsProcessing(true);
    try {
      const response = await fetch("/api/trash", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileIds: Array.from(selectedFiles) }),
      });

      if (!response.ok) {
        throw new Error("Failed to restore files");
      }

      const data = await response.json();

      // Remove restored files from the list
      setFiles(files.filter((f) => !selectedFiles.has(f.id)));
      setSelectedFiles(new Set());
      setShowRestoreModal(false);

      alert(`✅ ${data.restoredCount} file(s) restored successfully!`);
      fetchTrashStats();
    } catch (err) {
      console.error("Failed to restore files:", err);
      alert("❌ Failed to restore files. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedFiles.size === 0) return;

    setIsProcessing(true);
    try {
      const response = await fetch("/api/trash", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileIds: Array.from(selectedFiles) }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete files");
      }

      const data = await response.json();

      // Remove deleted files from the list
      setFiles(files.filter((f) => !selectedFiles.has(f.id)));
      setSelectedFiles(new Set());
      setShowDeleteModal(false);

      alert(`✅ ${data.deletedCount} file(s) permanently deleted!`);
      fetchTrashStats();
    } catch (err) {
      console.error("Failed to delete files:", err);
      alert("❌ Failed to delete files. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEmptyTrash = async () => {
    setIsProcessing(true);
    try {
      const response = await fetch("/api/trash/empty", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to empty trash");
      }

      const data = await response.json();

      // Clear all files
      setFiles([]);
      setSelectedFiles(new Set());
      setShowEmptyModal(false);

      alert(`✅ ${data.message}`);
      fetchTrashStats();
    } catch (err) {
      console.error("Failed to empty trash:", err);
      alert("❌ Failed to empty trash. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestoreSingle = async (fileId: string) => {
    try {
      const response = await fetch("/api/trash", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileIds: [fileId] }),
      });

      if (!response.ok) {
        throw new Error("Failed to restore file");
      }

      // Remove from list
      setFiles(files.filter((f) => f.id !== fileId));
      alert("✅ File restored successfully!");
      fetchTrashStats();
    } catch (err) {
      console.error("Failed to restore file:", err);
      alert("❌ Failed to restore file. Please try again.");
    }
  };

  const handleDeleteSingle = async (fileId: string) => {
    if (
      !confirm(
        "Are you sure you want to permanently delete this file? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      const response = await fetch("/api/trash", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileIds: [fileId] }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete file");
      }

      // Remove from list
      setFiles(files.filter((f) => f.id !== fileId));
      alert("✅ File permanently deleted!");
      fetchTrashStats();
    } catch (err) {
      console.error("Failed to delete file:", err);
      alert("❌ Failed to delete file. Please try again.");
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

  const calculateDaysInTrash = (deletedAt: string) => {
    const days = Math.floor(
      (Date.now() - new Date(deletedAt).getTime()) / (1000 * 60 * 60 * 24)
    );
    return days;
  };

  // Filter files based on search
  const filteredFiles = files.filter((file) => {
    const matchesSearch =
      file.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      file.content.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-[#1a1d29] to-gray-900 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center">
                <svg
                  className="w-7 h-7 text-red-400"
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
              </div>
              <h1 className="text-3xl font-bold text-white">Trash</h1>
            </div>
            <p className="text-gray-400">
              {trashStats && !trashStats.isEmpty
                ? `${trashStats.totalTrashed} file(s) • ${trashStats.approximateSize}`
                : "Trash is empty"}
            </p>
          </div>

          <div className="flex items-center gap-3">
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

            {trashStats && trashStats.canEmpty && (
              <button
                onClick={() => setShowEmptyModal(true)}
                className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-lg font-medium transition-colors"
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
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
                Empty Trash
              </button>
            )}
          </div>
        </div>

        {/* Search and Bulk Actions */}
        <div className="bg-[#1a1d29] border border-gray-800 rounded-xl p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
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
                placeholder="Search trashed files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-800/50 border border-gray-700 text-white rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
              />
            </div>

            {/* Bulk Actions */}
            {selectedFiles.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400 whitespace-nowrap">
                  {selectedFiles.size} selected
                </span>
                <button
                  onClick={() => setShowRestoreModal(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium transition-colors"
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
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Restore
                </button>
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors"
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
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Files Table */}
        <div className="bg-[#1a1d29] border border-gray-800 rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500"></div>
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
          ) : filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                <svg
                  className="w-10 h-10 text-red-400"
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
              </div>
              <p className="text-gray-400 text-lg mb-2 font-medium">
                Trash is empty
              </p>
              <p className="text-gray-500 text-sm mb-6">
                {searchQuery
                  ? "No files match your search"
                  : "Deleted files will appear here"}
              </p>
              {!searchQuery && (
                <Link
                  href="/files"
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
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  Browse Files
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-800/50 border-b border-gray-800">
                  <tr>
                    <th className="px-6 py-4 text-left">
                      <input
                        type="checkbox"
                        checked={
                          filteredFiles.length > 0 &&
                          selectedFiles.size === filteredFiles.length
                        }
                        onChange={handleSelectAll}
                        className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-red-600 focus:ring-red-500 focus:ring-2 cursor-pointer"
                      />
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      ID
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Title
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider hidden lg:table-cell">
                      Content Preview
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-medium text-gray-400 uppercase tracking-wider hidden xl:table-cell">
                      Favorite
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider hidden xl:table-cell">
                      Deleted
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider hidden 2xl:table-cell">
                      Days in Trash
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {filteredFiles.map((file) => (
                    <tr
                      key={file.id}
                      className={`hover:bg-gray-800/30 transition-colors ${
                        selectedFiles.has(file.id) ? "bg-gray-800/20" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input
                          type="checkbox"
                          checked={selectedFiles.has(file.id)}
                          onChange={() => handleSelectFile(file.id)}
                          className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-red-600 focus:ring-red-500 focus:ring-2 cursor-pointer"
                        />
                      </td>

                      {/* ID */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className="font-mono">
                          #{file.id.slice(0, 8)}
                        </span>
                      </td>

                      {/* Title */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <svg
                            className="w-5 h-5 text-red-400 flex-shrink-0"
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
                          <span className="text-white font-medium">
                            {file.title}
                          </span>
                        </div>
                      </td>

                      {/* Content Preview */}
                      <td className="px-6 py-4 text-sm text-gray-400 hidden lg:table-cell max-w-xs">
                        {truncateText(file.content, 60)}
                      </td>

                      {/* Favorite */}
                      <td className="px-6 py-4 whitespace-nowrap text-center hidden xl:table-cell">
                        {file.isFavorite ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
                            ⭐ Yes
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-500/10 text-gray-400 border border-gray-500/20">
                            No
                          </span>
                        )}
                      </td>

                      {/* Deleted Date */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 hidden xl:table-cell">
                        {formatDate(file.deletedAt)}
                      </td>

                      {/* Days in Trash */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 hidden 2xl:table-cell">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                            calculateDaysInTrash(file.deletedAt) > 30
                              ? "bg-red-500/10 text-red-400 border border-red-500/20"
                              : calculateDaysInTrash(file.deletedAt) > 7
                              ? "bg-orange-500/10 text-orange-400 border border-orange-500/20"
                              : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                          }`}
                        >
                          {calculateDaysInTrash(file.deletedAt)} days
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          {/* Restore Button */}
                          <button
                            onClick={() => handleRestoreSingle(file.id)}
                            className="p-2 text-green-400 hover:text-green-300 hover:bg-green-500/10 rounded-lg transition-colors"
                            title="Restore file"
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
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                              />
                            </svg>
                          </button>

                          {/* Delete Permanently Button */}
                          <button
                            onClick={() => handleDeleteSingle(file.id)}
                            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Delete permanently"
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
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
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
        {!isLoading && !error && filteredFiles.length > 0 && (
          <div className="mt-4 text-center text-sm text-gray-400">
            Showing {filteredFiles.length} trashed file(s)
          </div>
        )}

        {/* Warning Card */}
        <div className="mt-6 bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <h3 className="text-sm font-medium text-red-400 mb-1">
                Important Notice
              </h3>
              <ul className="text-xs text-gray-400 space-y-1">
                <li>• Files in trash can be restored at any time</li>
                <li>• Permanently deleted files cannot be recovered</li>
                <li>• Empty trash will delete all files permanently</li>
                <li>• Files older than 30 days are highlighted for cleanup</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Empty Trash Confirmation Modal */}
      {showEmptyModal && trashStats && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1d29] border border-gray-800 rounded-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-red-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Empty Trash?
                </h3>
                <p className="text-sm text-gray-400">
                  This action cannot be undone
                </p>
              </div>
            </div>

            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-300 mb-3">
                Are you sure you want to permanently delete{" "}
                <span className="font-semibold text-white">
                  {trashStats.deletableFiles} file(s)
                </span>
                ?
              </p>
              <div className="text-xs text-gray-400 space-y-1">
                <p>• Total size: {trashStats.approximateSize}</p>
                <p>• All files will be permanently deleted</p>
                <p>• This action cannot be undone</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowEmptyModal(false)}
                disabled={isProcessing}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleEmptyTrash}
                disabled={isProcessing}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-500 text-white transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Emptying...
                  </>
                ) : (
                  "Empty Trash"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Selected Modal */}
      {showRestoreModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1d29] border border-gray-800 rounded-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-green-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Restore Files?
                </h3>
                <p className="text-sm text-gray-400">
                  Move files back to your library
                </p>
              </div>
            </div>

            <p className="text-gray-300 mb-6">
              Are you sure you want to restore{" "}
              <span className="font-semibold">
                {selectedFiles.size} file(s)
              </span>
              ? They will be moved back to your files.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowRestoreModal(false)}
                disabled={isProcessing}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRestoreSelected}
                disabled={isProcessing}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-green-600 hover:bg-green-500 text-white transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Restoring...
                  </>
                ) : (
                  "Restore Files"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Selected Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1d29] border border-gray-800 rounded-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-red-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">
                  Delete Permanently?
                </h3>
                <p className="text-sm text-gray-400">
                  This action cannot be undone
                </p>
              </div>
            </div>

            <p className="text-gray-300 mb-6">
              Are you sure you want to permanently delete{" "}
              <span className="font-semibold">
                {selectedFiles.size} file(s)
              </span>
              ? This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isProcessing}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteSelected}
                disabled={isProcessing}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-500 text-white transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Deleting...
                  </>
                ) : (
                  "Delete Permanently"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
