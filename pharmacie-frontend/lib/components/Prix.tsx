"use client";
import { useConfigPharmacie } from '../context/ConfigPharmacieContext';

/**
 * 💰 COMPOSANT <Prix> CENTRALISÉ
 *
 * Avant ce composant, "FCFA" était codé en dur dans ~12 fichiers frontend,
 * alors que PharmacieConfig.devise_preferee existe côté backend et est
 * configurable par tenant depuis /admin/settings — mais n'était presque
 * jamais lu côté frontend.
 *
 * Utilisation :
 *   <Prix montant={1800} />              → "1 800 FCFA"
 *   <Prix montant="2500.00" />           → "2 500 FCFA"  (DRF renvoie parfois des strings)
 *   <Prix montant={1800} className="text-emerald-600 font-black" />
 *
 * Le composant :
 * - Accepte number OU string (DecimalField DRF → "1010.00")
 * - Arrondit à l'entier (les devises CEMAC n'ont pas de centimes en usage réel)
 * - Formate avec séparateur de milliers via toLocaleString('fr-FR')
 * - Lit la devise depuis ConfigPharmacieContext (un seul appel API au démarrage,
 *   partagé dans toute l'app via ConfigPharmacieProvider dans layout.tsx)
 * - Fallback "FCFA" si la config n'est pas encore chargée (évite un flash vide)
 */

interface PrixProps {
  montant: number | string | null | undefined;
  className?: string;
}

// Symboles/labels d'affichage par code devise (cohérent avec PharmacieConfig.DEVISES)
const LABELS_DEVISE: Record<string, string> = {
  FCFA: 'FCFA',
  EUR: '€',
  USD: '$',
};

export default function Prix({ montant, className }: PrixProps) {
  const { config } = useConfigPharmacie();

  // Normalise : string "1010.00" → number 1010, null/undefined → 0
  const valeur = Math.round(Number(montant ?? 0));

  const devise = config?.devise_preferee ?? 'FCFA';
  const label = LABELS_DEVISE[devise] ?? devise;

  // Formatage : séparateur de milliers, locale française (1 800 plutôt que 1,800)
  const montantFormate = valeur.toLocaleString('fr-FR');

  // Positionnement du symbole : après le montant pour FCFA, avant pour EUR/USD
  const affichage = devise === 'FCFA'
    ? `${montantFormate} ${label}`
    : `${label}${montantFormate}`;

  return (
    <span className={className}>
      {affichage}
    </span>
  );
}
