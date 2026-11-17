# Transcendence — état des lieux (17 nov. 2026)

> Photo prise le **mardi 17 novembre**, début de la semaine 2 sur 6.
> Sources : board Miro « TRANSCENDANCE », repo d'équipe (`Desktop/Transcendence`, branche `main` + branches distantes), bac à sable (`Labo/Transcendence`).
> Détails : `01-technique.md` (code, infra, branches) et `02-jeu-et-produit.md` (règles, backlog, modules, planning).

## L'équipe

| Rôle (Miro) | Qui |
|---|---|
| PO / PM | Alice (propriétaire du repo GitHub `AliceTh0rel/Transcendence`) |
| Tech lead | Aissam (CI/CD, Docker, VM Azure, branche `feature/chat`) |
| Devs | Léo, Tim (un des deux committe sous le nom « Sudoku » sur `feature/backend-profile`) |

Le bac à sable « Aura » (règles du jeu + arène 3D) est dans le dossier Labo, hors du repo d'équipe.

## Le calendrier

- 10 nov → **18 déc** (livraison). **Feature freeze le 14 déc.** Il reste environ 4 semaines de dev.
- Jalons : S1 projet cadré (16/11) ✅ · **S2 socle technique (23/11)** ← on est ici · S3 gameplay simple (30/11) · S4 multijoueur fonctionnel (7/12) · S5 freeze (14/12) · S6 livraison (18/12).

## Où on en est, en une ligne par bloc

| Bloc | État |
|---|---|
| Infra / CI/CD | **Solide.** Docker Compose (Caddy + Adonis + Postgres), CI lint/typecheck/build, déploiement auto sur VM Azure au merge dans `prod`. |
| Backend | **Squelette.** Sur `main` : inscription, login, profil, logout (tokens opaques). Seulement 2 tables (`users`, `auth_access_tokens`). |
| Auth avancée | **Branche en cours** `feature/backend-profile` : nickname, avatar, 2FA TOTP (QR code). Pas encore mergée. |
| Temps réel | **Branche en cours** `feature/chat` : Socket.IO branché sur Adonis, un event `hello` de test. Pas de chat réel. |
| Frontend | **Presque vide.** Une page d'accueil statique ; React Router, Zustand et Tailwind installés mais pas utilisés. Les maquettes sont sur Figma (je n'y ai pas accès). |
| Moteur de jeu | **Le plus avancé, mais hors repo.** Moteur pur TS (score, mains, match à 2, 31 tests) + table de jeu + arène 3D three.js. |
| Modèle de données | Miro dit « schéma conçu ✅ », mais dans le code seule la table `users` existe. Games, Cards, Chats, Messages, Friends : à faire. |

## Les points d'attention, par ordre de gravité

1. **Le jeu tourne dans le navigateur, il doit tourner sur le serveur.** Le moteur du labo met dans l'état la main des deux joueurs, la pioche et la seed : en réseau, un client qui reçoit ça voit tout. Le sujet (et US11) exige des règles appliquées côté serveur. Tout le reste du multijoueur dépend de ce découpage.
2. **Le moteur n'est pas dans le repo.** Versions différentes (React 18 / TS 5.6 / Vite 5 au labo, React 19 / TS 6 / Vite 8 dans le repo). Le moteur n'a aucune dépendance, il est donc portable, mais il faut décider où il vit.
3. **En prod, Socket.IO ne passera pas par Caddy.** Le Caddyfile ne relaie que `/api/v1/*` ; `/socket.io/*` tombera sur le serveur de fichiers du front. À ajouter avant de tester le temps réel sur la VM (et penser au timeout d'inactivité Azure de 4 min).
4. **`feature/backend-profile` modifie une migration déjà jouée** (`create_users_table` : `full_name` → `nickname`). Sur une base déjà migrée (la prod), ce changement ne s'appliquera jamais. Il faut une nouvelle migration `alter`.
5. **Conflits de merge à prévoir** : les deux branches touchent `package-lock.json`, `adonisrc.ts`, les fichiers générés `.adonisjs/`, et `feature/chat` réécrit le `Makefile` que `main` local a aussi modifié (commit non poussé).
6. **Le front de prod appellera probablement `localhost:3333`.** `api.ts` retombe sur `http://localhost:3333` si `VITE_API_URL` est vide, et le build Docker de la CI n'a pas de `.env` front. Invisible tant que le front n'appelle pas l'API.
7. **Le cœur du jeu n'est pas tranché** : lien entre les cartes et les « moves » / danses d'aura, rôle des familles, 2 joueurs ou plus. Voir `02-jeu-et-produit.md`.

## Les questions encore ouvertes (à travailler ensemble)

Classées par ce qu'elles bloquent :

**Bloquent le multijoueur (S3-S4)**
- A. Architecture du jeu en réseau : qui détient l'état, ce que chaque client reçoit, chrono serveur, protocole d'événements Socket.IO, reconnexion.
- B. Emplacement du moteur dans le monorepo (package partagé front/back ?).
- C. Matchmaking : file d'attente, lobby, partie privée par code/lien (US08, US09).
- D. Ce qu'on persiste en base : partie, manches, mains posées, résultats (pour l'historique et les stats).

**Bloquent le gameplay (S3)**
- E. Cartes ↔ moves / danses : une animation par carte (52 ?), par combinaison, par famille ?
- F. Familles thématiques (Internet, Manifs, Gen Z…) avec bonus, ou neutres ? Modificateurs (étape 6 du labo).
- G. Valeurs finales des règles (étape 5 du labo, en cours).

**Bloquent le front / l'intégration**
- H. Auth côté front : où stocker le token, comment authentifier la socket.
- I. Intégration de l'arène 3D (three.js) dans le front React 19, et assets 3D des personnages.

**Côté modules**
- J. Comment valider « Real-time collaborative features » et « Public API » (personne n'est dessus).
- K. Pages CGU / confidentialité (US05).
