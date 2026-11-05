import { useCallback, useEffect, useMemo, useState, type MouseEventHandler } from "react";
import { formatIsoDateNoTimezone, getISODate, getImgForAnswer, getTierFromScore } from "./utils";
import type { History, Prompt } from "./types";
import { STATS_STORAGE_NAME } from "./constants";

export default function Stats({ 
  handleBack,
  getScoringAnswers
}: { 
  handleBack: MouseEventHandler<HTMLButtonElement>,
  getScoringAnswers: (answers: Prompt[], goalScore: number) => number[]
}) {
  const [stats, setStats] = useState<History[]>([]);

  const loadStatsFromMemory = useCallback(() => {
    try {
      const cache = localStorage.getItem(STATS_STORAGE_NAME);
      if (!cache) return;

      const json = JSON.parse(cache);
      if (!json) return;

      setStats(json);
    } catch(err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    loadStatsFromMemory();
  }, []);

  const streak: number = useMemo(() => {
    const dateFromIso = (iso: string) => new Date(iso).setUTCHours(0, 0, 0, 0);

    const today = dateFromIso(getISODate());
    const prevDates = stats.map(s => s.date).sort((a, b) => dateFromIso(b) - dateFromIso(a));

    if (!prevDates || prevDates.length === 0) return 0;

    let count = 0;
    const oneDayMs = 1000 * 60 * 60 * 24;

    if (today - dateFromIso(prevDates[0]) > oneDayMs) return 0;

    // if not played yet today, then start counting streak from yesterday
    let start = today;
    if (today - dateFromIso(prevDates[0]) === oneDayMs) {
      start = dateFromIso(prevDates[0]);
    }

    prevDates.forEach((el, i) => {
      if ((start - dateFromIso(el)) === i * oneDayMs) count++;
    });
    return count;
  }, [stats]);

  const bestDive: number[] = useMemo(() => {
    if(!stats || !stats.length) return [];

    return stats.reduce((prev: number[], curr: History) => {
      const scoringAnswers = getScoringAnswers(curr.answers, curr.goalScore);
      const currScore = scoringAnswers.reduce((a,b) => a + b, 0);

      // disqualified
      if (currScore < curr.goalScore) return prev;

      // return first qualified
      if (prev.length === 0) return scoringAnswers;

      // return next smallest dive
      if (scoringAnswers.length < prev.length) return scoringAnswers;

      // if tied for smallest dive, return if better score
      const prevScore = prev.reduce((a,b) => a + b, 0);
      if (scoringAnswers.length === prev.length && currScore > prevScore) return scoringAnswers;

      return prev;
    }, []);
  }, [stats]);

  return (
    <main id="stats-page">
      <h1>Chill Krill</h1>
      <div id="hero-stat-container">
        <div className="hero-stat">
          <p>{streak} day{streak === 1 ? "" : "s"}</p>
          <label>Current Streak</label>
        </div>
        <div className="hero-stat">
          <div id="best-dive-img-row">{bestDive.map((score, i) => (
            <img key={i} src={getImgForAnswer(score)} className="hero-answer-icon" alt={getTierFromScore(score)} data-tier={getTierFromScore(score)} />
          ))}</div>
          <label>Best Dive</label>
        </div>
      </div>
      <div id="archive-container">
        <h2>Dive Archive</h2>
        <div id="archive-list">
          {stats?.length 
            ? stats.toSorted((a,b) => new Date(a.date) > new Date(b.date) ? -1 : 1).map(day => {
              const answers = getScoringAnswers(day.answers, day.goalScore);
              const score = day.answers.map(a => a.answers.reduce((a,b) => a + b.score, 0)).reduce((a,b) => a + b, 0);
              const isQualified = score >= day.goalScore;
              return (
              <div key={day.date} className="archive-puzzle">
                <p>{formatIsoDateNoTimezone(day.date)}</p>
                <p>{isQualified ? `${answers.length} answer${answers.length === 1 ? "" : "s"}` : "UNQUALIFIED"}</p>
                <p>{day.answers.reduce((prev, prompt) => prev + prompt.answers.reduce((prev2, answer) => prev2 + answer.score, 0), 0)} / {day.goalScore}</p>
              </div>
            )}) 
            : <p>Previous dives will appear here</p>}
        </div>
      </div>
      <button id="back-button" onClick={handleBack}>&#9664;</button>
    </main>
  )
}