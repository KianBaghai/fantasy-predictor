"use client";

import { Position } from "@/utils/scoring";
import { DraftPlayer, DraftPick, TeamRoster, UpcomingPick } from "../types";
import { ROUNDS, NUM_TEAMS, ROSTER_TARGETS } from "../constants";
import { getStarterPoints } from "../utils";
import styles from "../page.module.css";

// ============================================================================
// DRAFT HEADER
// ============================================================================

type DraftHeaderProps = {
  currentRound: number;
  currentPick: number;
  isUserTurn: boolean;
  currentTeamIndex: number;
  autopick: boolean;
  setAutopick: (v: boolean) => void;
  onExit: () => void;
};

/**
 * Header bar showing draft progress and controls
 */
export function DraftHeader({
  currentRound,
  currentPick,
  isUserTurn,
  currentTeamIndex,
  autopick,
  setAutopick,
  onExit,
}: DraftHeaderProps) {
  return (
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
        <button className={styles.exitButton} onClick={onExit}>
          Exit Draft
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// PLAYER BOARD
// ============================================================================

type PlayerBoardProps = {
  players: DraftPlayer[];
  isUserTurn: boolean;
  onPlayerClick: (player: DraftPlayer) => void;
  filterPosition: Position | "ALL";
  setFilterPosition: (pos: Position | "ALL") => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
};

/**
 * Panel showing available players with search and filter
 */
export function PlayerBoard({
  players,
  isUserTurn,
  onPlayerClick,
  filterPosition,
  setFilterPosition,
  searchQuery,
  setSearchQuery,
}: PlayerBoardProps) {
  return (
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
        {players.slice(0, 50).map((player) => (
          <PlayerRow
            key={player.id}
            player={player}
            isClickable={isUserTurn}
            onClick={() => onPlayerClick(player)}
          />
        ))}
      </div>
    </div>
  );
}

/** Single player row in the board */
function PlayerRow({
  player,
  isClickable,
  onClick,
}: {
  player: DraftPlayer;
  isClickable: boolean;
  onClick: () => void;
}) {
  return (
    <div
      className={`${styles.playerRow} ${isClickable ? styles.clickable : ""}`}
      onClick={onClick}
    >
      <span
        className={`${styles.positionBadge} ${styles[`pos${player.position}`]}`}
      >
        {player.position}
      </span>
      <span className={styles.playerName}>{player.name}</span>
      <span className={styles.playerPoints}>{player.points.toFixed(1)}</span>
      <span className={styles.playerVor}>VOR: {player.vor.toFixed(1)}</span>
    </div>
  );
}

// ============================================================================
// DRAFT CENTER (Pick Queue + Recent Picks)
// ============================================================================

type DraftCenterProps = {
  upcomingPicks: UpcomingPick[];
  recentPicks: DraftPick[];
  userTeamIndex: number;
};

/**
 * Center panel showing upcoming picks and recent draft history
 */
export function DraftCenter({
  upcomingPicks,
  recentPicks,
  userTeamIndex,
}: DraftCenterProps) {
  return (
    <div className={styles.draftCenter}>
      <PickQueue picks={upcomingPicks} />
      <RecentPicks picks={recentPicks} userTeamIndex={userTeamIndex} />
    </div>
  );
}

/** Shows upcoming picks in order */
function PickQueue({ picks }: { picks: UpcomingPick[] }) {
  return (
    <div className={styles.upcomingPicks}>
      <h3 className={styles.sectionTitle}>On the Clock</h3>
      <div className={styles.pickQueue}>
        {picks.map((pick, idx) => (
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
  );
}

/** Shows recent draft picks */
function RecentPicks({
  picks,
  userTeamIndex,
}: {
  picks: DraftPick[];
  userTeamIndex: number;
}) {
  return (
    <div className={styles.recentPicks}>
      <h3 className={styles.sectionTitle}>Recent Picks</h3>
      <div className={styles.pickLog}>
        {picks.length === 0 ? (
          <p className={styles.noPicks}>Draft starting...</p>
        ) : (
          picks
            .slice(-10)
            .reverse()
            .map((pick) => (
              <div
                key={pick.overall}
                className={`${styles.logItem} ${
                  pick.teamIndex === userTeamIndex ? styles.userLogItem : ""
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
                <span className={styles.logPlayer}>{pick.player.name}</span>
              </div>
            ))
        )}
      </div>
    </div>
  );
}

// ============================================================================
// YOUR TEAM PANEL
// ============================================================================

type YourTeamPanelProps = {
  roster: TeamRoster;
};

/**
 * Panel showing the user's drafted roster during the draft
 */
export function YourTeamPanel({ roster }: YourTeamPanelProps) {
  const starterPoints = getStarterPoints(roster);

  return (
    <div className={styles.yourTeam}>
      <div className={styles.teamHeader}>
        <h2 className={styles.teamTitle}>Your Team</h2>
        <div className={styles.teamPoints}>{starterPoints.toFixed(1)} pts</div>
      </div>
      <div className={styles.teamRoster}>
        {(["QB", "RB", "WR", "TE"] as Position[]).map((pos) => (
          <PositionSlots key={pos} position={pos} players={roster[pos]} />
        ))}
      </div>
    </div>
  );
}

/** Shows slots for a single position */
function PositionSlots({
  position,
  players,
}: {
  position: Position;
  players: DraftPlayer[];
}) {
  const targetMin = ROSTER_TARGETS[position].min;
  const slots = Math.max(targetMin, players.length);

  return (
    <div className={styles.teamPosition}>
      <div className={styles.teamPosHeader}>
        <span className={styles.teamPosName}>{position}</span>
        <span className={styles.teamPosCount}>
          {players.length}/{ROSTER_TARGETS[position].max}
        </span>
      </div>
      {Array.from({ length: slots }).map((_, idx) => {
        const player = players[idx];
        return (
          <div
            key={idx}
            className={`${styles.teamSlot} ${player ? "" : styles.emptySlot}`}
          >
            {player ? (
              <>
                <span className={styles.slotName}>{player.name}</span>
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
}
