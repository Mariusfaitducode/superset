# Installing this fork

This build replaces `/Applications/Superset.app` and keeps all your data: it uses the same `~/.superset` as the official app. Running terminals and agents keep going during the swap.

## Requirements

- An Apple Silicon Mac.
- [Bun](https://bun.sh) 1.4.2 in `~/.bun/bin`.

## Install or update

```bash
git clone https://github.com/Mariusfaitducode/superset && cd superset   # first time
git fetch origin && git checkout marius/main && git pull                  # afterwards
bun install
./marius/update.sh
```

The build takes 7 to 30 minutes. At the end Superset asks to quit: click "Quit" and it reopens on its own on the new build. Progress is in `build-marius.log` and `marius/swap.log`.

The first swap keeps the official app in `~/Backups/superset-<date>`.

## Check the version

Settings, at the bottom of the left column: `desktop-v1.39.0 + marius/main@<commit> · <date>`.

## Go back to the official app

```bash
./marius/rollback-to-official.sh
```

## Good to know

- Auto-update is off: `update.sh` is how you update.
- Never kill every Superset process, it would cut the running terminals.
