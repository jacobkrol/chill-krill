import { useCallback, useEffect, useMemo, useState, type MouseEventHandler } from "react";
import { 
  formatIsoDateNoTimezone, 
  getISODate, 
  getImgForAnswer, 
  getPromptDiversityScore, 
  getTierFromScore,
  handleShare
} from "./utils";
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
  const [revealedKrillions, setRevealedKrillions] = useState<string[]>([]);

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

  const refreshBoxHeight = useCallback(() => {
      [...document.querySelectorAll(".archive-puzzle-area.active")].forEach((box: any) => {
        box.style.maxHeight = box.scrollHeight + "px";
      })
    }, []);

  const handleCollapseClick = (evt: any) => {
    [...document.querySelectorAll(".archive-puzzle-title")].forEach(btn => {
      if (btn !== evt.currentTarget) {
        btn.classList.remove("active");
        const contentBox = btn.nextElementSibling as HTMLDivElement;
        contentBox.style.maxHeight = "";
        contentBox.classList.remove("active");
      }
    });

    evt.currentTarget.classList.toggle("active");
    const content = evt.currentTarget.nextElementSibling;
    if (content.style.maxHeight){
      content.style.maxHeight = null;
      content.classList.remove("active");
    } else {
      content.style.maxHeight = content.scrollHeight + "px";
      content.classList.add("active");
    }
  }

  const getStreakOnDay = useCallback((date: string, stats: History[]) => {
    const dateFromIso = (iso: string) => new Date(iso).setUTCHours(0, 0, 0, 0);
    
    const today = dateFromIso(date);
    const prevDates = stats
      .map(s => s.date)
      .toSorted((a, b) => dateFromIso(b) - dateFromIso(a))
      .filter(d => dateFromIso(d) <= today);

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
  }, []);


  const streak: number = useMemo(() => {
    return getStreakOnDay(getISODate(), stats);
  }, [stats]);

  const maxStreak: number = useMemo(() => {
    return stats.reduce((prev, curr) => {
      const currStreak = getStreakOnDay(curr.date, stats);
      return currStreak > prev ? currStreak : prev;
    }, 0);
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

  const avgAnswers: number = useMemo(() => {
    if(!stats || !stats.length) return 0;

    const numCompletedDives = stats.filter(s => s.answers.reduce((prev, prompt) => prev + prompt.answers.reduce((prev2, answer) => prev2 + answer.score, 0), 0) >= s.goalScore).length;
    const numScoringAnswers = stats.reduce((prev, curr) => {
      const isCompleted = curr.answers.reduce((prev, prompt) => prev + prompt.answers.reduce((prev2, answer) => prev2 + answer.score, 0), 0) >= curr.goalScore;
      if (!isCompleted) return prev;
      const scoringAnswers = getScoringAnswers(curr.answers, curr.goalScore);
      return prev + scoringAnswers.length;
    }, 0);
    return numScoringAnswers / numCompletedDives;
  }, [stats]);

  const widestDive: number = useMemo(() => {
    if(!stats || !stats.length) return 0;

    return stats.reduce((prev: number, curr: History) => {
      if (curr.answers.reduce((prev, prompt) => prev + prompt.answers.reduce((prev2, answer) => prev2 + answer.score, 0), 0) < curr.goalScore) return prev;
      const promptDiversity = getPromptDiversityScore(curr.answers);
      return promptDiversity > prev ? promptDiversity : prev;
    }, 0);
  }, [stats]);

  const deepestDive: number = useMemo(() => {
    if(!stats || !stats.length) return 0;

    return stats.reduce((prev: number, curr: History) => {
      const score = curr.answers.reduce((prev, prompt) => prev + prompt.answers.reduce((prev2, answer) => prev2 + answer.score, 0), 0);
      return score > prev ? score : prev;
    }, 0);
  }, [stats]);

  const handleToggleKrillions = useCallback((day: string) => {
    const dayStats = stats.find(s => s.date === day);
    if (!dayStats) return;

    const isHiding = revealedKrillions.includes(day);

    setRevealedKrillions(prev => isHiding ? prev.filter(d => d !== day) : [...prev, day]);
    const krillionListElements = document.querySelectorAll(`.archive-puzzle[data-date="${day}"] .archive-puzzle-prompt-krillion-list`);
    if (!krillionListElements) return;
    krillionListElements.forEach(element => element.classList.toggle("hidden", isHiding));

    refreshBoxHeight();
  }, [revealedKrillions, stats]);

  const handleShareButton = useCallback((day: string) => {
    const userAnswers = stats.find(s => s.date === day)?.answers ?? [];
    const goalScore = stats.find(s => s.date === day)?.goalScore ?? 0;
    const scoringAnswers = getScoringAnswers(userAnswers, goalScore);
    const promptDiversity = getPromptDiversityScore(userAnswers);
    const score = userAnswers.reduce((prev, prompt) => prev + prompt.answers.reduce((prev2, answer) => prev2 + answer.score, 0), 0);
    handleShare(scoringAnswers, promptDiversity, score, goalScore, day);
  }, [stats, getScoringAnswers, getPromptDiversityScore]);

  return (
    <main id="stats-page">
      <h1>Chill Krill</h1>
      <div id="hero-stat-container">
        <h2 className="section-title col-span-full">Diver Stats</h2>
        <div className="hero-stat">
          <p>{streak}</p>
          <label>Active Streak</label>
        </div>
        <div className="hero-stat">
          <p>{maxStreak}</p>
          <label>Max Streak</label>
        </div>
        <div className="hero-stat">
          <p>{stats.length.toLocaleString("en-US")}</p>
          <label>Total Dives</label>
        </div>
        <div className="hero-stat">
          <p>{avgAnswers.toFixed(1)}</p>
          <label>Avg Answers<sup>*</sup></label>
        </div>
        <div className="hero-stat">
          <p>{Math.floor(widestDive)}%</p>
          <label>Best Diversity<sup>*</sup></label>
        </div>
        <div className="hero-stat">
          <p>{deepestDive.toLocaleString("en-US")}</p>
          <label>Deepest Dive</label>
        </div>
        <div className="hero-stat col-span-full">
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
              const diversity = getPromptDiversityScore(day.answers);
              const score = day.answers.map(a => a.answers.reduce((a,b) => a + b.score, 0)).reduce((a,b) => a + b, 0);
              const isQualified = score >= day.goalScore;
              return (
                <div key={day.date} className="archive-puzzle" data-date={day.date}>
                  <button className="archive-puzzle-title" onClick={handleCollapseClick}>
                    <p>{formatIsoDateNoTimezone(day.date)}</p>
                    <p className="archive-puzzle-stats">
                      {isQualified ? (
                        <>
                        <span><strong>{answers.length}</strong></span>
                        <span>{Math.floor(diversity)}%</span>
                        <span>{score}</span>
                        </>
                      ) : <span>UNQUALIFIED</span>}
                    </p>
                    <i className="toggle"></i>
                  </button>
                  <div className="archive-puzzle-area">
                    <div className="archive-puzzle-content">
                      <div id="hero-score-row">
                        <div className="hero-stat archive-puzzle-hero-diversity">
                          <p>{Math.floor(diversity)}%</p>
                          <label>diversity</label>
                        </div>
                        <div className="hero-stat archive-puzzle-hero-answers">
                          <p>{answers.length}</p>
                          <label>answer{answers.length !== 1 ? 's' : ''}</label>
                        </div>
                        <div className="hero-stat archive-puzzle-hero-score">
                          <p>{score}</p>
                          <label>points</label>
                        </div>
                      </div>
                      <div id="hero-answers">
                        {answers.map((a,i) => {
                          const imgSrc = getImgForAnswer(a);
                          const tier = getTierFromScore(a);
                          return (
                            <img src={imgSrc} key={i} className="hero-answer-icon" data-tier={tier} alt={tier} />
                        )})}
                      </div>
                      {day.reveal?.prompts?.length && (
                        <>
                          <div className="archive-puzzle-prompt-list">
                            {day.reveal.prompts.map((prompt, i) => {
                              const answers = day.answers.find(a => a.id === prompt.id)?.answers;
                              const topAnswer = answers ? answers.reduce((prev, curr) => prev.score > curr.score ? prev : curr) : null;
                              const topScore = topAnswer?.score ?? 0;
                              return (
                                <div key={i} className="archive-puzzle-prompt">
                                  <div className="archive-puzzle-prompt-title">
                                    <img src={getImgForAnswer(topScore)} className="archive-puzzle-prompt-icon" data-tier={getTierFromScore(topScore)} alt={getTierFromScore(topScore)} />
                                    <p className="archive-puzzle-prompt-text">{prompt.text}</p>
                                  </div>
                                  <div className="archive-puzzle-prompt-krillion-list hidden">
                                    {prompt.answers.map((answer, j) => {
                                      const imgSrc = getImgForAnswer(answer.score);
                                      const tier = getTierFromScore(answer.score);
                                      return (
                                        <div key={j} className="archive-puzzle-prompt-krillion">
                                          <img src={imgSrc} className="archive-puzzle-prompt-icon" data-tier={tier} alt={tier} />
                                          <p className="archive-puzzle-prompt-krillion-text">{answer.answer}</p>
                                        </div>
                                      );
                                    })}
                                    {prompt.answers.length === 0 && (
                                      <div className="archive-puzzle-prompt-krillion">
                                        <p className="archive-puzzle-prompt-krillion-text">This prompt had no Krillions</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <div className="archive-puzzle-action-row">
                            <button onClick={() => handleToggleKrillions(day.date)}>{revealedKrillions.includes(day.date) ? "Hide" : "Reveal"} Krillions</button>
                            <button className="primary-btn" onClick={() => handleShareButton(day.date)}>Share This Day</button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}) 
            : <p>Previous dives will appear here</p>}
        </div>
      </div>
      <p className="footnote"><sup>*</sup>&nbsp;Among "qualified" dives only (&ge; goal score, typically 700)</p>
      <button id="back-button" onClick={handleBack}>&#9664;</button>
    </main>
  )
}