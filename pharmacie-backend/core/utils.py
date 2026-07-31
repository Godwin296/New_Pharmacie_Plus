import qrcode
import base64
import mimetypes
from io import BytesIO
from django.contrib.staticfiles import finders

def generate_qr_base64(data_string):
    try:
        # 1. Création du QR Code
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(str(data_string)) # On force en string pour éviter les erreurs
        qr.make(fit=True)

        # 2. Création de l'image
        img = qr.make_image(fill_color="black", back_color="white")

        # 3. Conversion en Base64
        buffered = BytesIO()
        img.save(buffered, format="PNG")
        img_str = base64.b64encode(buffered.getvalue()).decode()
        
        return f"data:image/png;base64,{img_str}"
    except Exception as e:
        print(f"Erreur lors de la génération du QR : {e}")
        return "" # Retourne vide au lieu de faire planter le serveur


# Logo par défaut (paysage) affiché en en-tête des documents PDF quand le tenant n'a pas
# encore uploadé le sien -- cf. pharmacie-frontend/public/branding/README.md, qui désigne
# explicitement ce fichier pour "en-tête de facture/rapport PDF, papier à en-tête".
_LOGO_DEFAUT_STATIC_PATH = "core/branding/logo-defaut-pdf.png"

import re
_EMOJI_PATTERN = re.compile(
    "["
    "\U0001F300-\U0001FAFF"  # symboles/pictogrammes divers, émojis récents
    "\U00002600-\U000027BF"  # symboles divers + dingbats (inclut ❤️ ☀️ ✨)
    "\U0001F1E6-\U0001F1FF"  # drapeaux
    "\uFE0F"                 # variation selector (rend un caractère "emoji-style")
    "]+",
    flags=re.UNICODE,
)


def nettoyer_libelle_pour_pdf(texte):
    """
    🧾 Retire les émojis d'un libellé pour un contexte PDF professionnel (rapports
    destinés à être présentés à un dirigeant/partenaire), SANS toucher aux choix
    `Produit.CATEGORIES` eux-mêmes -- ces émojis restent utiles et volontaires dans
    l'interface de l'application (catalogue, POS...), juste pas dans un document imprimé
    formel. On ne modifie donc jamais les données en base, seulement l'affichage au
    moment de générer le PDF.
    """
    if not texte:
        return texte
    return _EMOJI_PATTERN.sub("", texte).strip()


def obtenir_logo_base64(config):
    """
    🖼️ CORRECTIF (logo systématiquement cassé dans TOUS les PDF -- facture, rapports,
    ticket) : l'ancien code passait une URL HTTP (`request.build_absolute_uri(config.logo.url)`)
    à WeasyPrint, qui doit alors refaire une requête HTTP vers le serveur lui-même pour
    charger l'image. Or `config/urls.py` ne sert `MEDIA_URL` QUE si `settings.DEBUG=True`
    (`if settings.DEBUG: urlpatterns += static(...)`) -- en production (et potentiellement
    selon la config Daphne en dev), cette URL renvoie 404 et le logo ne s'affiche jamais.

    On lit maintenant l'image DIRECTEMENT SUR DISQUE (aucune requête HTTP, donc aucune
    dépendance à la config MEDIA/STATIC servie ou non) et on l'encode en base64 -- même
    principe déjà utilisé et fiable pour le QR code ci-dessus (`generate_qr_base64`).

    Retourne une data-URI ("data:image/<type>;base64,...") prête à l'emploi dans un
    <img src="...">, ou None si vraiment aucune image (logo tenant ET logo par défaut)
    n'a pu être lue -- dans ce cas le template doit prévoir un repli visuel (ex: initiale
    du nom de la pharmacie dans un badge coloré).
    """
    # 1. Priorité au logo propre du tenant, s'il en a uploadé un
    if config and config.logo:
        try:
            with config.logo.open('rb') as f:
                contenu = f.read()
            type_mime = mimetypes.guess_type(config.logo.name)[0] or "image/png"
            return f"data:{type_mime};base64,{base64.b64encode(contenu).decode()}"
        except Exception as e:
            print(f"⚠️ Logo tenant illisible ({config.logo.name}), repli sur le logo par défaut : {e}")

    # 2. Repli sur le logo par défaut de la marque Pharmacie+ (fichier livré avec le code,
    # trouvé via les finders Django -- fonctionne que collectstatic ait tourné ou non)
    chemin_defaut = finders.find(_LOGO_DEFAUT_STATIC_PATH)
    if chemin_defaut:
        try:
            with open(chemin_defaut, 'rb') as f:
                contenu = f.read()
            return f"data:image/png;base64,{base64.b64encode(contenu).decode()}"
        except Exception as e:
            print(f"⚠️ Impossible de lire le logo par défaut : {e}")

    return None


# Alias rétrocompatible : les 4 exports PDF (core/views.py) appelaient cette fonction sous
# son ancien nom avant qu'elle serve aussi à infos_pharmacie (core/api.py) -- pas la peine
# de retoucher 4 call sites pour un simple renommage.
obtenir_logo_base64_pour_pdf = obtenir_logo_base64


def construire_contenu_qr_facture(commande, nom_client):
    """
    🔗 Construit le contenu textuel embarqué dans le QR code d'une facture.

    🐛 CORRECTIF (QR code incomplet sur la facture PDF, remonté en test) : deux
    implémentations INDÉPENDANTES du contenu du QR code coexistaient -- une riche
    (CommandeSerializer.get_qr_code, aperçu React /facture : facture, client, date,
    ARTICLES détaillés, total) et une appauvrie, dupliquée à la main dans
    export_facture_pdf (juste facture, client, total -- sans la liste des articles).
    Un même document affichait donc un QR différent selon qu'on le consultait en
    aperçu ou en PDF téléchargé. Point d'entrée UNIQUE désormais, utilisé par les deux.
    """
    num_facture = f"FAC-{commande.id}"
    date_info = commande.date.strftime('%d/%m/%Y %H:%M') if commande.date else "N/A"

    liste_produits = ""
    for item in commande.items.all():
        nom_p = item.produit.nom[:12]
        liste_produits += f"{item.quantite}x {nom_p}\n"

    total_prix = f"{commande.total()} CFA"

    return (
        f"FACTURE: {num_facture}\n"
        f"CLIENT: {nom_client}\n"
        f"DATE: {date_info}\n"
        f"ARTICLES:\n{liste_produits}"
        f"TOTAL: {total_prix}"
    )