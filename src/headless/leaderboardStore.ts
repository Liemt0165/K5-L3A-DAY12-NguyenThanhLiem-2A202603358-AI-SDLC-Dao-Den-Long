import fs from 'node:fs';
import path from 'node:path';

export interface LeaderboardEntry {
  name: string;
  score: number;
  nights_won: number;
  achieved_at: string;
  seed: number;
}

export interface LeaderboardFile {
  entries: LeaderboardEntry[];
}

const DEFAULT_STORE_PATH = path.resolve(process.cwd(), '.dao-den-long-leaderboard.json');

export function sortAndTrimLeaderboard(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const ta = Date.parse(a.achieved_at) || 0;
      const tb = Date.parse(b.achieved_at) || 0;
      return ta - tb;
    })
    .slice(0, 10);
}

export function loadLeaderboard(storePath = DEFAULT_STORE_PATH): LeaderboardFile {
  try {
    if (!fs.existsSync(storePath)) {
      return { entries: [] };
    }
    const raw = fs.readFileSync(storePath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<LeaderboardFile>;
    if (!parsed || !Array.isArray(parsed.entries)) {
      return { entries: [] };
    }
    const valid = parsed.entries.filter(
      (e): e is LeaderboardEntry =>
        Boolean(e) &&
        typeof e.name === 'string' &&
        typeof e.score === 'number' &&
        typeof e.nights_won === 'number' &&
        typeof e.achieved_at === 'string' &&
        typeof e.seed === 'number'
    );
    return { entries: sortAndTrimLeaderboard(valid) };
  } catch {
    return { entries: [] };
  }
}

export function addLeaderboardEntry(
  entry: LeaderboardEntry,
  storePath = DEFAULT_STORE_PATH
): LeaderboardFile {
  const current = loadLeaderboard(storePath);
  current.entries.push(entry);
  const next: LeaderboardFile = {
    entries: sortAndTrimLeaderboard(current.entries)
  };
  fs.writeFileSync(storePath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
  return next;
}
