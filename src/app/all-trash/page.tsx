"use client";

import { useEffect, useState } from "react";
import AllNavbar from "@/components/AllNavbar";

interface TrashFile {
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

export default function AllTrashPage() {
  const [files, setFiles] = useState<TrashFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchAllTrash();
  }, []);

  const fetchAllTrash = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/all/all-trash");
      if (!response.ok) {
        throw new Error("Failed to fetch trashed files");
      }
      const data = await response.json();
      setFiles(data.files || []);
      setError("");
    } catch (err) {
      setError("Failed to load trashed files");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter files based on search
  const filteredFiles = files.filter((file) => {
    const ownerName = file.owner?.name || "";
    const ownerUsername = file.owner?.username || "";
    const ownerEmail = file.owner?.email || "";
    return (
      file.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      file.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ownerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ownerUsername.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ownerEmail.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <>
      <AllNavbar />
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-[#1a1d29] to-gray-900 py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center">
                  <svg
                    className="w-7 h-7 text-red-400"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6" />
                  </svg>
                </div>
                <h1 className="text-3xl font-bold text-white">All Trash</h1>
              </div>
              <p className="text-gray-400">All trashed files (full table)</p>
            </div>
          </div>

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
                placeholder="Search trashed files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-800/50 border border-gray-700 text-white rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div className="bg-[#1a1d29] border border-gray-800 rounded-xl overflow-x-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500"></div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-red-400 flex items-center gap-2">
                  {error}
                </div>
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                  <svg
                    className="w-10 h-10 text-red-400"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6" />
                  </svg>
                </div>
                <p className="text-gray-400 text-lg mb-2 font-medium">
                  No trashed files found
                </p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-800/50 text-gray-300 text-left">
                    <th className="px-4 py-3">Trash ID</th>
                    <th className="px-4 py-3">File Title</th>
                    <th className="px-4 py-3">File Content</th>
                    <th className="px-4 py-3">Owner Name</th>
                    <th className="px-4 py-3">Owner Username</th>
                    <th className="px-4 py-3">Owner Email</th>
                    <th className="px-4 py-3">Deleted At</th>
                    <th className="px-4 py-3">Created At</th>
                    <th className="px-4 py-3">Updated At</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFiles.map((file) => (
                    <tr key={file.trashId} className="border-t border-gray-800">
                      <td className="px-4 py-3 text-gray-400">
                        {file.trashId}
                      </td>
                      <td className="px-4 py-3">{file.title}</td>
                      <td className="px-4 py-3 max-w-xs truncate">
                        {file.content}
                      </td>
                      <td className="px-4 py-3">{file.owner?.name ?? "—"}</td>
                      <td className="px-4 py-3">
                        {file.owner?.username ?? "—"}
                      </td>
                      <td className="px-4 py-3">{file.owner?.email ?? "—"}</td>
                      <td className="px-4 py-3">
                        {new Date(file.deletedAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        {new Date(file.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        {new Date(file.updatedAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {!isLoading && !error && filteredFiles.length > 0 && (
            <div className="mt-4 text-center text-sm text-gray-400">
              Showing {filteredFiles.length} trashed file
              {filteredFiles.length !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
