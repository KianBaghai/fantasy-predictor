"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";
import { parseCSV, toNumber } from "@/utils/csv";
import {
  computeFantasyPoints,
  detectPlayerNameKey,
  getStatColumns,
  formatStat,
  Position,
  Scoring,
} from "@/utils/scoring";

type TableRow = Record<string, string | number> & {
  __points: number;
  __rank: number;
};

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

type SortConfig = {
  key: string;
  direction: "asc" | "desc";
};

export default function Home() {
  const [position, setPosition] = useState<Position>("QB");
  const [scoring, setScoring] = useState<Scoring>("PPR");
  const [rows, setRows] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "__points",
    direction: "desc",
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const file = FILES[position];
        const res = await fetch(`${DATA_DIR}/${file}`);
        if (!res.ok) throw new Error(`Failed to load ${file}`);
        const text = await res.text();
        const { rows: r } = parseCSV(text);

        const computed = r.map((row) => ({
          ...row,
          __points: computeFantasyPoints(row, position, scoring),
          __rank: 0,
        }));

        computed.sort((a, b) => b.__points - a.__points);
        computed.forEach((row, idx) => (row.__rank = idx + 1));

        setRows(computed);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Unknown error");
        setRows([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [position, scoring]);

  const playerKey = useMemo(() => {
    if (rows.length === 0) return null;
    return detectPlayerNameKey(
      Object.fromEntries(
        Object.keys(rows[0]).map((k) => [k, String(rows[0][k])])
      )
    );
  }, [rows]);

  const statColumns = useMemo(() => getStatColumns(position), [position]);

  const sortedRows = useMemo(() => {
    const sorted = [...rows].sort((a, b) => {
      const aVal = toNumber(a[sortConfig.key]);
      const bVal = toNumber(b[sortConfig.key]);
      return sortConfig.direction === "desc" ? bVal - aVal : aVal - bVal;
    });
    return sorted;
  }, [rows, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "desc" ? "asc" : "desc",
    }));
  };

  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig.key !== columnKey) {
      return <span className={styles.sortIcon}>⇅</span>;
    }
    return (
      <span className={styles.sortIconActive}>
        {sortConfig.direction === "desc" ? "↓" : "↑"}
      </span>
    );
  };

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <header className={styles.header}>
          <h1 className={styles.title}>🏈 Fantasy Football Predictions</h1>
          <p className={styles.subtitle}>2025 Season Projections</p>
          <Link href="/my-team" className={styles.teamLink}>
            📋 Build My Team →
          </Link>
        </header>

        <div className={styles.controls}>
          <div className={styles.controlGroup}>
            <span className={styles.controlLabel}>Position</span>
            <div className={styles.tabs}>
              {(["QB", "RB", "WR", "TE"] as Position[]).map((p) => (
                <button
                  key={p}
                  className={`${styles.tabButton} ${
                    p === position ? styles.tabButtonActive : ""
                  }`}
                  onClick={() => setPosition(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.controlGroup}>
            <span className={styles.controlLabel}>Scoring</span>
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

        {error && <div className={styles.error}>⚠️ {error}</div>}
        {loading && (
          <div className={styles.loading}>Loading predictions...</div>
        )}

        {!loading && rows.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.rankCol}>Rank</th>
                  <th className={styles.playerCol}>Player</th>
                  <th
                    className={`${styles.pointsCol} ${styles.sortableHeader}`}
                    onClick={() => handleSort("__points")}
                  >
                    Points <SortIcon columnKey="__points" />
                  </th>
                  {statColumns.map((col) => (
                    <th
                      key={col.key}
                      className={`${styles.statCol} ${styles.sortableHeader}`}
                      onClick={() => handleSort(col.key)}
                    >
                      {col.label} <SortIcon columnKey={col.key} />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row, index) => {
                  const playerName = playerKey ? String(row[playerKey]) : "—";
                  return (
                    <tr
                      key={`${playerName}-${row.__rank}`}
                      className={styles.tableRow}
                    >
                      <td className={styles.rankCell}>{index + 1}</td>
                      <td className={styles.playerCell}>{playerName}</td>
                      <td className={styles.pointsCell}>
                        {row.__points.toFixed(1)}
                      </td>
                      {statColumns.map((col) => (
                        <td key={col.key} className={styles.statCell}>
                          {formatStat(row[col.key])}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <footer className={styles.footer}>
          <p>
            Predictions based on historical data and machine learning models
          </p>
        </footer>
      </main>
    </div>
  );
}
