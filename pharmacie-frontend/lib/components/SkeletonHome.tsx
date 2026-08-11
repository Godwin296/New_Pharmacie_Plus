"use client";

import { motion } from "framer-motion";

export default function SkeletonHome() {
  return (
    <div className="px-4 pt-2 pb-28 max-w-md mx-auto space-y-6 animate-pulse">
      {/* Hero skeleton */}
      <div className="rounded-3xl bg-gray-200 dark:bg-gray-800 h-64" />

      {/* Catégories skeleton */}
      <div className="space-y-3">
        <div className="h-4 w-24 bg-gray-200 dark:bg-gray-800 rounded" />
        <div className="flex gap-2.5 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-11 w-32 bg-gray-200 dark:bg-gray-800 rounded-2xl flex-shrink-0" />
          ))}
        </div>
      </div>

      {/* Section populaires skeleton */}
      <div className="space-y-3">
        <div className="h-4 w-32 bg-gray-200 dark:bg-gray-800 rounded" />
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="w-[156px] flex-shrink-0 space-y-2">
              <div className="aspect-square rounded-[20px] bg-gray-200 dark:bg-gray-800" />
              <div className="h-3 w-full bg-gray-200 dark:bg-gray-800 rounded" />
              <div className="h-3 w-2/3 bg-gray-200 dark:bg-gray-800 rounded" />
              <div className="flex justify-between">
                <div className="h-4 w-12 bg-gray-200 dark:bg-gray-800 rounded" />
                <div className="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-800" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}