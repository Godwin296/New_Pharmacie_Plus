import apiClient from "./apiClient";

/**
 * 🧾 Ouvre la facture PDF (vraie facture professionnelle générée par WeasyPrint,
 * core/templates/core/Caisse/facture_pdf.html) dans un nouvel onglet.
 *
 * 🔴 CORRECTIF (bug remonté en test, session du 20/07) : "voir la facture" pointait vers
 * la page React `/facture?id=...` (cartes très arrondies, style jugé peu professionnel
 * par le porteur du projet) au lieu du PDF officiel -- alors que ce PDF existe déjà,
 * fonctionne, et que le backend a même été pensé pour ça (`Content-Disposition: inline`
 * dans `export_facture_pdf`, cf. core/views.py).
 *
 * Pourquoi ne pas juste faire `window.open('/api/facture-pdf/id/')` directement : cette
 * route exige un jeton JWT dans l'en-tête Authorization (compte client comme personnel),
 * or `window.open` ne permet JAMAIS d'attacher un en-tête personnalisé à une simple
 * navigation -- ce serait un 401 systématique. On récupère donc le PDF en tant que
 * `blob` via `apiClient` (qui attache déjà le jeton automatiquement), puis on ouvre une
 * URL locale temporaire pointant vers ce blob -- même principe déjà utilisé et fiable
 * pour le TÉLÉCHARGEMENT du PDF (`caisse/archives/page.tsx`), simplement `window.open`
 * au lieu de forcer un téléchargement, pour une consultation immédiate dans un nouvel onglet.
 */
export async function voirFacturePdf(commandeId: number | string): Promise<void> {
  try {
    const response = await apiClient.get(`/api/facture-pdf/${commandeId}/`, {
      responseType: "blob",
    });
    const blob = new Blob([response.data], { type: "application/pdf" });
    const url = window.URL.createObjectURL(blob);
    window.open(url, "_blank");
    // Révocation différée : le nouvel onglet a besoin d'un instant pour charger le blob
    // avant que l'URL locale ne soit invalidée.
    setTimeout(() => window.URL.revokeObjectURL(url), 30000);
  } catch (err) {
    console.error("Erreur d'ouverture de la facture PDF:", err);
    alert("Impossible d'afficher la facture PDF. Vérifiez vos droits d'accès.");
  }
}
