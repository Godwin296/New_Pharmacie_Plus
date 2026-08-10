"use client";
/**
 * 🎬 PAGE TRANSITION — Task 1/20
 *
 * Wrapper Framer Motion qui anime chaque changement de page avec
 * un slide directionnel (forward = from-right, backward = from-left)
 * combiné à un fade et un léger scale — fidèle au feel iOS natif.
 *
 * Utilisé dans app/template.tsx (remonté à chaque navigation par Next.js).
 */
import { motion } from "framer-motion";
import { useNavigation } from "@/lib/context/NavigationContext";

const variants = {
  enter: (direction: "forward" | "backward") => ({
    x: direction === "forward" ? "100%" : "-35%",
    opacity: 0,
    scale: direction === "forward" ? 0.97 : 1,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
  },
  exit: (direction: "forward" | "backward") => ({
    x: direction === "forward" ? "-35%" : "100%",
    opacity: 0,
    scale: direction === "forward" ? 1 : 0.97,
  }),
};

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const { direction } = useNavigation();

  return (
    <motion.div
      key={typeof window !== "undefined" ? window.location.pathname : "ssr"}
      custom={direction}
      variants={variants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{
        x: {
          type: "spring",
          stiffness: 320,
          damping: 34,
          mass: 0.9,
          restDelta: 0.001,
        },
        opacity: { duration: 0.22, ease: "easeInOut" },
        scale: { duration: 0.28, ease: [0.32, 0.72, 0, 1] },
      }}
      style={{
        willChange: "transform, opacity",
        transformOrigin: "center center",
      }}
      className="min-h-[100dvh]"
    >
      {children}
    </motion.div>
  );
}
