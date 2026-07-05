"use client";

import { useConfigPharmacie } from "../lib/context/ConfigPharmacieContext";

/**
 * 🏷️ Affiche le nom RÉEL du tenant (PharmacieConfig.nom, ex: "Pharmacie Dupont"),
 * plutôt que "PHARMACIE +" codé en dur -- bug historique du nav générique de
 * app/layout.tsx qui affichait le même nom sur TOUS les tenants.
 *
 * Doit être rendu à l'intérieur de <ConfigPharmacieProvider> (voir layout.tsx).
 * Pendant le chargement initial (ou si l'API échoue), on retombe sur "Pharmacie +"
 * plutôt que d'afficher un vide disgracieux le temps du premier appel réseau.
 */
export function PharmacyBrandName({ className }: { className?: string }) {
  const { config } = useConfigPharmacie();
  return <span className={className}>{config?.nom || "Pharmacie +"}</span>;
}
