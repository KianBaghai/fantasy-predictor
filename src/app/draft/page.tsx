"use client";

import { useState } from "react";
import { Scoring } from "@/utils/scoring";
import { useDraft, usePlayerFilter } from "./hooks";
import {
  DraftSetup,
  DraftResults,
  DraftHeader,
  PlayerBoard,
  DraftCenter,
  YourTeamPanel,
} from "./components";
import styles from "./page.module.css";

/**
 * Mock Draft Simulator Page
 * 
 * This page allows users to simulate a fantasy football draft against 11 CPU teams.
 * 
 * Features:
 * - Choose draft position (1-12) and scoring format
 * - Snake draft format with intelligent CPU opponents
 * - Real-time draft board with player search and filtering
 * - Track your roster and projected points
 * - Compare final results against all teams
 * 
 * The draft flow:
 * 1. SETUP: Configure draft settings (position, scoring, speed)
 * 2. DRAFTING: Take turns picking players with CPU teams
 * 3. COMPLETE: View results and compare team rankings
 */
export default function DraftPage() {
  // Scoring format (affects player projections)
  const [scoring, setScoring] = useState<Scoring>("PPR");

  // Main draft state and logic
  const draft = useDraft(scoring);

  // Player filtering (search and position filter)
  const playerFilter = usePlayerFilter(draft.availablePlayers);

  // ============================================================================
  // RENDER: SETUP PHASE
  // ============================================================================
  if (draft.draftPhase === "setup") {
    return (
      <DraftSetup
        loading={draft.loading}
        playerCount={draft.allPlayers.length}
        userPickPosition={draft.userPickPosition}
        setUserPickPosition={draft.setUserPickPosition}
        scoring={scoring}
        setScoring={setScoring}
        draftSpeed={draft.draftSpeed}
        setDraftSpeed={draft.setDraftSpeed}
        onStartDraft={draft.startDraft}
      />
    );
  }

  // ============================================================================
  // RENDER: RESULTS PHASE
  // ============================================================================
  if (draft.draftPhase === "complete") {
    return (
      <DraftResults
        teamRankings={draft.teamRankings}
        teamRosters={draft.teamRosters}
        userTeamIndex={draft.userTeamIndex}
        selectedTeamView={draft.selectedTeamView}
        setSelectedTeamView={draft.setSelectedTeamView}
        onDraftAgain={draft.resetDraft}
      />
    );
  }

  // ============================================================================
  // RENDER: DRAFTING PHASE
  // ============================================================================
  return (
    <div className={styles.page}>
      <main className={styles.mainDrafting}>
        {/* Top: Draft progress and controls */}
        <DraftHeader
          currentRound={draft.currentRound}
          currentPick={draft.currentPick}
          isUserTurn={draft.isUserTurn}
          currentTeamIndex={draft.currentTeamIndex}
          autopick={draft.autopick}
          setAutopick={draft.setAutopick}
          onExit={draft.resetDraft}
        />

        <div className={styles.draftLayout}>
          {/* Left: Available players to draft */}
          <PlayerBoard
            players={playerFilter.filteredPlayers}
            isUserTurn={draft.isUserTurn}
            onPlayerClick={draft.handleUserPick}
            filterPosition={playerFilter.filterPosition}
            setFilterPosition={playerFilter.setFilterPosition}
            searchQuery={playerFilter.searchQuery}
            setSearchQuery={playerFilter.setSearchQuery}
          />

          {/* Center: Pick queue and draft history */}
          <DraftCenter
            upcomingPicks={draft.getUpcomingPicks(8)}
            recentPicks={draft.draftPicks}
            userTeamIndex={draft.userTeamIndex}
          />

          {/* Right: User's current roster */}
          <YourTeamPanel roster={draft.userRoster} />
        </div>
      </main>
    </div>
  );
}
