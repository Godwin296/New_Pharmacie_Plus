"use client";

import { useEffect, useRef } from "react";
import { motion, useMotionValue, useSpring, useTransform, type MotionValue } from "framer-motion";

type IconKind = "capsule" | "tablet" | "syringe" | "scissors";

function ShapeSvg({ kind, color1, color2 }: { kind: IconKind; color1: string; color2: string }) {
  if (kind === "tablet") {
    return (
      <svg width="100%" height="100%" viewBox="0 0 60 60" fill="none">
        <circle cx="30" cy="30" r="26" fill={color1} fillOpacity="0.16" stroke={color1} strokeOpacity="0.4" strokeWidth="1.5" />
        <path d="M6 30 H54" stroke={color1} strokeOpacity="0.4" strokeWidth="1.5" />
      </svg>
    );
  }
  if (kind === "syringe") {
    return (
      <svg width="100%" height="100%" viewBox="0 0 110 30" fill="none">
        <rect x="10" y="10" width="52" height="10" rx="2.5" fill={color1} fillOpacity="0.16" stroke={color1} strokeOpacity="0.4" strokeWidth="1.4" />
        <path d="M18 10 V20 M28 10 V20 M38 10 V20 M48 10 V20" stroke={color1} strokeOpacity="0.3" strokeWidth="1" />
        <rect x="62" y="12.5" width="16" height="5" fill={color1} fillOpacity="0.28" />
        <path d="M78 15 H98" stroke={color1} strokeOpacity="0.5" strokeWidth="2" />
        <path d="M6 6 L11 15 L6 24" stroke={color2} strokeOpacity="0.55" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === "scissors") {
    return (
      <svg width="100%" height="100%" viewBox="0 0 60 60" fill="none">
        <circle cx="13" cy="13" r="7" stroke={color2} strokeOpacity="0.5" strokeWidth="2" />
        <circle cx="13" cy="47" r="7" stroke={color2} strokeOpacity="0.5" strokeWidth="2" />
        <path d="M20 17 L52 46" stroke={color1} strokeOpacity="0.45" strokeWidth="2" strokeLinecap="round" />
        <path d="M20 43 L52 14" stroke={color1} strokeOpacity="0.45" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="100%" height="100%" viewBox="0 0 100 42" fill="none">
      <rect x="1" y="1" width="98" height="40" rx="20" fill={color1} fillOpacity="0.16" stroke={color1} strokeOpacity="0.35" />
      <path d="M50 1 H79 A20 20 0 0 1 79 41 H50 Z" fill={color2} fillOpacity="0.22" />
    </svg>
  );
}

function FloatingIcon({
  kind,
  width,
  height,
  color1,
  color2,
  rotate,
  style,
  dirX,
  dirY,
  amplitude,
  bobDuration,
  bobDelay,
  energy,
}: {
  kind: IconKind;
  width: number;
  height: number;
  color1: string;
  color2: string;
  rotate: number;
  style: React.CSSProperties;
  dirX: number;
  dirY: number;
  amplitude: number;
  bobDuration: number;
  bobDelay: number;
  energy: MotionValue<number>;
}) {
  const jitterX = useTransform(energy, (e) => dirX * e * amplitude);
  const jitterY = useTransform(energy, (e) => dirY * e * amplitude);
  const sx = useSpring(jitterX, { stiffness: 60, damping: 12 });
  const sy = useSpring(jitterY, { stiffness: 60, damping: 12 });

  return (
    <motion.div
      style={style}
      animate={{ y: [0, -14, 0] }}
      transition={{ duration: bobDuration, repeat: Infinity, ease: "easeInOut", delay: bobDelay }}
      className="absolute pointer-events-none"
    >
      <motion.div style={{ x: sx, y: sy, rotate, width, height }}>
        <ShapeSvg kind={kind} color1={color1} color2={color2} />
      </motion.div>
    </motion.div>
  );
}

const ICONS: Array<{
  kind: IconKind;
  width: number;
  height: number;
  color1: string;
  color2: string;
  rotate: number;
  style: React.CSSProperties;
  dirX: number;
  dirY: number;
  amplitude: number;
  bobDuration: number;
  bobDelay: number;
}> = [
  { kind: "capsule", width: 92, height: 39, color1: "#10b981", color2: "#059669", rotate: -24, style: { top: "16%", left: "6%" }, dirX: -1, dirY: 0.6, amplitude: 26, bobDuration: 6, bobDelay: 0 },
  { kind: "tablet", width: 46, height: 46, color1: "#2563eb", color2: "#4f8cff", rotate: 0, style: { top: "58%", left: "11%" }, dirX: 0.8, dirY: -1, amplitude: 22, bobDuration: 7.5, bobDelay: 0.6 },
  { kind: "capsule", width: 70, height: 30, color1: "#10b981", color2: "#059669", rotate: 42, style: { top: "10%", right: "24%" }, dirX: 1, dirY: 0.7, amplitude: 30, bobDuration: 8.5, bobDelay: 1.1 },
  { kind: "tablet", width: 40, height: 40, color1: "#2563eb", color2: "#4f8cff", rotate: 0, style: { bottom: "16%", right: "9%" }, dirX: -0.7, dirY: -1, amplitude: 20, bobDuration: 6.5, bobDelay: 0.3 },
  { kind: "syringe", width: 96, height: 26, color1: "#5eead4", color2: "#10b981", rotate: -12, style: { bottom: "26%", left: "3%" }, dirX: 1, dirY: -0.6, amplitude: 24, bobDuration: 9, bobDelay: 1.6 },
  { kind: "scissors", width: 42, height: 42, color1: "#93c5fd", color2: "#2563eb", rotate: 20, style: { top: "34%", right: "6%" }, dirX: -0.9, dirY: 0.8, amplitude: 22, bobDuration: 7, bobDelay: 0.9 },
  { kind: "tablet", width: 34, height: 34, color1: "#10b981", color2: "#10b981", rotate: 0, style: { top: "72%", right: "30%" }, dirX: 0.6, dirY: 1, amplitude: 18, bobDuration: 6, bobDelay: 1.9 },
];

export function FloatingCapsules({ className = "" }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const energy = useMotionValue(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let last: { x: number; y: number; t: number } | null = null;
    let raf = 0;

    function handleMove(e: MouseEvent) {
      const now = performance.now();
      if (last) {
        const dt = Math.max(now - last.t, 1);
        const dx = e.clientX - last.x;
        const dy = e.clientY - last.y;
        const speed = Math.sqrt(dx * dx + dy * dy) / dt;
        energy.set(Math.min(1, energy.get() + speed * 3.2));
      }
      last = { x: e.clientX, y: e.clientY, t: now };
    }

    function decay() {
      energy.set(Math.max(0, energy.get() - 0.014));
      raf = requestAnimationFrame(decay);
    }

    el.addEventListener("mousemove", handleMove);
    raf = requestAnimationFrame(decay);
    return () => {
      el.removeEventListener("mousemove", handleMove);
      cancelAnimationFrame(raf);
    };
  }, [energy]);

  return (
    <div ref={containerRef} className={`absolute inset-0 overflow-hidden ${className}`}>
      {ICONS.map((icon, i) => (
        <FloatingIcon key={i} {...icon} energy={energy} />
      ))}
    </div>
  );
}
