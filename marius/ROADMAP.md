# Feuille de route du fork

Suivie par les agents qui travaillent sur ce fork, et lue sur les deux Macs. Mise à jour à chaque étape.

## Ta liste (sidebar)

| # | To-do | État | Quand / comment |
|---|---|---|---|
| 1 | Idea list ? | Confié | Une autre session construit une Page Superset. Les idées propres au fork l'y rejoindront ensuite. |
| 2 | Latest release / merged version | Fait, à valider | Le build affiché vient du dernier tag upstream (`desktop-v1.39.0`, le plus récent au 2026-10-20) et de la branche fusionnée. Suite : rebase hebdomadaire, voir « Routine ». |
| 3 | Show release name | Fait, à valider | En bas des Réglages : tag upstream + branche@commit + date, posé par `marius/update.sh`. |
| 4 | Allow agents to see todos | **Prochain** | D'abord une conception avec toi. Les to-do quittent le stockage du navigateur pour le service hôte, puis sont exposées aux agents (CLI `superset` ou MCP) : lire, créer, cocher, réorganiser. |
| 5 | Create general agent | Après le 4 | Projet B : un coordinateur qui voit toutes les sessions et leurs to-do et aide à prioriser. Regarder d'abord le skill `cockpit`. |
| 6 | Rename conv in sidebar | Fait, à valider | Double-clic sur le titre, Entrée pour valider, Échap pour annuler. |

## Backlog

- Panneau qui suit une tâche d'ops en direct (courbe d'une métrique Prometheus/Grafana, rattachée à la conversation qui l'a lancée). Idée de la session debugging, pas commencée.
- Proposer en amont ce qui marche (issue superset-sh/superset#8634).

## Routine

- Chaque semaine : `git fetch upstream --tags`. Si un nouveau `desktop-vX.Y.Z` existe, rebaser `marius/main` dessus, recompiler (`marius/update.sh`), réinstaller.
- Avant de coder sur un Mac : `git fetch` pour voir ce que l'autre a poussé.

## À régler

- Pousser `feature/sidebar-unify` à la place de la PR #2 (attend ton OK).
- L'autre Mac commite avec l'adresse Spore : corriger sa config git. Réécrire ses 3 commits demande un force-push (attend ton OK).
