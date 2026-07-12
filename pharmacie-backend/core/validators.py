"""
🔐 Validation et désinfection des fichiers uploadés par les clients (ordonnances médicales).

Pourquoi ce fichier existe :
Un client peut uploader n'importe quoi sous un nom de fichier qui ment ("ordonnance.jpg" peut
être en réalité un script, un exécutable, ou une image contenant un payload caché après ses
données réelles — technique de stéganographie/"polyglot file"). On ne peut JAMAIS faire confiance :
- au nom de fichier (ex: "ordonnance.pdf" peut être n'importe quoi)
- au Content-Type envoyé par le navigateur (falsifiable très facilement, ex: avec curl)

Stratégie de défense en profondeur (4 couches) :
1. Limite de taille STRICTE, vérifiée avant toute opération coûteuse
2. Détection du type réel par lecture des "magic bytes" (signature binaire du contenu, pas du nom)
3. DÉSINFECTION PAR RECONSTRUCTION : on ne fait jamais confiance au fichier tel quel.
   - Image -> on la redécode pixel par pixel avec Pillow, puis on la réencode entièrement.
     Tout ce qui n'est pas un pixel légitime (payload cabriolet après les données JPEG,
     métadonnées EXIF malveillantes, scripts collés en fin de fichier) disparaît automatiquement,
     car on ne recopie jamais les octets bruts du fichier d'origine.
   - PDF -> on le rouvre avec pikepdf (basé sur qpdf) et on supprime explicitement tout JavaScript
     embarqué et toute action automatique (/JS, /OpenAction, /AA), avant de le réécrire proprement.
4. Nom de fichier généré côté serveur (jamais celui fourni par le client) -> élimine tout risque
   d'injection de chemin ou de caractères spéciaux dans le nom.
"""
import io
import uuid
import logging

import magic
from PIL import Image, ImageOps, UnidentifiedImageError
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import InMemoryUploadedFile

logger = logging.getLogger(__name__)

# Taille maximale acceptée pour une ordonnance : 8 Mo.
# Une photo de prescription correctement compressée tient largement dans cette limite ;
# un PDF scanné multi-pages aussi. On reste généreux pour ne pas frustrer l'utilisateur,
# tout en bloquant les abus (upload de fichiers énormes pour saturer le serveur).
TAILLE_MAX_ORDONNANCE_OCTETS = 8 * 1024 * 1024  # 8 Mo
TAILLE_MAX_ORDONNANCE_MO = TAILLE_MAX_ORDONNANCE_OCTETS // (1024 * 1024)

# Types MIME réellement acceptés, détectés par CONTENU (pas par extension de nom de fichier)
MIME_AUTORISES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "application/pdf": "pdf",
}


def valider_taille(fichier):
    """
    Lève une ValidationError si le fichier dépasse la taille maximale autorisée.
    Cette vérification est volontairement la PREMIÈRE, avant toute lecture de contenu :
    pas la peine de gaspiller du CPU à analyser un fichier qu'on va rejeter de toute façon.
    """
    if fichier.size > TAILLE_MAX_ORDONNANCE_OCTETS:
        taille_recue_mo = round(fichier.size / (1024 * 1024), 1)
        raise ValidationError(
            f"Le fichier est trop volumineux ({taille_recue_mo} Mo). "
            f"Taille maximale acceptée : {TAILLE_MAX_ORDONNANCE_MO} Mo."
        )


def detecter_type_reel(fichier) -> str:
    """
    Détecte le VRAI type du fichier en lisant ses premiers octets (magic bytes),
    indépendamment du nom ou de l'extension fournis par le client.
    Retourne le type MIME détecté, ou lève une ValidationError si le type n'est pas autorisé.
    """
    fichier.seek(0)
    entete = fichier.read(2048)  # quelques Ko suffisent pour identifier le type via libmagic
    fichier.seek(0)

    mime_detecte = magic.from_buffer(entete, mime=True)

    if mime_detecte not in MIME_AUTORISES:
        raise ValidationError(
            "Ce fichier n'est pas reconnu comme une image (JPG/PNG) ou un PDF valide. "
            "Si vous pensez qu'il s'agit d'une erreur, essayez de réenregistrer le document "
            "puis de le charger à nouveau."
        )
    return mime_detecte


def _desinfecter_image(fichier, largeur_max_px=1600, qualite_jpeg=88) -> io.BytesIO:
    """
    Réencode entièrement une image à partir de ses pixels réels.
    Toute donnée cachée en dehors des pixels légitimes (queue de fichier, métadonnées EXIF
    forgées, payload de stéganographie) est éliminée car jamais recopiée.

    `largeur_max_px` / `qualite_jpeg` sont volontairement paramétrables : une ordonnance
    (document médical, doit rester lisible) et une photo de produit catalogue (juste
    illustrative) n'ont pas les mêmes contraintes de qualité -- voir les deux points
    d'entrée `valider_et_desinfecter_ordonnance` et `valider_et_desinfecter_photo_produit`
    ci-dessous, qui appellent cette même fonction avec des réglages différents.
    """
    fichier.seek(0)
    try:
        image = Image.open(fichier)
        image.verify()  # détecte les images structurellement corrompues ou tronquées

        # .verify() invalide l'objet pour un usage normal : on doit le ré-ouvrir pour le traiter
        fichier.seek(0)
        image = Image.open(fichier)
        image.load()
    except (UnidentifiedImageError, OSError, ValueError) as e:
        raise ValidationError(
            "Le fichier image est corrompu ou invalide. Merci d'essayer avec une autre photo."
        ) from e

    # 🔄 ORIENTATION EXIF : un téléphone enregistre souvent l'image "à plat" (capteur) et
    # note juste "tourner de 90°" dans une métadonnée EXIF -- que l'affichage applique
    # automatiquement. Comme on va justement SUPPRIMER ces métadonnées ci-dessous (c'est le
    # but : nettoyage de sécurité), il faut d'abord "figer" cette rotation dans les pixels
    # eux-mêmes, sinon l'ordonnance ressort couchée sur le côté après désinfection.
    image = ImageOps.exif_transpose(image)

    # On force la conversion en RGB : élimine toute palette/canal alpha exotique qui pourrait
    # servir de vecteur d'attaque, et garantit un JPEG de sortie cohérent.
    if image.mode not in ("RGB", "L"):
        image = image.convert("RGB")

    # 📉 REDIMENSIONNEMENT (façon WhatsApp) : une photo de smartphone moderne peut dépasser
    # 3000-4000px de large, ce qui pèse plusieurs Mo même bien compressée en JPEG. On limite
    # la largeur à 1600px, largement suffisant pour la lecture d'une ordonnance à l'écran ou
    # à l'impression, ce qui réduit drastiquement le poids final (utile sur connexion 3G/4G).
    # On ne redimensionne QUE si l'image dépasse la limite : jamais d'upscale d'une image
    # déjà plus petite (ça l'agrandirait artificiellement sans gagner en qualité réelle).
    LARGEUR_MAX_PX = largeur_max_px
    if image.width > LARGEUR_MAX_PX:
        ratio = LARGEUR_MAX_PX / image.width
        nouvelle_taille = (LARGEUR_MAX_PX, round(image.height * ratio))
        image = image.resize(nouvelle_taille, Image.LANCZOS)

    tampon_propre = io.BytesIO()
    image.save(tampon_propre, format="JPEG", quality=qualite_jpeg, optimize=True)
    tampon_propre.seek(0)
    return tampon_propre


def _desinfecter_pdf(fichier) -> io.BytesIO:
    """
    Réécrit le PDF en supprimant tout JavaScript embarqué et toute action automatique.
    Utilise pikepdf (basé sur qpdf), qui répare aussi au passage les PDF structurellement
    endommagés plutôt que de planter sur eux.
    """
    import pikepdf

    fichier.seek(0)
    try:
        pdf = pikepdf.open(fichier)
    except pikepdf.PdfError as e:
        raise ValidationError(
            "Le fichier PDF est corrompu ou invalide. Merci d'essayer avec un autre fichier."
        ) from e

    with pdf:
        # 🔐 Suppression de toute action automatique au niveau du document
        # (/OpenAction se déclenche automatiquement à l'ouverture du PDF — vecteur d'attaque classique)
        if "/OpenAction" in pdf.Root:
            del pdf.Root.OpenAction
        if "/AA" in pdf.Root:  # Additional Actions (ex: à la fermeture du document)
            del pdf.Root.AA

        # 🔐 Suppression du JavaScript embarqué au niveau du catalogue de noms (/Names /JavaScript)
        if "/Names" in pdf.Root and "/JavaScript" in pdf.Root.Names:
            del pdf.Root.Names.JavaScript

        # 🔐 Suppression des actions JS attachées à chaque page (annotations avec /A ou /AA)
        for page in pdf.pages:
            if "/AA" in page:
                del page.AA
            if "/Annots" in page:
                for annot in page.Annots:
                    if "/A" in annot:
                        del annot.A
                    if "/AA" in annot:
                        del annot.AA

        tampon_propre = io.BytesIO()
        pdf.save(tampon_propre)

    tampon_propre.seek(0)
    return tampon_propre


def valider_et_desinfecter_ordonnance(fichier_upload) -> InMemoryUploadedFile:
    """
    Point d'entrée principal : applique les 4 couches de défense sur un fichier d'ordonnance
    reçu via une requête HTTP (request.FILES['fichier_ordonnance']).

    Retourne un NOUVEAU fichier (InMemoryUploadedFile) propre, prêt à être assigné au champ
    `ordonnance` du modèle Commande — avec un nom généré côté serveur.

    Lève ValidationError (avec un message déjà adapté à l'affichage côté client) si le fichier
    est refusé à n'importe quelle étape.
    """
    # Couche 1 : taille
    valider_taille(fichier_upload)

    # Couche 2 : type réel par contenu binaire
    mime_detecte = detecter_type_reel(fichier_upload)
    extension = MIME_AUTORISES[mime_detecte]

    # Couche 3 : désinfection par reconstruction complète du fichier
    if mime_detecte == "application/pdf":
        contenu_propre = _desinfecter_pdf(fichier_upload)
    else:
        contenu_propre = _desinfecter_image(fichier_upload)
        extension = "jpg"  # toutes les images désinfectées sont réencodées en JPEG

    # Couche 4 : nom de fichier généré côté serveur, jamais celui fourni par le client
    nom_fichier_propre = f"ordonnance_{uuid.uuid4().hex}.{extension}"

    taille_finale = contenu_propre.getbuffer().nbytes
    logger.info(
        "Ordonnance désinfectée avec succès : %s (%s, %d octets)",
        nom_fichier_propre, mime_detecte, taille_finale,
    )

    return InMemoryUploadedFile(
        file=contenu_propre,
        field_name="ordonnance",
        name=nom_fichier_propre,
        content_type="application/pdf" if extension == "pdf" else "image/jpeg",
        size=taille_finale,
        charset=None,
    )


# Taille maximale acceptée pour une photo de produit catalogue AVANT compression : 5 Mo.
# Généreux pour ne pas frustrer l'admin qui upload depuis son téléphone, tout en bloquant
# les abus -- le fichier réel stocké est de toute façon bien plus petit après compression.
TAILLE_MAX_PHOTO_PRODUIT_OCTETS = 5 * 1024 * 1024  # 5 Mo

# Réglages volontairement plus agressifs que pour une ordonnance : une vignette catalogue
# n'a besoin d'être lisible qu'à l'écran (grille produit, jamais imprimée pour une décision
# médicale), donc on privilégie la bande passante -- surtout précieux en 3G/4G, avec un
# catalogue qui peut afficher des dizaines de photos d'un coup (cf. CataloguePagination).
LARGEUR_MAX_PHOTO_PRODUIT_PX = 900
QUALITE_JPEG_PHOTO_PRODUIT = 78


def valider_et_desinfecter_photo_produit(fichier_upload) -> InMemoryUploadedFile:
    """
    Point d'entrée pour les photos de produit catalogue (api_modifier_photo_produit) :
    mêmes couches de sécurité que pour une ordonnance (taille, type réel par contenu
    binaire, désinfection par reconstruction complète, nom généré côté serveur), mais avec
    une compression plus agressive puisqu'il s'agit d'une simple photo illustrative, jamais
    d'un document dont la lisibilité doit être préservée à tout prix.

    Contrairement aux ordonnances, un PDF n'a aucun sens ici : seules les images sont
    acceptées.
    """
    if fichier_upload.size > TAILLE_MAX_PHOTO_PRODUIT_OCTETS:
        taille_recue_mo = round(fichier_upload.size / (1024 * 1024), 1)
        taille_max_mo = TAILLE_MAX_PHOTO_PRODUIT_OCTETS // (1024 * 1024)
        raise ValidationError(
            f"L'image est trop volumineuse ({taille_recue_mo} Mo). "
            f"Taille maximale acceptée : {taille_max_mo} Mo."
        )

    fichier_upload.seek(0)
    entete = fichier_upload.read(2048)
    fichier_upload.seek(0)
    mime_detecte = magic.from_buffer(entete, mime=True)
    if mime_detecte not in ("image/jpeg", "image/png", "image/webp"):
        raise ValidationError(
            "Ce fichier n'est pas reconnu comme une image valide (JPG/PNG/WEBP). "
            "Si vous pensez qu'il s'agit d'une erreur, essayez de réenregistrer l'image "
            "puis de la charger à nouveau."
        )

    contenu_propre = _desinfecter_image(
        fichier_upload,
        largeur_max_px=LARGEUR_MAX_PHOTO_PRODUIT_PX,
        qualite_jpeg=QUALITE_JPEG_PHOTO_PRODUIT,
    )
    taille_finale = contenu_propre.getbuffer().nbytes
    nom_fichier_propre = f"produit_{uuid.uuid4().hex}.jpg"

    logger.info(
        "Photo produit compressée avec succès : %s (%d octets, contre %d à l'origine)",
        nom_fichier_propre, taille_finale, fichier_upload.size,
    )

    return InMemoryUploadedFile(
        file=contenu_propre,
        field_name="image",
        name=nom_fichier_propre,
        content_type="image/jpeg",
        size=taille_finale,
        charset=None,
    )
