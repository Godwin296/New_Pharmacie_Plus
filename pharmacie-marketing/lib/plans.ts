export type Plan = {
  id: string;
  name: string;
  tagline: string;
  monthlyPrice: number | null;
  yearlyPrice: number | null;
  highlighted?: boolean;
  features: string[];
  notIncluded?: string[];
};

export const PLANS: Plan[] = [
  {
    id: "essentiel",
    name: "Essentiel",
    tagline: "Digitalisez le stock et la caisse de votre officine.",
    monthlyPrice: 15000,
    yearlyPrice: 150000,
    features: [
      "Gestion du stock en temps réel avec alertes de rupture",
      "Vente au guichet (caisse rapide dédiée)",
      "Encaissement Mobile Money (Orange Money, MTN MoMo) avec vérification avant décrémentation du stock",
      "Tickets de caisse et factures imprimables (format thermique 80mm)",
      "Dashboard : chiffre d'affaires cash / en ligne",
      "1 compte administrateur + comptes caissière illimités",
      "Isolation totale de vos données (schéma dédié à votre pharmacie)",
      "Support par WhatsApp",
    ],
    notIncluded: [
      "Boutique en ligne pour vos patients",
      "Upload et validation d'ordonnances à distance",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "Ouvrez votre officine en ligne à vos patients.",
    monthlyPrice: 25000,
    yearlyPrice: 250000,
    highlighted: true,
    features: [
      "Tout le forfait Essentiel",
      "Boutique en ligne pour vos patients (catalogue, recherche, commande depuis leur téléphone)",
      "Suivi de commande en temps réel côté patient (mise à jour instantanée)",
      "Upload sécurisé d'ordonnances (vérification automatique + validation par le pharmacien)",
      "Application installable sur le téléphone du patient (PWA, sans passer par un store)",
      "Rapports et exports PDF avancés",
      "Support prioritaire",
    ],
  },
  {
    id: "reseau",
    name: "Réseau",
    tagline: "Plusieurs officines sous la même enseigne.",
    monthlyPrice: null,
    yearlyPrice: null,
    features: [
      "Tout le forfait Pro, pour chaque officine",
      "Tarif dégressif selon le nombre de pharmacies",
      "Accompagnement dédié à la mise en place",
      "Interlocuteur unique pour tout le réseau",
    ],
  },
];

export const PILOT_OFFER = {
  title: "Programme pilote",
  description:
    "Les toutes premières pharmacies à rejoindre Pharmacie+ bénéficient d'un essai gratuit de 30 jours, puis d'un tarif de lancement réduit de moitié pendant les 3 premiers mois — en échange de vos retours pour continuer à améliorer le produit.",
};
