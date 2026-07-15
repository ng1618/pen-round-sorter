import type { Assignment, PlayerEntry, Round } from "./types";

function shuffled<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Random Serial Dictatorship: players are visited in a random order and
 * each takes their most-preferred round that still has an open seat.
 * Fair and strategy-proof (ranking honestly is always a player's best
 * move), at the cost of not being globally optimal.
 */
export function runMatching(rounds: Round[], entries: PlayerEntry[]): Assignment[] {
  const capacityLeft = new Map(rounds.map((r) => [r.id, r.capacity]));

  return shuffled(entries).map((entry) => {
    const roundId = entry.rankedRoundIds.find((id) => (capacityLeft.get(id) ?? 0) > 0);
    if (roundId) {
      capacityLeft.set(roundId, capacityLeft.get(roundId)! - 1);
    }
    return { playerId: entry.id, roundId: roundId ?? null };
  });
}
