import {
  Pill, Flame, Thermometer, Droplet, Activity, Waves, Wind,
  HeartPulse, Syringe, Shield, Bug, Sparkles, Brain, Moon,
  Heart, Citrus, Leaf, ShieldCheck, type LucideIcon,
} from "lucide-react";

// 🎨 (30/07) En attendant que de vraies photos soient disponibles par catégorie (prévu par
// le porteur du projet), chaque catégorie a une icône dédiée plutôt qu'un pictogramme
// générique répété -- couvre les 30 valeurs de Produit.CATEGORIES (core/models.py).
export const CATEGORIE_ICONS: Record<string, LucideIcon> = {
  antalgique: Pill,
  anti_inflam: Flame,
  antipyrétique: Thermometer,
  anti_acide: Droplet,
  antispasmodique: Activity,
  antidiarrhéique: Waves,
  laxatif: Waves,
  antidiabétique: Syringe,
  antihypertenseur: HeartPulse,
  anticoagulant: Droplet,
  antiagrégant: Droplet,
  hypolipémiant: Heart,
  antibiotique: Bug,
  antiviral: Shield,
  antifongique: Bug,
  antihistaminique: Wind,
  bronchodilatateur: Wind,
  antitussif: Wind,
  expectorant: Wind,
  anxiolytique: Brain,
  hypnotique: Moon,
  antidépresseur: Brain,
  neuroleptique: Brain,
  dermo_corticoide: Sparkles,
  antiseptique: ShieldCheck,
  contraceptif: Heart,
  vitamine: Citrus,
  complement: Leaf,
  homeopathie: Leaf,
  phytotherapie: Leaf,
};

export function iconePourCategorie(code: string): LucideIcon {
  return CATEGORIE_ICONS[code] || Pill;
}

// Sous-ensemble mis en avant sur l'accueil (grille rapide), chacune avec sa propre teinte --
// fidèle à la grille colorée de la référence fournie (bleu/vert/rose/jaune), pas des tuiles
// toutes identiques comme dans la première tentative.
export const CATEGORIES_ACCUEIL: { code: string; label: string; bg: string; fg: string }[] = [
  { code: "antalgique", label: "Douleur", bg: "bg-blue-50 dark:bg-blue-500/10", fg: "text-blue-500" },
  { code: "antibiotique", label: "Infections", bg: "bg-emerald-50 dark:bg-emerald-500/10", fg: "text-emerald-500" },
  { code: "vitamine", label: "Vitamines", bg: "bg-amber-50 dark:bg-amber-500/10", fg: "text-amber-500" },
  { code: "antihistaminique", label: "Allergies", bg: "bg-rose-50 dark:bg-rose-500/10", fg: "text-rose-500" },
];
