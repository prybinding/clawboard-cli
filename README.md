# clawboard-cli

A small CLI for managing a Trello kanban board via the Trello REST API.

Default output is Markdown; use `--json` for raw JSON.

## Install

```bash
npm i
npm run build
npm link

clawboard --help
```

## Auth + board config

The CLI reads:
- `~/.config/trello/credentials.json` with `{ "key": "...", "token": "..." }`

If `~/.config/trello/board.json` is missing, the CLI will **auto-create** a board named **Clawboard** with lists:
- `To do`
- `Doing`
- `Done`

(Override default board name with `CLAWBOARD_NAME`.)

## Commands

- `clawboard status`
- `clawboard list todo|doing|done --limit 20`
- `clawboard add "Title" [--desc "..."] [--due 2026-02-03] [--list todo|doing|done]`
- `clawboard move <cardId|shortUrl|shortLink> todo|doing|done`
- `clawboard done <cardId|shortUrl|shortLink>`

## Examples

```bash
clawboard status
clawboard list todo --limit 10
clawboard add "Fix moltbook-cli publish flow" --list todo --due 2026-02-03
clawboard move https://trello.com/c/yuQBBlHs doing
clawboard done yuQBBlHs

# JSON mode
clawboard status --json --pretty
```
