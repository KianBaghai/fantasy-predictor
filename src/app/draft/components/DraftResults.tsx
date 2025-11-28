"use client";

import Link from "next/link";
import { Position } from "@/utils/scoring";
import { TeamRanking, TeamRoster } from "../types";
import { TEAM_NAMES } from "../constants";
import { isStarterSlot } from "../utils";
import styles from "../page.module.css";

type DraftResultsProps = {
  teamRankings: TeamRanking[];
  teamRosters: TeamRoster[];
  userTeamIndex: number;
  selectedTeamView: number;
  setSelectedTeamView: (idx: number) => void;
  onDraftAgain: () => void;
};

/**
 * Results screen shown after draft completion
 * Displays user's team, rankings, and allows viewing other teams
 */
export function DraftResults({
  teamRankings,
  teamRosters,
  userTeamIndex,
  selectedTeamView,
  setSelectedTeamView,
  onDraftAgain,
}: DraftResultsProps) {
  const userRank = teamRankings.findIndex((t) => t.isUser) + 1;
  const userTeam = teamRankings.find((t) => t.isUser)!;

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header}>
          <h1 className={styles.title}>🏆 Draft Complete!</h1>
          <p className={styles.subtitle}>
            Your team finished{" "}
            <strong className={styles.rankHighlight}>#{userRank}</strong> out of
            12 teams
          </p>
        </header>

        {/* User's Team Summary */}
        <UserTeamSummary userTeam={userTeam} userRank={userRank} />

        {/* Final Standings */}
        <Standings
          teamRankings={teamRankings}
          selectedTeamView={selectedTeamView}
          onSelectTeam={setSelectedTeamView}
        />

        {/* Selected Team Detail (if viewing another team) */}
        {selectedTeamView !== userTeamIndex && (
          <TeamDetail
            teamName={TEAM_NAMES[selectedTeamView]}
            roster={teamRosters[selectedTeamView]}
          />
        )}

        {/* Action Buttons */}
        <div className={styles.actionButtons}>
          <button className={styles.draftAgainButton} onClick={onDraftAgain}>
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

/** Displays the user's team stats and roster */
function UserTeamSummary({
  userTeam,
  userRank,
}: {
  userTeam: TeamRanking;
  userRank: number;
}) {
  return (
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
      <RosterGrid roster={userTeam.roster} showStarters />
    </div>
  );
}

/** Displays all team rankings */
function Standings({
  teamRankings,
  selectedTeamView,
  onSelectTeam,
}: {
  teamRankings: TeamRanking[];
  selectedTeamView: number;
  onSelectTeam: (idx: number) => void;
}) {
  return (
    <div className={styles.standingsCard}>
      <h2 className={styles.standingsTitle}>Final Standings</h2>
      <div className={styles.standingsList}>
        {teamRankings.map((team, idx) => (
          <div
            key={team.teamIndex}
            className={`${styles.standingsRow} ${
              team.isUser ? styles.userRow : ""
            }`}
            onClick={() => onSelectTeam(team.teamIndex)}
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
              {team.isUser && <span className={styles.youBadge}>YOU</span>}
            </span>
            <span className={styles.standingsPoints}>
              {team.starterPoints.toFixed(1)} pts
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Displays a team's roster detail */
function TeamDetail({
  teamName,
  roster,
}: {
  teamName: string;
  roster: TeamRoster;
}) {
  return (
    <div className={styles.teamDetailCard}>
      <h3 className={styles.teamDetailTitle}>{teamName} Roster</h3>
      <RosterGrid roster={roster} />
    </div>
  );
}

/** Displays a roster grid organized by position */
function RosterGrid({
  roster,
  showStarters = false,
}: {
  roster: TeamRoster;
  showStarters?: boolean;
}) {
  return (
    <div className={styles.rosterGrid}>
      {(["QB", "RB", "WR", "TE"] as Position[]).map((pos) => (
        <div key={pos} className={styles.positionGroup}>
          <h4 className={styles.positionHeader}>{pos}</h4>
          {roster[pos].map((p, idx) => (
            <div
              key={p.id}
              className={`${styles.rosterPlayer} ${
                showStarters && isStarterSlot(pos, idx) ? styles.starter : ""
              }`}
            >
              <span className={styles.rosterName}>{p.name}</span>
              <span className={styles.rosterPoints}>{p.points.toFixed(1)}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
