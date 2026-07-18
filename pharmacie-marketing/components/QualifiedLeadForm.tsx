"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { CONTACT } from "@/lib/contact";

export function QualifiedLeadForm() {
  const [pharmacy, setPharmacy] = useState("");
  const [city, setCity] = useState("");
  const [phone, setPhone] = useState("");
  const [touched, setTouched] = useState(false);

  const isValid = pharmacy.trim().length > 1 && city.trim().length > 1;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!isValid) return;

    const lines = [
      "Bonjour, je souhaite une démo de Pharmacie+.",
      `Pharmacie : ${pharmacy.trim()}`,
      `Ville : ${city.trim()}`,
    ];
    if (phone.trim()) lines.push(`Téléphone : ${phone.trim()}`);

    const message = lines.join("\n");
    const link = `https://wa.me/${CONTACT.whatsappNumber}?text=${encodeURIComponent(message)}`;
    window.open(link, "_blank", "noopener,noreferrer");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-md mx-auto rounded-[24px] bg-white dark:bg-[#0b1a16] border border-slate-200/70 dark:border-white/10 p-6 sm:p-7 text-left"
    >
      <div className="space-y-3.5">
        <div>
          <label className="text-[13px] font-semibold text-slate-600 dark:text-slate-300">
            Nom de votre pharmacie
          </label>
          <input
            type="text"
            value={pharmacy}
            onChange={(e) => setPharmacy(e.target.value)}
            placeholder="Ex. Pharmacie Dupont"
            className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#050e0c] px-4 py-2.5 text-[14px] text-[var(--color-ink)] dark:text-white outline-none focus:border-emerald-400 transition-colors"
          />
          {touched && pharmacy.trim().length <= 1 && (
            <p className="mt-1 text-[12px] text-red-500">Ce champ est requis.</p>
          )}
        </div>

        <div>
          <label className="text-[13px] font-semibold text-slate-600 dark:text-slate-300">
            Ville
          </label>
          <input
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Ex. Dschang"
            className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#050e0c] px-4 py-2.5 text-[14px] text-[var(--color-ink)] dark:text-white outline-none focus:border-emerald-400 transition-colors"
          />
          {touched && city.trim().length <= 1 && (
            <p className="mt-1 text-[12px] text-red-500">Ce champ est requis.</p>
          )}
        </div>

        <div>
          <label className="text-[13px] font-semibold text-slate-600 dark:text-slate-300">
            Téléphone <span className="text-slate-400 font-normal">(optionnel)</span>
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+237 6 XX XX XX XX"
            className="mt-1.5 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#050e0c] px-4 py-2.5 text-[14px] text-[var(--color-ink)] dark:text-white outline-none focus:border-emerald-400 transition-colors"
          />
        </div>
      </div>

      <button
        type="submit"
        data-umami-event="qualified-form-submit"
        className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-5 py-3 text-[14px] font-bold text-white border-none cursor-pointer transition-colors"
      >
        <Send size={15} />
        Continuer sur WhatsApp
      </button>
      <p className="mt-3 text-[11px] text-center text-slate-400">
        Ouvre WhatsApp avec votre message pré-rempli — vous gardez le contrôle avant l&apos;envoi.
      </p>
    </form>
  );
}
