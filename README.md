# Transcendence · labo

| Dossier | Contenu |
|---|---|
| `sandbox/` | Aura, le bac à sable du jeu (voir `sandbox/README.md`) |
| `transcendence/` | Le repo d'équipe `AliceTh0rel/Transcendence`, en sous-module |
| `animation-test/`, `etat-des-lieux/` | Essais d'animation, état des lieux du projet |

## Lancer les morceaux : `./labo`

```sh
./labo            # le panneau : j/k pour choisir, ↵ lancer/arrêter, o ouvrir, a toute l'équipe, q quitter
./labo status     # une ligne par service
./labo stop       # arrête ce que le labo a lancé (la base reste)
```

| Service | Port |
|---|---|
| Base de données (conteneur `labo_transcendence_pg`) | 5433 |
| API équipe (Adonis) | 3333 |
| Front équipe | 5173 |
| Aura (bac à sable) | 5174 |

Lancer un service lance aussi ce dont il dépend (front → API → base). Les services tournent détachés :
quitter le panneau ne les arrête pas. Logs dans `.labo/logs/`. La base du labo est volontairement séparée de
celle du clone `~/Desktop/Transcendence` (même nom de projet compose : un `docker compose up` ici
réutiliserait la sienne). L'action « Migrations » repasse `schema.ts` dans prettier : `migration:run` le
régénère sans formatage et salirait le sous-module.

## Travailler sur le repo d'équipe

Le sous-module suit `test`. On expérimente sur `feature/sandbox-experiments`, jamais sur `main`/`test`/`prod`.

```sh
tools/setup-team.sh                                      # après un clone : init + garde-fou
cd transcendence
git fetch && git rebase origin/test                      # récupérer le boulot de l'équipe
git push -u origin feature/sandbox-experiments           # partager un essai
cd .. && git add transcendence && git commit             # épingler cette version dans le labo
```

Le hook `tools/team-hooks/pre-push` refuse, dans le sous-module : les pushs vers `main`/`test`/`prod`, vers
une branche hors `feature/*`, les tags, les suppressions de branche, et tout push qui n'est pas en avance
rapide (un force-push qui écraserait le travail d'un collègue). Après un rebase de ta branche déjà poussée,
pousse-la sous un nouveau nom plutôt que de forcer. Échappatoire assumée : `git push --no-verify`.

`push.recurseSubmodules=check` empêche de pousser le labo s'il épingle un commit du sous-module jamais poussé.
