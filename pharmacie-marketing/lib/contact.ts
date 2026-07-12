export const CONTACT = {
  whatsappNumber: "237683242487",
  whatsappDisplay: "+237 683 242 487",
  email: "pharmacieplus9@gmail.com",
};

function waLink(message: string) {
  return `https://wa.me/${CONTACT.whatsappNumber}?text=${encodeURIComponent(message)}`;
}

export const DEMO_WHATSAPP_LINK = waLink(
  "Bonjour, je souhaite une démo de Pharmacie+ pour ma pharmacie."
);

export const GENERAL_WHATSAPP_LINK = waLink("Bonjour, j'ai une question sur Pharmacie+.");

export const CLIENT_WHATSAPP_LINK = waLink(
  "Bonjour, ma pharmacie n'utilise pas encore Pharmacie+, je voudrais la leur recommander."
);
