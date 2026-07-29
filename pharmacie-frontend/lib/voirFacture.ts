import apiClient from "./apiClient";

/**
 * 🖨️ Ouvre DIRECTEMENT la boîte de dialogue d'impression du navigateur sur un PDF servi par
 * l'API (facture, rapport financier, inventaire, alertes...), sans jamais afficher d'onglet
 * intermédiaire visible.
 *
 * 🔧 CORRECTIF (comportement jugé peu pratique) : "voir la facture" ouvrait auparavant le PDF
 * dans un nouvel onglet (window.open), laissant l'utilisateur cliquer lui-même sur l'icône
 * d'impression du lecteur PDF du navigateur -- une étape de trop pour un geste répété à chaque
 * vente. On charge maintenant le PDF dans une <iframe> invisible et on déclenche .print()
 * dessus dès qu'elle a fini de charger : la boîte de dialogue d'impression système s'ouvre
 * directement, sans onglet visible ni clic supplémentaire.
 *
 * Pourquoi une iframe cachée plutôt que window.open(url).print() : la plupart des
 * navigateurs bloquent ou retardent l'appel .print() sur une fenêtre tout juste ouverte
 * (popup), et le rendu du PDF dans ce nouvel onglet n'est pas toujours prêt au moment de
 * l'appel -- l'iframe, elle, reste dans la page courante et son évènement `onload` garantit
 * que le PDF est bien chargé avant d'imprimer.
 *
 * Pourquoi récupérer le PDF en `blob` via apiClient plutôt qu'une simple URL directe : ces
 * routes exigent un jeton JWT dans l'en-tête Authorization (compte client comme personnel),
 * or une <iframe src="..."> ne permet jamais d'attacher un en-tête personnalisé -- ce serait
 * un 401 systématique.
 *
 * 🔧 CORRECTIF (rapports financier/stock, bug distinct et plus grave que ci-dessus) : les
 * pages app/admin/rapports/print/page.tsx et app/admin/stocks/print/page.tsx RECRÉAIENT le
 * rapport en React à partir des données brutes (boss-dashboard), au lieu d'imprimer le VRAI
 * PDF généré par WeasyPrint -- un document totalement différent (une seule page, données
 * différentes de celles du vrai rapport) qui, en plus, déclenchait window.print() sur un
 * simple délai fixe de 300ms SANS attendre que le rendu (ni même le logo, chargé par une
 * requête réseau séparée) soit réellement terminé -- d'où les aperçus Windows figés sur
 * "Génération..." vus en test. Pire : app/admin/rapports/page.tsx déclenchait LUI-MÊME un
 * second window.print() en plus de celui du composant enfant -- jusqu'à 3 déclenchements
 * cumulés (aggravés par le double-appel des effets React en mode strict). imprimerPdf()
 * ci-dessous, utilisée pour CES DEUX rapports également, élimine cette duplication : un seul
 * appel réseau qui n'aboutit qu'une fois le PDF réel intégralement reçu, un seul print().
 */
export async function imprimerPdf(url: string, nomPourErreur = "le document"): Promise<void> {
  try {
    const response = await apiClient.get(url, { responseType: "blob" });
    const blob = new Blob([response.data], { type: "application/pdf" });
    const objectUrl = window.URL.createObjectURL(blob);

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    iframe.setAttribute("aria-hidden", "true");

    iframe.onload = () => {
      // Petit délai : certains navigateurs ont besoin d'un instant supplémentaire pour finir
      // de peindre le PDF dans l'iframe avant que .print() ne produise un aperçu correct.
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      }, 150);
    };

    iframe.src = objectUrl;
    document.body.appendChild(iframe);

    // Nettoyage différé : l'iframe (et l'URL locale qu'elle affiche) doit rester en vie le
    // temps que l'utilisateur consulte/imprime réellement l'aperçu.
    setTimeout(() => {
      document.body.removeChild(iframe);
      window.URL.revokeObjectURL(objectUrl);
    }, 60000);
  } catch (err) {
    console.error(`Erreur d'impression de ${nomPourErreur}:`, err);
    alert(`Impossible d'imprimer ${nomPourErreur}. Vérifiez vos droits d'accès.`);
  }
}

/** 🧾 Facture d'une commande précise (voir imprimerPdf ci-dessus pour le détail). */
export async function voirFacturePdf(commandeId: number | string): Promise<void> {
  return imprimerPdf(`/api/facture-pdf/${commandeId}/`, "la facture PDF");
}
