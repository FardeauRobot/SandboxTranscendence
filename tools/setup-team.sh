#!/bin/sh
# Prépare le sous-module transcendence/ (repo d'équipe) après un clone du bac à sable.
# Idempotent : relançable sans risque.
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root"
git submodule update --init transcendence
# Le hook n'est pas versionné dans .git/modules : on pointe le sous-module vers celui du bac à sable.
git -C transcendence config core.hooksPath "$root/tools/team-hooks"
# Refuse de pousser le bac à sable s'il épingle un commit du sous-module jamais poussé.
git config push.recurseSubmodules check
if ! git -C transcendence rev-parse --verify -q feature/sandbox-experiments >/dev/null; then
  git -C transcendence fetch origin
  git -C transcendence switch -c feature/sandbox-experiments --no-track origin/test
fi
echo "transcendence/ prêt : hook pre-push actif, branche $(git -C transcendence branch --show-current)."
