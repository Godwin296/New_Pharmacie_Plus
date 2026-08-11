"use client";

import { motion } from "framer-motion";

interface PageSkeletonProps {
  variant?: "home" | "catalogue" | "commandes" | "profil" | "panier" | "generic";
}

const shimmer = "animate-pulse bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-800 dark:via-gray-700 dark:to-gray-800 bg-[length:200%_100%]";

export default function PageSkeleton({ variant = "generic" }: PageSkeletonProps) {
  if (variant === "home") return <HomeSkeleton />;
  if (variant === "catalogue") return <CatalogueSkeleton />;
  if (variant === "commandes") return <CommandesSkeleton />;
  if (variant === "profil") return <ProfilSkeleton />;
  if (variant === "panier") return <PanierSkeleton />;
  
  return <GenericSkeleton />;
}

/* ═══ HOME ═══ */
function HomeSkeleton() {
  return (
    <div className="px-4 pt-2 pb-28 max-w-md mx-auto space-y-6">
      <div className={`rounded-3xl h-64 ${shimmer}`} />
      <div className="space-y-3">
        <div className={`h-4 w-24 rounded ${shimmer}`} />
        <div className="flex gap-2.5 overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={`h-11 w-32 rounded-2xl flex-shrink-0 ${shimmer}`} />
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <div className="flex justify-between">
          <div className={`h-4 w-32 rounded ${shimmer}`} />
          <div className={`h-4 w-16 rounded ${shimmer}`} />
        </div>
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="w-[156px] flex-shrink-0 space-y-2">
              <div className={`aspect-square rounded-[20px] ${shimmer}`} />
              <div className={`h-3 w-full rounded ${shimmer}`} />
              <div className={`h-3 w-2/3 rounded ${shimmer}`} />
              <div className="flex justify-between">
                <div className={`h-4 w-12 rounded ${shimmer}`} />
                <div className={`h-8 w-8 rounded-full ${shimmer}`} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══ CATALOGUE ═══ */
function CatalogueSkeleton() {
  return (
    <div className="px-4 pt-4 pb-28 max-w-md mx-auto space-y-4">
      <div className={`h-11 w-full rounded-2xl ${shimmer}`} />
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={`h-8 w-24 rounded-full flex-shrink-0 ${shimmer}`} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className={`aspect-square rounded-[20px] ${shimmer}`} />
            <div className={`h-3 w-full rounded ${shimmer}`} />
            <div className={`h-3 w-2/3 rounded ${shimmer}`} />
            <div className={`h-4 w-16 rounded ${shimmer}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══ COMMANDES ═══ */
function CommandesSkeleton() {
  return (
    <div className="px-4 pt-4 pb-28 max-w-md mx-auto space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className={`h-28 rounded-2xl ${shimmer}`} />
      ))}
    </div>
  );
}

/* ═══ PROFIL ═══ */
function ProfilSkeleton() {
  return (
    <div className="px-4 pt-4 pb-28 max-w-md mx-auto space-y-4">
      <div className="flex items-center gap-4">
        <div className={`w-16 h-16 rounded-full ${shimmer}`} />
        <div className="space-y-2 flex-1">
          <div className={`h-4 w-32 rounded ${shimmer}`} />
          <div className={`h-3 w-48 rounded ${shimmer}`} />
        </div>
      </div>
      <div className="space-y-2 mt-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className={`h-14 rounded-xl ${shimmer}`} />
        ))}
      </div>
    </div>
  );
}

/* ═══ PANIER ═══ */
function PanierSkeleton() {
  return (
    <div className="px-4 pt-4 pb-28 max-w-md mx-auto space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <div className={`w-20 h-20 rounded-2xl flex-shrink-0 ${shimmer}`} />
          <div className="flex-1 space-y-2 py-1">
            <div className={`h-4 w-3/4 rounded ${shimmer}`} />
            <div className={`h-3 w-1/2 rounded ${shimmer}`} />
            <div className={`h-4 w-20 rounded ${shimmer}`} />
          </div>
        </div>
      ))}
      <div className={`h-14 rounded-2xl mt-4 ${shimmer}`} />
    </div>
  );
}

/* ═══ GENERIC ═══ */
function GenericSkeleton() {
  return (
    <div className="px-4 pt-6 pb-28 max-w-md mx-auto space-y-6">
      <div className={`h-8 w-1/3 rounded-lg ${shimmer}`} />
      <div className={`h-64 rounded-3xl ${shimmer}`} />
      <div className="space-y-3">
        <div className={`h-4 w-24 rounded ${shimmer}`} />
        <div className="flex gap-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={`h-11 w-28 rounded-2xl flex-shrink-0 ${shimmer}`} />
          ))}
        </div>
      </div>
    </div>
  );
}