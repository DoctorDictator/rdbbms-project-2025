"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";

interface User {
  id: string;
  username: string;
  email: string | null;
  phone: string | null;
  name: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<User | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    phone: "",
    name: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch("/api/profile");
      if (!res.ok) throw new Error("Failed to fetch profile");
      const data = await res.json();
      setProfile(data.user);
      setFormData({
        username: data.user.username,
        email: data.user.email ?? "",
        phone: data.user.phone ?? "",
        name: data.user.name ?? "",
      });
    } catch (err) {
      setError("Failed to load profile");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = () => {
    setEditMode(true);
    setSuccess("");
    setError("");
  };

  const handleCancel = () => {
    setEditMode(false);
    setError("");
    setSuccess("");
    if (profile) {
      setFormData({
        username: profile.username,
        email: profile.email ?? "",
        phone: profile.phone ?? "",
        name: profile.name ?? "",
      });
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError("");
    setSuccess("");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setIsLoading(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update profile");
      setProfile(data.user);
      setEditMode(false);
      setSuccess("Profile updated successfully!");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || "Failed to update profile");
      } else {
        setError("Failed to update profile");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (
      !confirm(
        "Are you sure you want to delete your account? This cannot be undone."
      )
    )
      return;
    setError("");
    setSuccess("");
    setIsLoading(true);
    try {
      const res = await fetch("/api/profile", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to delete account");
      }
      setSuccess("Account deleted successfully!");
      logout();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message || "Failed to delete account");
      } else {
        setError("Failed to delete account");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-red-400">Profile not found.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-[#1a1d29] to-gray-900 py-8 px-4">
      <div className="max-w-xl mx-auto bg-[#1a1d29] border border-gray-800 rounded-xl p-8">
        <h1 className="text-3xl font-bold text-white mb-6">My Profile</h1>
        {error && (
          <div className="mb-4 bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 bg-green-500/10 border border-green-500/50 text-green-400 px-4 py-3 rounded-lg text-sm">
            {success}
          </div>
        )}
        {!editMode ? (
          <div>
            <div className="mb-4">
              <span className="block text-gray-400 text-sm mb-1">Username</span>
              <span className="text-white font-medium">{profile.username}</span>
            </div>
            <div className="mb-4">
              <span className="block text-gray-400 text-sm mb-1">
                Full Name
              </span>
              <span className="text-white font-medium">
                {profile.name || "—"}
              </span>
            </div>
            <div className="mb-4">
              <span className="block text-gray-400 text-sm mb-1">Email</span>
              <span className="text-white font-medium">
                {profile.email || "—"}
              </span>
            </div>
            <div className="mb-4">
              <span className="block text-gray-400 text-sm mb-1">Phone</span>
              <span className="text-white font-medium">
                {profile.phone || "—"}
              </span>
            </div>
            <div className="mb-4">
              <span className="block text-gray-400 text-sm mb-1">Joined</span>
              <span className="text-white font-medium">
                {new Date(profile.createdAt).toLocaleString()}
              </span>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={handleEdit}
                className="px-4 py-2 rounded bg-blue-600 text-white font-medium"
              >
                Edit Profile
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 rounded bg-red-600 text-white font-medium"
              >
                Delete Account
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-5">
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Username
              </label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                className="w-full bg-gray-800/50 border border-gray-700 text-white rounded-lg px-4 py-2.5"
                required
                disabled
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                Full Name
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full bg-gray-800/50 border border-gray-700 text-white rounded-lg px-4 py-2.5"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full bg-gray-800/50 border border-gray-700 text-white rounded-lg px-4 py-2.5"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Phone</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full bg-gray-800/50 border border-gray-700 text-white rounded-lg px-4 py-2.5"
              />
            </div>
            <div className="flex gap-3 mt-6">
              <button
                type="submit"
                className="px-4 py-2 rounded bg-blue-600 text-white font-medium"
                disabled={isLoading}
              >
                Save Changes
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 rounded bg-gray-700 text-white font-medium"
                disabled={isLoading}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
