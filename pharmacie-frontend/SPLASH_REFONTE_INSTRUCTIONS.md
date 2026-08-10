# 📝 MODIFICATIONS À APPORTER À `app/layout.tsx`

## Étape 1 : Ajouter les imports

En haut du fichier, ajoute ces deux imports :

```tsx
import SplashScreen from "@/lib/components/SplashScreen";
import SkeletonHome from "./_components/SkeletonHome";
```

## Étape 2 : Ajouter un nouvel état

Dans le composant RootLayout, ajoute cet état (à côté de `showSplash`) :

```tsx
const [splashComplete, setSplashComplete] = useState(false);
```

## Étape 3 : Modifier le timer du splash screen

Trouve cette ligne (environ ligne 100) :
```tsx
const timer = setTimeout(() => setShowSplash(false), 6000);
```

Remplace-la PAR :
```tsx
const timer = setTimeout(() => setShowSplash(false), 1500);
```

## Étape 4 : Remplacer TOUT le bloc du splash screen inline

Trouve ce bloc (environ lignes 191 à 289) :

```tsx
          {showSplash && (
            <motion.div 
              exit={{ opacity: 0, scale: 1.06 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-0 z-[150] flex flex-col items-center justify-center bg-brand-deep overflow-hidden"
            >
              {/* 🌿 FOND VIVANT : masses lumineuses floutées qui dérivent lentement --
                  mêmes teintes (émeraude + bleu) que le Hero du site marketing. */}
              <motion.div
                animate={{ x: [0, 40, -20, 0], y: [0, -30, 20, 0], scale: [1, 1.15, 0.95, 1] }}
                ...
              />
              ... (tout le reste du splash screen) ...
            </motion.div>
          )}
```

Remplace-le ENTIÈREMENT PAR :

```tsx
          <AnimatePresence mode="wait">
            {showSplash && (
              <SplashScreen
                key="splash"
                onComplete={() => setSplashComplete(true)}
                duration={1500}
              />
            )}
          </AnimatePresence>
```

## Étape 5 : Afficher le skeleton pendant le chargement des données

Juste APRÈS le bloc du splash screen (donc après le `</AnimatePresence>` du splash),
et AVANT le `children`, ajoute ce bloc conditionnel :

```tsx
          {/* 🦴 SKELETON — affiché entre le splash et le vrai contenu,
              pendant que les données (config, catalogue, commandes...) chargent. */}
          {!showSplash && !splashComplete && <SkeletonHome />}
```

OU, si tu préfères que le skeleton ne s'affiche que sur la home :

```tsx
          {!showSplash && !splashComplete && pathname === "/" && <SkeletonHome />}
```

## Étape 6 : Conditionner l'affichage du vrai contenu

Trouve la ligne où `children` est rendu. Elle doit être conditionnée pour ne
pas s'afficher tant que le skeleton est actif. Remplace :

```tsx
{children}
```

PAR :

```tsx
{(showSplash || splashComplete) ? children : null}
```

Ou, si tu utilises le skeleton uniquement sur la home :
```tsx
{children}
```
(resté inchangé — le skeleton s'affiche "par-dessus" via z-index ou position fixed)

## Étape 7 : Nettoyer les imports inutilisés

Tu peux retirer l'import de `PulseLine` si tu ne l'utilises plus ailleurs :
```tsx
// Retirer cette ligne si PulseLine n'est utilisé que dans le splash screen :
import { PulseLine } from '../components/PulseLine';
```

Garde-le si PulseLine est utilisé ailleurs dans le layout ou dans d'autres composants.

---

## 🎯 RÉCAPITULATIF DES CHANGEMENTS

| Avant | Après |
|-------|-------|
| Splash 6 secondes | Splash 1.5 seconde |
| Masses lumineuses qui dérivent | Fond uni #04241a |
| Tracé ECG animé | 3 dots qui pulse (style iOS) |
| Salutation + prénom | Juste "Pharmacie+" discret |
| Halo blur-2xl | Lueur subtile statique |
| Exit 0.6s scale 1.06 | Exit 0.35s scale 1.015 |
| Rien après le splash | SkeletonHome pendant le chargement |
| Cut brutal vers la page | Fade doux + skeleton structuré |

## ⚠️ POINTS D'ATTENTION

1. **Le composant SplashScreen utilise un logo SVG placeholder.** Remplace le SVG
   dans `lib/components/SplashScreen.tsx` (ligne ~45) par ton vrai logo :
   ```tsx
   <PharmacyIcon className="w-full h-full object-cover" alt="Pharmacie+" />
   ```

2. **Le nom de l'app** est codé en dur "Pharmacie+" dans SplashScreen.tsx.
   Si tu veux qu'il soit dynamique (depuis ConfigPharmacieContext), il faudra
   wrapper le SplashScreen DANS le ConfigPharmacieProvider — mais ça complique
   la structure. Pour un splash screen, un nom codé en dur est acceptable
   (c'est ce que font toutes les apps natives).

3. **Le SkeletonHome** est conçu pour la page d'accueil (`/`). Si tu veux des
   skeletons pour d'autres pages (catalogue, panier, profil), dis-le-moi
   et je les crée.

4. **Le `AnimatePresence` du splash** doit avoir `mode="wait"` pour que le
   splash disparaisse COMPLETEMENT avant que le skeleton ou le contenu
   n'apparaisse. Cela évite les superpositions visuelles.
