"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

/**
 * This page normalizes multiple possible API shapes returned by your friendship endpoints.
 * If the API item lacks username/name/email it will fetch /api/users/:id to fill missing fields.
 *
 * Ensure you have an API at /api/users/[id] that returns { id, username, name, email }.
 */

type ApiFriendRaw = Record<string, unknown>;

type FriendRow = {
  id: string;
  username: string | null;
  name: string | null;
  email: string | null;
  status: string;
  friendshipId: string;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type UserCacheValue = {
  id: string;
  username?: string;
  name?: string;
  email?: string;
};

export default function FriendsPage() {
  const { user } = useAuth();
  const meId = (user as { id?: string } | null)?.id || null;
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [received, setReceived] = useState<FriendRow[]>([]);
  const [sent, setSent] = useState<FriendRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [view, setView] = useState<"friends" | "received" | "sent" | "add">(
    "friends"
  );
  const userCache = useRef<Map<string, UserCacheValue>>(new Map());

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchUserById(id: string) {
    if (!id) return null;
    const cached = userCache.current.get(id);
    if (cached) return cached;
    try {
      const res = await fetch(`/api/users/${id}`);
      if (!res.ok) return null;
      const data = await res.json();
      const u: UserCacheValue = {
        id: data.id,
        username: data.username,
        name: data.name,
        email: data.email,
      };
      userCache.current.set(id, u);
      return u;
    } catch {
      return null;
    }
  }

  // try to extract "other" user and friendship metadata from many shapes
  function normalizeRawItem(
    item: ApiFriendRaw,
    currentUserId: string | null
  ): {
    otherId?: string;
    friendshipId?: string;
    createdAt?: string;
    status?: string;
    rawOther?: Record<string, unknown>;
  } {
    // common shapes:
    // 1) item = { id, username, name, email, friendshipId, status, createdAt }
    if (
      "friendshipId" in item ||
      (typeof item.friendship === "object" &&
        item.friendship &&
        "id" in item.friendship)
    ) {
      // shape where other user fields may be top-level (id, username...) and friendshipId present
      const otherId =
        (item as { id?: string }).id ||
        (item as { userId?: string }).userId ||
        (item as { friendId?: string }).friendId;
      return {
        otherId,
        friendshipId:
          (item as { friendshipId?: string }).friendshipId ??
          (item.friendship as { id?: string })?.id,
        createdAt: (item as { createdAt?: string }).createdAt,
        status:
          (item as { status?: string }).status ??
          (item.friendship as { status?: string })?.status,
        rawOther: item as Record<string, unknown>,
      };
    }

    // 2) item = { friendship: { id, userId, friendId, status, createdAt }, other: { id, username... } }
    if (
      typeof item.friendship === "object" &&
      item.friendship &&
      ("user" in item || "friend" in item)
    ) {
      const f = item.friendship as {
        id?: string;
        userId?: string;
        friendId?: string;
        status?: string;
        createdAt?: string;
      };
      const user = (item as { user?: { id?: string } }).user;
      const friend = (item as { friend?: { id?: string } }).friend;
      const other = user && user.id !== currentUserId ? user : friend;
      return {
        otherId: other?.id,
        friendshipId: f?.id,
        createdAt: f?.createdAt,
        status: f?.status,
        rawOther: other as Record<string, unknown>,
      };
    }

    // 3) item = { id: friendshipId, userId, friendId, status, createdAt, users: [u1, u2] }
    if (
      ("userId" in item || "friendId" in item) &&
      (Array.isArray((item as { users?: unknown[] }).users) ||
        Array.isArray((item as { participants?: unknown[] }).participants))
    ) {
      const participants =
        (item as { users?: unknown[] }).users ??
        (item as { participants?: unknown[] }).participants;
      const other =
        (participants as { id?: string }[]).find(
          (p) => p.id !== currentUserId
        ) || (participants as { id?: string }[])[0];
      return {
        otherId: other?.id,
        friendshipId: (item as { id?: string }).id,
        createdAt: (item as { createdAt?: string }).createdAt,
        status: (item as { status?: string }).status,
        rawOther: other as Record<string, unknown>,
      };
    }

    // 4) item already is user object and some metadata present separately
    if ("username" in item || "email" in item || "name" in item) {
      // if metadata keys present treat as other user
      return {
        otherId: (item as { id?: string }).id,
        friendshipId:
          (item as { friendshipId?: string }).friendshipId ??
          (item.friendship as { id?: string })?.id ??
          (item as { id?: string }).id,
        createdAt: (item as { createdAt?: string }).createdAt,
        status: (item as { status?: string }).status ?? "PENDING",
        rawOther: item as Record<string, unknown>,
      };
    }

    // 5) fallback: maybe item = { friendshipId, otherId, ... }
    if (
      "otherId" in item ||
      (typeof item.other === "object" && item.other && "id" in item.other)
    ) {
      return {
        otherId:
          (item as { otherId?: string }).otherId ??
          (item.other as { id?: string })?.id,
        friendshipId:
          (item as { friendshipId?: string }).friendshipId ??
          (item.friendship as { id?: string })?.id,
        createdAt: (item as { createdAt?: string }).createdAt,
        status: (item as { status?: string }).status,
        rawOther: item.other as Record<string, unknown>,
      };
    }

    // Last resort: try to detect friendId/userId keys
    const possibleOtherId =
      (item as { friendId?: string }).friendId &&
      (item as { friendId?: string }).friendId !== currentUserId
        ? (item as { friendId?: string }).friendId
        : (item as { userId?: string }).userId &&
          (item as { userId?: string }).userId !== currentUserId
        ? (item as { userId?: string }).userId
        : (item as { id?: string }).id;
    return {
      otherId: possibleOtherId,
      friendshipId:
        (item as { friendshipId?: string }).friendshipId ??
        (item as { id?: string }).id,
      createdAt: (item as { createdAt?: string }).createdAt,
      status: (item as { status?: string }).status,
      rawOther: item as Record<string, unknown>,
    };
  }

  async function toFriendRow(
    item: ApiFriendRaw,
    currentUserId: string | null
  ): Promise<FriendRow> {
    const { otherId, friendshipId, createdAt, status, rawOther } =
      normalizeRawItem(item, currentUserId);
    // rawOther may already contain username/name/email
    let username =
      (rawOther?.username as string | undefined) ??
      (rawOther?.user as { username?: string })?.username ??
      (rawOther?.friend as { username?: string })?.username ??
      null;
    let name =
      (rawOther?.name as string | undefined) ??
      (rawOther?.user as { name?: string })?.name ??
      (rawOther?.friend as { name?: string })?.name ??
      null;
    let email =
      (rawOther?.email as string | undefined) ??
      (rawOther?.user as { email?: string })?.email ??
      (rawOther?.friend as { email?: string })?.email ??
      null;

    // If still missing, fetch by otherId
    if ((!username || !name) && otherId) {
      const u = await fetchUserById(String(otherId));
      if (u) {
        username = username ?? u.username ?? null;
        name = name ?? u.name ?? null;
        email = email ?? u.email ?? null;
      }
    }

    return {
      id: otherId ?? (rawOther?.id as string) ?? "",
      username: username ?? null,
      name: name ?? null,
      email: email ?? null,
      status: status ?? (rawOther?.status as string) ?? "PENDING",
      friendshipId:
        friendshipId ??
        (rawOther?.friendshipId as string) ??
        (rawOther?.friendship as { id?: string })?.id ??
        (rawOther?.id as string) ??
        "",
      createdAt: createdAt ?? (rawOther?.createdAt as string) ?? null,
      updatedAt: (rawOther?.updatedAt as string) ?? null,
    };
  }

  async function fetchAndNormalize(url: string): Promise<FriendRow[]> {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.warn("fetch failed:", url, await res.text().catch(() => ""));
        return [];
      }
      const data = await res.json().catch(() => ({}));
      // try to find array in common keys
      const arr: ApiFriendRaw[] =
        (data.friends as ApiFriendRaw[]) ??
        (data.requests as ApiFriendRaw[]) ??
        (data.items as ApiFriendRaw[]) ??
        (Array.isArray(data) ? data : []);
      if (!Array.isArray(arr)) return [];
      // Build set of userIds we might need to fetch in batch (we will still fetch individually to keep code simple)
      const rows: FriendRow[] = [];
      for (const it of arr) {
        rows.push(await toFriendRow(it, meId));
      }
      return rows;
    } catch {
      console.error("fetchAndNormalize error");
      return [];
    }
  }

  async function fetchAll() {
    setIsLoading(true);
    setError("");
    try {
      // accepted friends
      const friendsRows = await fetchAndNormalize(
        "/api/friendships?status=ACCEPTED"
      );
      // received pending
      const receivedRows = await fetchAndNormalize("/api/friendships/pending");
      // sent pending
      const sentRows = await fetchAndNormalize(
        "/api/friendships?sent=true&status=PENDING"
      );

      setFriends(friendsRows);
      setReceived(receivedRows);
      setSent(sentRows);
    } catch {
      console.error("Failed to load friends");
      setError("Failed to load friends");
    } finally {
      setIsLoading(false);
    }
  }

  const formatDate = (iso?: string | null) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  };

  const filtered = (rows: FriendRow[]) =>
    rows.filter((r) => {
      const hay = `${r.name ?? ""} ${r.username ?? ""} ${r.email ?? ""} ${
        r.createdAt ?? ""
      }`.toLowerCase();
      return hay.includes(searchQuery.toLowerCase());
    });

  // Actions (accept/reject/cancel/remove)
  async function accept(id: string) {
    try {
      const res = await fetch(`/api/friendships/${id}/accept`, {
        method: "POST",
      });
      if (res.ok) fetchAll();
    } catch {
      console.error("accept failed");
    }
  }
  async function rejectReq(id: string) {
    try {
      const res = await fetch(`/api/friendships/${id}/reject`, {
        method: "POST",
      });
      if (res.ok) fetchAll();
    } catch {
      console.error("rejectReq failed");
    }
  }
  async function cancelSent(id: string) {
    try {
      const res = await fetch(`/api/friendships/${id}`, { method: "DELETE" });
      if (res.ok) fetchAll();
    } catch {
      console.error("cancelSent failed");
    }
  }
  async function removeFriend(id: string) {
    try {
      const res = await fetch(`/api/friendships/${id}`, { method: "DELETE" });
      if (res.ok) fetchAll();
    } catch {
      console.error("removeFriend failed");
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-[#1a1d29] to-gray-900 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setView("friends")}
            className={`px-4 py-2 rounded-lg ${
              view === "friends"
                ? "bg-green-500 text-white"
                : "bg-gray-800 text-gray-300"
            }`}
          >
            Friends
          </button>
          <button
            onClick={() => setView("received")}
            className={`px-4 py-2 rounded-lg ${
              view === "received"
                ? "bg-blue-500 text-white"
                : "bg-gray-800 text-gray-300"
            }`}
          >
            Requests Received
          </button>
          <button
            onClick={() => setView("sent")}
            className={`px-4 py-2 rounded-lg ${
              view === "sent"
                ? "bg-yellow-500 text-white"
                : "bg-gray-800 text-gray-300"
            }`}
          >
            Requests Sent
          </button>
          <button
            onClick={() => setView("add")}
            className={`px-4 py-2 rounded-lg ${
              view === "add"
                ? "bg-purple-500 text-white"
                : "bg-gray-800 text-gray-300"
            }`}
          >
            Add Friend
          </button>
        </div>

        <div className="bg-[#1a1d29] border border-gray-800 rounded-xl overflow-hidden p-4">
          <div className="flex items-center gap-3 mb-4">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="bg-gray-800/50 border border-gray-700 rounded px-3 py-2 text-white w-full"
            />
            <button
              onClick={() => fetchAll()}
              className="px-3 py-2 bg-blue-600 rounded text-white"
            >
              Refresh
            </button>
          </div>

          {isLoading ? (
            <div className="text-gray-400">Loading...</div>
          ) : error ? (
            <div className="text-red-400">{error}</div>
          ) : view === "friends" ? (
            <>
              <h2 className="text-lg text-white mb-3">Your Friends</h2>
              {filtered(friends).length === 0 ? (
                <div className="text-gray-400">No friends found.</div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-800/50 text-gray-300 text-left">
                      <th className="px-4 py-2">Name</th>
                      <th className="px-4 py-2">Username</th>
                      <th className="px-4 py-2">Email</th>
                      <th className="px-4 py-2">Since</th>
                      <th className="px-4 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered(friends).map((f) => (
                      <tr
                        key={f.friendshipId}
                        className="border-t border-gray-800"
                      >
                        <td className="px-4 py-3">{f.name ?? "-"}</td>
                        <td className="px-4 py-3">{f.username ?? "-"}</td>
                        <td className="px-4 py-3 text-sm text-gray-400">
                          {f.email ?? "-"}
                        </td>
                        <td className="px-4 py-3">{formatDate(f.createdAt)}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => removeFriend(f.friendshipId)}
                              className="px-3 py-1 rounded bg-red-600 text-white text-xs"
                            >
                              Remove
                            </button>
                            <Link
                              href={`/profile/${f.id}`}
                              className="px-3 py-1 rounded bg-gray-700 text-gray-200 text-xs"
                            >
                              Profile
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          ) : view === "received" ? (
            <>
              <h2 className="text-lg text-white mb-3">Requests Received</h2>
              {filtered(received).length === 0 ? (
                <div className="text-gray-400">No received requests.</div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-800/50 text-gray-300 text-left">
                      <th className="px-4 py-2">From</th>
                      <th className="px-4 py-2">Username</th>
                      <th className="px-4 py-2">Email</th>
                      <th className="px-4 py-2">Requested At</th>
                      <th className="px-4 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered(received).map((r) => (
                      <tr
                        key={r.friendshipId}
                        className="border-t border-gray-800"
                      >
                        <td className="px-4 py-3">{r.name ?? "-"}</td>
                        <td className="px-4 py-3">{r.username ?? "-"}</td>
                        <td className="px-4 py-3 text-sm text-gray-400">
                          {r.email ?? "-"}
                        </td>
                        <td className="px-4 py-3">{formatDate(r.createdAt)}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => accept(r.friendshipId)}
                              className="px-3 py-1 rounded bg-green-600 text-white text-xs"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => rejectReq(r.friendshipId)}
                              className="px-3 py-1 rounded bg-red-600 text-white text-xs"
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          ) : view === "sent" ? (
            <>
              <h2 className="text-lg text-white mb-3">Requests Sent</h2>
              {filtered(sent).length === 0 ? (
                <div className="text-gray-400">No sent requests.</div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-800/50 text-gray-300 text-left">
                      <th className="px-4 py-2">To</th>
                      <th className="px-4 py-2">Username</th>
                      <th className="px-4 py-2">Email</th>
                      <th className="px-4 py-2">Requested At</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered(sent).map((r) => (
                      <tr
                        key={r.friendshipId}
                        className="border-t border-gray-800"
                      >
                        <td className="px-4 py-3">{r.name ?? "-"}</td>
                        <td className="px-4 py-3">{r.username ?? "-"}</td>
                        <td className="px-4 py-3 text-sm text-gray-400">
                          {r.email ?? "-"}
                        </td>
                        <td className="px-4 py-3">{formatDate(r.createdAt)}</td>
                        <td className="px-4 py-3">
                          <span className="inline-block bg-yellow-600/20 text-yellow-300 px-3 py-1 rounded-full text-xs font-semibold">
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => cancelSent(r.friendshipId)}
                              className="px-3 py-1 rounded bg-red-600 text-white text-xs"
                            >
                              Cancel
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          ) : (
            // add friend view (simple)
            <div>
              <h2 className="text-lg text-white mb-3">Add Friend</h2>
              <AddFriendForm onSent={() => fetchAll()} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// small add friend component
function AddFriendForm({ onSent }: { onSent?: () => void }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    setStatus("");
    if (!q.trim()) return setStatus("Enter username or email");
    try {
      const res = await fetch("/api/friendships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: q }),
      });
      const json = await res.json();
      if (res.ok) {
        setStatus("Request sent");
        setQ("");
        onSent?.();
      } else {
        setStatus(json.error || "Failed");
      }
    } catch {
      setStatus("Failed");
    }
  }
  return (
    <form onSubmit={(e) => submit(e)} className="flex gap-2">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="username or email"
        className="bg-gray-800/50 border border-gray-700 px-3 py-2 rounded text-white"
      />
      <button
        className="bg-blue-600 px-3 py-2 rounded text-white"
        type="submit"
      >
        Send
      </button>
      {status && <div className="text-sm text-yellow-300 ml-2">{status}</div>}
    </form>
  );
}
