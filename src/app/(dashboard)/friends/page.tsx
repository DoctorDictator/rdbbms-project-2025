"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";

interface Friend {
  id: string;
  username: string;
  name: string;
  email: string;
  status: string;
  friendshipId: string;
  createdAt: string;
  updatedAt: string;
}

interface FriendRequest {
  id: string;
  userId: string;
  friendId: string;
  status: string;
  user: {
    id: string;
    username: string;
    name: string;
    email: string;
  };
  createdAt: string;
}

type ViewType = "friends" | "received" | "sent" | "add";

export default function FriendsPage() {
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [receivedRequests, setReceivedRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [addQuery, setAddQuery] = useState("");
  const [addStatus, setAddStatus] = useState("");
  const [actionStatus, setActionStatus] = useState("");
  const [view, setView] = useState<ViewType>("friends");

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setIsLoading(true);
    try {
      const friendsRes = await fetch("/api/friendships?status=ACCEPTED");
      const friendsData = friendsRes.ok
        ? await friendsRes.json()
        : { friends: [] };
      setFriends(friendsData.friends || []);

      const receivedRes = await fetch("/api/friendships/pending");
      const receivedData = receivedRes.ok
        ? await receivedRes.json()
        : { requests: [] };
      setReceivedRequests(receivedData.requests || []);

      const sentRes = await fetch("/api/friendships?sent=true&status=PENDING");
      const sentData = sentRes.ok ? await sentRes.json() : { friends: [] };
      setSentRequests(sentData.friends || []);
      setError("");
    } catch (err) {
      setError("Failed to load friends or requests");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter friends based on search
  const filteredFriends = friends.filter((friend) =>
    (friend.name || friend.username || friend.email || "")
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  // Add friend request handler
  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddStatus("");
    if (!addQuery.trim()) return;
    try {
      const res = await fetch("/api/friendships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: addQuery }),
      });
      const data = await res.json();
      if (res.ok) {
        setAddStatus("Friend request sent!");
        setAddQuery("");
        fetchAll();
      } else {
        setAddStatus(data.error || "Failed to send request");
      }
    } catch {
      setAddStatus("Failed to send request");
    }
  };

  // Accept friend request
  const handleAccept = async (id: string) => {
    setActionStatus("");
    try {
      const res = await fetch(`/api/friendships/${id}/accept`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setActionStatus("Friend request accepted!");
        fetchAll();
      } else {
        setActionStatus(data.error || "Failed to accept request");
      }
    } catch {
      setActionStatus("Failed to accept request");
    }
  };

  // Reject friend request
  const handleReject = async (id: string) => {
    setActionStatus("");
    try {
      const res = await fetch(`/api/friendships/${id}/reject`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setActionStatus("Friend request rejected!");
        fetchAll();
      } else {
        setActionStatus(data.error || "Failed to reject request");
      }
    } catch {
      setActionStatus("Failed to reject request");
    }
  };

  // Block friend
  const handleBlock = async (id: string) => {
    setActionStatus("");
    try {
      const res = await fetch(`/api/friendships/${id}/block`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        setActionStatus("Friend blocked!");
        fetchAll();
      } else {
        setActionStatus(data.error || "Failed to block friend");
      }
    } catch {
      setActionStatus("Failed to block friend");
    }
  };

  // Remove friend
  const handleRemove = async (id: string) => {
    setActionStatus("");
    if (!confirm("Are you sure you want to remove this friend?")) return;
    try {
      const res = await fetch(`/api/friendships/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        setActionStatus("Friend removed!");
        fetchAll();
      } else {
        setActionStatus(data.error || "Failed to remove friend");
      }
    } catch {
      setActionStatus("Failed to remove friend");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-[#1a1d29] to-gray-900 py-8 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Navigation Tabs */}
        <div className="flex gap-2 mb-8">
          <button
            className={`px-4 py-2 rounded-lg font-semibold ${
              view === "friends"
                ? "bg-green-500 text-white"
                : "bg-gray-800 text-gray-300"
            }`}
            onClick={() => setView("friends")}
          >
            Friends
          </button>
          <button
            className={`px-4 py-2 rounded-lg font-semibold ${
              view === "received"
                ? "bg-blue-500 text-white"
                : "bg-gray-800 text-gray-300"
            }`}
            onClick={() => setView("received")}
          >
            Requests Received
          </button>
          <button
            className={`px-4 py-2 rounded-lg font-semibold ${
              view === "sent"
                ? "bg-yellow-500 text-white"
                : "bg-gray-800 text-gray-300"
            }`}
            onClick={() => setView("sent")}
          >
            Requests Sent
          </button>
          <button
            className={`px-4 py-2 rounded-lg font-semibold ${
              view === "add"
                ? "bg-purple-500 text-white"
                : "bg-gray-800 text-gray-300"
            }`}
            onClick={() => setView("add")}
          >
            Add Friend
          </button>
        </div>

        {/* Friends Table */}
        {view === "friends" && (
          <div>
            <h2 className="text-xl font-semibold text-white mb-3">
              Your Friends
            </h2>
            <div className="bg-[#1a1d29] border border-gray-800 rounded-xl overflow-x-auto">
              <div className="p-4">
                <input
                  type="text"
                  placeholder="Search friends..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-gray-800/50 border border-gray-700 text-white rounded-lg px-4 py-2.5 mb-4 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                />
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
                  </div>
                ) : error ? (
                  <div className="text-red-400">{error}</div>
                ) : filteredFriends.length === 0 ? (
                  <div className="text-gray-400 py-8 text-center">
                    No friends found.
                  </div>
                ) : (
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-800/50 text-gray-300 text-left">
                        <th className="px-4 py-2 font-semibold">Name</th>
                        <th className="px-4 py-2 font-semibold">Username</th>
                        <th className="px-4 py-2 font-semibold">Email</th>
                        <th className="px-4 py-2 font-semibold">Status</th>
                        <th className="px-4 py-2 font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredFriends.map((friend) => (
                        <tr
                          key={friend.friendshipId}
                          className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors"
                        >
                          <td className="px-4 py-2">{friend.name || "-"}</td>
                          <td className="px-4 py-2">{friend.username}</td>
                          <td className="px-4 py-2">{friend.email}</td>
                          <td className="px-4 py-2">
                            <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs font-semibold">
                              {friend.status}
                            </span>
                          </td>
                          <td className="px-4 py-2 flex gap-2">
                            <button
                              onClick={() => handleBlock(friend.friendshipId)}
                              className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-xs font-semibold hover:bg-red-500/30 transition"
                              title="Block"
                            >
                              Block
                            </button>
                            <button
                              onClick={() => handleRemove(friend.friendshipId)}
                              className="bg-gray-500/20 text-gray-400 px-3 py-1 rounded-full text-xs font-semibold hover:bg-gray-500/30 transition"
                              title="Remove"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
            {actionStatus && (
              <div className="mt-2 text-sm text-green-400">{actionStatus}</div>
            )}
          </div>
        )}

        {/* Received Friend Requests */}
        {view === "received" && (
          <div>
            <h2 className="text-xl font-semibold text-white mb-3">
              Friend Requests Received
            </h2>
            <div className="bg-[#1a1d29] border border-gray-800 rounded-xl overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-800/50 text-gray-300 text-left">
                    <th className="px-4 py-2 font-semibold">Name</th>
                    <th className="px-4 py-2 font-semibold">Username</th>
                    <th className="px-4 py-2 font-semibold">Email</th>
                    <th className="px-4 py-2 font-semibold">Requested At</th>
                    <th className="px-4 py-2 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {receivedRequests.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="text-gray-400 py-8 text-center"
                      >
                        No friend requests received.
                      </td>
                    </tr>
                  ) : (
                    receivedRequests.map((req) => (
                      <tr
                        key={req.id}
                        className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors"
                      >
                        <td className="px-4 py-2">{req.user.name || "-"}</td>
                        <td className="px-4 py-2">{req.user.username}</td>
                        <td className="px-4 py-2">{req.user.email}</td>
                        <td className="px-4 py-2">
                          {new Date(req.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-2 flex gap-2">
                          <button
                            onClick={() => handleAccept(req.id)}
                            className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs font-semibold hover:bg-green-500/30 transition"
                          >
                            Accept
                          </button>
                          <button
                            onClick={() => handleReject(req.id)}
                            className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-xs font-semibold hover:bg-red-500/30 transition"
                          >
                            Reject
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {actionStatus && (
                <div className="mt-2 text-sm text-green-400">
                  {actionStatus}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sent Friend Requests */}
        {view === "sent" && (
          <div>
            <h2 className="text-xl font-semibold text-white mb-3">
              Friend Requests Sent
            </h2>
            <div className="bg-[#1a1d29] border border-gray-800 rounded-xl overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-800/50 text-gray-300 text-left">
                    <th className="px-4 py-2 font-semibold">To</th>
                    <th className="px-4 py-2 font-semibold">Username</th>
                    <th className="px-4 py-2 font-semibold">Email</th>
                    <th className="px-4 py-2 font-semibold">Requested At</th>
                    <th className="px-4 py-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sentRequests.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="text-gray-400 py-8 text-center"
                      >
                        No friend requests sent.
                      </td>
                    </tr>
                  ) : (
                    sentRequests.map((req) => (
                      <tr
                        key={req.friendId || req.id}
                        className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors"
                      >
                        <td className="px-4 py-2">{req.user?.name || "-"}</td>
                        <td className="px-4 py-2">{req.user?.username}</td>
                        <td className="px-4 py-2">{req.user?.email}</td>
                        <td className="px-4 py-2">
                          {new Date(req.createdAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-2">
                          <span className="bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-full text-xs font-semibold">
                            {req.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Add Friend */}
        {view === "add" && (
          <div>
            <h2 className="text-xl font-semibold text-white mb-3">
              Add a Friend
            </h2>
            <div className="bg-[#1a1d29] border border-gray-800 rounded-xl p-4 mb-6">
              <form
                onSubmit={handleAddFriend}
                className="flex flex-col sm:flex-row gap-3 items-center"
              >
                <input
                  type="text"
                  placeholder="Find friends by username or email..."
                  value={addQuery}
                  onChange={(e) => setAddQuery(e.target.value)}
                  className="w-full sm:w-80 bg-gray-800/50 border border-gray-700 text-white rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                />
                <button
                  type="submit"
                  className="bg-green-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-600 transition"
                >
                  Send Friend Request
                </button>
              </form>
              {addStatus && (
                <div className="mt-2 text-sm text-green-400">{addStatus}</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
