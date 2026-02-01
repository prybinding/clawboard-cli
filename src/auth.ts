import fs from "node:fs";

import { TrelloCredentials, credsPath, loadCreds } from "./config.js";
import { printAuthGuide, writeCredentials } from "./init.js";
import { trelloRequest } from "./trello.js";

export type AuthStatus = {
  ok: boolean;
  member?: { id?: string; username?: string; fullName?: string };
  error?: string;
};

export function maybeLoadCreds(): TrelloCredentials | null {
  try {
    return loadCreds();
  } catch {
    return null;
  }
}

export async function checkCreds(creds: TrelloCredentials): Promise<AuthStatus> {
  try {
    const me = await trelloRequest<any>("GET", "/members/me", creds, { fields: "id,username,fullName" });
    return {
      ok: true,
      member: { id: me?.id, username: me?.username, fullName: me?.fullName },
    };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}

export async function initAuthFromArgs(args: { key?: string; token?: string }) {
  const key = args.key?.trim();
  const token = args.token?.trim();
  if (!key || !token) {
    printAuthGuide();
    throw new Error(`Missing --key/--token. Expected credentials at ${credsPath()}`);
  }

  const creds: TrelloCredentials = { key, token };
  const status = await checkCreds(creds);
  if (!status.ok) {
    throw new Error(`Provided Trello credentials are invalid: ${status.error}`);
  }

  const p = writeCredentials(creds);
  return { path: p, status };
}
