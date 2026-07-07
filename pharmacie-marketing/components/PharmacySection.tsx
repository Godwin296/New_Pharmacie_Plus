"use client";

import {
  PackageSearch,
  ShieldCheck,
  FileLock2,
  Smartphone,
  BarChart3,
  Users,
} from "lucide-react";
import { motion } from "framer-motion";
import { Reveal } from "./Reveal";
import { TiltCard } from "./TiltCard";

const stockRows = [
  { name: "Paracétamol 500mg", pct: 78 },
  { name: "Amoxicilline 500mg", pct: 34 },
  { name: "Vitamine C 500mg", pct: 9 },
];

export function PharmacySection() {
  return (
    <section id="pharmacies" className="relative bg-[var(--color-mist)] py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Reveal className="max-w-2xl">
          <span className="text-[12px] font-mono uppercase tracking-[0.2em] text-emerald-600">
            Pour votre officine
          </span>
          <h2 className="mt-4 font-display font-bold text-[var(--color-ink)] text-4xl sm:text-5xl leading-[1.1] tracking-tight">
            Tout ce qu&apos;il faut pour piloter votre pharmacie, depuis votre
            téléphone.
          </h2>
          <p className="mt-5 text-[17px] leading-relaxed text-slate-600">
            Fini le stock sur cahier et les ordonnances perdues. Chaque vente,
            chaque paiement, chaque ordonnance est tracé et vérifié — en temps
            réel, même au guichet.
          </p>
        </Reveal>

        <div className="mt-14 grid grid-cols-1 md:grid-cols-6 gap-5">
          {/* Large card — stock en temps réel */}
          <Reveal className="md:col-span-4 md:row-span-2">
            <TiltCard className="h-full">
              <div className="h-full rounded-[28px] bg-white border border-slate-200/70 p-8 shadow-sm hover:shadow-xl hover:shadow-emerald-900/5 transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="rounded-2xl bg-emerald-50 p-3">
                    <PackageSearch className="h-6 w-6 text-emerald-600" />
                  </div>
                  <span className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest text-slate-400">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                    </span>
                    Stock — en direct
                  </span>
                </div>
                <h3 className="mt-6 font-display font-bold text-xl text-[var(--color-ink)]">
                  Suivi de stock en temps réel
                </h3>
                <p className="mt-3 text-[15px] leading-relaxed text-slate-500">
                  Chaque vente décrémente le stock instantanément. Des alertes de
                  rupture vous préviennent avant qu&apos;un médicament essentiel ne
                  manque.
                </p>

                <div className="mt-7 space-y-4">
                  {stockRows.map((row) => (
                    <div key={row.name}>
                      <div className="flex justify-between text-[13px] mb-1.5">
                        <span className="font-medium text-slate-700">{row.name}</span>
                        <span
                          className={`font-mono ${row.pct < 15 ? "text-amber-600" : "text-slate-400"}`}
                        >
                          {row.pct}%
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: `${row.pct}%` }}
                          viewport={{ once: true, margin: "-100px" }}
                          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
                          className={`h-full rounded-full ${row.pct < 15 ? "bg-amber-500" : "bg-emerald-500"}`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TiltCard>
          </Reveal>

          {/* Mobile money */}
          <Reveal delay={0.05} className="md:col-span-2">
            <TiltCard className="h-full">
              <div className="h-full rounded-[28px] bg-brand-deep-soft p-7 shadow-sm hover:shadow-xl hover:shadow-emerald-950/20 transition-shadow">
                <div className="rounded-2xl bg-white/10 p-3 w-fit">
                  <ShieldCheck className="h-6 w-6 text-emerald-400" />
                </div>
                <h3 className="mt-5 font-display font-bold text-lg text-white">
                  Mobile Money vérifié
                </h3>
                <p className="mt-2.5 text-[14px] leading-relaxed text-white/50">
                  Orange Money et MTN MoMo, avec vérification caissière avant
                  décrémentation du stock. Aucun paiement fantôme.
                </p>
              </div>
            </TiltCard>
          </Reveal>

          {/* Ordonnances */}
          <Reveal delay={0.1} className="md:col-span-2">
            <TiltCard className="h-full">
              <div className="h-full rounded-[28px] bg-white border border-slate-200/70 p-7 shadow-sm hover:shadow-xl hover:shadow-blue-900/5 transition-shadow">
                <div className="rounded-2xl bg-blue-50 p-3 w-fit">
                  <FileLock2 className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="mt-5 font-display font-bold text-lg text-[var(--color-ink)]">
                  Ordonnances sécurisées
                </h3>
                <p className="mt-2.5 text-[14px] leading-relaxed text-slate-500">
                  Upload depuis le téléphone, validation par le pharmacien,
                  fichiers vérifiés et re-encodés avant stockage.
                </p>
              </div>
            </TiltCard>
          </Reveal>

          {/* PWA */}
          <Reveal delay={0.15} className="md:col-span-2">
            <div className="h-full rounded-[28px] bg-white border border-slate-200/70 p-7 shadow-sm hover:shadow-lg transition-shadow hover:-translate-y-0.5 duration-300">
              <div className="rounded-2xl bg-emerald-50 p-3 w-fit">
                <Smartphone className="h-6 w-6 text-emerald-600" />
              </div>
              <h3 className="mt-5 font-display font-bold text-lg text-[var(--color-ink)]">
                Installable, comme une app
              </h3>
              <p className="mt-2.5 text-[14px] leading-relaxed text-slate-500">
                Aucun store nécessaire. Ajoutez Pharmacie+ à l&apos;écran d&apos;accueil
                Android en un geste.
              </p>
            </div>
          </Reveal>

          {/* Dashboard */}
          <Reveal delay={0.2} className="md:col-span-3">
            <div className="h-full rounded-[28px] bg-white border border-slate-200/70 p-7 shadow-sm hover:shadow-lg transition-shadow hover:-translate-y-0.5 duration-300">
              <div className="rounded-2xl bg-blue-50 p-3 w-fit">
                <BarChart3 className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="mt-5 font-display font-bold text-lg text-[var(--color-ink)]">
                Dashboard &amp; rapports
              </h3>
              <p className="mt-2.5 text-[14px] leading-relaxed text-slate-500">
                Chiffre d&apos;affaires ventilé cash / en ligne, historique complet,
                exports PDF pour votre comptabilité.
              </p>
            </div>
          </Reveal>

          {/* Multi-role */}
          <Reveal delay={0.25} className="md:col-span-3">
            <div className="h-full rounded-[28px] bg-white border border-slate-200/70 p-7 shadow-sm hover:shadow-lg transition-shadow hover:-translate-y-0.5 duration-300">
              <div className="rounded-2xl bg-emerald-50 p-3 w-fit">
                <Users className="h-6 w-6 text-emerald-600" />
              </div>
              <h3 className="mt-5 font-display font-bold text-lg text-[var(--color-ink)]">
                Un accès par rôle
              </h3>
              <p className="mt-2.5 text-[14px] leading-relaxed text-slate-500">
                Client, caissière, administrateur : chacun ne voit que ce dont
                il a besoin, avec authentification dédiée.
              </p>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.1} className="mt-14 flex flex-col sm:flex-row items-start sm:items-center gap-6 justify-between rounded-[28px] bg-white border border-slate-200/70 p-8">
          <div>
            <h3 className="font-display font-bold text-xl text-[var(--color-ink)]">
              Prêt à moderniser votre officine ?
            </h3>
            <p className="mt-2 text-slate-500 text-[15px]">
              Une démo de 15 minutes suffit pour voir Pharmacie+ tourner avec
              vos propres produits.
            </p>
          </div>
          <a
            href="#contact"
            className="shrink-0 inline-flex items-center justify-center rounded-2xl bg-emerald-600 hover:bg-emerald-500 px-7 py-4 text-[15px] font-bold text-white no-underline transition-colors"
          >
            Demander une démo
          </a>
        </Reveal>
      </div>
    </section>
  );
}
