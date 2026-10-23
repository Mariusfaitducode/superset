Tu construis le moniteur de tâches de mon fork Superset (repo Mariusfaitducode/superset, worktree ~/CodeProjects/superset-monitor, branches parties de `origin/marius/main`). Tu mènes deux PR vers `marius/main` jusqu'au vert, je les teste ensuite dans build/next.

## À lire d'abord
- ~/.claude/CLAUDE.md : « act first, I verify after ». Tu décides, tu construis, tu me rends un rapport. Pas de séance de questions.
- Dans ~/CodeProjects/superset : marius/AGENT-BRIEF.md (tes règles), marius/README.md, marius/ROADMAP.md (« How we work », et l'entrée de backlog « Background task card »).
- `git fetch` d'abord : un autre Mac pousse parfois.
- Le modèle à imiter : les to-dos de conversation (`packages/host-service/src/trpc/router/conversation-todos/`, store sur l'hôte dans `~/.superset/state/`, commande `superset todos`, push de l'hôte vers l'app ajouté par #13).
- La PR #24 (`feature/desk`, `superset report …`), pas encore mergée : regarde-la pour rester cohérent (même style de CLI, même push). Ne t'empile pas dessus. Son `report progress` est une passation ponctuelle. Ta tâche suivie est un objet vivant, donc tu la gardes séparée. Explique dans la PR comment les deux cohabitent.

## Principe transversal : on n'efface rien, on archive
Quand je ferme une carte ou un to-do, il ne doit pas être supprimé : il est archivé pour garder une trace (statut `archived`, date d'archivage, qui l'a archivé). On le retrouve dans une vue « Archivés », et `--archived` sur la commande `list`.

## PR 1 — `feature/todos-archive` (petite, à ouvrir en premier)
- La suppression d'un to-do (UI et `superset todos remove`) devient un archivage. Garde la règle actuelle : un agent n'archive que ses propres to-dos.
- Les to-dos déjà supprimés sont perdus, on n'y peut rien. Les fichiers d'état existants doivent continuer à se lire.
- Dans le panneau des to-dos, ajoute un accès discret aux archivés, avec la possibilité de restaurer.
- Une vraie purge peut rester, mais seulement pour moi, explicite, et jamais par défaut. Ou pas du tout, à toi de trancher.

## PR 2 — `feature/task-monitor`
Ce que je veux, en résumé : quand un agent surveille un truc long (une commande lente, une CI, un nettoyage disque suivi dans Prometheus), je veux le suivre sans aller lire son terminal.

**Côté agent : la CLI** (noms indicatifs, à toi d'ajuster) :
```
superset track start "Nettoyage disque SN004" --steps "Snapshot,Purge logs,Purge images,Vérif" [--link <url>]
superset track step <n|nom> [--note "12 Go libérés"]
superset track progress <0-100> [--note …]
superset track note "…"
superset track done [--note …] | superset track fail "raison"
superset tracks list [--archived]
```
- Le store est sur l'hôte (`~/.superset/state/tracked-tasks.json`), avec pour clé workspace + conversation, comme les to-dos. L'hôte pousse chaque changement vers l'app.
- Plusieurs tâches par conversation sont possibles. Seul l'agent qui a créé une tâche peut la modifier. Seul moi peux l'archiver.
- Ajoute une skill `plugins/superset/skills/track/SKILL.md` qui dit quand l'utiliser (toute attente de plus d'environ 2 minutes : CI, build, déploiement, opération longue) et comment. Pense aussi à `superset --help`.

**Suivi automatique de la CI (dans la v1)** : si le `--link` d'une tâche est un run GitHub Actions (ou une PR, prends son dernier run), c'est l'hôte qui suit le run avec `gh` : jobs terminés sur le total, job en cours, puis réussite ou échec, qui fait passer la tâche en done ou fail. L'agent n'a pas à boucler pour attendre. Interroge GitHub avec un intervalle raisonnable, seulement tant que la tâche est en cours, et loin du main loop (worker pool `offLoop` comme les autres features). Vérifie tes appels sur un vrai run du fork, en lecture seule.

**Détection du silence** : marque une tâche « silencieuse » si elle n'a reçu aucune mise à jour depuis N minutes (seuil adapté, sauf si la CI est suivie automatiquement), ou si l'agent de la conversation est mort ou inactif. Utilise le même état d'agent que la sidebar.

**Côté app : le bouton et le panneau**
- Un bouton dans la TopBar, en haut à droite, à côté du bouton « Open in » (`routes/_authenticated/_dashboard/components/TopBar/TopBar.tsx`).
- Le bouton porte un badge avec le nombre de tâches en cours et un petit anneau de progression global. Il devient rouge si une tâche a échoué et n'est pas encore archivée.
- Au clic, un panneau glisse depuis la droite sur toute la hauteur, comme le centre de notifications de macOS quand on clique sur la date. Il se ferme avec Escape ou un clic dehors.
- Dans le panneau, une carte par tâche, de tous les workspaces. Les tâches en cours apparaissent d'abord, puis les échouées, puis les terminées. Chaque carte montre :
  - le titre, la conversation et le workspace ;
  - la barre de progression : par étapes, en pourcentage, ou indéterminée ;
  - la liste des étapes avec l'étape en cours ;
  - la durée écoulée et la dernière note ;
  - le badge « silencieuse » si besoin ;
  - le lien.

  Un clic sur la carte ouvre la conversation.
- Les cartes terminées ou échouées restent jusqu'à ce que je les ferme. Fermer une carte l'archive (voir le principe plus haut), et une vue « Archivées » est accessible dans le panneau.
- Une notification macOS en cas d'échec. Une notification en cas de réussite seulement si l'app n'est pas au premier plan, ou pas du tout : à toi de trancher.
- Soigne le design : charge la skill frontend-design. Le résultat doit avoir l'air natif dans Superset, pas plaqué.

## Comment travailler
- Commence par PR 1, ouvre-la, puis enchaîne sur PR 2 depuis `origin/marius/main`. PR 2 peut réutiliser l'archivage de PR 1 en mergeant la branche de PR 1 dedans : dis-le dans la PR. Ne base jamais une PR sur une autre branche que `marius/main`.
- Fais des commits nouveaux, sans rebase ni force-push. Merge `origin/marius/main` si la branche bouge. Ne pousse que tes deux branches. Ne merge rien.
- Mémoire : 16 Go partagés. Jamais de build de l'app, de dev server ou de typecheck complet en local, et un seul `bun test` ciblé à la fois. Vérifie `memory_pressure` avant tout ce qui est lourd. Seule « Fork CI » compte sur GitHub : le check Neon rouge et le « CI » amont en attente sont normaux.
- Utilise les outils du fork :
  - Au démarrage : `superset todos list --open` et `superset labels add "In progress"`.
  - Mes actions à faire et tes questions qui ne bloquent pas vont dans `superset todos add`.
  - Une décision importante va dans `superset notes add`.
  - Une friction dans Superset va dans `superset notes add "Superset idea: …"`.
  - À la fin, mets `Waiting` et retire `In progress`.
- Utilise toi-même `superset track` pour suivre ta propre attente de CI dès que la commande existe : c'est le premier vrai test.
- Descriptions de PR dans ma voix : charge la skill my-voice, écris en anglais, court. Loggue la première proposition avec `~/.claude/voice/bin/voice.py log`. Sur ce fork tu peux les publier sans attendre, montre-les-moi dans le rapport.

## Rapport final (en français)
- Les liens des deux PR et l'état de la CI.
- Ce que je dois tester, en gestes concrets.
- Tes choix et l'alternative écartée, tes hypothèses.
- Ce qui n'est pas fini.
- Les textes de PR publiés.

Termine par l'enveloppe SUPERSET_WORKER_DONE du brief. Le coordinateur intégrera les deux PR dans build/next.
