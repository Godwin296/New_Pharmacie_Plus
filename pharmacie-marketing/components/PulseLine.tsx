"use client";

import { motion } from "framer-motion";

export function PulseLine({
  className = "",
  stroke = "#10b981",
  width = 900,
  height = 120,
}: {
  className?: string;
  stroke?: string;
  width?: number;
  height?: number;
}) {
  const path =
    "M0,60 L140,60 L168,60 L182,14 L198,110 L214,60 L230,32 L246,60 L400,60 L428,60 L442,14 L458,110 L474,60 L490,32 L506,60 L900,60";

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      fill="none"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      <path
        d={path}
        stroke={stroke}
        strokeOpacity={0.15}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <motion.path
        d={path}
        stroke={stroke}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="120 900"
        initial={{ strokeDashoffset: 0 }}
        animate={{ strokeDashoffset: -1020 }}
        transition={{ duration: 3.6, repeat: Infinity, ease: "linear" }}
        style={{ filter: `drop-shadow(0 0 6px ${stroke})` }}
      />
    </svg>
  );
}
