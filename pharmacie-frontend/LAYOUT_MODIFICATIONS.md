# 📝 MODIFICATIONS À APPORTER À `app/layout.tsx`

## Étape 1 : Ajouter l'import
En haut du fichier, ajoute :
```tsx
import AppShell from "@/lib/components/AppShell";
```

## Étape 2 : Wrapper le return
Trouve le `return (` du composant RootLayout. Il doit y avoir quelque chose comme :

```tsx
return (
  <ConfigPharmacieProvider>
    {/* ... tout le contenu ... */}
  </ConfigPharmacieProvider>
);
```

Remplace par :

```tsx
return (
  <AppShell>
    <ConfigPharmacieProvider>
      {/* ... tout le contenu existant, inchangé ... */}
    </ConfigPharmacieProvider>
  </AppShell>
);
```

**⚠️ IMPORTANT** : Le `<AppShell>` doit englober TOUT, y compris le
`<ConfigPharmacieProvider>`. C'est nécessaire car le splash screen (qui est
rendu à l'intérieur du ConfigPharmacieProvider) doit aussi bénéficier du
contexte de navigation pour les futures transitions.

## Étape 3 : Supprimer les padding-bottom manuels sur la bottom nav
Si tu avais un `pb-4` ou `pb-6` sur la nav du bas, remplace-le par
`pb-[env(safe-area-inset-bottom)]` ou laisse-le — le `AppShell` ajoute déjà
le padding global au conteneur racine. La nav n'a plus besoin de son propre
padding bottom pour la home indicator.

## Étape 4 : Safe area sur le header
Si le header a un padding-top fixe (ex: `pt-4`), remplace-le par :
```tsx
className="... pt-[max(1rem,env(safe-area-inset-top))] ..."
```
Ou plus simplement avec Tailwind v4 :
```tsx
className="... pt-4 pt-[env(safe-area-inset-top)] ..."
```
Tailwind prendra la valeur la plus grande (mais en v4 il faut vérifier le
comportement — utilise plutôt une classe custom si besoin).

La solution la plus simple : laisse le `pt-[env(safe-area-inset-top)]` du
AppShell gérer l'espace en haut, et retire tout padding-top du header lui-même.
