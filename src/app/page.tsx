"use client";

import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-[#1a1d29] to-gray-900 flex items-center justify-center px-4">
      <div className="max-w-lg w-full bg-[#1a1d29] border border-gray-800 rounded-xl p-8 shadow-2xl text-center">
        <h1 className="text-4xl font-bold text-white mb-4">
          Welcome to RDBMS Project
        </h1>
        <p className="text-gray-400 mb-8">
          Choose an option below to continue:
        </p>
        <div className="flex flex-col gap-6">
          <Link
            href="/all-files"
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-lg transition-colors text-lg"
          >
            See All Data
          </Link>
          <Link
            href="/login"
            className="w-full bg-gray-800 hover:bg-gray-700 text-white font-medium py-3 rounded-lg transition-colors text-lg"
          >
            Login
          </Link>
        </div>
      </div>
    </div>
  );
}
