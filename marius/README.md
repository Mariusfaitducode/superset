# Installer ce fork

Ce build remplace `/Applications/Superset.app` et garde toutes tes données, puisqu'il utilise le même `~/.superset` que l'app officielle. Les terminaux et les agents en cours continuent de tourner pendant le remplacement.

## Prérequis

- Un Mac Apple Silicon.
- [Bun](https://bun.sh) 1.4.2 dans `~/.bun/bin`.

## Installer ou mettre à jour

```bash
git clone https://github.com/Mariusfaitducode/superset && cd superset   # première fois
git fetch origin && git checkout marius/main && git pull                  # ensuite
bun install
./marius/update.sh
```

La compilation prend entre 7 et 30 minutes. À la fin, Superset demande à quitter : clique « Quitter », l'app se relance toute seule sur le nouveau build. Le suivi s'affiche dans `build-marius.log` et `marius/swap.log`.

Au premier remplacement, l'app officielle est gardée dans `~/Backups/superset-<date>`.

## Vérifier la version

Réglages, en bas de la colonne de gauche : `desktop-v1.39.0 + marius/main@<commit> · <date>`.

## Revenir à l'app officielle

```bash
./marius/rollback-to-official.sh
```

## À savoir

- La mise à jour automatique est désactivée : c'est `update.sh` qui met à jour.
- Ne tue jamais tous les processus Superset, ça couperait les terminaux en cours.
