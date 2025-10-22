"use client";

import { useEffect, useState } from "react";
import AllNavbar from "@/components/AllNavbar";

interface User {
  id: string;
  username: string;
  name: string | null;
  email: string | null;
}

interface SharedFile {
  shareId: string;
  permission: "VIEW" | "EDIT";
  sharedAt: string;
  file: {
    id: string;
    title: string;
    content: string;
    createdAt: string;
    updatedAt: string;
    owner: User;
  };
  owner: User;
  sharedWith: User;
}

export default function AllSharedPage() {
  const [shared, setShared] = useState<SharedFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchAllShared();
  }, []);

  const fetchAllShared = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/all/all-shared");
      if (!response.ok) {
        throw new Error("Failed to fetch shared files");
      }
      const data = await response.json();
      setShared(data.shared || []);
      setError("");
    } catch (err) {
      setError("Failed to load shared files");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter shared files based on search
  const filteredShared = shared.filter((share) => {
    const fileTitle = share.file.title || "";
    const fileContent = share.file.content || "";
    const ownerName = share.owner.name || "";
    const ownerUsername = share.owner.username || "";
    const sharedWithName = share.sharedWith.name || "";
    const sharedWithUsername = share.sharedWith.username || "";
    return (
      fileTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fileContent.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ownerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ownerUsername.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sharedWithName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sharedWithUsername.toLowerCase().includes(searchQuery.toLowerCase())
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
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
                  <svg
                    className="w-7 h-7 text-purple-400"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316" />
                  </svg>
                </div>
                <h1 className="text-3xl font-bold text-white">
                  All Shared Files
                </h1>
              </div>
              <p className="text-gray-400">All shared files (full table)</p>
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
                placeholder="Search shared files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-800/50 border border-gray-700 text-white rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div className="bg-[#1a1d29] border border-gray-800 rounded-xl overflow-x-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-red-400 flex items-center gap-2">
                  {error}
                </div>
              </div>
            ) : filteredShared.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-20 h-20 rounded-full bg-purple-500/10 flex items-center justify-center mb-4">
                  <svg
                    className="w-10 h-10 text-purple-400"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316" />
                  </svg>
                </div>
                <p className="text-gray-400 text-lg mb-2 font-medium">
                  No shared files found
                </p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-800/50 text-gray-300 text-left">
                    <th className="px-4 py-3">Share ID</th>
                    <th className="px-4 py-3">File Title</th>
                    <th className="px-4 py-3">File Content</th>
                    <th className="px-4 py-3">Owner Name</th>
                    <th className="px-4 py-3">Owner Username</th>
                    <th className="px-4 py-3">Shared With Name</th>
                    <th className="px-4 py-3">Shared With Username</th>
                    <th className="px-4 py-3">Permission</th>
                    <th className="px-4 py-3">Shared At</th>
                    <th className="px-4 py-3">File Created At</th>
                    <th className="px-4 py-3">File Updated At</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredShared.map((share) => (
                    <tr
                      key={share.shareId}
                      className="border-t border-gray-800"
                    >
                      <td className="px-4 py-3 text-gray-400">
                        {share.shareId}
                      </td>
                      <td className="px-4 py-3">{share.file.title}</td>
                      <td className="px-4 py-3 max-w-xs truncate">
                        {share.file.content}
                      </td>
                      <td className="px-4 py-3">{share.owner.name ?? "—"}</td>
                      <td className="px-4 py-3">{share.owner.username}</td>
                      <td className="px-4 py-3">
                        {share.sharedWith.name ?? "—"}
                      </td>
                      <td className="px-4 py-3">{share.sharedWith.username}</td>
                      <td className="px-4 py-3">{share.permission}</td>
                      <td className="px-4 py-3">
                        {new Date(share.sharedAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        {new Date(share.file.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        {new Date(share.file.updatedAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {!isLoading && !error && filteredShared.length > 0 && (
            <div className="mt-4 text-center text-sm text-gray-400">
              Showing {filteredShared.length} shared file
              {filteredShared.length !== 1 ? "s" : ""}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
