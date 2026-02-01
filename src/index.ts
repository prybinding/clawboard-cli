#!/usr/bin/env node

import { Command } from "commander";
import { loadCreds } from "./config.js";
import { ensureBoardConfig } from "./init.js";
import { checkCreds, initAuthFromArgs, maybeLoadCreds } from "./auth.js";
import { fmtDate, fmtNum, mdEscape, printJson, printMarkdown, truncate } from "./format.js";
import { resolveCardId, trelloRequest } from "./trello.js";

type Card = any;

const program = new Command();
program
  .name("clawboard")
  .description("Manage Trello kanban (Clawboard)")
  .option("--json", "output raw JSON", false)
  .option("--pretty", "pretty-print JSON (only with --json)", false);

program
  .command("init")
  .description("Initialize credentials (if missing) and create board config (if missing)")
  .option("--key <key>", "Trello API key")
  .option("--token <token>", "Trello API token")
  .option("--name <boardName>", "board name (default: CLAWBOARD_NAME or Clawboard)")
  .action(async (cmdOpts: { key?: string; token?: string; name?: string }) => {
    const opts = program.opts<{ json: boolean; pretty: boolean }>();

    if (cmdOpts.name) process.env.CLAWBOARD_NAME = cmdOpts.name;

    let creds = maybeLoadCreds();
    if (!creds) {
      const res = await initAuthFromArgs({ key: cmdOpts.key, token: cmdOpts.token });
      creds = loadCreds();
      if (!opts.json) {
        process.stderr.write(`[clawboard] Wrote credentials: ${res.path}\n`);
      }
    } else {
      const status = await checkCreds(creds);
      if (!status.ok) throw new Error(`Trello auth check failed: ${status.error}`);
    }

    const board = await ensureBoardConfig(creds);

    if (opts.json) {
      printJson({ ok: true, board }, opts.pretty);
      return;
    }

    const lines: string[] = [];
    lines.push(`# Clawboard init`);
    lines.push("");
    if (board.boardUrl) lines.push(`- board: ${board.boardUrl}`);
    lines.push(`- boardId: \`${mdEscape(board.boardId)}\``);
    lines.push(`- lists: todo/doing/done ready`);
    printMarkdown(lines);
  });

program
  .command("status")
  .description("Board/list status summary")
  .action(async () => {
    const opts = program.opts<{ json: boolean; pretty: boolean }>();
    const creds = loadCreds();
    const board = await ensureBoardConfig(creds);

    const lists = [
      { key: "todo", name: "To do", id: board.lists.todo },
      { key: "doing", name: "Doing", id: board.lists.doing },
      { key: "done", name: "Done", id: board.lists.done },
    ];

    const results: Record<string, { count: number }> = {};
    for (const l of lists) {
      const cards = await trelloRequest<Card[]>("GET", `/lists/${l.id}/cards`, creds, {
        fields: "id",
      });
      results[l.key] = { count: Array.isArray(cards) ? cards.length : 0 };
    }

    const out = { boardId: board.boardId, boardUrl: board.boardUrl, lists: results };

    if (opts.json) {
      printJson(out, opts.pretty);
      return;
    }

    const lines: string[] = [];
    lines.push(`# Clawboard status`);
    lines.push("");
    if (board.boardUrl) lines.push(`- board: ${board.boardUrl}`);
    lines.push("");
    lines.push(`| list | count |`);
    lines.push(`|---|---:|`);
    for (const l of lists) {
      lines.push(`| ${mdEscape(l.name)} | ${fmtNum(results[l.key].count)} |`);
    }
    printMarkdown(lines);
  });

program
  .command("list")
  .description("List cards in a list")
  .argument("<todo|doing|done>")
  .option("--limit <n>", "max cards", "20")
  .action(async (listKey: string, cmdOpts: { limit: string }) => {
    const opts = program.opts<{ json: boolean; pretty: boolean }>();
    const creds = loadCreds();
    const board = await ensureBoardConfig(creds);

    const limit = clampInt(cmdOpts.limit, 1, 200);
    const listId = listIdForKey(board, listKey);

    const cards = await trelloRequest<Card[]>("GET", `/lists/${listId}/cards`, creds, {
      fields: "id,name,shortUrl,due,dateLastActivity",
    });

    const sliced = Array.isArray(cards) ? cards.slice(0, limit) : [];

    if (opts.json) {
      printJson({ list: listKey, cards: sliced }, opts.pretty);
      return;
    }

    const lines: string[] = [];
    lines.push(`# Clawboard list: ${mdEscape(listKey)}`);
    lines.push("");
    lines.push(`| # | title | shortUrl | due | lastActivity |`);
    lines.push(`|---:|---|---|---|---|`);
    sliced.forEach((c, i) => {
      const title = mdEscape(truncate(String(c?.name ?? ""), 80)) || "-";
      const shortUrl = mdEscape(String(c?.shortUrl ?? "-"));
      const due = mdEscape(fmtDate(c?.due));
      const act = mdEscape(fmtDate(c?.dateLastActivity));
      lines.push(`| ${i + 1} | ${title} | ${shortUrl} | ${due} | ${act} |`);
    });
    printMarkdown(lines);
  });

program
  .command("add")
  .description("Add a card")
  .argument("<title>")
  .option("--desc <text>", "description")
  .option("--due <YYYY-MM-DD>", "due date (local date)")
  .option("--list <todo|doing|done>", "target list", "todo")
  .action(async (title: string, cmdOpts: { desc?: string; due?: string; list: string }) => {
    const opts = program.opts<{ json: boolean; pretty: boolean }>();
    const creds = loadCreds();
    const board = await ensureBoardConfig(creds);

    const listId = listIdForKey(board, cmdOpts.list);

    const card = await trelloRequest<Card>("POST", `/cards`, creds, {
      idList: listId,
      name: title,
      desc: cmdOpts.desc ?? "",
      due: cmdOpts.due ? toIsoDue(cmdOpts.due) : undefined,
      pos: "top",
    });

    if (opts.json) {
      printJson(card, opts.pretty);
      return;
    }

    const lines: string[] = [];
    lines.push(`# Card created`);
    lines.push("");
    lines.push(`- title: **${mdEscape(String(card?.name ?? title))}**`);
    if (card?.shortUrl) lines.push(`- url: ${String(card.shortUrl)}`);
    if (card?.id) lines.push(`- id: \`${mdEscape(String(card.id))}\``);
    printMarkdown(lines);
  });

program
  .command("move")
  .description("Move a card to a list")
  .argument("<cardId|shortUrl|shortLink>")
  .argument("<todo|doing|done>")
  .action(async (cardRef: string, listKey: string) => {
    const opts = program.opts<{ json: boolean; pretty: boolean }>();
    const creds = loadCreds();
    const board = await ensureBoardConfig(creds);

    const cardId = await resolveCardId(cardRef, creds);
    const listId = listIdForKey(board, listKey);

    const card = await trelloRequest<Card>("PUT", `/cards/${encodeURIComponent(cardId)}`, creds, {
      idList: listId,
    });

    if (opts.json) {
      printJson(card, opts.pretty);
      return;
    }

    const lines: string[] = [];
    lines.push(`# Card moved`);
    lines.push("");
    lines.push(`- to: **${mdEscape(listKey)}**`);
    if (card?.name) lines.push(`- title: ${mdEscape(String(card.name))}`);
    if (card?.shortUrl) lines.push(`- url: ${String(card.shortUrl)}`);
    printMarkdown(lines);
  });

program
  .command("done")
  .description("Move a card to Done")
  .argument("<cardId|shortUrl|shortLink>")
  .action(async (cardRef: string) => {
    const opts = program.opts<{ json: boolean; pretty: boolean }>();
    const creds = loadCreds();
    const board = await ensureBoardConfig(creds);

    const cardId = await resolveCardId(cardRef, creds);
    const listId = board.lists.done;

    const card = await trelloRequest<Card>("PUT", `/cards/${encodeURIComponent(cardId)}`, creds, {
      idList: listId,
    });

    if (opts.json) {
      printJson(card, opts.pretty);
      return;
    }

    const lines: string[] = [];
    lines.push(`# Card moved to Done`);
    lines.push("");
    if (card?.name) lines.push(`- title: ${mdEscape(String(card.name))}`);
    if (card?.shortUrl) lines.push(`- url: ${String(card.shortUrl)}`);
    printMarkdown(lines);
  });

program.parseAsync(process.argv).catch((err) => {
  process.stderr.write(String(err?.message || err) + "\n");
  process.exit(1);
});

function clampInt(value: string, min: number, max: number) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function listIdForKey(board: Awaited<ReturnType<typeof ensureBoardConfig>>, key: string): string {
  const k = String(key).toLowerCase();
  if (k === "todo" || k === "to do" || k === "to-do") return board.lists.todo;
  if (k === "doing") return board.lists.doing;
  if (k === "done") return board.lists.done;
  throw new Error(`Unknown list key: ${key} (expected todo|doing|done)`);
}

function toIsoDue(dateYmd: string): string {
  // Trello accepts ISO 8601. Use local date at 09:00 to avoid timezone surprises.
  // Example input: 2026-02-03
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) {
    throw new Error(`Invalid due date (expected YYYY-MM-DD): ${dateYmd}`);
  }
  return `${dateYmd}T09:00:00+09:00`;
}
