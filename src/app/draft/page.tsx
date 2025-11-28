"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import styles from "./page.module.css";
import { parseCSV } from "@/utils/csv";
import {
  computeFantasyPoints,
  detectPlayerNameKey,
  Position,
  Scoring,
} from "@/utils/scoring";

// Types
type DraftPlayer = {
  id: string;
  name: string;
  position: Position;
  points: number;
  vor: number; // Value Over Replacement
  tier: number;
  raw: Record<string, string | number>;
};

type DraftPick = {
  round: number;
  pick: number;
  overall: number;
  teamIndex: number;
  player: DraftPlayer;
};

type TeamRoster = {
  QB: DraftPlayer[];
  RB: DraftPlayer[];
  WR: DraftPlayer[];
  TE: DraftPlayer[];
};

type DraftState = "setup" | "drafting" | "complete";

// Constants
const FILES: Record<Position, string> = {
  QB: "2025_qb_predictions.csv",
  RB: "2025_rb_predictions.csv",
  WR: "2025_wr_predictions.csv",
  TE: "2025_te_predictions.csv",
};

const DATA_DIR = `/data/${encodeURIComponent("fantasy predictions")}`;

const SCORING_LABELS: Record<Scoring, string> = {
  STANDARD: "Standard",
  HALF_PPR: "Half PPR",
  PPR: "PPR",
};

const ROSTER_SIZE = 15;
const NUM_TEAMS = 12;
const ROUNDS = 15;

// Roster requirements for CPU logic
const ROSTER_TARGETS: Record<Position, { min: number; max: number }> = {
  QB: { min: 1, max: 2 },
  RB: { min: 4, max: 6 },
  WR: { min: 4, max: 6 },
  TE: { min: 1, max: 2 },
};

// Position scarcity weights (higher = draft earlier)
const POSITION_VALUE: Record<Position, number> = {
  RB: 1.15,
  WR: 1.1,
  TE: 1.0,
  QB: 0.95,
};

// Replacement player thresholds (for VOR calculation)
const REPLACEMENT_RANK: Record<Position, number> = {
  QB: 12,
  RB: 24,
  WR: 24,
  TE: 12,
};

// Team names for display
const TEAM_NAMES = [
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

export default function DraftPage() {
  // Core state
  const [allPlayers, setAllPlayers] = useState<DraftPlayer[]>([]);
  const [availablePlayers, setAvailablePlayers] = useState<DraftPlayer[]>([]);
  const [draftPicks, setDraftPicks] = useState<DraftPick[]>([]);
  const [teamRosters, setTeamRosters] = useState<TeamRoster[]>([]);

  // Settings
  const [scoring, setScoring] = useState<Scoring>("PPR");
  const [userPickPosition, setUserPickPosition] = useState<number>(1);
  const [draftState, setDraftState] = useState<DraftState>("setup");

  // UI state
  const [loading, setLoading] = useState(true);
  const [filterPosition, setFilterPosition] = useState<Position | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [autopick, setAutopick] = useState(false);
  const [draftSpeed, setDraftSpeed] = useState<"slow" | "medium" | "fast">(
    "medium"
  );
  const [selectedTeamView, setSelectedTeamView] = useState<number>(0);

  // Derived values
  const currentPick = draftPicks.length;
  const currentRound = Math.floor(currentPick / NUM_TEAMS) + 1;

  // Snake draft: odd rounds go 1-12, even rounds go 12-1
  const getCurrentTeamIndex = useCallback((pickNumber: number) => {
    const round = Math.floor(pickNumber / NUM_TEAMS);
    const pickInRound = pickNumber % NUM_TEAMS;
    return round % 2 === 0 ? pickInRound : NUM_TEAMS - 1 - pickInRound;
  }, []);

  const currentTeamIndex = getCurrentTeamIndex(currentPick);
  const isUserTurn = currentTeamIndex === userPickPosition - 1;

  // Calculate user's pick position adjusted for 0-index
  const userTeamIndex = userPickPosition - 1;

  // Load all players
  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      const playersByPosition: Record<Position, DraftPlayer[]> = {
        QB: [],
        RB: [],
        WR: [],
        TE: [],
      };

      for (const pos of ["QB", "RB", "WR", "TE"] as Position[]) {
        try {
          const res = await fetch(`${DATA_DIR}/${FILES[pos]}`);
          if (!res.ok) continue;
          const text = await res.text();
          const { rows } = parseCSV(text);

          const nameKey = rows.length > 0 ? detectPlayerNameKey(rows[0]) : null;

          // Dedupe by player name
          const byName: Record<
            string,
            {
              row: Record<string, string | number>;
              points: number;
              name: string;
            }
          > = {};
          rows.forEach((row, idx) => {
            const rawName = nameKey ? String(row[nameKey]) : `Player ${idx}`;
            const key = rawName.toLowerCase().trim();
            const points = computeFantasyPoints(row, pos, scoring);
            if (!byName[key] || points > byName[key].points) {
              byName[key] = { row, points, name: rawName };
            }
          });

          Object.values(byName).forEach((entry) => {
            playersByPosition[pos].push({
              id: `${pos}-${entry.name}`,
              name: entry.name,
              position: pos,
              points: entry.points,
              vor: 0,
              tier: 0,
              raw: entry.row,
            });
          });

          // Sort by points
          playersByPosition[pos].sort((a, b) => b.points - a.points);
        } catch (e) {
          console.error(`Failed to load ${pos}:`, e);
        }
      }

      // Calculate VOR for each position
      for (const pos of ["QB", "RB", "WR", "TE"] as Position[]) {
        const players = playersByPosition[pos];
        const replacementValue =
          players[REPLACEMENT_RANK[pos] - 1]?.points ?? 0;

        players.forEach((p, idx) => {
          p.vor = p.points - replacementValue;
          // Simple tier assignment: every 3-4 players based on VOR gaps
          p.tier = Math.floor(idx / 4) + 1;
        });
      }

      // Combine all players and sort by VOR * position value
      const all = Object.values(playersByPosition).flat();
      all.sort((a, b) => {
        const aValue = a.vor * POSITION_VALUE[a.position];
        const bValue = b.vor * POSITION_VALUE[b.position];
        return bValue - aValue;
      });

      setAllPlayers(all);
      setAvailablePlayers(all);
      setLoading(false);
    };

    loadAll();
  }, [scoring]);

  // Initialize team rosters
  useEffect(() => {
    const rosters: TeamRoster[] = Array.from({ length: NUM_TEAMS }, () => ({
      QB: [],
      RB: [],
      WR: [],
      TE: [],
    }));
    setTeamRosters(rosters);
  }, []);

  // CPU drafting logic
  const getCPUPick = useCallback(
    (
      available: DraftPlayer[],
      teamRoster: TeamRoster,
      round: number
    ): DraftPlayer | null => {
      if (available.length === 0) return null;

      // Count current roster
      const counts: Record<Position, number> = {
        QB: teamRoster.QB.length,
        RB: teamRoster.RB.length,
        WR: teamRoster.WR.length,
        TE: teamRoster.TE.length,
      };

      const totalPicks = counts.QB + counts.RB + counts.WR + counts.TE;
      const picksRemaining = ROSTER_SIZE - totalPicks;

      // Determine positions we need
      const neededPositions: Position[] = [];
      const wantedPositions: Position[] = [];

      for (const pos of ["QB", "RB", "WR", "TE"] as Position[]) {
        if (counts[pos] < ROSTER_TARGETS[pos].min) {
          neededPositions.push(pos);
        }
        if (counts[pos] < ROSTER_TARGETS[pos].max) {
          wantedPositions.push(pos);
        }
      }

      // Filter available by position constraints
      let candidates = available.filter((p) => {
        // Don't overdraft any position
        if (counts[p.position] >= ROSTER_TARGETS[p.position].max) return false;
        return true;
      });

      if (candidates.length === 0) {
        candidates = available; // Fallback
      }

      // If we're running low on picks and need positions, prioritize them
      if (
        neededPositions.length > 0 &&
        picksRemaining <= neededPositions.length + 2
      ) {
        const urgentCandidates = candidates.filter((p) =>
          neededPositions.includes(p.position)
        );
        if (urgentCandidates.length > 0) {
          candidates = urgentCandidates;
        }
      }

      // Score each candidate
      const scored = candidates.map((p) => {
        let score = p.vor * POSITION_VALUE[p.position];

        // Boost if we need this position
        if (neededPositions.includes(p.position)) {
          score *= 1.3;
        }

        // Slight boost for tier 1-2 players (value picks)
        if (p.tier <= 2) {
          score *= 1.1;
        }

        // Late round QB/TE boost if we don't have one
        if (round >= 8 && (p.position === "QB" || p.position === "TE")) {
          if (counts[p.position] === 0) {
            score *= 1.25;
          }
        }

        // Add small randomness for variety (±5%)
        score *= 0.95 + Math.random() * 0.1;

        return { player: p, score };
      });

      scored.sort((a, b) => b.score - a.score);
      return scored[0]?.player ?? available[0];
    },
    []
  );

  // Make a draft pick
  const makePick = useCallback(
    (player: DraftPlayer) => {
      const pickNumber = draftPicks.length;
      const round = Math.floor(pickNumber / NUM_TEAMS) + 1;
      const pickInRound = (pickNumber % NUM_TEAMS) + 1;
      const teamIndex = getCurrentTeamIndex(pickNumber);

      const pick: DraftPick = {
        round,
        pick: pickInRound,
        overall: pickNumber + 1,
        teamIndex,
        player,
      };

      setDraftPicks((prev) => [...prev, pick]);
      setAvailablePlayers((prev) => prev.filter((p) => p.id !== player.id));
      setTeamRosters((prev) => {
        const updated = [...prev];
        updated[teamIndex] = {
          ...updated[teamIndex],
          [player.position]: [...updated[teamIndex][player.position], player],
        };
        return updated;
      });

      // Check if draft is complete
      if (pickNumber + 1 >= ROUNDS * NUM_TEAMS) {
        setDraftState("complete");
      }
    },
    [draftPicks.length, getCurrentTeamIndex]
  );

  // Handle user pick
  const handleUserPick = useCallback(
    (player: DraftPlayer) => {
      if (!isUserTurn || draftState !== "drafting") return;
      makePick(player);
    },
    [isUserTurn, draftState, makePick]
  );

  // CPU auto-draft
  useEffect(() => {
    if (draftState !== "drafting") return;
    if (isUserTurn && !autopick) return;
    if (availablePlayers.length === 0) return;

    const delay =
      draftSpeed === "fast" ? 200 : draftSpeed === "medium" ? 500 : 1000;

    const timer = setTimeout(() => {
      const teamRoster = teamRosters[currentTeamIndex];
      const pick = getCPUPick(availablePlayers, teamRoster, currentRound);
      if (pick) {
        makePick(pick);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [
    draftState,
    isUserTurn,
    autopick,
    availablePlayers,
    currentTeamIndex,
    teamRosters,
    currentRound,
    getCPUPick,
    makePick,
    draftSpeed,
  ]);

  // Start draft
  const startDraft = () => {
    setDraftPicks([]);
    setAvailablePlayers(allPlayers);
    setTeamRosters(
      Array.from({ length: NUM_TEAMS }, () => ({
        QB: [],
        RB: [],
        WR: [],
        TE: [],
      }))
    );
    setDraftState("drafting");
    setSelectedTeamView(userTeamIndex);
  };

  // Reset draft
  const resetDraft = () => {
    setDraftState("setup");
    setDraftPicks([]);
    setAvailablePlayers(allPlayers);
    setTeamRosters(
      Array.from({ length: NUM_TEAMS }, () => ({
        QB: [],
        RB: [],
        WR: [],
        TE: [],
      }))
    );
    setAutopick(false);
  };

  // Calculate team total points
  const getTeamPoints = (roster: TeamRoster): number => {
    const allPlayers = [...roster.QB, ...roster.RB, ...roster.WR, ...roster.TE];
    return allPlayers.reduce((sum, p) => sum + p.points, 0);
  };

  // Calculate starter points (1QB, 2RB, 2WR, 1TE, 1FLEX)
  const getStarterPoints = (roster: TeamRoster): number => {
    const qb = roster.QB.slice(0, 1);
    const rb = roster.RB.slice(0, 2);
    const wr = roster.WR.slice(0, 2);
    const te = roster.TE.slice(0, 1);

    // Flex: best remaining RB/WR/TE
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
  };

  // Filter available players for display
  const filteredPlayers = useMemo(() => {
    return availablePlayers.filter((p) => {
      const matchesSearch = p.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchesPosition =
        filterPosition === "ALL" || p.position === filterPosition;
      return matchesSearch && matchesPosition;
    });
  }, [availablePlayers, searchQuery, filterPosition]);

  // Get upcoming picks for display
  const getUpcomingPicks = useCallback(
    (count: number = 8) => {
      const picks: { pick: number; team: number; isUser: boolean }[] = [];
      for (let i = 0; i < count; i++) {
        const pickNum = currentPick + i;
        if (pickNum >= ROUNDS * NUM_TEAMS) break;
        const teamIdx = getCurrentTeamIndex(pickNum);
        picks.push({
          pick: pickNum + 1,
          team: teamIdx + 1,
          isUser: teamIdx === userTeamIndex,
        });
      }
      return picks;
    },
    [currentPick, getCurrentTeamIndex, userTeamIndex]
  );

  // Team rankings for results
  const teamRankings = useMemo(() => {
    return teamRosters
      .map((roster, idx) => ({
        teamIndex: idx,
        name: idx === userTeamIndex ? "Your Team" : TEAM_NAMES[idx],
        roster,
        totalPoints: getTeamPoints(roster),
        starterPoints: getStarterPoints(roster),
        isUser: idx === userTeamIndex,
      }))
      .sort((a, b) => b.starterPoints - a.starterPoints);
  }, [teamRosters, userTeamIndex]);

  // Render setup screen
  if (draftState === "setup") {
    return (
      <div className={styles.page}>
        <main className={styles.main}>
          <header className={styles.header}>
            <Link href="/" className={styles.backLink}>
              ← Back to Rankings
            </Link>
            <h1 className={styles.title}>🏈 Mock Draft Simulator</h1>
            <p className={styles.subtitle}>
              Draft against 11 CPU teams and build your roster
            </p>
          </header>

          {loading ? (
            <div className={styles.loading}>Loading player data...</div>
          ) : (
            <div className={styles.setupCard}>
              <h2 className={styles.setupTitle}>Draft Settings</h2>

              <div className={styles.settingGroup}>
                <label className={styles.settingLabel}>
                  Your Draft Position
                </label>
                <div className={styles.pickSelector}>
                  {Array.from({ length: 12 }, (_, i) => (
                    <button
                      key={i + 1}
                      className={`${styles.pickButton} ${
                        userPickPosition === i + 1
                          ? styles.pickButtonActive
                          : ""
                      }`}
                      onClick={() => setUserPickPosition(i + 1)}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
                <p className={styles.settingHint}>
                  Pick {userPickPosition} means you draft{" "}
                  {userPickPosition === 1
                    ? "1st"
                    : `${userPickPosition}${getOrdinalSuffix(
                        userPickPosition
                      )}`}{" "}
                  in odd rounds, {13 - userPickPosition}
                  {getOrdinalSuffix(13 - userPickPosition)} in even rounds
                  (snake draft)
                </p>
              </div>

              <div className={styles.settingGroup}>
                <label className={styles.settingLabel}>Scoring Format</label>
                <div className={styles.tabs}>
                  {(["STANDARD", "HALF_PPR", "PPR"] as Scoring[]).map((s) => (
                    <button
                      key={s}
                      className={`${styles.tabButton} ${
                        s === scoring ? styles.tabButtonActive : ""
                      }`}
                      onClick={() => setScoring(s)}
                    >
                      {SCORING_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.settingGroup}>
                <label className={styles.settingLabel}>Draft Speed</label>
                <div className={styles.tabs}>
                  {(["slow", "medium", "fast"] as const).map((speed) => (
                    <button
                      key={speed}
                      className={`${styles.tabButton} ${
                        draftSpeed === speed ? styles.tabButtonActive : ""
                      }`}
                      onClick={() => setDraftSpeed(speed)}
                    >
                      {speed.charAt(0).toUpperCase() + speed.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.draftInfo}>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Teams</span>
                  <span className={styles.infoValue}>12</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Rounds</span>
                  <span className={styles.infoValue}>{ROUNDS}</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Format</span>
                  <span className={styles.infoValue}>Snake</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Players</span>
                  <span className={styles.infoValue}>{allPlayers.length}</span>
                </div>
              </div>

              <button className={styles.startButton} onClick={startDraft}>
                Start Draft 🚀
              </button>
            </div>
          )}
        </main>
      </div>
    );
  }

  // Render results screen
  if (draftState === "complete") {
    const userRank = teamRankings.findIndex((t) => t.isUser) + 1;
    const userTeam = teamRankings.find((t) => t.isUser)!;

    return (
      <div className={styles.page}>
        <main className={styles.main}>
          <header className={styles.header}>
            <h1 className={styles.title}>🏆 Draft Complete!</h1>
            <p className={styles.subtitle}>
              Your team finished{" "}
              <strong className={styles.rankHighlight}>#{userRank}</strong> out
              of 12 teams
            </p>
          </header>

          {/* User team summary */}
          <div className={styles.userSummary}>
            <h2 className={styles.summaryTitle}>Your Team</h2>
            <div className={styles.summaryStats}>
              <div className={styles.statBox}>
                <span className={styles.statLabel}>Starter Pts</span>
                <span className={styles.statValue}>
                  {userTeam.starterPoints.toFixed(1)}
                </span>
              </div>
              <div className={styles.statBox}>
                <span className={styles.statLabel}>Total Pts</span>
                <span className={styles.statValue}>
                  {userTeam.totalPoints.toFixed(1)}
                </span>
              </div>
              <div className={styles.statBox}>
                <span className={styles.statLabel}>Rank</span>
                <span
                  className={`${styles.statValue} ${
                    userRank <= 3 ? styles.topRank : ""
                  }`}
                >
                  #{userRank}
                </span>
              </div>
            </div>

            <div className={styles.rosterGrid}>
              {(["QB", "RB", "WR", "TE"] as Position[]).map((pos) => (
                <div key={pos} className={styles.positionGroup}>
                  <h4 className={styles.positionHeader}>{pos}</h4>
                  {userTeam.roster[pos].map((p, idx) => (
                    <div
                      key={p.id}
                      className={`${styles.rosterPlayer} ${
                        idx === 0 || (pos !== "QB" && pos !== "TE" && idx === 1)
                          ? styles.starter
                          : ""
                      }`}
                    >
                      <span className={styles.rosterName}>{p.name}</span>
                      <span className={styles.rosterPoints}>
                        {p.points.toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* All teams comparison */}
          <div className={styles.standingsCard}>
            <h2 className={styles.standingsTitle}>Final Standings</h2>
            <div className={styles.standingsList}>
              {teamRankings.map((team, idx) => (
                <div
                  key={team.teamIndex}
                  className={`${styles.standingsRow} ${
                    team.isUser ? styles.userRow : ""
                  }`}
                  onClick={() => setSelectedTeamView(team.teamIndex)}
                >
                  <span className={styles.standingsRank}>
                    {idx === 0
                      ? "🥇"
                      : idx === 1
                      ? "🥈"
                      : idx === 2
                      ? "🥉"
                      : `#${idx + 1}`}
                  </span>
                  <span className={styles.standingsName}>
                    {team.name}
                    {team.isUser && (
                      <span className={styles.youBadge}>YOU</span>
                    )}
                  </span>
                  <span className={styles.standingsPoints}>
                    {team.starterPoints.toFixed(1)} pts
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Selected team detail */}
          {selectedTeamView !== userTeamIndex && (
            <div className={styles.teamDetailCard}>
              <h3 className={styles.teamDetailTitle}>
                {TEAM_NAMES[selectedTeamView]} Roster
              </h3>
              <div className={styles.rosterGrid}>
                {(["QB", "RB", "WR", "TE"] as Position[]).map((pos) => (
                  <div key={pos} className={styles.positionGroup}>
                    <h4 className={styles.positionHeader}>{pos}</h4>
                    {teamRosters[selectedTeamView][pos].map((p) => (
                      <div key={p.id} className={styles.rosterPlayer}>
                        <span className={styles.rosterName}>{p.name}</span>
                        <span className={styles.rosterPoints}>
                          {p.points.toFixed(1)}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className={styles.actionButtons}>
            <button className={styles.draftAgainButton} onClick={resetDraft}>
              Draft Again 🔄
            </button>
            <Link href="/my-team" className={styles.buildTeamLink}>
              Build Custom Team →
            </Link>
          </div>
        </main>
      </div>
    );
  }

  // Render drafting screen
  return (
    <div className={styles.page}>
      <main className={styles.mainDrafting}>
        {/* Draft header */}
        <div className={styles.draftHeader}>
          <div className={styles.draftStatus}>
            <span className={styles.roundInfo}>
              Round {currentRound} of {ROUNDS}
            </span>
            <span className={styles.pickInfo}>
              Pick {currentPick + 1} of {ROUNDS * NUM_TEAMS}
            </span>
          </div>
          <div className={styles.turnIndicator}>
            {isUserTurn ? (
              <span className={styles.yourTurn}>🎯 Your Pick!</span>
            ) : (
              <span className={styles.cpuTurn}>
                CPU Team {currentTeamIndex + 1} picking...
              </span>
            )}
          </div>
          <div className={styles.draftActions}>
            <label className={styles.autopickLabel}>
              <input
                type="checkbox"
                checked={autopick}
                onChange={(e) => setAutopick(e.target.checked)}
              />
              Autopick
            </label>
            <button className={styles.exitButton} onClick={resetDraft}>
              Exit Draft
            </button>
          </div>
        </div>

        <div className={styles.draftLayout}>
          {/* Left: Available players */}
          <div className={styles.playerBoard}>
            <div className={styles.boardHeader}>
              <h2 className={styles.boardTitle}>Available Players</h2>
              <div className={styles.boardFilters}>
                <input
                  type="text"
                  placeholder="Search..."
                  className={styles.searchInput}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <div className={styles.positionTabs}>
                  {(["ALL", "QB", "RB", "WR", "TE"] as const).map((pos) => (
                    <button
                      key={pos}
                      className={`${styles.posTab} ${
                        filterPosition === pos ? styles.posTabActive : ""
                      }`}
                      onClick={() => setFilterPosition(pos)}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className={styles.playerList}>
              {filteredPlayers.slice(0, 50).map((player) => (
                <div
                  key={player.id}
                  className={`${styles.playerRow} ${
                    isUserTurn ? styles.clickable : ""
                  }`}
                  onClick={() => handleUserPick(player)}
                >
                  <span
                    className={`${styles.positionBadge} ${
                      styles[`pos${player.position}`]
                    }`}
                  >
                    {player.position}
                  </span>
                  <span className={styles.playerName}>{player.name}</span>
                  <span className={styles.playerPoints}>
                    {player.points.toFixed(1)}
                  </span>
                  <span className={styles.playerVor}>
                    VOR: {player.vor.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Center: Draft log & upcoming */}
          <div className={styles.draftCenter}>
            {/* Upcoming picks */}
            <div className={styles.upcomingPicks}>
              <h3 className={styles.sectionTitle}>On the Clock</h3>
              <div className={styles.pickQueue}>
                {getUpcomingPicks(8).map((pick, idx) => (
                  <div
                    key={pick.pick}
                    className={`${styles.queueItem} ${
                      idx === 0 ? styles.currentPick : ""
                    } ${pick.isUser ? styles.userPick : ""}`}
                  >
                    <span className={styles.queuePick}>#{pick.pick}</span>
                    <span className={styles.queueTeam}>
                      {pick.isUser ? "YOU" : `Team ${pick.team}`}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent picks */}
            <div className={styles.recentPicks}>
              <h3 className={styles.sectionTitle}>Recent Picks</h3>
              <div className={styles.pickLog}>
                {draftPicks
                  .slice(-10)
                  .reverse()
                  .map((pick) => (
                    <div
                      key={pick.overall}
                      className={`${styles.logItem} ${
                        pick.teamIndex === userTeamIndex
                          ? styles.userLogItem
                          : ""
                      }`}
                    >
                      <span className={styles.logPick}>#{pick.overall}</span>
                      <span className={styles.logTeam}>
                        {pick.teamIndex === userTeamIndex
                          ? "You"
                          : `Team ${pick.teamIndex + 1}`}
                      </span>
                      <span
                        className={`${styles.logPosition} ${
                          styles[`pos${pick.player.position}`]
                        }`}
                      >
                        {pick.player.position}
                      </span>
                      <span className={styles.logPlayer}>
                        {pick.player.name}
                      </span>
                    </div>
                  ))}
                {draftPicks.length === 0 && (
                  <p className={styles.noPicks}>Draft starting...</p>
                )}
              </div>
            </div>
          </div>

          {/* Right: Your team */}
          <div className={styles.yourTeam}>
            <div className={styles.teamHeader}>
              <h2 className={styles.teamTitle}>Your Team</h2>
              <div className={styles.teamPoints}>
                {getStarterPoints(
                  teamRosters[userTeamIndex] ?? {
                    QB: [],
                    RB: [],
                    WR: [],
                    TE: [],
                  }
                ).toFixed(1)}{" "}
                pts
              </div>
            </div>
            <div className={styles.teamRoster}>
              {(["QB", "RB", "WR", "TE"] as Position[]).map((pos) => {
                const players = teamRosters[userTeamIndex]?.[pos] ?? [];
                const targetMin = ROSTER_TARGETS[pos].min;
                const slots = Math.max(targetMin, players.length);

                return (
                  <div key={pos} className={styles.teamPosition}>
                    <div className={styles.teamPosHeader}>
                      <span className={styles.teamPosName}>{pos}</span>
                      <span className={styles.teamPosCount}>
                        {players.length}/{ROSTER_TARGETS[pos].max}
                      </span>
                    </div>
                    {Array.from({ length: slots }).map((_, idx) => {
                      const player = players[idx];
                      return (
                        <div
                          key={idx}
                          className={`${styles.teamSlot} ${
                            player ? "" : styles.emptySlot
                          }`}
                        >
                          {player ? (
                            <>
                              <span className={styles.slotName}>
                                {player.name}
                              </span>
                              <span className={styles.slotPoints}>
                                {player.points.toFixed(1)}
                              </span>
                            </>
                          ) : (
                            <span className={styles.slotEmpty}>Empty</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// Helper function for ordinal suffix
function getOrdinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
