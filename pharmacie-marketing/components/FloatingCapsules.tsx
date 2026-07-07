"use client";

import { useEffect, useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

function Capsule({
  size,
  color1,
  color2,
  rotate,
  depth,
  mx,
  my,
  style,
  driftDelay = 0,
}: {
  size: number;
  color1: string;
  color2: string;
  rotate: number;
  depth: number;
  mx: ReturnType<typeof useMotionValue<number>>;
  my: ReturnType<typeof useMotionValue<number>>;
  style: React.CSSProperties;
  driftDelay?: number;
}) {
  const x = useTransform(mx, (v) => v * depth);
  const y = useTransform(my, (v) => v * depth);

  return (
    <motion.div
      style={{ ...style, x, y, rotate }}
      animate={{ y: [0, -14, 0] }}
      transition={{ duration: 5 + depth * 6, repeat: Infinity, ease: "easeInOut", delay: driftDelay }}
      className="absolute pointer-events-none"
    >
      <svg width={size} height={size * 0.42} viewBox="0 0 100 42" fill="none">
        <rect x="1" y="1" width="98" height="40" rx="20" fill={color1} fillOpacity="0.16" stroke={color1} strokeOpacity="0.35" />
        <path d="M50 1 H79 A20 20 0 0 1 79 41 H50 Z" fill={color2} fillOpacity="0.22" />
      </svg>
    </motion.div>
  );
}

export function FloatingCapsules({ className = "" }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const mx = useSpring(rawX, { stiffness: 40, damping: 20 });
  const my = useSpring(rawY, { stiffness: 40, damping: 20 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function handleMove(e: MouseEvent) {
      const rect = el!.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      rawX.set(px * 26);
      rawY.set(py * 26);
    }
    el.addEventListener("mousemove", handleMove);
    return () => el.removeEventListener("mousemove", handleMove);
  }, [rawX, rawY]);

  return (
    <div ref={containerRef} className={`absolute inset-0 overflow-hidden ${className}`}>
      <Capsule size={92} color1="#10b981" color2="#059669" rotate={-24} depth={1.6} mx={mx} my={my} style={{ top: "18%", left: "6%" }} />
      <Capsule size={64} color1="#2563eb" color2="#4f8cff" rotate={18} depth={1.1} mx={mx} my={my} style={{ top: "62%", left: "12%" }} driftDelay={0.6} />
      <Capsule size={76} color1="#10b981" color2="#059669" rotate={40} depth={1.9} mx={mx} my={my} style={{ top: "8%", right: "26%" }} driftDelay={1.1} />
      <Capsule size={54} color1="#2563eb" color2="#4f8cff" rotate={-14} depth={0.8} mx={mx} my={my} style={{ bottom: "14%", right: "8%" }} driftDelay={0.3} />
    </div>
  );
}
