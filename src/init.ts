import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { BoardConfig, TrelloCredentials } from "./config.js";
import { trelloRequest } from "./trello.js";

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
