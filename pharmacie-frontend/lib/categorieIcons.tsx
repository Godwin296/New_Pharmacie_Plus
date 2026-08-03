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

// Sous-ensemble mis en avant sur l'accueil (grille rapide) -- les plus courantes en usage
// officinal quotidien plutôt que les 30 d'un coup, qui noieraient l'écran.
export const CATEGORIES_ACCUEIL = ["antalgique", "antibiotique", "vitamine", "antihistaminique"];
