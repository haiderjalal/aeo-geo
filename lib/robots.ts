/**
 * Minimal robots.txt evaluator — enough to answer "may this bot fetch this path?".
 * Follows the usual precedence: an exact user-agent group wins over `*`, and
 * within a group the longest matching rule wins (Allow breaks ties).
 */

interface Rule {
  allow: boolean;
  path: string;
}

type Groups = Map<string, Rule[]>;

export function parseRobots(text: string): Groups {
  const groups: Groups = new Map();
  let current: string[] = [];
  let collectingAgents = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.split("#")[0].trim();
    if (!line) continue;
    const sep = line.indexOf(":");
    if (sep === -1) continue;
    const field = line.slice(0, sep).trim().toLowerCase();
    const value = line.slice(sep + 1).trim();

    if (field === "user-agent") {
      if (!collectingAgents) current = [];
      collectingAgents = true;
      const agent = value.toLowerCase();
      current.push(agent);
      if (!groups.has(agent)) groups.set(agent, []);
      continue;
    }

    if (field === "allow" || field === "disallow") {
      collectingAgents = false;
      if (current.length === 0) continue;
      for (const agent of current) {
        groups.get(agent)?.push({ allow: field === "allow", path: value });
      }
    }
  }
  return groups;
}

function matches(rule: string, path: string): number {
  if (rule === "") return -1; // empty Disallow means "allow everything"
  const hasEnd = rule.endsWith("$");
  const pattern = hasEnd ? rule.slice(0, -1) : rule;
  const parts = pattern.split("*");

  let cursor = 0;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part === "") continue;
    const at = i === 0 ? (path.startsWith(part) ? 0 : -1) : path.indexOf(part, cursor);
    if (at === -1) return -1;
    cursor = at + part.length;
  }
  if (hasEnd && cursor !== path.length) return -1;
  return pattern.length;
}

/** Returns true when `agent` is permitted to fetch `path`. */
export function isAllowed(groups: Groups, agent: string, path: string): boolean {
  const key = agent.toLowerCase();
  const rules = groups.get(key) ?? groups.get("*");
  if (!rules || rules.length === 0) return true;

  let best: Rule | null = null;
  let bestLen = -1;
  for (const rule of rules) {
    const len = matches(rule.path, path);
    if (len < 0) continue;
    if (len > bestLen || (len === bestLen && rule.allow)) {
      best = rule;
      bestLen = len;
    }
  }
  return best ? best.allow : true;
}

/** True when robots.txt names this agent in its own group, rather than relying on `*`. */
export function hasExplicitGroup(groups: Groups, agent: string): boolean {
  return groups.has(agent.toLowerCase());
}
