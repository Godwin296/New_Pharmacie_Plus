"use client";

import { useConfigPharmacie } from "../lib/context/ConfigPharmacieContext";

/**
 * 🏷️ Affiche le LOGO RÉEL du tenant (PharmacieConfig.logo, uploadé dans
 * /admin/settings), plutôt que l'icône générique "Pharmacie+" codée en dur --
 * même bug historique que PharmacyBrandName.tsx, mais pour l'image plutôt que
 * le nom : seule app/page.tsx (l'accueil) affichait le vrai logo du tenant ;
 * partout ailleurs (splash screen, nav générique, en-tête admin, connexion,
 * inscription), l'icône par défaut restait affichée quel que soit le logo
 * réellement uploadé par l'officine.
 *
 * Doit être rendu à l'intérieur de <ConfigPharmacieProvider> (voir layout.tsx).
 * Pendant le chargement initial (ou si aucun logo n'a encore été uploadé), on
 * retombe sur l'icône par défaut plutôt que d'afficher une image cassée.
 */
export function PharmacyIcon({
  className,
  alt = "Logo",
}: {
  className?: string;
  alt?: string;
}) {
  const { config } = useConfigPharmacie();
  return (
    <img
      src={config?.logo || "/branding/icon-mark.png"}
      alt={alt}
      className={className}
    />
  );
}
