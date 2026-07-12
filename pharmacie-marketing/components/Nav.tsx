"use client";

import { useState } from "react";
import Image from "next/image";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence, useScroll, useSpring } from "framer-motion";
import { DEMO_WHATSAPP_LINK } from "@/lib/contact";

const links = [
  { href: "#pharmacies", label: "Pour les pharmacies" },
  { href: "#clients", label: "Pour les patients" },
  { href: "#confiance", label: "Sécurité" },
  { href: "#faq", label: "FAQ" },
  { href: "#contact", label: "Contact" },
];

export function Nav() {
  const [open, setOpen] = useState(false);
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 24, mass: 0.2 });

  return (
    <header className="fixed top-0 inset-x-0 z-50">
      <motion.div
        style={{ scaleX: progress }}
        className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-400 via-blue-400 to-emerald-400 origin-left z-[60]"
      />
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/10 bg-[#053a30]/75 backdrop-blur-xl px-4 py-3 shadow-lg shadow-emerald-950/30">
          <a href="#top" className="flex items-center gap-2.5 no-underline">
            <Image
              src="/branding/icon-mark.png"
              alt="Pharmacie+"
              width={32}
              height={32}
              className="h-8 w-8 object-contain"
              priority
            />
            <span className="font-display font-bold text-white text-[15px] tracking-tight">
              Pharmacie<span className="text-emerald-400">+</span>
            </span>
          </a>

          <nav className="hidden md:flex items-center gap-7">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="text-[13px] font-medium text-white/70 hover:text-white transition-colors no-underline"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <a
              href={DEMO_WHATSAPP_LINK}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-[13px] font-bold px-4 py-2 no-underline transition-colors"
            >
              Demander une démo
            </a>
          </div>

          <button
            aria-label="Ouvrir le menu"
            onClick={() => setOpen(true)}
            className="md:hidden p-2 text-white bg-transparent border-none cursor-pointer"
          >
            <Menu size={22} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm md:hidden"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed top-0 right-0 z-[70] h-full w-[80%] max-w-xs bg-brand-deep p-6 md:hidden shadow-2xl"
            >
              <div className="flex justify-end">
                <button
                  aria-label="Fermer le menu"
                  onClick={() => setOpen(false)}
                  className="p-2 text-white bg-transparent border-none cursor-pointer"
                >
                  <X size={22} />
                </button>
              </div>
              <div className="mt-8 flex flex-col gap-1">
                {links.map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="py-3.5 text-[15px] font-medium text-white/80 border-b border-white/10 no-underline"
                  >
                    {l.label}
                  </a>
                ))}
                <a
                  href={DEMO_WHATSAPP_LINK}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setOpen(false)}
                  className="mt-6 rounded-xl bg-emerald-500 text-center text-white text-sm font-bold px-4 py-3 no-underline"
                >
                  Demander une démo
                </a>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
