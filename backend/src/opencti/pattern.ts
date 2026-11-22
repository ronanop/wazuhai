export type ParsedObservable = {
  kind: "ipv4" | "ipv6" | "domain" | "url" | "sha256" | "md5" | "sha1" | "other";
  value: string;
};

/**
 * Extract observable values from a STIX 2.x indicator pattern.
 * Handles common forms like: [ipv4-addr:value = '1.2.3.4']
 * and file:hashes.'SHA-256' = 'abc...'
 */
export function parseStixPattern(pattern: string): ParsedObservable[] {
  const text = String(pattern || "").trim();
  if (!text) return [];

  const out: ParsedObservable[] = [];
  const seen = new Set<string>();

  const push = (kind: ParsedObservable["kind"], value: string) => {
    const v = value.trim().replace(/^['"]|['"]$/g, "");
    if (!v) return;
    const key = `${kind}:${v.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ kind, value: v });
  };

  // hash patterns: file:hashes.'SHA-256' = '...'
  const hashRe =
    /file:hashes\.(?:'|")?(SHA-?256|SHA-?1|MD5)(?:'|")?\s*=\s*(?:'|")([a-fA-F0-9]+)(?:'|")/gi;
  let m: RegExpExecArray | null;
  while ((m = hashRe.exec(text))) {
    const algo = m[1].toUpperCase().replace("-", "");
    const kind = algo.includes("256") ? "sha256" : algo.includes("1") ? "sha1" : "md5";
    push(kind, m[2]);
  }

  // typed STIX comparisons: ipv4-addr:value = 'x'
  const typedRe =
    /(ipv4-addr|ipv6-addr|domain-name|hostname|url|file:name)(?:\.value)?\s*=\s*(?:'|")([^'"]+)(?:'|")/gi;
  while ((m = typedRe.exec(text))) {
    const t = m[1].toLowerCase();
    if (t.startsWith("ipv4")) push("ipv4", m[2]);
    else if (t.startsWith("ipv6")) push("ipv6", m[2]);
    else if (t.includes("domain") || t === "hostname") push("domain", m[2]);
    else if (t === "url") push("url", m[2]);
    else push("other", m[2]);
  }

  // bare IPv4 fallback
  const ipRe = /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\b/g;
  while ((m = ipRe.exec(text))) {
    push("ipv4", m[0]);
  }

  // bare domain-ish (conservative)
  const domRe = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}\b/gi;
  while ((m = domRe.exec(text))) {
    const v = m[0];
    if (v.includes("=") || v.endsWith(".value")) continue;
    if (/^(sha|md5|ipv4|file|and|or)$/i.test(v)) continue;
    push("domain", v);
  }

  // bare hashes
  const sha256Re = /\b[a-fA-F0-9]{64}\b/g;
  while ((m = sha256Re.exec(text))) push("sha256", m[0]);
  const md5Re = /\b[a-fA-F0-9]{32}\b/g;
  while ((m = md5Re.exec(text))) {
    if (m[0].length === 32) push("md5", m[0]);
  }

  return out;
}

export function observableValues(observables: ParsedObservable[]): string[] {
  return [...new Set(observables.map((o) => o.value))];
}
