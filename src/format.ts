export function printJson(data: unknown, pretty: boolean) {
  const text = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
  process.stdout.write(text + "\n");
}

export function mdEscape(text: string) {
  return text.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

export function printMarkdown(lines: string[]) {
  process.stdout.write(lines.join("\n") + "\n");
}

export function truncate(text: string, max = 120) {
  const t = String(text ?? "");
  if (t.length <= max) return t;
  return t.slice(0, Math.max(0, max - 1)) + "…";
}

export function fmtNum(n: unknown) {
  const x = typeof n === "number" ? n : Number(n);
  return Number.isFinite(x) ? x.toLocaleString("en-US") : "-";
}

export function fmtDate(iso: unknown) {
  const s = typeof iso === "string" ? iso : "";
  return s ? s.replace(/\.\d+Z$/, "Z") : "-";
}
