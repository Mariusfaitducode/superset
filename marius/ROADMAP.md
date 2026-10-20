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

- **Carte de tâche de fond** : une carte rattachée à la conversation, qui dit ce que l'agent fait, où il en est, avec une barre de progression. C'est l'agent qui la met à jour, par la même voie que les to-do. Cas d'origine : suivre le cleanup du disque d'un proto au lieu de relancer Grafana à la main. Une courbe de métrique pourra venir ensuite.
- **Vues custom** : en commençant par une vue PR. La page PR actuelle affiche « no GitHub remote » sur hub : comprendre pourquoi d'abord.
- **⌘K façon Notion pour passer d'un agent à l'autre** : ⌘K vide le terminal aujourd'hui, et la palette est sur ⌘⇧K. Il faut choisir le raccourci.
- **Vue workspaces plus riche** : quelles infos ajouter, à définir.
- Plus tard : ergonomie, performance, agent général, MCP, fonctions bloquées par l'offre payante.
- Proposer en amont ce qui marche (issue superset-sh/superset#8634).

## Routine

- Chaque semaine : `git fetch upstream --tags`. Si un nouveau `desktop-vX.Y.Z` existe, rebaser `marius/main` dessus, recompiler (`marius/update.sh`), réinstaller.
- Avant de coder sur un Mac : `git fetch` pour voir ce que l'autre a poussé.

## À régler

- Pousser `feature/sidebar-unify` à la place de la PR #2 (attend ton OK).
- L'autre Mac commite avec l'adresse Spore : corriger sa config git. Réécrire ses 3 commits demande un force-push (attend ton OK).
