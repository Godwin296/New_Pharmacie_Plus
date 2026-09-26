from django.db import models


class HoraireOuverture(models.Model):
    """
    Horaires d'ouverture d'une pharmacie, un jour de la semaine = une ligne (maquette 22/09 :
    "Lun-Sam : 8h30 - 20h00" + statut "Ouvert jusqu'à 20:00" / "Fermé" calculé en temps réel).

    Schéma PUBLIC (comme tenants.Pharmacie) : la marketplace liste des pharmacies de plusieurs
    schémas tenant en une seule requête, donc ces horaires ne peuvent pas vivre par-tenant.
    """

    JOURS = [
        (0, 'Lundi'), (1, 'Mardi'), (2, 'Mercredi'), (3, 'Jeudi'),
        (4, 'Vendredi'), (5, 'Samedi'), (6, 'Dimanche'),
    ]

    pharmacie = models.ForeignKey(
        'tenants.Pharmacie', on_delete=models.CASCADE, related_name='horaires',
    )
    jour_semaine = models.PositiveSmallIntegerField(choices=JOURS)
    ferme = models.BooleanField(default=False, verbose_name="Fermé ce jour-là")
    heure_ouverture = models.TimeField(null=True, blank=True)
    heure_fermeture = models.TimeField(null=True, blank=True)

    class Meta:
        unique_together = [('pharmacie', 'jour_semaine')]
        ordering = ['jour_semaine']

    def __str__(self):
        if self.ferme:
            return f"{self.pharmacie.nom} — {self.get_jour_semaine_display()} : fermé"
        return f"{self.pharmacie.nom} — {self.get_jour_semaine_display()} : {self.heure_ouverture}-{self.heure_fermeture}"
