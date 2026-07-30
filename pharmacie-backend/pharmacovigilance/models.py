"""
💊 PHARMACOVIGILANCE -- interactions médicamenteuses.

⚖️ DÉCISION D'ARCHITECTURE : app SHARED (schéma "public"), PAS TENANT_APPS. Contrairement
à `Produit` ou `Commande` (données propres à chaque pharmacie cliente), une interaction
médicamenteuse est un FAIT MÉDICAL UNIVERSEL -- vrai pour toute pharmacie, à Douala comme
ailleurs. La dupliquer par tenant obligerait à ressaisir/corriger la même donnée dans
chaque schéma séparément, pour un fait qui ne dépend d'aucune pharmacie en particulier.
Une seule copie dans le schéma public, gérée par la plateforme (Django admin), consultée
par toutes les pharmacies clientes.

📚 SOURCE ET LIMITES (honnêteté importante sur une fonctionnalité de sécurité patient) :
Le jeu de règles initial (voir migration de données / fixture associée) est une sélection
DÉLIBÉRÉMENT RESTREINTE d'interactions parmi les mieux établies et les plus fréquemment
citées (sourcées sur le Thésaurus des interactions médicamenteuses de l'ANSM et la
littérature pharmacologique de référence) -- PAS une base de données médicale exhaustive
et certifiée comme Vidal ou Thériaque. Ce module est un GARDE-FOU D'APPOINT qui vient
s'ajouter à la vigilance du pharmacien, jamais un substitut à son jugement professionnel.
La table est conçue pour être enrichie progressivement (via le Django admin, schéma
public) au fil du temps, pas figée.

🔬 GRANULARITÉ : les règles portent sur des PRINCIPES ACTIFS (DCI -- Dénomination Commune
Internationale), pas sur des noms de marque ni sur les catégories larges de `Produit`
(30 classes génériques type "antalgique", bien trop grossières pour ce usage -- tous les
antalgiques n'interagissent pas entre eux de la même façon, loin de là). C'est le niveau
de granularité correct en pharmacologie : Doliprane et Dafalgan sont tous deux du
paracétamol, donc concernés par les mêmes règles, sans avoir à les lister individuellement.
"""
from django.db import models


class PrincipeActif(models.Model):
    """
    Un principe actif (DCI), avec ses synonymes/noms de marque connus pour aider au
    rapprochement -- `Produit.principe_actif` (champ texte libre saisi par le pharmacien,
    voir core/models.py) ne suivra pas toujours exactement la même orthographe que la
    DCI officielle ("aspirine" vs "acide acétylsalicylique" par exemple).
    """
    nom = models.CharField(max_length=150, unique=True, verbose_name="Principe actif (DCI)")
    alias = models.TextField(
        blank=True,
        verbose_name="Synonymes / noms de marque courants (séparés par des virgules)",
        help_text="Ex. pour 'acide acétylsalicylique' : aspirine, aspegic, kardegic",
    )

    class Meta:
        verbose_name = "Principe actif"
        verbose_name_plural = "Principes actifs"
        ordering = ["nom"]

    def __str__(self):
        return self.nom

    def noms_normalises(self):
        """
        Retourne l'ensemble de tous les noms reconnus pour ce principe actif (nom canonique
        + alias), chacun normalisé (minuscules, sans accents) pour un rapprochement robuste
        avec le texte libre saisi côté `Produit.principe_actif`.
        """
        from .detection import normaliser_texte  # import local : évite un cycle au chargement des apps
        noms = [self.nom] + [a.strip() for a in self.alias.split(",") if a.strip()]
        return {normaliser_texte(n) for n in noms}


class InteractionMedicamenteuse(models.Model):
    """
    Une règle d'interaction entre DEUX principes actifs, avec le niveau de gravité et la
    conduite à tenir recommandée.

    Gravité : reprend la classification officielle à 4 niveaux du Thésaurus des
    interactions médicamenteuses de l'ANSM (pas une échelle maison) -- c'est le référentiel
    professionnel que connaissent déjà les pharmaciens, pas la peine d'en réinventer un.
    """
    GRAVITE_CHOICES = [
        ("contre_indication", "Contre-indication ⛔ (association à ne jamais faire)"),
        ("association_deconseillee", "Association déconseillée 🚫 (à éviter, sauf avis médical exprès)"),
        ("precaution_emploi", "Précaution d'emploi ⚠️ (association possible sous surveillance)"),
        ("a_prendre_en_compte", "À prendre en compte ℹ️ (risque plus faible, à mentionner)"),
    ]

    # ⚠️ Pas de contrainte d'ordre entre A et B (une règle "A+B" et "B+A" désignent la même
    # interaction) -- la logique de détection (voir detection.py) teste les deux sens.
    principe_actif_a = models.ForeignKey(
        PrincipeActif, on_delete=models.CASCADE, related_name="interactions_en_tant_que_a"
    )
    principe_actif_b = models.ForeignKey(
        PrincipeActif, on_delete=models.CASCADE, related_name="interactions_en_tant_que_b"
    )
    gravite = models.CharField(max_length=30, choices=GRAVITE_CHOICES)
    description = models.TextField(verbose_name="Mécanisme / risque encouru")
    conduite_a_tenir = models.TextField(
        blank=True,
        verbose_name="Conduite à tenir recommandée",
        help_text="Ex. : surveillance biologique renforcée, espacer les prises, contacter le prescripteur...",
    )
    source = models.CharField(
        max_length=255, blank=True,
        verbose_name="Source",
        help_text="Ex. : Thésaurus ANSM (version/date), pour traçabilité et mise à jour ultérieure",
    )

    class Meta:
        verbose_name = "Interaction médicamenteuse"
        verbose_name_plural = "Interactions médicamenteuses"
        # Empêche d'enregistrer deux fois la même paire dans le même sens (n'empêche pas
        # un doublon inversé A/B vs B/A -- accepté comme limite mineure, l'admin qui
        # saisit les règles reste attentif ; le detection.py, lui, gère les deux sens
        # correctement peu importe comment la règle a été enregistrée).
        unique_together = [("principe_actif_a", "principe_actif_b")]
        ordering = ["gravite", "principe_actif_a__nom"]

    def __str__(self):
        return f"{self.principe_actif_a} + {self.principe_actif_b} ({self.get_gravite_display()})"
