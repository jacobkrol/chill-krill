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
    const today = new Date(getISODate()).setHours(0, 0, 0, 0);
    const prevDates = stats.map(s => s.date);
    
    if (!prevDates || prevDates.length === 0) return 0;

    const uniqueSorted = [...new Set(prevDates)]
      .map(d => new Date(d).setHours(0, 0, 0, 0))
      .sort((a, b) => b - a);

    let streak = 1;
    const oneDayMs = 1000 * 60 * 60 * 24;

    if (today - uniqueSorted[0] > oneDayMs) return 0;

    for (let i = 0; i < uniqueSorted.length - 1; i++) {
      const diff = (uniqueSorted[i] - uniqueSorted[i + 1]) / oneDayMs;
      if (diff === 1) {
        streak++;
      } else {
        break; // Streak broken
      }
    }

    return streak;
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
            ? stats.toSorted((a,b) => new Date(a.date) > new Date(b.date) ? -1 : 1).map(day => (
              <div key={day.date} className="archive-puzzle">
                <p>{formatIsoDateNoTimezone(day.date)}</p>
                <p>{getScoringAnswers(day.answers, day.goalScore).length} answer{getScoringAnswers(day.answers, day.goalScore).length === 1 ? "" : "s"}</p>
                <p>{day.answers.reduce((prev, prompt) => prev + prompt.answers.reduce((prev2, answer) => prev2 + answer.score, 0), 0)} / {day.goalScore}</p>
              </div>
            )) 
            : <p>Previous dives will appear here</p>}
        </div>
      </div>
      <button id="back-button" onClick={handleBack}>&#9664;</button>
    </main>
  )
}