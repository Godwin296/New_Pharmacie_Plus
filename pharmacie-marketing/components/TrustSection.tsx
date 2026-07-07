import { Lock, Wifi, Coins, Languages } from "lucide-react";
import { Reveal } from "./Reveal";

const points = [
  {
    icon: Lock,
    title: "Isolation totale des données",
    text: "Architecture multi-tenant par schéma PostgreSQL : chaque pharmacie possède son propre espace, strictement isolé des autres.",
  },
  {
    icon: Wifi,
    title: "Pensé pour les connexions instables",
    text: "Pages allégées, mise en cache, et une application installable qui reste utilisable même quand le réseau faiblit.",
  },
  {
    icon: Coins,
    title: "FCFA natif, Mobile Money local",
    text: "Aucune conversion de devise. Orange Money et MTN MoMo intégrés dès le premier jour.",
  },
  {
    icon: Languages,
    title: "Pensé et développé au Cameroun",
    text: "Une équipe qui connaît le terrain : les ruptures de stock, les ordonnances manuscrites, les réalités d'une officine en Afrique Centrale.",
  },
];

export function TrustSection() {
  return (
    <section id="confiance" className="relative bg-[var(--color-ink)] py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <Reveal className="max-w-2xl">
          <span className="text-[12px] font-mono uppercase tracking-[0.2em] text-emerald-400">
            Fondations
          </span>
          <h2 className="mt-4 font-display font-bold text-white text-4xl sm:text-5xl leading-[1.1] tracking-tight">
            Construit pour durer, pas pour démontrer.
          </h2>
        </Reveal>

        <div className="mt-14 grid sm:grid-cols-2 gap-px rounded-[28px] overflow-hidden bg-white/10">
          {points.map((p, i) => (
            <Reveal key={p.title} delay={i * 0.06}>
              <div className="h-full bg-[var(--color-ink)] p-8 hover:bg-[var(--color-ink-soft)] transition-colors">
                <p.icon className="h-6 w-6 text-emerald-400" />
                <h3 className="mt-5 font-display font-bold text-lg text-white">
                  {p.title}
                </h3>
                <p className="mt-2.5 text-[14px] leading-relaxed text-white/50">
                  {p.text}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
