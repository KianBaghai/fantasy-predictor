import { DraftPlayer, TeamRoster } from "./types";
import { Position } from "@/utils/scoring";

/**
 * Get the ordinal suffix for a number (1st, 2nd, 3rd, etc.)
 */
export function getOrdinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

/**
 * Calculate total fantasy points for all players on a roster
 */
export function getTeamTotalPoints(roster: TeamRoster): number {
  const allPlayers = [...roster.QB, ...roster.RB, ...roster.WR, ...roster.TE];
  return allPlayers.reduce((sum, p) => sum + p.points, 0);
}

/**
 * Calculate starter fantasy points using standard lineup:
 * 1 QB, 2 RB, 2 WR, 1 TE, 1 FLEX (best remaining RB/WR/TE)
 */
export function getStarterPoints(roster: TeamRoster): number {
  const qb = roster.QB.slice(0, 1);
  const rb = roster.RB.slice(0, 2);
  const wr = roster.WR.slice(0, 2);
  const te = roster.TE.slice(0, 1);

  // Flex: best remaining RB/WR/TE after starters
  const flexCandidates = [
    ...roster.RB.slice(2),
    ...roster.WR.slice(2),
    ...roster.TE.slice(1),
  ].sort((a, b) => b.points - a.points);
  const flex = flexCandidates.slice(0, 1);

  return [...qb, ...rb, ...wr, ...te, ...flex].reduce(
    (sum, p) => sum + p.points,
    0
  );
}

/**
 * Get the team index for a given pick number in a snake draft
 * Odd rounds: picks go 1→12
 * Even rounds: picks go 12→1
 */
export function getSnakeDraftTeamIndex(
  pickNumber: number,
  numTeams: number
): number {
  const round = Math.floor(pickNumber / numTeams);
  const pickInRound = pickNumber % numTeams;
  return round % 2 === 0 ? pickInRound : numTeams - 1 - pickInRound;
}

/**
 * Count players at each position on a roster
 */
export function countRosterPositions(
  roster: TeamRoster
): Record<Position, number> {
  return {
    QB: roster.QB.length,
    RB: roster.RB.length,
    WR: roster.WR.length,
    TE: roster.TE.length,
  };
}

/**
 * Create an empty team roster
 */
export function createEmptyRoster(): TeamRoster {
  return {
    QB: [],
    RB: [],
    WR: [],
    TE: [],
  };
}

/**
 * Check if a player is a starter based on position and roster index
 * Starters: 1 QB, 2 RB, 2 WR, 1 TE
 */
export function isStarterSlot(position: Position, index: number): boolean {
  if (position === "QB" || position === "TE") {
    return index === 0;
  }
  // RB and WR have 2 starter slots
  return index <= 1;
}
