import { Position, Scoring } from "@/utils/scoring";

/** CSV files for each position */
export const POSITION_FILES: Record<Position, string> = {
  QB: "2025_qb_predictions.csv",
  RB: "2025_rb_predictions.csv",
  WR: "2025_wr_predictions.csv",
  TE: "2025_te_predictions.csv",
};

/** Path to prediction data files */
export const DATA_DIR = `/data/${encodeURIComponent("fantasy predictions")}`;

/** Human-readable scoring format labels */
export const SCORING_LABELS: Record<Scoring, string> = {
  STANDARD: "Standard",
  HALF_PPR: "Half PPR",
  PPR: "PPR",
};

/** Number of teams in the draft */
export const NUM_TEAMS = 12;

/** Number of rounds in the draft */
export const ROUNDS = 15;

/** Total roster size per team */
export const ROSTER_SIZE = 15;

/**
 * Roster requirements for CPU drafting logic
 * min: minimum required at position
 * max: maximum allowed at position
 */
export const ROSTER_TARGETS: Record<Position, { min: number; max: number }> = {
  QB: { min: 1, max: 2 },
  RB: { min: 4, max: 6 },
  WR: { min: 4, max: 6 },
  TE: { min: 1, max: 2 },
};

/**
 * Position scarcity weights for draft value calculation
 * Higher value = prioritize drafting earlier
 */
export const POSITION_VALUE: Record<Position, number> = {
  RB: 1.15,
  WR: 1.1,
  TE: 1.0,
  QB: 0.95,
};

/**
 * Replacement player thresholds for VOR (Value Over Replacement) calculation
 * The rank of the "replacement level" player at each position
 */
export const REPLACEMENT_RANK: Record<Position, number> = {
  QB: 12,
  RB: 24,
  WR: 24,
  TE: 12,
};

/** Display names for each team */
export const TEAM_NAMES = [
  "Your Team",
  "CPU Team 2",
  "CPU Team 3",
  "CPU Team 4",
  "CPU Team 5",
  "CPU Team 6",
  "CPU Team 7",
  "CPU Team 8",
  "CPU Team 9",
  "CPU Team 10",
  "CPU Team 11",
  "CPU Team 12",
];

/** Delay in ms for each draft speed setting */
export const DRAFT_SPEED_DELAYS: Record<"slow" | "medium" | "fast", number> = {
  slow: 1000,
  medium: 500,
  fast: 200,
};
