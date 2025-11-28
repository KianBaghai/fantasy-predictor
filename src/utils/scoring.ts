import { CSVRow, toNumber } from "./csv";

export type Position = "QB" | "RB" | "WR" | "TE";
export type Scoring = "STANDARD" | "HALF_PPR" | "PPR";

export function detectPlayerNameKey(
  row: Record<string, string>
): string | null {
  const keys = Object.keys(row);
  const candidates = [
    "PlayerName",
    "player",
    "player_name",
    "name",
    "playername",
    "full_name",
  ];
  for (const c of candidates) if (keys.includes(c)) return c;
  const fuzzy = keys.find(
    (k) =>
      k.toLowerCase().includes("name") || k.toLowerCase().includes("player")
  );
  return fuzzy ?? null;
}

// Get the stat columns we care about for each position
export function getStatColumns(
  position: Position
): { key: string; label: string }[] {
  switch (position) {
    case "QB":
      return [
        { key: "PassingYDS_pred", label: "Pass Yds" },
        { key: "PassingTD_pred", label: "Pass TD" },
        { key: "PassingInt_pred", label: "INT" },
        { key: "RushingYDS_pred", label: "Rush Yds" },
        { key: "RushingTD_pred", label: "Rush TD" },
      ];
    case "RB":
      return [
        { key: "RushingYDS_pred", label: "Rush Yds" },
        { key: "RushingTD_pred", label: "Rush TD" },
        { key: "ReceivingRec_pred", label: "Rec" },
        { key: "ReceivingYDS_pred", label: "Rec Yds" },
        { key: "ReceivingTD_pred", label: "Rec TD" },
      ];
    case "WR":
    case "TE":
      return [
        { key: "ReceivingRec_pred", label: "Rec" },
        { key: "ReceivingYDS_pred", label: "Rec Yds" },
        { key: "ReceivingTD_pred", label: "Rec TD" },
        { key: "Targets_pred", label: "Targets" },
      ];
  }
}

export function computeFantasyPoints(
  row: CSVRow,
  position: Position,
  scoring: Scoring
): number {
  // Read stats directly from actual CSV column names
  const passYds = toNumber(row["PassingYDS_pred"]);
  const passTD = toNumber(row["PassingTD_pred"]);
  const passInt = toNumber(row["PassingInt_pred"]);

  const rushYds = toNumber(row["RushingYDS_pred"]);
  const rushTD = toNumber(row["RushingTD_pred"]);

  const rec = toNumber(row["ReceivingRec_pred"]);
  const recYds = toNumber(row["ReceivingYDS_pred"]);
  const recTD = toNumber(row["ReceivingTD_pred"]);

  // Scoring rules
  const scoringPassYd = 1 / 25; // 0.04 per yard
  const scoringPassTD = 4;
  const scoringINT = -2;
  const scoringRushRecYd = 1 / 10; // 0.1 per yard
  const scoringRushRecTD = 6;
  const pprFactor = scoring === "PPR" ? 1 : scoring === "HALF_PPR" ? 0.5 : 0;

  let points = 0;

  // Passing (mainly for QBs)
  points +=
    passYds * scoringPassYd + passTD * scoringPassTD + passInt * scoringINT;

  // Rushing
  points += rushYds * scoringRushRecYd + rushTD * scoringRushRecTD;

  // Receiving
  points +=
    recYds * scoringRushRecYd + recTD * scoringRushRecTD + rec * pprFactor;

  return Math.round(points * 100) / 100;
}

// Format a stat value for display (round to 1 decimal)
export function formatStat(value: string | number | undefined): string {
  const num = toNumber(value);
  return num.toFixed(1);
}
