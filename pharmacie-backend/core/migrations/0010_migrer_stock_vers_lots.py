from django.db import migrations


def migrer_stock_existant_vers_lots(apps, schema_editor):
    """
    🔧 CHANTIER LOTS/FEFO : chaque Produit ayant déjà du stock devient un LotProduit unique,
    reprenant EXACTEMENT sa quantité et sa péremption actuelles (aucune perte de données).
    Les produits à quantite=0 n'ont rien à migrer (aucun lot créé, cache déjà cohérent : 0).
    Le champ historique `Produit.lot` (texte libre) est repris tel quel comme `numero_lot`.
    """
    Produit = apps.get_model('core', 'Produit')
    LotProduit = apps.get_model('core', 'LotProduit')

    lots_a_creer = [
        LotProduit(
            produit=produit,
            numero_lot=produit.lot,
            quantite_initiale=produit.quantite,
            quantite_restante=produit.quantite,
            date_peremption=produit.date_expiration,
            note="Migration initiale FEFO (stock repris tel quel)",
        )
        for produit in Produit.objects.filter(quantite__gt=0)
    ]
    LotProduit.objects.bulk_create(lots_a_creer)


def revenir_en_arriere(apps, schema_editor):
    """
    ⏪ Rollback : supprime uniquement les lots créés par cette migration (reconnaissables à
    leur note dédiée) -- Produit.quantite/date_expiration ne sont pas touchés par ce
    rollback : ce sont déjà les valeurs d'origine, la migration ne les a jamais modifiées.
    """
    LotProduit = apps.get_model('core', 'LotProduit')
    LotProduit.objects.filter(note="Migration initiale FEFO (stock repris tel quel)").delete()


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0009_mouvement_stock_note_lotproduit_mouvement_stock_lot_and_more'),
    ]

    operations = [
        migrations.RunPython(migrer_stock_existant_vers_lots, revenir_en_arriere),
    ]
