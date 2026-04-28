import qrcode
import base64
from io import BytesIO

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