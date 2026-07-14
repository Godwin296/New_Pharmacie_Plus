"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    setMounted(true);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("pharmacieplus-theme", next ? "dark" : "light");
    } catch {
      // localStorage indisponible (navigation privée, etc.) — pas bloquant
    }
  }

  if (!mounted) {
    return <div className={`h-9 w-9 ${className}`} aria-hidden />;
  }

  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Passer en mode clair" : "Passer en mode sombre"}
      title={dark ? "Mode clair" : "Mode sombre"}
      className={`flex items-center justify-center h-9 w-9 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors border-none cursor-pointer ${className}`}
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
