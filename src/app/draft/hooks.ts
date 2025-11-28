"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { parseCSV } from "@/utils/csv";
import {
  computeFantasyPoints,
  detectPlayerNameKey,
  Position,
  Scoring,
} from "@/utils/scoring";
import {
  DraftPlayer,
  DraftPick,
  DraftPhase,
  DraftSpeed,
  TeamRoster,
  UpcomingPick,
  TeamRanking,
} from "./types";
import {
  POSITION_FILES,
  DATA_DIR,
  NUM_TEAMS,
  ROUNDS,
  ROSTER_SIZE,
  ROSTER_TARGETS,
  POSITION_VALUE,
  REPLACEMENT_RANK,
  TEAM_NAMES,
  DRAFT_SPEED_DELAYS,
} from "./constants";
import {
  getSnakeDraftTeamIndex,
  getStarterPoints,
  getTeamTotalPoints,
  createEmptyRoster,
} from "./utils";

/**
 * Main hook that manages all draft state and logic
 */
export function useDraft(scoring: Scoring) {
  // Player data
  const [allPlayers, setAllPlayers] = useState<DraftPlayer[]>([]);
  const [availablePlayers, setAvailablePlayers] = useState<DraftPlayer[]>([]);
  const [loading, setLoading] = useState(true);

  // Draft state
  const [draftPicks, setDraftPicks] = useState<DraftPick[]>([]);
  const [teamRosters, setTeamRosters] = useState<TeamRoster[]>([]);
  const [draftPhase, setDraftPhase] = useState<DraftPhase>("setup");

  // Settings
  const [userPickPosition, setUserPickPosition] = useState<number>(1);
  const [draftSpeed, setDraftSpeed] = useState<DraftSpeed>("medium");
  const [autopick, setAutopick] = useState(false);

  // UI state
  const [selectedTeamView, setSelectedTeamView] = useState<number>(0);

  // Derived values
  const currentPick = draftPicks.length;
  const currentRound = Math.floor(currentPick / NUM_TEAMS) + 1;
  const currentTeamIndex = getSnakeDraftTeamIndex(currentPick, NUM_TEAMS);
  const userTeamIndex = userPickPosition - 1;
  const isUserTurn = currentTeamIndex === userTeamIndex;
  const isDraftComplete = currentPick >= ROUNDS * NUM_TEAMS;

  // Load all players from CSV files
  useEffect(() => {
    const loadPlayers = async () => {
      setLoading(true);
      const playersByPosition: Record<Position, DraftPlayer[]> = {
        QB: [],
        RB: [],
        WR: [],
        TE: [],
      };

      for (const pos of ["QB", "RB", "WR", "TE"] as Position[]) {
        try {
          const res = await fetch(`${DATA_DIR}/${POSITION_FILES[pos]}`);
          if (!res.ok) continue;
          const text = await res.text();
          const { rows } = parseCSV(text);

          const nameKey = rows.length > 0 ? detectPlayerNameKey(rows[0]) : null;

          // Dedupe by player name, keeping highest projection
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

          // Sort by points descending
          playersByPosition[pos].sort((a, b) => b.points - a.points);
        } catch (e) {
          console.error(`Failed to load ${pos}:`, e);
        }
      }

      // Calculate VOR (Value Over Replacement) for each position
      for (const pos of ["QB", "RB", "WR", "TE"] as Position[]) {
        const players = playersByPosition[pos];
        const replacementValue =
          players[REPLACEMENT_RANK[pos] - 1]?.points ?? 0;

        players.forEach((p, idx) => {
          p.vor = p.points - replacementValue;
          p.tier = Math.floor(idx / 4) + 1; // Tier every 4 players
        });
      }

      // Combine and sort all players by adjusted VOR
      const all = Object.values(playersByPosition).flat();
      all.sort((a, b) => b.vor - a.vor);

      setAllPlayers(all);
      setAvailablePlayers(all);
      setLoading(false);
    };

    loadPlayers();
  }, [scoring]);

  // Initialize team rosters
  useEffect(() => {
    setTeamRosters(Array.from({ length: NUM_TEAMS }, createEmptyRoster));
  }, []);

  // CPU drafting logic - determines the best pick for a CPU team
  const getCPUPick = useCallback(
    (
      available: DraftPlayer[],
      teamRoster: TeamRoster,
      round: number
    ): DraftPlayer | null => {
      if (available.length === 0) return null;

      const counts = {
        QB: teamRoster.QB.length,
        RB: teamRoster.RB.length,
        WR: teamRoster.WR.length,
        TE: teamRoster.TE.length,
      };

      const totalPicks = counts.QB + counts.RB + counts.WR + counts.TE;
      const picksRemaining = ROSTER_SIZE - totalPicks;

      // Identify positions we need vs want
      const neededPositions: Position[] = [];
      for (const pos of ["QB", "RB", "WR", "TE"] as Position[]) {
        if (counts[pos] < ROSTER_TARGETS[pos].min) {
          neededPositions.push(pos);
        }
      }

      // Filter out players at positions we've maxed out
      let candidates = available.filter(
        (p) => counts[p.position] < ROSTER_TARGETS[p.position].max
      );
      if (candidates.length === 0) candidates = available;

      // Urgently fill needed positions if running out of picks
      if (
        neededPositions.length > 0 &&
        picksRemaining <= neededPositions.length + 2
      ) {
        const urgentCandidates = candidates.filter((p) =>
          neededPositions.includes(p.position)
        );
        if (urgentCandidates.length > 0) candidates = urgentCandidates;
      }

      // Score each candidate
      const scored = candidates.map((p) => {
        let score = p.vor * POSITION_VALUE[p.position];

        // Boost needed positions
        if (neededPositions.includes(p.position)) score *= 1.3;

        // Boost top-tier players
        if (p.tier <= 2) score *= 1.1;

        // Late-round QB/TE boost if we don't have one
        if (
          round >= 8 &&
          (p.position === "QB" || p.position === "TE") &&
          counts[p.position] === 0
        ) {
          score *= 1.25;
        }

        // Add randomness for variety (±5%)
        score *= 0.95 + Math.random() * 0.1;

        return { player: p, score };
      });

      scored.sort((a, b) => b.score - a.score);
      return scored[0]?.player ?? available[0];
    },
    []
  );

  // Execute a draft pick
  const makePick = useCallback(
    (player: DraftPlayer) => {
      const pickNumber = draftPicks.length;
      const round = Math.floor(pickNumber / NUM_TEAMS) + 1;
      const pickInRound = (pickNumber % NUM_TEAMS) + 1;
      const teamIndex = getSnakeDraftTeamIndex(pickNumber, NUM_TEAMS);

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
        setDraftPhase("complete");
      }
    },
    [draftPicks.length]
  );

  // Handle user making a pick
  const handleUserPick = useCallback(
    (player: DraftPlayer) => {
      if (!isUserTurn || draftPhase !== "drafting") return;
      makePick(player);
    },
    [isUserTurn, draftPhase, makePick]
  );

  // Auto-draft for CPU teams (and user if autopick enabled)
  useEffect(() => {
    if (draftPhase !== "drafting") return;
    if (isUserTurn && !autopick) return;
    if (availablePlayers.length === 0) return;

    const timer = setTimeout(() => {
      const teamRoster = teamRosters[currentTeamIndex];
      const pick = getCPUPick(availablePlayers, teamRoster, currentRound);
      if (pick) makePick(pick);
    }, DRAFT_SPEED_DELAYS[draftSpeed]);

    return () => clearTimeout(timer);
  }, [
    draftPhase,
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

  // Start the draft
  const startDraft = useCallback(() => {
    setDraftPicks([]);
    setAvailablePlayers(allPlayers);
    setTeamRosters(Array.from({ length: NUM_TEAMS }, createEmptyRoster));
    setDraftPhase("drafting");
    setSelectedTeamView(userTeamIndex);
  }, [allPlayers, userTeamIndex]);

  // Reset to setup screen
  const resetDraft = useCallback(() => {
    setDraftPhase("setup");
    setDraftPicks([]);
    setAvailablePlayers(allPlayers);
    setTeamRosters(Array.from({ length: NUM_TEAMS }, createEmptyRoster));
    setAutopick(false);
  }, [allPlayers]);

  // Get upcoming picks for display
  const getUpcomingPicks = useCallback(
    (count: number = 8): UpcomingPick[] => {
      const picks: UpcomingPick[] = [];
      for (let i = 0; i < count; i++) {
        const pickNum = currentPick + i;
        if (pickNum >= ROUNDS * NUM_TEAMS) break;
        const teamIdx = getSnakeDraftTeamIndex(pickNum, NUM_TEAMS);
        picks.push({
          pick: pickNum + 1,
          team: teamIdx + 1,
          isUser: teamIdx === userTeamIndex,
        });
      }
      return picks;
    },
    [currentPick, userTeamIndex]
  );

  // Calculate team rankings for results
  const teamRankings = useMemo((): TeamRanking[] => {
    return teamRosters
      .map((roster, idx) => ({
        teamIndex: idx,
        name: idx === userTeamIndex ? "Your Team" : TEAM_NAMES[idx],
        roster,
        totalPoints: getTeamTotalPoints(roster),
        starterPoints: getStarterPoints(roster),
        isUser: idx === userTeamIndex,
      }))
      .sort((a, b) => b.starterPoints - a.starterPoints);
  }, [teamRosters, userTeamIndex]);

  // Get user's roster
  const userRoster = teamRosters[userTeamIndex] ?? createEmptyRoster();

  return {
    // Data
    allPlayers,
    availablePlayers,
    loading,
    draftPicks,
    teamRosters,
    teamRankings,
    userRoster,

    // Draft state
    draftPhase,
    currentPick,
    currentRound,
    currentTeamIndex,
    isUserTurn,
    isDraftComplete,
    userTeamIndex,

    // Settings
    userPickPosition,
    setUserPickPosition,
    draftSpeed,
    setDraftSpeed,
    autopick,
    setAutopick,
    selectedTeamView,
    setSelectedTeamView,

    // Actions
    startDraft,
    resetDraft,
    handleUserPick,
    getUpcomingPicks,
  };
}

/**
 * Hook for filtering available players
 */
export function usePlayerFilter(availablePlayers: DraftPlayer[]) {
  const [filterPosition, setFilterPosition] = useState<Position | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

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

  return {
    filteredPlayers,
    filterPosition,
    setFilterPosition,
    searchQuery,
    setSearchQuery,
  };
}
