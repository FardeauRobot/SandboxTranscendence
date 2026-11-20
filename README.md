# Transcendence · labo

| Dossier | Contenu |
|---|---|
| `sandbox/` | Aura, le bac à sable du jeu (voir `sandbox/README.md`) |
| `transcendence/` | Le repo d'équipe `AliceTh0rel/Transcendence`, en sous-module |
| `animation-test/`, `etat-des-lieux/` | Essais d'animation, état des lieux du projet |

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
