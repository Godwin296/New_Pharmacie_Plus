"use client";
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import apiClient from '../apiClient';
import messagesFr from '../../messages/fr.json';
import messagesEn from '../../messages/en.json';

/**
 * 🌍 CONTEXTE DE LANGUE (frontend)
 *
 * ⚠️ Pas de routing next-intl par URL ([locale] segment) ici : les sous-domaines
 * (dupont.localhost, martin.localhost...) servent déjà à identifier le TENANT (voir
 * apiClient.ts), on ne va pas superposer un deuxième système de segments d'URL par-dessus
 * pour la langue. On utilise donc next-intl "sans routing" : <NextIntlClientProvider>
 * directement, avec locale + messages déterminés ici en mémoire/contexte plutôt que par l'URL.
 *
 * PRIORITÉ -- volontairement identique à celle déjà implémentée côté backend
 * (voir core/authentication.py::_activer_langue_client + locale/README.md) :
 *   1. Préférence explicite du compte client (`langue_preferee`, via /api/v1/client/me/)
 *   2. Langue du navigateur (`navigator.language`)
 *   3. Défaut : français
 *
 * Un client anonyme (pas encore connecté) n'a que 2. et 3. -- sa préférence, une fois
 * connecté, est migrée vers le backend (PATCH /client/me/) plutôt que de rester seulement
 * en localStorage, pour rester cohérente entre l'app et les emails transactionnels envoyés
 * côté serveur (voir core/emails.py::_langue_destinataire).
 */

type Locale = 'fr' | 'en';

const MESSAGES: Record<Locale, typeof messagesFr> = {
  fr: messagesFr,
  en: messagesEn as typeof messagesFr,
};

const LANGUES_SUPPORTEES: Locale[] = ['fr', 'en'];

function detecterLangueNavigateur(): Locale {
  if (typeof navigator === 'undefined') return 'fr';
  const langue = navigator.language?.slice(0, 2).toLowerCase();
  return LANGUES_SUPPORTEES.includes(langue as Locale) ? (langue as Locale) : 'fr';
}

interface LangueContextType {
  locale: Locale;
  /** null = "Système" (pas de préférence explicite enregistrée), sinon 'fr'|'en' */
  preferenceExplicite: Locale | null;
  changerLangue: (langue: Locale | null) => Promise<void>;
  chargement: boolean;
}

const LangueContext = createContext<LangueContextType>({
  locale: 'fr',
  preferenceExplicite: null,
  changerLangue: async () => {},
  chargement: true,
});

const CLE_LOCALSTORAGE = 'langue_preferee';

export function LangueProvider({ children }: { children: React.ReactNode }) {
  const [preferenceExplicite, setPreferenceExplicite] = useState<Locale | null>(null);
  const [locale, setLocale] = useState<Locale>('fr');
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    let annule = false;

    const initialiser = async () => {
      const estClientConnecte =
        typeof window !== 'undefined' &&
        localStorage.getItem('access_token') &&
        localStorage.getItem('user_role') === 'client';

      let pref: Locale | null = null;

      if (estClientConnecte) {
        // 🎯 Source de vérité = backend (CompteClient.langue_preferee), pas localStorage :
        // évite une désynchro si le client change de langue depuis un autre appareil.
        try {
          const res = await apiClient.get('/api/v1/client/me/');
          const langueBackend = res.data?.langue_preferee;
          if (langueBackend && LANGUES_SUPPORTEES.includes(langueBackend)) {
            pref = langueBackend as Locale;
          }
        } catch {
          // Hors-ligne ou jeton expiré : on retombe sur le repli local ci-dessous,
          // pas d'erreur bloquante pour une simple histoire de langue d'affichage.
        }
      } else if (typeof window !== 'undefined') {
        // Client anonyme (pas encore de compte) : repli localStorage, pour que le choix
        // fait avant connexion ne soit pas perdu au premier rendu.
        const local = localStorage.getItem(CLE_LOCALSTORAGE);
        if (local && LANGUES_SUPPORTEES.includes(local as Locale)) {
          pref = local as Locale;
        }
      }

      if (!annule) {
        setPreferenceExplicite(pref);
        setLocale(pref ?? detecterLangueNavigateur());
        setChargement(false);
      }
    };

    initialiser();
    return () => { annule = true; };
  }, []);

  // 🔧 <html lang="fr"> dans layout.tsx est statique (rendu avant que ce contexte ne
  // détermine la langue réelle) -- on le corrige ici imperativement une fois connue,
  // pour l'accessibilité (lecteurs d'écran) et le SEO plutôt que de laisser "fr" en dur.
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const changerLangue = useCallback(async (langue: Locale | null) => {
    // Mise à jour optimiste de l'affichage -- ne dépend pas de la réussite de l'appel réseau.
    setPreferenceExplicite(langue);
    setLocale(langue ?? detecterLangueNavigateur());

    const estClientConnecte =
      typeof window !== 'undefined' &&
      localStorage.getItem('access_token') &&
      localStorage.getItem('user_role') === 'client';

    if (estClientConnecte) {
      // langue_preferee: '' côté backend == repli "Système" (voir core/api.py, ligne ~332).
      // On propage l'erreur réseau éventuelle à l'appelant (ex: pour afficher un toast
      // d'échec) plutôt que de l'avaler ici -- l'affichage reste à jour de toute façon
      // grâce à la mise à jour optimiste ci-dessus.
      await apiClient.patch('/api/v1/client/me/', { langue_preferee: langue ?? '' });
    } else if (typeof window !== 'undefined') {
      if (langue) {
        localStorage.setItem(CLE_LOCALSTORAGE, langue);
      } else {
        localStorage.removeItem(CLE_LOCALSTORAGE);
      }
    }
  }, []);

  return (
    <LangueContext.Provider value={{ locale, preferenceExplicite, changerLangue, chargement }}>
      <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone="Africa/Douala">
        {children}
      </NextIntlClientProvider>
    </LangueContext.Provider>
  );
}

export function useLangue() {
  return useContext(LangueContext);
}
