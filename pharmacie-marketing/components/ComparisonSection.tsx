import { Check, X, Minus } from "lucide-react";
import { Reveal } from "./Reveal";

type Cell = "yes" | "no" | "partial";

const rows: { label: string; manual: Cell; app: Cell }[] = [
  { label: "Suivi du stock en temps réel", manual: "no", app: "yes" },
  { label: "Alerte avant rupture de stock", manual: "no", app: "yes" },
  { label: "Recherche d'un produit", manual: "partial", app: "yes" },
  { label: "Vérification des paiements Mobile Money", manual: "partial", app: "yes" },
  { label: "Ordonnances centralisées et tracées", manual: "no", app: "yes" },
  { label: "Rapports de vente automatiques", manual: "no", app: "yes" },
  { label: "Accès depuis plusieurs postes", manual: "partial", app: "yes" },
  { label: "Protégé contre les erreurs de calcul et pertes de cahier", manual: "no", app: "yes" },
];

function CellIcon({ value }: { value: Cell }) {
  if (value === "yes") {
    return (
      <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-emerald-50 dark:bg-emerald-500/10">
        <Check size={15} className="text-emerald-600" />
      </span>
    );
  }
  if (value === "partial") {
    return (
      <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-amber-50 dark:bg-amber-500/10">
        <Minus size={15} className="text-amber-500" />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-slate-100 dark:bg-white/5">
      <X size={15} className="text-slate-400" />
    </span>
  );
}

export function ComparisonSection() {
  return (
    <section className="relative bg-white dark:bg-[#050e0c] py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <Reveal className="text-center">
          <span className="text-[12px] font-mono uppercase tracking-[0.2em] text-emerald-600">
            Pourquoi changer
          </span>
          <h2 className="mt-4 font-display font-bold text-[var(--color-ink)] dark:text-white text-4xl sm:text-5xl leading-[1.1] tracking-tight">
            Le cahier a fait son temps.
          </h2>
        </Reveal>

        <Reveal delay={0.1} className="mt-12">
          <div className="rounded-[28px] border border-slate-200/70 dark:border-white/10 overflow-hidden bg-white dark:bg-[#0b1a16]">
            <div className="grid grid-cols-[1fr_auto_auto] items-center px-4 sm:px-8 py-4 bg-[var(--color-mist)] dark:bg-white/[0.03] border-b border-slate-200/70 dark:border-white/10">
              <span className="text-[11px] sm:text-[12px] font-semibold text-slate-400 uppercase tracking-wide">Fonctionnalité</span>
              <span className="text-[10px] sm:text-[12px] font-semibold text-slate-400 uppercase tracking-wide text-center w-14 sm:w-20">Cahier / Excel</span>
              <span className="text-[10px] sm:text-[12px] font-semibold text-emerald-600 uppercase tracking-wide text-center w-14 sm:w-20">Pharmacie+</span>
            </div>
            {rows.map((row, i) => (
              <div
                key={row.label}
                className={`grid grid-cols-[1fr_auto_auto] items-center px-4 sm:px-8 py-4 ${
                  i % 2 === 1 ? "bg-slate-50/50 dark:bg-white/[0.015]" : ""
                }`}
              >
                <span className="text-[13px] sm:text-[14px] text-slate-700 dark:text-slate-300 pr-2 sm:pr-4">{row.label}</span>
                <span className="flex justify-center w-14 sm:w-20">
                  <CellIcon value={row.manual} />
                </span>
                <span className="flex justify-center w-14 sm:w-20">
                  <CellIcon value={row.app} />
                </span>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
