function decode(value: string): string {
  return value.replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&amp;/gi, "&").trim();
}
function attr(tag: string, name: string): string | undefined {
  return new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag)?.slice(1).find(Boolean);
}
export function parseHtmlMetadata(html: string) {
  const title = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.replace(/<[^>]+>/g, " ");
  let canonicalUrl: string | undefined; let description: string | undefined; const robots: string[] = [];
  for (const tag of html.match(/<(?:meta|link)\b[^>]*>/gi) ?? []) {
    const rel = attr(tag, "rel")?.toLowerCase(); const name = attr(tag, "name")?.toLowerCase(); const content = attr(tag, "content");
    if (rel?.split(/\s+/).includes("canonical")) canonicalUrl = attr(tag, "href");
    if (name === "description" && content) description = decode(content);
    if ((name === "robots" || name === "googlebot") && content) robots.push(...content.toLowerCase().split(/[,\s]+/).filter(Boolean));
  }
  return { title: title ? decode(title.replace(/\s+/g, " ")) : undefined, description, canonicalUrl, robots: [...new Set(robots)] };
}

export function parseXRobotsTag(headers: string[]): string[] {
  return [...new Set(headers.flatMap((value) => value.toLowerCase().split(/[,\s]+/)).filter(Boolean))];
}

type Rule = { allow: boolean; path: string };
export function evaluateRobots(text: string, path: string, userAgent: string): { allowed: boolean; rule?: string } {
  const groups: Array<{ agents: string[]; rules: Rule[] }> = []; let current: { agents: string[]; rules: Rule[] } | undefined; let sawRule = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim(); if (!line) continue;
    const match = /^([^:]+):\s*(.*)$/.exec(line); if (!match) continue;
    const key = match[1]!.trim().toLowerCase(); const value = match[2]!.trim();
    if (key === "user-agent") {
      if (!current || sawRule) { current = { agents: [], rules: [] }; groups.push(current); sawRule = false; }
      current.agents.push(value.toLowerCase());
    } else if ((key === "allow" || key === "disallow") && current) { sawRule = true; if (value) current.rules.push({ allow: key === "allow", path: value }); }
  }
  const ua = userAgent.toLowerCase(); const matching = groups.filter((g) => g.agents.some((a) => a === "*" || ua.includes(a)));
  const rules = matching.flatMap((g) => g.rules).filter((r) => path.startsWith(r.path)).sort((a, b) => b.path.length - a.path.length || Number(b.allow) - Number(a.allow));
  return rules[0] ? { allowed: rules[0].allow, rule: `${rules[0].allow ? "Allow" : "Disallow"}: ${rules[0].path}` } : { allowed: true };
}
