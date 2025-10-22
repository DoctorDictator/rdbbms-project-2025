"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface User {
  id: string;
  username: string;
  email: string | null;
  phone: string | null;
  name: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function PublicProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<User | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchProfile = async () => {
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/profile/${id}`);
      if (!res.ok) throw new Error("Profile not found");
      const data = await res.json();
      setProfile(data.user);
    } catch (err) {
      setError("Profile not found");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-red-400">{error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-[#1a1d29] to-gray-900 py-8 px-4">
      <div className="max-w-xl mx-auto bg-[#1a1d29] border border-gray-800 rounded-xl p-8">
        <h1 className="text-3xl font-bold text-white mb-6">
          {(profile.name || profile.username) + " Profile"}
        </h1>
        <div className="mb-4">
          <span className="block text-gray-400 text-sm mb-1">Username</span>
          <span className="text-white font-medium">{profile.username}</span>
        </div>
        <div className="mb-4">
          <span className="block text-gray-400 text-sm mb-1">Full Name</span>
          <span className="text-white font-medium">{profile.name || "—"}</span>
        </div>
        <div className="mb-4">
          <span className="block text-gray-400 text-sm mb-1">Email</span>
          <span className="text-white font-medium">{profile.email || "—"}</span>
        </div>
        <div className="mb-4">
          <span className="block text-gray-400 text-sm mb-1">Phone</span>
          <span className="text-white font-medium">{profile.phone || "—"}</span>
        </div>
        <div className="mb-4">
          <span className="block text-gray-400 text-sm mb-1">Joined</span>
          <span className="text-white font-medium">
            {new Date(profile.createdAt).toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}
