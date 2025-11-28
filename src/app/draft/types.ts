import { Position } from "@/utils/scoring";

/** A player available for drafting with computed metrics */
export type DraftPlayer = {
  id: string;
  name: string;
  position: Position;
  points: number;
  vor: number; // Value Over Replacement
  tier: number;
  raw: Record<string, string | number>;
};

/** A single draft pick record */
export type DraftPick = {
  round: number;
  pick: number;
  overall: number;
  teamIndex: number;
  player: DraftPlayer;
};

/** A team's roster organized by position */
export type TeamRoster = {
  QB: DraftPlayer[];
  RB: DraftPlayer[];
  WR: DraftPlayer[];
  TE: DraftPlayer[];
};

/** The current phase of the draft */
export type DraftPhase = "setup" | "drafting" | "complete";

/** Draft speed options */
export type DraftSpeed = "slow" | "medium" | "fast";

/** An upcoming pick in the draft queue */
export type UpcomingPick = {
  pick: number;
  team: number;
  isUser: boolean;
};

/** Team ranking data for results display */
export type TeamRanking = {
  teamIndex: number;
  name: string;
  roster: TeamRoster;
  totalPoints: number;
  starterPoints: number;
  isUser: boolean;
};
