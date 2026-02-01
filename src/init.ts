import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { BoardConfig, TrelloCredentials } from "./config.js";
import { trelloRequest } from "./trello.js";

export function credentialsPath() {
  return path.join(os.homedir(), ".config", "trello", "credentials.json");
}

export function writeCredentials(creds: TrelloCredentials) {
  const p = credentialsPath();
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(creds, null, 2) + "\n", { encoding: "utf-8" });
  try {
    fs.chmodSync(p, 0o600);
  } catch {
    // best-effort
  }
  return p;
}

export function printAuthGuide() {
  const lines: string[] = [];
  lines.push("Trello credentials are missing.");
  lines.push("");
  lines.push("1) Get your API key: https://trello.com/power-ups/admin");
  lines.push("2) Generate a token (log in + approve):");
  lines.push("   https://trello.com/1/authorize?expiration=never&name=ClawboardCLI&scope=read,write&response_type=token&key=YOUR_KEY");
  lines.push("");
  lines.push("Then run:");
  lines.push("  clawboard init --key YOUR_KEY --token YOUR_TOKEN");
  lines.push("");
  lines.push(`Or create: ${credentialsPath()}`);
  process.stderr.write(lines.join("\n") + "\n");
}

export function boardConfigPath() {
  return path.join(os.homedir(), ".config", "trello", "board.json");
}

export async function ensureBoardConfig(creds: TrelloCredentials): Promise<BoardConfig> {
  const p = boardConfigPath();
  if (fs.existsSync(p)) {
    const raw = fs.readFileSync(p, "utf-8");
    return JSON.parse(raw) as BoardConfig;
  }

  // Auto-initialize if missing.
  const boardName = process.env.CLAWBOARD_NAME?.trim() || "Clawboard";

  const board = await trelloRequest<any>("POST", "/boards", creds, {
    name: boardName,
    defaultLists: false,
  });

  const boardId = String(board?.id);
  const boardUrl = board?.url ? String(board.url) : undefined;

  const mkList = async (name: string) => {
    const lst = await trelloRequest<any>("POST", "/lists", creds, {
      name,
      idBoard: boardId,
      pos: "bottom",
    });
    return String(lst?.id);
  };

  const cfg: BoardConfig = {
    boardId,
    boardUrl,
    lists: {
      todo: await mkList("To do"),
      doing: await mkList("Doing"),
      done: await mkList("Done"),
    },
  };

  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(cfg, null, 2) + "\n", { encoding: "utf-8" });

  return cfg;
}
