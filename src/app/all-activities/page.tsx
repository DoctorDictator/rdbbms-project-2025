"use client";

import { useEffect, useState } from "react";
import AllNavbar from "@/components/AllNavbar";

interface Activity {
  id: string;
  userId: string;
  fileId?: string | null;
  action: string;
  createdAt: string;
  user?: {
    id: string;
    username: string;
    name: string | null;
    email: string | null;
  } | null;
  file?: {
    id: string;
    title: string;
    content?: string;
  } | null;
}

export default function AllActivitiesPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/all/all-activities");
      if (!response.ok) {
        throw new Error("Failed to fetch activities");
      }
      const data = await response.json();
      setActivities(data.activities || []);
      setError("");
    } catch (err) {
      setError("Failed to load activities");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter activities based on search
  const filteredActivities = activities.filter((activity) => {
    const fileTitle = activity.file?.title || "";
    const fileContent = activity.file?.content || "";
    const userName = activity.user?.name || "";
    const userUsername = activity.user?.username || "";
    return (
      activity.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fileTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fileContent.toLowerCase().includes(searchQuery.toLowerCase()) ||
      userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      userUsername.toLowerCase().includes(searchQuery.toLowerCase())
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
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <svg
                    className="w-7 h-7 text-blue-400"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h1 className="text-3xl font-bold text-white">
                  All Activities
                </h1>
              </div>
              <p className="text-gray-400">All activity logs (full table)</p>
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
                placeholder="Search activities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-gray-800/50 border border-gray-700 text-white rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div className="bg-[#1a1d29] border border-gray-800 rounded-xl overflow-x-auto">
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
            ) : filteredActivities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-20 h-20 rounded-full bg-blue-500/10 flex items-center justify-center mb-4">
                  <svg
                    className="w-10 h-10 text-blue-400"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <p className="text-gray-400 text-lg mb-2 font-medium">
                  No activities found
                </p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-800/50 text-gray-300 text-left">
                    <th className="px-4 py-3">ID</th>
                    <th className="px-4 py-3">User ID</th>
                    <th className="px-4 py-3">User Name</th>
                    <th className="px-4 py-3">User Username</th>
                    <th className="px-4 py-3">User Email</th>
                    <th className="px-4 py-3">File ID</th>
                    <th className="px-4 py-3">File Title</th>
                    <th className="px-4 py-3">File Content</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Created At</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredActivities.map((activity) => (
                    <tr key={activity.id} className="border-t border-gray-800">
                      <td className="px-4 py-3 text-gray-400">{activity.id}</td>
                      <td className="px-4 py-3">{activity.userId}</td>
                      <td className="px-4 py-3">
                        {activity.user?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        {activity.user?.username ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        {activity.user?.email ?? "—"}
                      </td>
                      <td className="px-4 py-3">{activity.fileId ?? "—"}</td>
                      <td className="px-4 py-3">
                        {activity.file?.title ?? "—"}
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate">
                        {activity.file?.content ?? "—"}
                      </td>
                      <td className="px-4 py-3">{activity.action}</td>
                      <td className="px-4 py-3">
                        {new Date(activity.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {!isLoading && !error && filteredActivities.length > 0 && (
            <div className="mt-4 text-center text-sm text-gray-400">
              Showing {filteredActivities.length} activity
              {filteredActivities.length !== 1 ? "ies" : "y"}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
