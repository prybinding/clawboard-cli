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

export function credsPath() {
  return path.join(os.homedir(), ".config", "trello", "credentials.json");
}

export function loadCreds(): TrelloCredentials {
  const p = credsPath();
  if (!fs.existsSync(p)) {
    throw new Error(`Missing Trello credentials: ${p}`);
  }
  const raw = fs.readFileSync(p, "utf-8");
  const j = JSON.parse(raw) as Partial<TrelloCredentials>;
  if (!j.key || !j.token) throw new Error(`Invalid Trello credentials file: ${p}`);
  return { key: String(j.key).trim(), token: String(j.token).trim() };
}
