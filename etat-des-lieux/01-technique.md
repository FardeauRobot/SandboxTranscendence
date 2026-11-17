# Technique : code, infra, branches (17 nov. 2026)

## Stack

| Couche | Choix | Remarque |
|---|---|---|
| Front | React 19 + TS, Vite 8, React Router 8, Zustand 5, Tailwind 4, `@tuyau/core` (client API typé généré depuis Adonis) | |
| Back | AdonisJS 7 (mode API), Lucid (ORM), VineJS (validation), `@adonisjs/auth` (tokens opaques en base) | |
| BDD | PostgreSQL 18 | |
| Temps réel | Socket.IO (branche `feature/chat`) | |
| Reverse proxy | Caddy (sert le front buildé + relaie `/api/v1/*`) | |
| Monorepo | npm workspaces (`apps/*`) + Turborepo | Pas encore de dossier `packages/` partagé |
| Déploiement | GHCR + VM Azure (SSH vers un utilisateur restreint qui ne peut lancer que le script `gg`) | |

Node ≥ 24, npm ≥ 11.

## Infra et CI/CD

- `compose.yaml` (prod) : `caddy` (80/443) → `backend` (3333, interne) → `db` (réseau `backend_net` interne). Healthchecks sur back et db.
- `compose.dev.yaml` : seulement Postgres sur `127.0.0.1:5432` ; back et front tournent en local (`npm run dev`).
- Workflow git : `feature/*` → PR vers `test` → PR vers `prod` (merge commit) → déploiement auto. `main` sert de base.
- CI (`.github/workflows/main.yml`) : `npm ci`, lint, typecheck, build. **Tests commentés.** Matrice réduite à Node 24 (le README dit encore 24 et 26).
- Chantier CI/CD en cours (`last_option_plus_cicd_upgrade.md`) : la VM ne reçoit pas `compose.yaml` au déploiement → option retenue : clone git sur la VM + deploy key en lecture seule. Ensuite : tags d'images par commit (rollback), `start_period` sur le healthcheck, Postgres en CI pour les tests, cache Docker.
- Points ouverts notés par l'équipe : `APP_KEY` non vide commité dans `.env.example` racine, alerte budget Azure, **timeout d'inactivité Azure de 4 min qui peut couper les WebSockets**.

## Backend sur `main`

Routes (`start/routes.ts`), toutes sous `/api/v1` :

| Méthode | Route | Rôle |
|---|---|---|
| POST | `/auth/signup` | Crée le compte, renvoie user + token |
| POST | `/auth/login` | Vérifie les identifiants, renvoie user + token |
| GET | `/account/profile` | Profil (auth requise) |
| POST | `/account/logout` | Révoque le token |

Tables : `users` (id, full_name, email, password, timestamps) et `auth_access_tokens`. Rien d'autre.

## Branches en cours

### `feature/backend-profile` (Sudoku, dernier commit le 17/11)
- `full_name` remplacé par `nickname` (unique, obligatoire), mise à jour du profil, upload d'avatar + avatar par défaut, 2FA TOTP (`otplib` + QR code).
- Login en deux temps : si la 2FA est active, `/auth/login` renvoie un token temporaire (capacité `2fa:verify`, 5 min) ; `/auth/login/verify` l'échange contre un vrai token. Un middleware `requireFullAccess` bloque les routes `/account/*` aux tokens temporaires.
- À relire avant merge :
  - **Migration déjà jouée modifiée** (`create_users_table`). Sur une base existante, `nickname` n'apparaîtra jamais → faire une migration `alter` à la place.
  - Le login n'utilise plus le validateur (`request.only`) et la réponse sans 2FA renvoie la clé **`temp`** au lieu de `token` (le front devra gérer deux noms différents).
  - `2fa/generate` réécrit le secret même si la 2FA est déjà active : l'appli d'authentification de l'utilisateur ne correspond plus, il peut se retrouver bloqué.
  - Secret TOTP stocké en clair en base.

### `feature/chat` (Aissam, dernier commit le 16/11)
- Service `realtime.ts` : un serveur Socket.IO attaché au serveur HTTP d'Adonis, **CORS `*`**, aucune authentification.
- `start/ws.ts` : un seul event `hello` avec accusé de réception. Page `Chat.tsx` de test côté front.
- Réécrit aussi le `Makefile` et le README.

### Divers
- `main` local a un commit non poussé (`update makefile`) qui touche le même fichier que `feature/chat`.
- Les fichiers générés `.adonisjs/` sont commités : ils vont créer des conflits à chaque merge qui touche les routes.

## Frontend sur `main`
- `App.tsx` : une page statique. `lib/api.ts` crée le client Tuyau.
- `api.ts` retombe sur `http://localhost:3333` si `VITE_API_URL` est vide. Le build de l'image Caddy en CI n'a pas de `.env` front, donc **en prod le front appellerait probablement localhost**. `Chat.tsx` (branche chat) gère déjà ce cas avec une URL relative en production.

## Prod et temps réel
- Le Caddyfile relaie seulement `handle /api/v1/*`. Le chemin par défaut de Socket.IO est `/socket.io/` : en prod, il tombera sur le `file_server` du front. Il faudra un `handle` de plus (ou un `path` Socket.IO sous `/api/v1`).

## Le bac à sable (dossier Labo)

`Labo/Transcendence/sandbox` — Vite 5 + React 18 + three.js 0.170 + Vitest. 2 commits.

| Dossier | Contenu |
|---|---|
| `src/engine/` | **Pur TS, aucun import React.** `types.ts`, `deck.ts` (RNG à seed), `hands.ts` (détection des mains), `score.ts` (`scoreHand`, étapes du calcul), `match.ts` (réducteur d'un match à 2), `defaultRules.ts`. 31 tests. |
| `src/ui/` | Table de jeu, cartes, panneau de score, éditeur de règles (« Le labo », export/import JSON), foule 2D. |
| `src/ui/arena/` | `scene.ts` : arène three.js sans React (ring, 2 combattants, ~500 spectateurs instanciés), pilotée par `setLevel`, `setAura`, `burst`. |

Avancement (`PROGRESS.json`) : 0 à 4c faits (scaffold, moteur, table, foule, éditeur, arène 3D, match 2 joueurs même écran) ; **5 « Réglage des règles (équipe) » en cours** ; 6 « Modificateurs » à faire.

Ce qui manque pour passer en réseau : `MatchState` contient la main et la pioche des deux joueurs et la seed. Le réducteur est déjà indépendant par joueur, et le chrono est géré par l'appelant (`timeout`), ce qui facilite le passage côté serveur.
