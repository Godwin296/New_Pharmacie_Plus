/**
 * 🚀 MODE OFFLINE (session 12/07, brique 3/4) : rejoue la file d'attente panier contre le
 * serveur (POST /api/panier/, un item à la fois, dans l'ordre d'ajout -- FIFO) dès que le
 * réseau est disponible.
 *
 * ⚠️ Le serveur reste l'unique source de vérité sur le stock (core/api.py::api_panier) --
 * cette synchro ne fait AUCUNE hypothèse d'optimisme sur le résultat : chaque item est
 * revalidé un par un, un stock devenu insuffisant entre l'ajout hors-ligne et le retour du
 * réseau est une erreur normale et attendue, pas un bug.
 */
import apiClient from "../apiClient";
import {
  ItemFileAttente,
  listerFileAttente,
  supprimerDeFileAttente,
  marquerStatutFileAttente,
} from "./panierQueue";

export interface ResultatSynchro {
  succes: number;
  echecs: number;
  restants: number; // ex: réseau reperdu en cours de route -- ces items restent 'en_attente'
}

let synchroEnCours = false; // 🔒 anti-réentrance : évite deux synchros simultanées (ex: event 'online' + bouton manuel cliqués en même temps), qui rejoueraient les mêmes items en double côté serveur
// ⚠️ Ce verrou est posé de façon SYNCHRONE (avant tout `await`) -- important car il peut y
// avoir PLUSIEURS instances de useOfflinePanier() montées en même temps (ex: badge de la nav
// dans app/layout.tsx ET la page /panier simultanément) : l'évènement navigateur 'online'
// déclenche leurs listeners les uns après les autres de façon SYNCHRONE (JS mono-thread, pas
// d'interleaving), donc le 2e appel à synchroniserFileAttente() voit déjà `synchroEnCours ===
// true` posé par le 1er avant même son premier `await` -- pas de vraie race condition ici,
// mais NE PAS déplacer la lecture/écriture de ce flag après un point d'`await`.

export async function synchroniserFileAttente(): Promise<ResultatSynchro> {
  if (synchroEnCours) {
    return { succes: 0, echecs: 0, restants: (await listerFileAttente()).length };
  }
  synchroEnCours = true;
  let succes = 0;
  let echecs = 0;

  try {
    const file = await listerFileAttente();

    for (const item of file) {
      // Un item déjà marqué "erreur" (ex: stock insuffisant constaté lors d'une synchro
      // précédente) n'est PAS rejoué automatiquement à l'infini -- le client doit d'abord
      // le retirer ou l'ajuster explicitement (voir panier/page.tsx), sinon on spammerait
      // le serveur avec une requête vouée à rééchouer à chaque retour de réseau.
      if (item.statut === "erreur") continue;

      try {
        await marquerStatutFileAttente(item, "en_cours");
        await apiClient.post("/api/panier/", {
          produit_id: item.produitId,
          quantite: item.quantite,
        });
        await supprimerDeFileAttente(item.localId);
        succes++;
      } catch (err: any) {
        if (!err?.response) {
          // Toujours pas de réseau (ou serveur injoignable) : on s'arrête là plutôt que
          // d'enchaîner les échecs sur tous les items restants -- ils seront retentés au
          // prochain passage (évènement 'online', bouton manuel...).
          await marquerStatutFileAttente(item, "en_attente");
          break;
        }
        // Le serveur A répondu (400/409...) : erreur métier réelle et définitive pour cet
        // état de la file (ex: "Stock insuffisant") -- pas la peine de la retenter seule,
        // mais ça ne doit PAS bloquer les items suivants de la file.
        const message = err.response?.data?.error || "Impossible d'ajouter ce produit au panier";
        await marquerStatutFileAttente(item, "erreur", message);
        echecs++;
      }
    }
  } finally {
    synchroEnCours = false;
  }

  const restants = (await listerFileAttente()).filter((i) => i.statut !== "erreur").length;
  return { succes, echecs, restants };
}
