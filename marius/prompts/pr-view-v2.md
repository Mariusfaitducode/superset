Tu reprends la vue PR de mon fork Superset (repo Mariusfaitducode/superset, worktree ~/CodeProjects/superset-pr-view, branche feature/pr-view, PR #14 vers marius/main, pas encore mergée). Tu la mènes jusqu'à une PR verte que je teste dans build/next.

## À lire d'abord
- ~/.claude/CLAUDE.md : « act first, I verify after ». Tu décides, tu construis, tu me rends un rapport. Pas de séance de questions.
- Dans ~/CodeProjects/superset (branche docs/fork-workflow) : marius/AGENT-BRIEF.md, marius/README.md, marius/ROADMAP.md (« How we work »).
- La PR #14 (`gh pr view 14 -R Mariusfaitducode/superset`) : ce qui existe déjà, c'est-à-dire l'onglet « Mine » de la page Pull Requests, « Waiting on you / on others », la raison de chaque PR et le lien vers la conversation ou le workspace.
- `git fetch` d'abord : un autre Mac pousse parfois.

## Mon retour après l'avoir testée
Il faut des filtres. Il faut que ce soit plus rapide. Il faut que je puisse tout comprendre et voir en un coup d'œil. Il faut que je puisse prioriser.

Pistes, à toi de trancher :
- **Filtres** : repo ou projet, mon rôle (auteur, reviewer, je suis), état (CI rouge, conflits, review demandée, changements demandés, prête à merger, brouillon), ancienneté. Chaque filtre affiche son compteur, et le choix est gardé d'une ouverture à l'autre.
- **Vitesse** : mesure d'abord (temps avant le premier affichage, durée de chaque appel GitHub). Affiche tout de suite la dernière liste connue, puis rafraîchis derrière. Lance les repos en parallèle et ne charge le détail d'une PR qu'à l'ouverture. Mets les chiffres avant/après dans la PR.
- **Coup d'œil** :
  - Une ligne en tête du type « 3 t'attendent · 2 CI rouges · 1 prête à merger ».
  - Puis une ligne dense par PR : CI, review, conflits, âge, dernière activité, taille, qui attend qui.
  - Les PR regroupées par prochaine action plutôt que par repo.
- **Prioriser** : un ordre par défaut qui se justifie, par exemple :
  1. Quelqu'un est bloqué par moi.
  2. Une review est demandée depuis longtemps.
  3. La CI est rouge sur ma PR.
  4. La PR est prête à merger.

  Chaque ligne dit pourquoi elle est à cette place. Je dois aussi pouvoir épingler une PR ou monter sa priorité à la main, et ce choix est gardé.

Vérifie tes requêtes sur des données réelles en lecture seule (`gh api graphql`, `gh search prs`), sur spore-bio/hub et sur le fork. Ne touche pas au remote de hub, qui contient un token : c'est à moi de le retirer.

## Comment travailler
- Continue sur feature/pr-view, dans la même PR #14. Fais des commits nouveaux, sans rebase ni force-push, et merge origin/marius/main si la branche a bougé.
- Mémoire : 16 Go partagés, swap souvent plein. Jamais de build de l'app, de dev server ou de typecheck complet en local, et un seul `bun test` ciblé à la fois. Vérifie `memory_pressure` avant tout ce qui est lourd. La Fork CI sur GitHub fait le typecheck. Seule « Fork CI » compte : le check Neon rouge et le « CI » amont en attente sont normaux.
- Utilise les outils du fork :
  - Au démarrage : `superset todos list --open` et `superset labels add "In progress"`.
  - Mes actions à faire et tes questions qui ne bloquent pas vont dans `superset todos add`.
  - Une décision importante va dans `superset notes add`.
  - Une friction dans Superset va dans `superset notes add "Superset idea: …"`.
  - À la fin, mets `Waiting` et retire `In progress`.
- Mets à jour la description de la PR #14 dans ma voix : charge la skill my-voice, écris en anglais, court. Loggue la première proposition avec `~/.claude/voice/bin/voice.py log`. Sur ce fork tu peux la publier sans attendre, montre-la-moi dans le rapport.
- Ne t'arrête pas tant que la Fork CI est rouge. Ne merge rien. Ne pousse que feature/pr-view.

## Rapport final (en français)
- Le lien de la PR et l'état de la CI.
- Ce que je dois tester, en 4 gestes concrets.
- Les chiffres de vitesse avant/après.
- Tes choix et l'alternative écartée, tes hypothèses.
- Ce qui n'est pas fini.
- Le texte de PR publié.

Termine par l'enveloppe SUPERSET_WORKER_DONE du brief. Le coordinateur l'intégrera dans build/next.
