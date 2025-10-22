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
  userId: string;
}

export default function FilesPage() {
  const { user } = useAuth();
  const [files, setFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<File | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);

  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/files");

      if (!response.ok) {
        throw new Error("Failed to fetch files");
      }

      const data = await response.json();
      setFiles(data.files);
      setError("");
    } catch (err) {
      setError("Failed to load files");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewFile = (file: File) => {
    setSelectedFile(file);
    setShowViewModal(true);
  };

  const handleDeleteClick = (file: File) => {
    setFileToDelete(file);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!fileToDelete) return;

    try {
      const response = await fetch(`/api/files/${fileToDelete.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete file");
      }

      setFiles(files.filter((f) => f.id !== fileToDelete.id));
      setShowDeleteModal(false);
      setFileToDelete(null);
      alert("✅ File deleted successfully!");
    } catch (err) {
      console.error("Failed to delete file:", err);
      alert("❌ Failed to delete file. Please try again.");
    }
  };

  const handleToggleFavorite = async (fileId: string) => {
    try {
      const response = await fetch(`/api/files/${fileId}/favorite`, {
        method: "PATCH",
      });

      if (!response.ok) {
        throw new Error("Failed to toggle favorite");
      }

      const data = await response.json();

      setFiles(
        files.map((f) =>
          f.id === fileId ? { ...f, isFavorite: data.isFavorite } : f
        )
      );
    } catch (err) {
      console.error("Failed to toggle favorite:", err);
      alert("❌ Failed to update favorite status. Please try again.");
    }
  };

  const handleToggleTrash = async (fileId: string) => {
    try {
      const response = await fetch(`/api/files/${fileId}/trash`, {
        method: "PATCH",
      });

      if (!response.ok) {
        throw new Error("Failed to toggle trash");
      }

      const data = await response.json();

      setFiles(
        files.map((f) =>
          f.id === fileId ? { ...f, isTrashed: data.isTrashed } : f
        )
      );

      if (data.isTrashed) {
        alert("✅ File moved to trash!");
      } else {
        alert("✅ File restored from trash!");
      }
    } catch (err) {
      console.error("Failed to toggle trash:", err);
      alert("❌ Failed to update trash status. Please try again.");
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
    setShowBulkActions(newSelected.size > 0);
  };

  const handleSelectAll = () => {
    if (selectedFiles.size === filteredFiles.length) {
      setSelectedFiles(new Set());
      setShowBulkActions(false);
    } else {
      setSelectedFiles(new Set(filteredFiles.map((f) => f.id)));
      setShowBulkActions(true);
    }
  };

  const handleBulkDelete = async () => {
    if (
      !confirm(
        `Are you sure you want to delete ${selectedFiles.size} file(s)? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      const deletePromises = Array.from(selectedFiles).map((fileId) =>
        fetch(`/api/files/${fileId}`, { method: "DELETE" })
      );

      await Promise.all(deletePromises);

      setFiles(files.filter((f) => !selectedFiles.has(f.id)));
      setSelectedFiles(new Set());
      setShowBulkActions(false);
      alert(`✅ ${deletePromises.length} file(s) deleted successfully!`);
    } catch (err) {
      console.error("Failed to bulk delete:", err);
      alert("❌ Failed to delete files. Please try again.");
    }
  };

  const handleBulkTrash = async () => {
    try {
      const trashPromises = Array.from(selectedFiles).map((fileId) =>
        fetch(`/api/files/${fileId}/trash`, { method: "PATCH" })
      );

      await Promise.all(trashPromises);

      // Update files state
      setFiles(
        files.map((f) =>
          selectedFiles.has(f.id) ? { ...f, isTrashed: true } : f
        )
      );

      setSelectedFiles(new Set());
      setShowBulkActions(false);
      alert(`✅ ${trashPromises.length} file(s) moved to trash!`);
    } catch (err) {
      console.error("Failed to bulk trash:", err);
      alert("❌ Failed to move files to trash. Please try again.");
    }
  };

  const handleBulkFavorite = async () => {
    try {
      const favoritePromises = Array.from(selectedFiles).map((fileId) =>
        fetch(`/api/files/${fileId}/favorite`, { method: "PATCH" })
      );

      const responses = await Promise.all(favoritePromises);
      const data = await Promise.all(responses.map((r) => r.json()));

      // Update files state
      setFiles(
        files.map((f) => {
          const index = Array.from(selectedFiles).indexOf(f.id);
          if (index !== -1) {
            return { ...f, isFavorite: data[index].isFavorite };
          }
          return f;
        })
      );

      setSelectedFiles(new Set());
      setShowBulkActions(false);
      alert(`✅ ${favoritePromises.length} file(s) favorite status updated!`);
    } catch (err) {
      console.error("Failed to bulk favorite:", err);
      alert("❌ Failed to update favorite status. Please try again.");
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

  // Filter files based on search only
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
            <h1 className="text-3xl font-bold text-white mb-2">My Files</h1>
            <p className="text-gray-400">Manage and organize your documents</p>
          </div>

          <Link
            href="/files/new"
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
            Create New File
          </Link>
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
                placeholder="Search files by title or content..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-800/50 border border-gray-700 text-white rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            {/* Bulk Actions */}
            {showBulkActions && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-400 whitespace-nowrap">
                  {selectedFiles.size} selected
                </span>
                <button
                  onClick={handleBulkFavorite}
                  className="flex items-center gap-2 px-4 py-2.5 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg text-sm font-medium transition-colors"
                  title="Toggle favorite"
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
                      d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                    />
                  </svg>
                  <span className="hidden sm:inline">Favorite</span>
                </button>
                <button
                  onClick={handleBulkTrash}
                  className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-sm font-medium transition-colors"
                  title="Move to trash"
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
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                  <span className="hidden sm:inline">Trash</span>
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors"
                  title="Delete permanently"
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
                  <span className="hidden sm:inline">Delete</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Files Table */}
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
          ) : filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <svg
                className="w-16 h-16 text-gray-600 mb-4"
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
              <p className="text-gray-400 text-lg mb-2">No files found</p>
              <p className="text-gray-500 text-sm">
                {searchQuery
                  ? "Try adjusting your search"
                  : "Create your first file to get started"}
              </p>
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
                        className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-blue-600 focus:ring-blue-500 focus:ring-2 cursor-pointer"
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
                    <th className="px-6 py-4 text-center text-xs font-medium text-gray-400 uppercase tracking-wider hidden xl:table-cell">
                      Trashed
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider hidden 2xl:table-cell">
                      Updated
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
                          className="w-4 h-4 rounded border-gray-700 bg-gray-800 text-blue-600 focus:ring-blue-500 focus:ring-2 cursor-pointer"
                        />
                      </td>

                      {/* ID */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <Link
                          href={`/files/${file.id}`}
                          className="hover:text-blue-400 transition-colors font-mono"
                        >
                          #{file.id.slice(0, 8)}
                        </Link>
                      </td>

                      {/* Title */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          href={`/files/${file.id}`}
                          className="flex items-center gap-2 hover:text-blue-400 transition-colors"
                        >
                          <svg
                            className="w-5 h-5 text-blue-500 flex-shrink-0"
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
                          <span className="text-white font-medium">
                            {file.title}
                          </span>
                        </Link>
                      </td>

                      {/* Content Preview */}
                      <td className="px-6 py-4 text-sm text-gray-400 hidden lg:table-cell max-w-xs">
                        <button
                          onClick={() => handleViewFile(file)}
                          className="hover:text-gray-300 transition-colors text-left"
                        >
                          {truncateText(file.content, 60)}
                        </button>
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

                      {/* Trashed */}
                      <td className="px-6 py-4 whitespace-nowrap text-center hidden xl:table-cell">
                        {file.isTrashed ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                            🗑️ Yes
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                            No
                          </span>
                        )}
                      </td>

                      {/* Updated Date */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 hidden 2xl:table-cell">
                        {formatDate(file.updatedAt)}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          {/* View Button */}
                          <button
                            onClick={() => handleViewFile(file)}
                            className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors"
                            title="Quick view"
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
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                              />
                            </svg>
                          </button>

                          {/* Edit Button */}
                          <Link
                            href={`/files/${file.id}/edit`}
                            className="p-2 text-green-400 hover:text-green-300 hover:bg-green-500/10 rounded-lg transition-colors"
                            title="Edit"
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
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                          </Link>

                          {/* Favorite Button */}
                          <button
                            onClick={() => handleToggleFavorite(file.id)}
                            className={`p-2 rounded-lg transition-colors ${
                              file.isFavorite
                                ? "text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10"
                                : "text-gray-400 hover:text-yellow-300 hover:bg-yellow-500/10"
                            }`}
                            title={
                              file.isFavorite
                                ? "Remove from favorites"
                                : "Add to favorites"
                            }
                          >
                            <svg
                              className="w-5 h-5"
                              fill={file.isFavorite ? "currentColor" : "none"}
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                              />
                            </svg>
                          </button>

                          {/* Trash/Restore Button */}
                          <button
                            onClick={() => handleToggleTrash(file.id)}
                            className={`p-2 rounded-lg transition-colors ${
                              file.isTrashed
                                ? "text-green-400 hover:text-green-300 hover:bg-green-500/10"
                                : "text-orange-400 hover:text-orange-300 hover:bg-orange-500/10"
                            }`}
                            title={
                              file.isTrashed
                                ? "Restore from trash"
                                : "Move to trash"
                            }
                          >
                            {file.isTrashed ? (
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
                            ) : (
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
                            )}
                          </button>

                          {/* Delete Button */}
                          <button
                            onClick={() => handleDeleteClick(file)}
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
        {!isLoading && !error && (
          <div className="mt-4 text-center text-sm text-gray-400">
            Showing {filteredFiles.length} of {files.length} file(s)
          </div>
        )}
      </div>

      {/* View File Modal */}
      {showViewModal && selectedFile && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1d29] border border-gray-800 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-800">
              <div className="flex items-center gap-3">
                <svg
                  className="w-6 h-6 text-blue-500"
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
                <h2 className="text-xl font-bold text-white">
                  {selectedFile.title}
                </h2>
              </div>
              <button
                onClick={() => setShowViewModal(false)}
                className="text-gray-400 hover:text-white p-2 hover:bg-gray-800 rounded-lg transition-colors"
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

            <div className="flex-1 overflow-y-auto p-6">
              <div className="bg-gray-800/50 rounded-lg p-4 mb-4 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-400">ID:</span>
                  <span className="text-white font-mono">
                    #{selectedFile.id}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-400">Favorite:</span>
                  {selectedFile.isFavorite ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-green-500/10 text-green-400 border border-green-500/20">
                      Yes
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-500/10 text-gray-400 border border-gray-500/20">
                      No
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-400">Trashed:</span>
                  {selectedFile.isTrashed ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-red-500/10 text-red-400 border border-red-500/20">
                      Yes
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-500/10 text-gray-400 border border-gray-500/20">
                      No
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-400">Created:</span>
                  <span className="text-white">
                    {formatDate(selectedFile.createdAt)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-400">Updated:</span>
                  <span className="text-white">
                    {formatDate(selectedFile.updatedAt)}
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-400 mb-2">
                  Content:
                </h3>
                <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4 text-white whitespace-pre-wrap">
                  {selectedFile.content}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-800">
              <button
                onClick={() => setShowViewModal(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              >
                Close
              </button>
              <Link
                href={`/files/${selectedFile.id}`}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors"
              >
                View Full Details
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && fileToDelete && (
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
                  Delete File?
                </h3>
                <p className="text-sm text-gray-400">
                  This action cannot be undone
                </p>
              </div>
            </div>

            <p className="text-gray-300 mb-6">
              Are you sure you want to permanently delete &quot;
              <span className="font-semibold">{fileToDelete.title}</span>&quot;?
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setFileToDelete(null);
                }}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-500 text-white transition-colors"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
