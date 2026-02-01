import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export type TrelloCredentials = {
  key: string;
  token: string;
};

export type BoardConfig = {
  boardId: string;
  boardUrl?: string;
  lists: {
    todo: string;
    doing: string;
    done: string;
  };
};

export function loadCreds(): TrelloCredentials {
  const p = path.join(os.homedir(), ".config", "trello", "credentials.json");
  if (!fs.existsSync(p)) {
    throw new Error(`Missing Trello credentials: ${p}`);
  }
  const raw = fs.readFileSync(p, "utf-8");
  const j = JSON.parse(raw) as Partial<TrelloCredentials>;
  if (!j.key || !j.token) throw new Error(`Invalid Trello credentials file: ${p}`);
  return { key: String(j.key).trim(), token: String(j.token).trim() };
}

export function loadBoard(): BoardConfig {
  const p = path.join(os.homedir(), ".config", "trello", "board.json");
  if (!fs.existsSync(p)) {
    throw new Error(`Missing Trello board config: ${p}`);
  }
  const raw = fs.readFileSync(p, "utf-8");
  const j = JSON.parse(raw) as Partial<BoardConfig>;
  if (!j.boardId || !j.lists?.todo || !j.lists?.doing || !j.lists?.done) {
    throw new Error(`Invalid Trello board config file: ${p}`);
  }
  return j as BoardConfig;
}
