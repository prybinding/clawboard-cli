import { TrelloCredentials } from "./config.js";

export class TrelloError extends Error {
  status?: number;
  body?: unknown;

  constructor(message: string, opts?: { status?: number; body?: unknown }) {
    super(message);
    this.name = "TrelloError";
    this.status = opts?.status;
    this.body = opts?.body;
  }
}

const API_BASE = "https://api.trello.com/1";

type ReqInit = Omit<RequestInit, "headers"> & { headers?: Record<string, string> };

export async function trelloRequest<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  creds: TrelloCredentials,
  params?: Record<string, string | number | boolean | undefined | null>,
  body?: unknown
): Promise<T> {
  const url = new URL(path.replace(/^\//, ""), API_BASE + "/");
  url.searchParams.set("key", creds.key);
  url.searchParams.set("token", creds.token);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }

  const init: ReqInit = {
    method,
    headers: {
      Accept: "application/json",
    },
  };

  if (body !== undefined && body !== null) {
    init.headers!["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }

  const res = await fetch(url, init as RequestInit);
  const text = await res.text();
  const parsed = text ? safeJsonParse(text) : null;

  if (!res.ok) {
    throw new TrelloError(`HTTP ${res.status} ${res.statusText} for ${url}`, {
      status: res.status,
      body: parsed,
    });
  }

  return parsed as T;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function extractShortLink(input: string): string | null {
  const s = input.trim();
  // shortLink example: yuQBBlHs
  if (/^[a-zA-Z0-9]{8}$/.test(s)) return s;

  // shortUrl example: https://trello.com/c/yuQBBlHs/1-title
  try {
    const u = new URL(s);
    const parts = u.pathname.split("/").filter(Boolean);
    const idx = parts.indexOf("c");
    if (idx >= 0 && parts[idx + 1] && /^[a-zA-Z0-9]{8}$/.test(parts[idx + 1])) {
      return parts[idx + 1];
    }
  } catch {
    // ignore
  }

  return null;
}

export async function resolveCardId(input: string, creds: TrelloCredentials): Promise<string> {
  const shortLink = extractShortLink(input);
  if (shortLink) {
    // GET /cards/{id} supports shortLink
    const card = await trelloRequest<any>("GET", `/cards/${encodeURIComponent(shortLink)}`, creds, {
      fields: "id",
    });
    if (card?.id) return String(card.id);
  }

  // maybe full id
  if (/^[a-f0-9]{24}$/.test(input.trim()) || /^[0-9a-fA-F-]{36}$/.test(input.trim())) {
    return input.trim();
  }

  throw new Error(`Could not resolve card id from: ${input}`);
}
