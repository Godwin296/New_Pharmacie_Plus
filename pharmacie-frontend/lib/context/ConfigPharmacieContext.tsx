"use client";
import React, { createContext, useContext, useEffect, useState } from 'react';
import apiClient from '../apiClient';

/**
 * 🌍 CONTEXTE CONFIG PHARMACIE
 *
 * Avant ce contexte, chaque page qui avait besoin d'infos sur la pharmacie
 * (nom, logo, devise...) refaisait son propre appel à /api/infos-pharmacie/.
 * Ici, on charge cette config UNE SEULE FOIS au niveau racine de l'app (voir
 * layout.tsx), et n'importe quel composant peut la lire instantanément via
 * useConfigPharmacie(), sans appel réseau supplémentaire ni prop-drilling.
 *
 * Premier cas d'usage concret : le composant <Prix> (lib/components/Prix.tsx)
 * lit ici PharmacieConfig.devise_preferee, qui existait déjà côté backend mais
 * n'était presque jamais utilisé (FCFA codé en dur dans ~12 fichiers frontend).
 */

interface PharmacieConfig {
  nom?: string;
  adresse?: string;
  telephone?: string;
  logo?: string;
  email_contact?: string;
  devise_preferee?: string; // 'FCFA' | 'EUR' | 'USD' (voir core/models.py -> PharmacieConfig.DEVISES)
  langue_preferee?: string;
  [key: string]: unknown; // le serializer backend expose fields='__all__', on reste permissif ici
}

interface ConfigPharmacieContextType {
  config: PharmacieConfig | null;
  loading: boolean;
}

const ConfigPharmacieContext = createContext<ConfigPharmacieContextType>({
  config: null,
  loading: true,
});

export function ConfigPharmacieProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<PharmacieConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await apiClient.get('/api/infos-pharmacie/');
        setConfig(res.data);
      } catch (err) {
        console.error("Impossible de charger la configuration de la pharmacie:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchConfig();
  }, []);

  return (
    <ConfigPharmacieContext.Provider value={{ config, loading }}>
      {children}
    </ConfigPharmacieContext.Provider>
  );
}

export function useConfigPharmacie() {
  return useContext(ConfigPharmacieContext);
}
