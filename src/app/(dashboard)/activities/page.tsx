"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

interface Activity {
  id: string;
  userId: string;
  fileId?: string | null;
  action: string;
  createdAt: string;
  file?: {
    id: string;
    title: string;
  } | null;
}

const ACTION_LABELS: Record<string, string> = {
  FILE_CREATED: "File Created",
  FILE_UPDATED: "File Updated",
  FILE_DELETED: "File Deleted",
  FILE_SHARED: "File Shared",
  FILE_UNSHARED: "File Unshared",
  FRIEND_REQUEST_SENT: "Friend Request Sent",
  FRIEND_REQUEST_ACCEPTED: "Friend Request Accepted",
  FRIEND_REQUEST_REJECTED: "Friend Request Rejected",
  FILE_FAVOURITED: "File Favourited",
  FILE_UNFAVOURITED: "File Unfavourited",
  FILE_TRASHED: "File Trashed",
  FILE_RESTORED: "File Restored",
  FRIENDSHIP_BLOCKED: "Friendship Blocked",
};

export default function ActivitiesPage() {
  const { user } = useAuth();
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
      const response = await fetch("/api/activities");
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

  // Filter activities based on search
  const filteredActivities = activities.filter((activity) => {
    const actionLabel = ACTION_LABELS[activity.action] || activity.action;
    const fileTitle = activity.file?.title || "";
    return (
      actionLabel.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fileTitle.toLowerCase().includes(searchQuery.toLowerCase())
    );
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
                  <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-white">Activities</h1>
            </div>
            <p className="text-gray-400">Your recent actions and events</p>
          </div>
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
              placeholder="Search activities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-800/50 border border-gray-700 text-white rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
        </div>

        {/* Activities Table */}
        <div className="bg-[#1a1d29] border border-gray-800 rounded-xl overflow-x-auto">
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
                No activities yet
              </p>
              <p className="text-gray-500 text-sm mb-6">
                {searchQuery
                  ? "No activities match your search"
                  : "Your actions and events will appear here"}
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-800/50 text-gray-300 text-left">
                  <th className="px-6 py-4 font-semibold">Action</th>
                  <th className="px-6 py-4 font-semibold">File</th>
                  <th className="px-6 py-4 font-semibold">Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredActivities.map((activity) => (
                  <tr
                    key={activity.id}
                    className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors"
                  >
                    <td className="px-6 py-4">
                      {ACTION_LABELS[activity.action] || activity.action}
                    </td>
                    <td className="px-6 py-4">
                      {activity.file ? (
                        <Link
                          href={`/files/${activity.file.id}`}
                          className="text-blue-400 hover:underline"
                        >
                          {activity.file.title}
                        </Link>
                      ) : (
                        <span className="text-gray-500 italic">N/A</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {formatDate(activity.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Results Count */}
        {!isLoading && !error && filteredActivities.length > 0 && (
          <div className="mt-4 text-center text-sm text-gray-400">
            Showing {filteredActivities.length} activity
            {filteredActivities.length !== 1 ? "ies" : "y"}
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
                About Activities
              </h3>
              <ul className="text-xs text-gray-400 space-y-1">
                <li>
                  <b>Actions</b> include file edits, sharing, trashing, and
                  friend requests.
                </li>
                <li>
                  <b>Files</b> link to the file involved in the activity (if
                  applicable).
                </li>
                <li>
                  <b>Date</b> shows when the activity occurred.
                </li>
                <li>
                  Use the search box to filter activities by action or file
                  title.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
