"use client";

import Link from "next/link";
import { Scoring } from "@/utils/scoring";
import { DraftSpeed } from "../types";
import { SCORING_LABELS, ROUNDS } from "../constants";
import { getOrdinalSuffix } from "../utils";
import styles from "../page.module.css";

type DraftSetupProps = {
  loading: boolean;
  playerCount: number;
  userPickPosition: number;
  setUserPickPosition: (pos: number) => void;
  scoring: Scoring;
  setScoring: (s: Scoring) => void;
  draftSpeed: DraftSpeed;
  setDraftSpeed: (speed: DraftSpeed) => void;
  onStartDraft: () => void;
};

/**
 * Setup screen where users configure draft settings before starting
 */
export function DraftSetup({
  loading,
  playerCount,
  userPickPosition,
  setUserPickPosition,
  scoring,
  setScoring,
  draftSpeed,
  setDraftSpeed,
  onStartDraft,
}: DraftSetupProps) {
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

            {/* Draft Position Selector */}
            <div className={styles.settingGroup}>
              <label className={styles.settingLabel}>Your Draft Position</label>
              <div className={styles.pickSelector}>
                {Array.from({ length: 12 }, (_, i) => (
                  <button
                    key={i + 1}
                    className={`${styles.pickButton} ${
                      userPickPosition === i + 1 ? styles.pickButtonActive : ""
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
                {getOrdinalSuffix(13 - userPickPosition)} in even rounds (snake
                draft)
              </p>
            </div>

            {/* Scoring Format Selector */}
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

            {/* Draft Speed Selector */}
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

            {/* Draft Info Summary */}
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
                <span className={styles.infoValue}>{playerCount}</span>
              </div>
            </div>

            <button className={styles.startButton} onClick={onStartDraft}>
              Start Draft 🚀
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
