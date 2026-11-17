# Jeu et produit : règles, backlog, modules, planning (17 nov. 2026)

## Le concept (Miro, « Product vision »)
« La Battle d'Aura » : simulation d'une battle d'aura en jeu de cartes. Deux joueurs s'affrontent à travers leurs auras. Cible : les curieux. Objectif : retrouver les codes des battles d'aura.

## Les règles : deux générations sur le board

**1re génération (frame « REGLES ») — idées abandonnées ou en suspens**
- Deck customisable, « un deck = une famille », choisir un personnage = choisir son deck.
- Énergie à la Hearthstone (1, 2, 3… max 10 ?).
- Barre d'aura / thermomètre ; but : atteindre un palier d'aura.
- Familles thématiques avec potentiellement un avantage chacune : Internet 2000-2010 (Gangnam Style, Harlem Shake, Dab), Manifs, Gen Z, « Pipous » (chorés d'enfants), À l'ancienne (valse…).
- Combos selon le nombre de cartes d'une même famille ou le nombre de cartes jouées.
- Progression cosmétique (personnages, badges).

**2e génération (« BATTLE D'AURA × BALATRO ») — celle qui est implémentée dans le labo**
Frame « LES REGLES / DEROULEMENT » + slides « AURA, les règles du jeu » + `NOTES.txt`.
- 2 joueurs, 5 manches, 45 s par joueur et par manche.
- Donne neuve de 8 cartes par manche ; on pose 1 à 5 cartes, une seule fois par manche.
- Défausses : **10 pour tout le match** (1 défausse = 1 à 5 cartes remplacées).
- Jeu de 52 cartes, 4 familles (Coupes, Deniers, Épées, Bâtons), rangs 2 → As.
- Mains de poker de la carte haute à la quinte flush, chacune avec une base `chips × mult`.
- Score = (base + valeur des cartes qui comptent) × mult. Les kickers ne rapportent rien.
- Familles **neutres par défaut** (bonus +chips / +mult / ×mult réglables dans le labo ; avec un ×mult, l'ordre de sélection compte).
- Foule : 4 niveaux selon le score de la main (seuils 40 / 150 / 400 / 900).
- Victoire au score cumulé après 5 manches, égalité possible.

## Ce qui n'est pas tranché

- **Cartes ↔ danses.** Miro : « on active les danses des cartes jouées qui comptent dans la combinaison » ; « base de données avec les animations (52 en tout ?) » ou « on colle différents sprites par-dessus ». Le retroplanning S2 a « Choisir les moves des cartes » à faire. Les familles thématiques de la 1re génération ne sont pas reliées aux 4 familles actuelles.
- **Questions listées sur Miro** : afficher la prévisualisation du score (penchant : oui) ; menu avec la liste des mains ; deck de 52 cartes.
- **Nombre de joueurs** : US08 et US10 parlent de « plusieurs joueurs », le moteur et le module Remote players sont à 2.
- **Gestion des déconnexions** : seulement notée comme « problème possible » (perte de connexion client, crash serveur).
- US11 dit explicitement « À définir : déroulement d'un tour, actions, combat, victoire, égalités » : le labo y répond en partie, mais la fiche n'est pas à jour.

## Backlog (Miro, « Product »)

| ID | User story | Priorité | État |
|---|---|---|---|
| US01 | Créer un compte | Must | Terminé |
| US02 | Voir mes scores totaux (victoires, défaites, parties) | Must | À faire |
| US03 | Amis : rechercher, demander, accepter, lister, supprimer | Could | À faire |
| US04 | Profil : avatar, changer le mot de passe | Should | En cours |
| US05 | CGU : consulter, accepter (versionnées, en base) | Must | À faire |
| US06 | Règles du jeu consultables sans compte | Must | À faire |
| US07 | Double authentification (QR code) | Must | En cours |
| US08 | Rejoindre une partie (sinon en héberger une) | Must | À faire |
| US09 | Partie privée : inviter un ami ou par code/lien | Must | À faire |
| US10 | Chat pendant la partie | Must | À faire |
| US11 | Jouer une partie (règles appliquées côté serveur) | Must | À faire |

Le backlog n'a pas de story pour le classement général ni pour l'admin (présents dans la liste de features de la réunion du 9/11).

## Modules visés (Miro, « Check Module »)

| Module | Type | Pts | Comment on valide (selon Miro) | Où on en est |
|---|---|---|---|---|
| Framework front + back | Majeur | 2 | React + Adonis | ✅ en place |
| Temps réel (WebSockets) | Majeur | 2 | Socket.IO, chat et coups du jeu | Branche chat, embryon |
| Interaction entre utilisateurs (chat, profil, amis) | Majeur | 2 | Chat | Profil en cours, chat embryon, amis à faire |
| API publique (clé, rate limit, doc, 5 endpoints) | Majeur | 2 | *(vide)* | Personne dessus |
| Gestion standard des utilisateurs (profil, avatar, amis + statut en ligne) | Majeur | 2 | *(vide)* | Branche profile |
| Jeu web complet | Majeur | 2 | *(vide)* | Moteur au labo |
| Joueurs à distance (latence, reconnexion) | Majeur | 2 | *(vide)* | Rien |
| ORM | Mineur | 1 | Lucid | ✅ de fait |
| Fonctions collaboratives temps réel | Mineur | 1 | *(vide)* | Pas clair comment le justifier |
| Design system (≥ 10 composants, palette, typo, icônes) | Mineur | 1 | *(vide)* | Rien |
| Upload de fichiers | Mineur | 1 | *(vide)* | Avatar sur la branche profile (le module en demande plus : types multiples, aperçu, barre de progression, suppression) |
| Navigateurs supplémentaires | Mineur | 1 | Chrome, Safari, Firefox | À tester en S5 |
| Stats de jeu et historique | Mineur | 1 | *(vide)* | Dépend de la persistance des parties |
| 2FA | Mineur | 1 | *(vide)* | Branche profile |

Total visé : **14 points de majeurs + 7 de mineurs = 21**. Le seuil exigé par le sujet est à vérifier dans le PDF (je n'ai pas pu lire les documents attachés au board), mais il y a de la marge : on peut abandonner les modules flous (collaboratif, API publique) sans tout mettre en danger.

## Retroplanning (Miro)

| Semaine | Thème | Jalon |
|---|---|---|
| S1 10-16 nov | Cadrage, conception, fondations | Projet cadré ✅ (tout est « Done ») |
| **S2 17-23 nov** | Gameplay + gestion de compte | Socle technique |
| S3 24-30 nov | Gameplay : cartes, règles, tours, effets, interface de combat, victoire/défaite | Gameplay simple |
| S4 1-7 déc | Lobbies, 2 joueurs connectés, synchro Socket.IO, sauvegarde des résultats, profil/stats, déconnexions | Multijoueur fonctionnel |
| S5 8-14 déc | Intégration, design, animations, tests, sécurité, responsive, Docker | **Feature freeze** |
| S6 15-18 déc | Bugs, tests de bout en bout, déploiement, README, démo | **Livraison** |

État de S2 aujourd'hui : front, back, Postgres, Docker, routes API ✅ ; inscription/connexion, Socket.IO, chat, 2FA, design 2D/3D en cours ; modèles backend (Games, Friends…), table friends, choix des moves des cartes à faire.

## Non lu ou inaccessible
- Les documents attachés au board (probablement le sujet PDF), le schéma d'architecture (image trop petite pour être lue), le moodboard DA, les maquettes Figma.
- Le schéma de base de données « conçu » en S1 : je ne l'ai trouvé ni sur le board ni dans le code.
