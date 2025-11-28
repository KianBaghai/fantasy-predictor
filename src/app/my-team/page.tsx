"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";
import { parseCSV, toNumber } from "@/utils/csv";
import {
  computeFantasyPoints,
  detectPlayerNameKey,
  Position,
  Scoring,
} from "@/utils/scoring";

type Player = {
  id: string;
  name: string;
  position: Position;
  points: number;
  raw: Record<string, string | number>;
};

type RosterSlot = "starter" | "bench";

type RosterPlayer = Player & {
  slot: RosterSlot;
};

const FILES: Record<Position, string> = {
  QB: "2025_qb_predictions.csv",
  RB: "2025_rb_predictions.csv",
  WR: "2025_wr_predictions.csv",
  TE: "2025_te_predictions.csv",
};

const DATA_DIR = `/data/${encodeURIComponent("fantasy predictions")}`;

const POSITION_LIMITS: Record<Position, number> = {
  QB: 2,
  RB: 5,
  WR: 5,
  TE: 4,
};

const STARTER_LIMITS: Record<Position, number> = {
  QB: 1,
  RB: 2,
  WR: 2,
  TE: 1,
};

const SCORING_LABELS: Record<Scoring, string> = {
  STANDARD: "Standard",
  HALF_PPR: "Half PPR",
  PPR: "PPR",
};

export default function MyTeamPage() {
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [scoring, setScoring] = useState<Scoring>("PPR");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPosition, setFilterPosition] = useState<Position | "ALL">("ALL");

  // Load all players from all positions
  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      const players: Player[] = [];

      for (const pos of ["QB", "RB", "WR", "TE"] as Position[]) {
        try {
          const res = await fetch(`${DATA_DIR}/${FILES[pos]}`);
          if (!res.ok) continue;
          const text = await res.text();
          const { rows } = parseCSV(text);

          const nameKey = rows.length > 0 ? detectPlayerNameKey(rows[0]) : null;

          // Dedupe by player name within this position (keep higher projection)
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

          Object.values(byName).forEach((entry, idx) => {
            players.push({
              id: `${pos}-${entry.name}-${idx}`,
              name: entry.name,
              position: pos,
              points: entry.points,
              raw: entry.row,
            });
          });
        } catch (e) {
          console.error(`Failed to load ${pos}:`, e);
        }
      }

      // Sort by points
      players.sort((a, b) => b.points - a.points);
      setAllPlayers(players);
      setLoading(false);
    };

    loadAll();
  }, [scoring]);

  // Recalculate roster points when scoring changes
  useEffect(() => {
    setRoster((prev) =>
      prev.map((p) => ({
        ...p,
        points: computeFantasyPoints(
          p.raw as Record<string, string>,
          p.position,
          scoring
        ),
      }))
    );
  }, [scoring]);

  // Count players by position on roster
  const rosterCounts = useMemo(() => {
    const counts: Record<Position, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };
    roster.forEach((p) => counts[p.position]++);
    return counts;
  }, [roster]);

  // Count starters by position
  const starterCounts = useMemo(() => {
    const counts: Record<Position, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };
    roster
      .filter((p) => p.slot === "starter")
      .forEach((p) => counts[p.position]++);
    return counts;
  }, [roster]);

  // Check if can add player
  const canAddPlayer = (player: Player): boolean => {
    const isOnRoster = roster.some((p) => p.id === player.id);
    if (isOnRoster) return false;
    return rosterCounts[player.position] < POSITION_LIMITS[player.position];
  };

  // Check if can set as starter
  const canSetStarter = (player: RosterPlayer): boolean => {
    if (player.slot === "starter") return true;
    return starterCounts[player.position] < STARTER_LIMITS[player.position];
  };

  // Add player to roster
  const addPlayer = (player: Player) => {
    if (!canAddPlayer(player)) return;

    // Auto-assign as starter if slot available
    const isStarter =
      starterCounts[player.position] < STARTER_LIMITS[player.position];

    setRoster((prev) => [
      ...prev,
      { ...player, slot: isStarter ? "starter" : "bench" },
    ]);
  };

  // Remove player from roster
  const removePlayer = (playerId: string) => {
    setRoster((prev) => prev.filter((p) => p.id !== playerId));
  };

  // Toggle starter/bench
  const toggleSlot = (playerId: string) => {
    setRoster((prev) =>
      prev.map((p) => {
        if (p.id !== playerId) return p;
        if (p.slot === "starter") {
          return { ...p, slot: "bench" };
        } else {
          // Check if can become starter
          const currentStarters = prev.filter(
            (x) => x.position === p.position && x.slot === "starter"
          ).length;
          if (currentStarters < STARTER_LIMITS[p.position]) {
            return { ...p, slot: "starter" };
          }
          return p;
        }
      })
    );
  };

  // Calculate totals
  const starterPoints = useMemo(() => {
    return roster
      .filter((p) => p.slot === "starter")
      .reduce((sum, p) => sum + p.points, 0);
  }, [roster]);

  const totalPoints = useMemo(() => {
    return roster.reduce((sum, p) => sum + p.points, 0);
  }, [roster]);

  // Filter available players
  const filteredPlayers = useMemo(() => {
    return allPlayers.filter((p) => {
      const matchesSearch = p.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchesPosition =
        filterPosition === "ALL" || p.position === filterPosition;
      return matchesSearch && matchesPosition;
    });
  }, [allPlayers, searchQuery, filterPosition]);

  // Separate starters and bench
  const starters = roster.filter((p) => p.slot === "starter");
  const bench = roster.filter((p) => p.slot === "bench");

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header}>
          <Link href="/" className={styles.backLink}>
            ← Back to Rankings
          </Link>
          <h1 className={styles.title}>📋 My Team Builder</h1>
          <p className={styles.subtitle}>
            Build your fantasy roster and see projected points
          </p>
        </header>

        {/* Scoring Toggle */}
        <div className={styles.controls}>
          <div className={styles.controlGroup}>
            <span className={styles.controlLabel}>Scoring Format</span>
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
        </div>

        <div className={styles.layout}>
          {/* Left: Player Pool */}
          <div className={styles.playerPool}>
            <div className={styles.poolHeader}>
              <h2 className={styles.sectionTitle}>Available Players</h2>
              <div className={styles.filters}>
                <input
                  type="text"
                  placeholder="Search players..."
                  className={styles.searchInput}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <div className={styles.positionFilter}>
                  {(["ALL", "QB", "RB", "WR", "TE"] as const).map((pos) => (
                    <button
                      key={pos}
                      className={`${styles.filterButton} ${
                        filterPosition === pos ? styles.filterButtonActive : ""
                      }`}
                      onClick={() => setFilterPosition(pos)}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {loading ? (
              <div className={styles.loading}>Loading players...</div>
            ) : (
              <div className={styles.playerList}>
                {filteredPlayers.slice(0, 100).map((player) => {
                  const onRoster = roster.some((p) => p.id === player.id);
                  const atLimit =
                    rosterCounts[player.position] >=
                    POSITION_LIMITS[player.position];

                  return (
                    <div
                      key={player.id}
                      className={`${styles.playerCard} ${
                        onRoster ? styles.playerOnRoster : ""
                      }`}
                    >
                      <div className={styles.playerInfo}>
                        <span className={styles.playerPosition}>
                          {player.position}
                        </span>
                        <span className={styles.playerName}>{player.name}</span>
                        <span className={styles.playerPoints}>
                          {player.points.toFixed(1)} pts
                        </span>
                      </div>
                      {onRoster ? (
                        <span className={styles.addedBadge}>Added</span>
                      ) : (
                        <button
                          className={styles.addButton}
                          onClick={() => addPlayer(player)}
                          disabled={atLimit}
                          title={
                            atLimit
                              ? `Max ${POSITION_LIMITS[player.position]} ${
                                  player.position
                                }s`
                              : "Add to roster"
                          }
                        >
                          {atLimit ? "Full" : "+ Add"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: Roster */}
          <div className={styles.rosterPanel}>
            <div className={styles.rosterHeader}>
              <h2 className={styles.sectionTitle}>My Roster</h2>
              <div className={styles.rosterLimits}>
                {(["QB", "RB", "WR", "TE"] as Position[]).map((pos) => (
                  <span
                    key={pos}
                    className={`${styles.limitBadge} ${
                      rosterCounts[pos] >= POSITION_LIMITS[pos]
                        ? styles.limitFull
                        : ""
                    }`}
                  >
                    {pos}: {rosterCounts[pos]}/{POSITION_LIMITS[pos]}
                  </span>
                ))}
              </div>
            </div>

            {/* Points Summary */}
            <div className={styles.pointsSummary}>
              <div className={styles.pointsCard}>
                <span className={styles.pointsLabel}>Starter Points</span>
                <span className={styles.pointsValue}>
                  {starterPoints.toFixed(1)}
                </span>
              </div>
              <div className={styles.pointsCard}>
                <span className={styles.pointsLabel}>Total Roster</span>
                <span className={styles.pointsValueSecondary}>
                  {totalPoints.toFixed(1)}
                </span>
              </div>
            </div>

            {/* Starters */}
            <div className={styles.rosterSection}>
              <h3 className={styles.rosterSectionTitle}>
                Starters
                <span className={styles.starterLimits}>
                  (1 QB, 2 RB, 2 WR, 1 TE)
                </span>
              </h3>
              {starters.length === 0 ? (
                <p className={styles.emptyMessage}>
                  Add players to your starting lineup
                </p>
              ) : (
                <div className={styles.rosterList}>
                  {starters.map((player) => (
                    <div key={player.id} className={styles.rosterCard}>
                      <div className={styles.rosterPlayerInfo}>
                        <span className={styles.rosterPosition}>
                          {player.position}
                        </span>
                        <span className={styles.rosterName}>{player.name}</span>
                        <span className={styles.rosterPoints}>
                          {player.points.toFixed(1)}
                        </span>
                      </div>
                      <div className={styles.rosterActions}>
                        <button
                          className={styles.benchButton}
                          onClick={() => toggleSlot(player.id)}
                          title="Move to bench"
                        >
                          ↓ Bench
                        </button>
                        <button
                          className={styles.removeButton}
                          onClick={() => removePlayer(player.id)}
                          title="Remove from roster"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bench */}
            <div className={styles.rosterSection}>
              <h3 className={styles.rosterSectionTitle}>Bench</h3>
              {bench.length === 0 ? (
                <p className={styles.emptyMessage}>No players on bench</p>
              ) : (
                <div className={styles.rosterList}>
                  {bench.map((player) => {
                    const canStart = canSetStarter(player);
                    return (
                      <div
                        key={player.id}
                        className={`${styles.rosterCard} ${styles.benchCard}`}
                      >
                        <div className={styles.rosterPlayerInfo}>
                          <span className={styles.rosterPosition}>
                            {player.position}
                          </span>
                          <span className={styles.rosterName}>
                            {player.name}
                          </span>
                          <span className={styles.rosterPoints}>
                            {player.points.toFixed(1)}
                          </span>
                        </div>
                        <div className={styles.rosterActions}>
                          <button
                            className={styles.startButton}
                            onClick={() => toggleSlot(player.id)}
                            disabled={!canStart}
                            title={
                              canStart
                                ? "Move to starters"
                                : "Starter slots full"
                            }
                          >
                            ↑ Start
                          </button>
                          <button
                            className={styles.removeButton}
                            onClick={() => removePlayer(player.id)}
                            title="Remove from roster"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {roster.length > 0 && (
              <button
                className={styles.clearButton}
                onClick={() => setRoster([])}
              >
                Clear Roster
              </button>
            )}
          </div>
        </div>

        <footer className={styles.footer}>
          <p>
            Roster limits: 2 QB, 5 RB, 5 WR, 4 TE • Starters: 1 QB, 2 RB, 2 WR,
            1 TE
          </p>
        </footer>
      </main>
    </div>
  );
}
