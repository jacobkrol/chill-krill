import React, { useState, useEffect, useCallback, useMemo, type MouseEventHandler } from 'react';
import './App.css';
import './bubble-button.css';
import BrandKrillion from "./assets/krillion.png";
import BubbleGroup from './BubbleGroup';
import type {
  PromptId,
  Prompt,
  Reveal,
  Response,
  History
} from './types.ts';
import { 
  getTierFromScore,
  getISODate,
  getImgForAnswer,
  getPromptDiversityScore
} from './utils.ts';
import {
  PROMPT_STORAGE_NAME,
  ANSWER_STORAGE_NAME,
  STATS_STORAGE_NAME
} from './constants.ts';
import ConfettiExplosion from 'react-confetti-explosion';
import Stats from './Stats.tsx';
import HowTo from './HowTo.tsx';

const isoDate = getISODate();
const playerId = crypto.randomUUID();

const scoreTrackMilestones = [30, 24, 18, 12, 9, 7];

function App() {
  const [page, setPage] = useState("home");
  const [reveal, setReveal] = useState<Reveal>();
  const [answers, setAnswers] = useState<Prompt[]>([]); // accepted answers
  const [responses, setResponses] = useState<Response[]>([]); // server non-accepted responses
  const [isSubmitting, setIsSubmitting] = useState(false); // loading state
  const [isPerfect, setIsPerfect] = useState(false);
  const [isExploding, setIsExploding] = useState(false); // confetti

  const handlePlay = () => {
    setPage("play");
  }

  const handleHow = () => {
    setPage("how");
  }

  const handleStats = () => {
    setPage("stats");
  }

  const handleBack: MouseEventHandler<HTMLButtonElement> = () => {
    setPage("home");
  }

  useEffect(() => {
    [...document.querySelectorAll(".prompt-box-area.active")].forEach((box: any) => {
      box.style.maxHeight = box.scrollHeight + "px";
    })
  }, [answers])

  const handleCollapseClick = (evt: any) => {
    [...document.querySelectorAll(".prompt-box-title")].forEach(btn => {
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

  const fetchReveal = useCallback(async () => {
    try {
      // pull from cache
      const cache = localStorage.getItem(PROMPT_STORAGE_NAME);
      if (cache?.length) {
        const { data } = JSON.parse(cache);
        if (data.date && data.date === isoDate) {
          return data;
        }
      }

      // fallback to fetch
      const res = await fetch("https://proxyrequest-eic4hc2dwa-uc.a.run.app", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          url: `https://krillion.io/api/reveal?date=${isoDate}`,
          options: {
            method: "GET"
          }
        })
      });
      const json = await res.json();
      if (json.success && json.status === 200 && json.data) {
        // remove sub-krillion data to avoid overflowing localstorage capacity
        const data: Reveal = json.data;
        const krillionOnlyData = { 
          date: data.date, 
          prompts: data.prompts.map((p: Prompt) => ({ ...p, answers: p.answers.filter(a => a.score === 100) })) 
        };
        localStorage.setItem(PROMPT_STORAGE_NAME, JSON.stringify({ ...json, data: krillionOnlyData }));
        return json.data;
      }
    } catch(err) {
      console.error(err);
    }
  }, []);

  const fetchAnswers = useCallback(() => {
    try {
      const cache = localStorage.getItem(ANSWER_STORAGE_NAME);
      if (!cache?.length) return;

      const cacheAnswers = JSON.parse(cache);
      if (cacheAnswers.date !== isoDate) return;

      return cacheAnswers.answers;
    } catch(err) {
      console.error(err);
    }
  }, []);

  const hydratePuzzle = useCallback(async () => {
    if (!reveal || reveal?.date !== isoDate) {
      try {
        const res = await fetchReveal();
        if (!res) throw new Error("Error loading answers");
        setReveal(res);
      } catch(err) {
        console.error(err);
        window.alert("An error occurred loading today's puzzle. Please try again later.");
      }
    }
    if (!answers.length) {
      const cacheAnswers = fetchAnswers();
      if (cacheAnswers?.length) {
        setAnswers(cacheAnswers);
      }
    }
  }, [reveal, answers.length, fetchAnswers, fetchReveal]);

  useEffect(() => {
    if (page === "play") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      hydratePuzzle();
    }
  }, [page, hydratePuzzle]);

  const score = useMemo(() => {
    return answers.reduce((p1, c1) => c1.answers.reduce((p2, c2) => c2.score + p2, 0) + p1, 0);
  }, [answers]);

  const goalScore = useMemo(() => {
    if (!reveal || !reveal?.prompts?.length) return 0;
    const maxScores = reveal.prompts.map(x => Math.max(...x.answers.map(y => y.score)));
    return maxScores.reduce((p, c) => p + c, 0);
  }, [reveal]);

  const getScoringAnswers = useCallback((answers: Prompt[], goalScore: number) => {
    if (!answers.length) return [];

    const sortedUserScores = answers.map(x => x.answers.map(y => y.score)).flat().toSorted((a,b) => a > b ? -1 : 1);
    return sortedUserScores.reduce((p1: number[], c1) => {
      const runningTotal = p1.reduce((p2, c2) => p2 + c2, 0);
      return runningTotal >= goalScore ? p1 : [...p1, c1];
    }, []);
  }, []);

  const scoringAnswers = useMemo(() => {
    return getScoringAnswers(answers, goalScore);
  }, [answers, goalScore]);

  const promptDiversity = useMemo(() => {
    // y.     for each prompt, find number of scoringAnswers that are found in prompt.answers.map(a => a.score), without double counting
    // y-bar. find average number of scoringAnswers found in each prompt.answers
    // s2.    find sqrt[sum of (y - ybar)^2 / 7]
    return getPromptDiversityScore(answers);
  }, [scoringAnswers, answers]);

  const hasQualifiedScore = useMemo(() => (
    goalScore > 0 && scoringAnswers.reduce((p,c) => p + c, 0) >= goalScore
  ), [scoringAnswers, goalScore]);

  const openQualifiedDialog = useCallback(() => {
    const dialog = document.getElementById("qualified-dialog") as HTMLDialogElement;
    dialog.showModal();
    setIsExploding(true);
  }, []);

  const openPerfectDialog = useCallback(() => {
    const dialog = document.getElementById("perfect-dialog") as HTMLDialogElement;
    dialog.showModal();
    setIsExploding(true);
  }, []);

  const openOvertimeDialog = useCallback(() => {
    const dialog = document.getElementById("overtime-dialog") as HTMLDialogElement;
    dialog.showModal();
  }, []);

  useEffect(() => {
    if (hasQualifiedScore && scoringAnswers.length === 7 && !isPerfect) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsPerfect(true);
      openPerfectDialog();
    }
  }, [scoringAnswers, hasQualifiedScore, openPerfectDialog, isPerfect]);

  const fetchSubmissionResponse = useCallback(async (answer: string, promptId: PromptId) => {
    try {
      const res = await fetch("https://proxyrequest-eic4hc2dwa-uc.a.run.app", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          url: `https://krillion.io/api/submit`,
          options: {
            method: "POST",
            body: JSON.stringify({
              answer,
              date: isoDate,
              playerId,
              previewCorrection: true,
              promptId
            })
          }
        })
      });
      const json = await res.json();
      if (!json.success || json.status !== 200) {
        throw new Error("Error submitting answer");
      }
      return json;
    } catch(err) {
      console.error(err);
      window.alert("An error occurred submitting this answer. Please try again later.");
      return { networkError: true };
    }
  }, []);

  const saveAnswers = useCallback((answerList: Prompt[], reveal: Reveal | undefined, goalScore: number) => {
    localStorage.setItem(ANSWER_STORAGE_NAME, JSON.stringify({ date: isoDate, answers: answerList }));

    // reveal should always be defined when saving answers
    reveal = reveal ?? { date: isoDate, prompts: [] };

    const answersWithPrompts = answerList.map(a => ({
      ...a,
      text: reveal.prompts.find(p => p.id === a.id)?.text ?? ""
    }));

    const revealKrillions = { ...reveal, prompts: reveal.prompts.map(p => ({
      ...p,
      answers: p.answers.filter(a => a.score == 100)
    }))};

    try {
      const cache = localStorage.getItem(STATS_STORAGE_NAME);
      let stats: History[] = cache?.length ? JSON.parse(cache) : [];
      stats = stats.filter(x => x.date !== isoDate);
      stats.push({
        date: isoDate,
        answers: answersWithPrompts,
        reveal: revealKrillions,
        goalScore
      });
      localStorage.setItem(STATS_STORAGE_NAME, JSON.stringify(stats));
    } catch(err) {
      console.error(err);
    }
  }, []);

  const handleAnswerSubmit = async (evt: any) => {
    setIsSubmitting(true);

    if (getISODate() !== isoDate) {
      openOvertimeDialog();
      setIsSubmitting(false);
      return;
    }

    const userValue = evt.currentTarget.previousElementSibling.value;
    const promptId = evt.currentTarget.dataset["promptid"] as PromptId;
    const updatedAnswers = structuredClone(answers);
    const wasQualified = hasQualifiedScore;

    // clear input and suggestion/feedback
    const inputElement = evt.currentTarget.previousElementSibling;
    inputElement.value = "";
    const prevResponses = [...responses].filter(r => r.promptId !== promptId);
    setResponses(prevResponses);

    // do not submit whitespace
    if (userValue.trim().length === 0) {
      setIsSubmitting(false);
      return;
    }

    // Request:
    // { answer: "title", date: "1986-02-05", playerId: "xxxxxx-xxxx-...", previewCorrection: true, promptId: "p1" }

    const { data: serverResponse } = await fetchSubmissionResponse(userValue, promptId);

    // Response:
    // { accepted: true, answer: "Title Case", tier: "schooler", score: 30 }
    // { accepted: false }
    // { accepted: false, correction: "Title Case" }

    if (!serverResponse || serverResponse.networkError) {
      // user alerted during fetch request
      setIsSubmitting(false);
      return;
    }

    const isAcceptedFoundPreviously = serverResponse.accepted && 
      answers.find(a => a.id == promptId) && 
      answers.find(a => a.id == promptId)?.answers.find(a => a.answer === serverResponse.answer);
    const isCorrectedFoundPreviously = serverResponse.accepted === false &&
      serverResponse.correction &&
      answers.find(a => a.id == promptId) && 
      answers.find(a => a.id == promptId)?.answers.find(a => a.answer === serverResponse.correction);
    if (isAcceptedFoundPreviously || isCorrectedFoundPreviously) {
      const text = serverResponse.answer ?? serverResponse.correction;
      if (text.length) {
        setResponses([...prevResponses, { promptId, text: `"${text}" already found` }]);
        setIsSubmitting(false);
        return;
      }
    }

    if (!serverResponse.accepted) {
      const correction = serverResponse.correction;
      if (correction?.length) {
        setResponses([...prevResponses, { promptId, text: `Did you mean "${correction}"?` }]);
        inputElement.value = correction;
      } else {
        setResponses([...prevResponses, { promptId, text: `No results found for "${userValue}" :(` }])
      }
      setIsSubmitting(false);
      return;
    }

    const newAnswer = {
      answer: serverResponse.answer,
      score: serverResponse.score,
      tier: serverResponse.tier
    };

    if (answers.find(a => a.id == promptId)) {
      updatedAnswers.forEach(a => {
        if (a.id === promptId) {
          a.answers.push(newAnswer);
        }
      });
    } else {
      updatedAnswers.push({
        id: promptId,
        text: "",
        answers: [newAnswer]
      });
    }

    if (score + newAnswer.score >= goalScore && !wasQualified) {
      openQualifiedDialog();
    }

    const area = document.querySelector(`.prompt-box-area[data-promptid="${promptId}"]`) as HTMLDivElement;
    area.dataset.tier = newAnswer.tier;
    area.classList.add("scoring");
    setTimeout(() => area.classList.remove("scoring"), 1200);

    saveAnswers(updatedAnswers, reveal, goalScore);
    setAnswers(updatedAnswers);
    setIsSubmitting(false);
  }

  const handleShare = useCallback(async () => {
    const emojiMap = {
      "plankton": "🫧",
      "schooler": "🐟",
      "rare": "🟥",
      "deepcut": "🟪",
      "krillion": "🌟"
    };

    const shareData = {
      title: "🧊 Chill Krill 🦐 " + isoDate,
      text: "" + 
        `Chill Krill  -  ${isoDate}\n` + 
        `[${scoringAnswers.length} answers | ${Math.floor(promptDiversity)}% diversity | ${score}/${goalScore}]\n` + 
        scoringAnswers
          .map(getTierFromScore)
          .filter((tier): tier is keyof typeof emojiMap => tier !== undefined)
          .map(tier => emojiMap[tier])
          .join("") + "\n\n",
      url: "https://chill-krill.kroljs.com"
    }

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.error(err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareData.url);
      } catch (clipboardErr) {
        console.error(clipboardErr);
      }
    }
  }, [scoringAnswers, hasQualifiedScore, score, goalScore]);

  const handleExplosionEnd = () => {
    setIsExploding(false);
  }

  return (
    <>
      {isExploding && <div id="confetti-container">
        <ConfettiExplosion 
          onComplete={handleExplosionEnd} 
          force={0.9}
          duration={5000}
          particleCount={300}
          colors={[
            '#4de3ff',
            '#2097ac',
            '#5b97a2',
            '#1e5d68'
          ]}
        />
      </div>}
      <dialog id="qualified-dialog">
        <div className="dialog-body">
          <p className="dialog-title">Goal score reached!</p>
          <p>Continue playing to find higher scoring answers and reach the goal score in fewer answers.</p>
          <div className="dialog-btn-row">
            <button commandfor="qualified-dialog" command="close">Keep Diving</button>
          </div>
        </div>
      </dialog>
      <dialog id="perfect-dialog">
        <div className="dialog-body">
          <p className="dialog-title">Perfect Score!</p>
          <p>You've found a top scoring answer to every prompt. Share with your friends to show off the <em>depth</em> of your knowledge!</p>
          <div className="dialog-btn-row">
            <button className="primary-btn" onClick={handleShare}>Share</button>
            <button commandfor="perfect-dialog" command="close">Close</button>
          </div>
        </div>
      </dialog>
      <dialog id="overtime-dialog">
        <div className="dialog-body">
          <p className="dialog-title">Onto the Next Dive</p>
          <p className="mb-10">This puzzle is no longer available. You'll need to refresh your page to play today's puzzle.</p>
          <p>You can share this dive's results one last time before refreshing, if you'd like.</p>
          <div className="dialog-btn-row">
            <button className="primary-btn" onClick={handleShare}>Share</button>
            <button commandfor="overtime-dialog" command="close">Okay</button>
          </div>
        </div>
      </dialog>
      {page === "home" && (
        <main id="home-page">
          <h1>Chill Krill</h1>
          <img id="hero-krill" src={BrandKrillion} alt="Krill" />
          <button className="bubble" onClick={handlePlay}>
            <div className="left"></div>
              Play Today's Puzzle
            <div className="right"></div>
          </button>
          <button onClick={handleHow}>How to Play</button>
          <button onClick={handleStats}>Stats &amp; Archive</button>
        </main>
      )}
      {page === "play" && (
        <main id="play-page">
          <h1>Chill Krill</h1>
          {reveal?.prompts.length && <div id="hero-section">
            {hasQualifiedScore && <div id="score-track">
              {scoreTrackMilestones.map((val, i) => (
                <span key={i} className="score-track-block">
                  {i > 0 && <div className={`score-track-line ${scoringAnswers.length <= val ? "complete" : ""}`}></div>}
                  <BubbleGroup filled={scoringAnswers.length <= val} label={val.toString()} />
                </span>
              ))}
            </div>}
            <div id="hero-score-row">
              {hasQualifiedScore && <p id="hero-diversity">
                <span className="hero-user-score">{Math.floor(promptDiversity)}<span className="hero-user-score-unit">%</span></span>
                <span className="hero-score-label">diversity</span>
              </p>}
              <p id="hero-score">
                {hasQualifiedScore
                  ? <><span className="hero-user-score">{scoringAnswers.length}</span><span className="hero-score-label">answers</span></>
                  : <span><span className="hero-user-score">{scoringAnswers.reduce((p,c) => p + c, 0)}</span> / {goalScore}</span>
                }
              </p>
              {hasQualifiedScore && <p id="hero-points">
                <span className="hero-user-score">{score}</span>
                <span className="hero-score-label">points</span>
              </p>}
            </div>
            {hasQualifiedScore
              ? <div id="hero-answers">
                  {scoringAnswers.map((a,i) => {
                    const imgSrc = getImgForAnswer(a);
                    const tier = getTierFromScore(a);
                    return (
                      <img src={imgSrc} key={i} className="hero-answer-icon" data-tier={tier} alt={tier} />
                  )})}
                </div>
              : <p id="unqualified-note">Not yet qualified. Reach the goal score first and then improve your answer score efficiency!</p>}
            {hasQualifiedScore && <p id="hero-answer-caption">Reached {goalScore} points using only {scoringAnswers.length} answers</p>}
          </div>}
          {!reveal?.prompts.length && <div id="loading-reveal-message">
            <p>Loading today's dive...</p>
            <span>
              <img src={BrandKrillion} className="hero-answer-icon" alt="krill" data-tier="plankton" />
              <img src={BrandKrillion} className="hero-answer-icon" alt="krill" data-tier="plankton" />
              <img src={BrandKrillion} className="hero-answer-icon" alt="krill" data-tier="plankton" />
            </span>
          </div>}
          {reveal && reveal.prompts.map((p) => {
            const userAnswers = answers.find(a => a.id === p.id)?.answers;
            const topAnswer = (userAnswers ?? []).reduce((p, c) => (c.score > p.score ? c : p), { score: 0, tier: "" });
            const imgSrc = getImgForAnswer(topAnswer.score);
            const response = responses.find(r => r.promptId === p.id);
            return (
            <div key={p.id} className="prompt-box">
              <button className="prompt-box-title" onClick={handleCollapseClick}>
                <img src={imgSrc} className="prompt-box-icon" data-tier={topAnswer.tier} alt={topAnswer.tier} />
                <p>{p.text}</p>
                <i className="toggle"></i>
              </button>
              <div className="prompt-box-area" data-promptid={p.id}>
                <div className="prompt-box-content">
                  {answers.find(a => a.id === p.id)?.answers.length
                    ? (<div className="answer-result-list">
                        {answers.find(a => a.id === p.id)?.answers.toSorted((a,b) => b.score - a.score || a.answer.localeCompare(b.answer)).map((a, i) => (
                          <React.Fragment key={i}>
                            <p>{a.answer}</p>
                            <p>+{a.score}</p>
                          </React.Fragment>
                        ))}
                    </div>)
                    : (<p>Type an answer below to start earning points.</p>)
                  }
                  <div className="answer-response-row">
                    <p className="answer-response">{response?.text?.length
                      ? response.text
                      : <>&nbsp;</>}</p>
                  </div>
                  <div className="answer-input-row">
                    <input type="search" data-promptid={p.id} placeholder="type one answer..." disabled={isSubmitting} />
                    <button data-promptid={p.id} onClick={handleAnswerSubmit} disabled={isSubmitting}>{isSubmitting ? <span className="loader"></span> : "SUBMIT"}</button>
                  </div>
                </div>
              </div>
            </div>
          )})}
          {reveal?.prompts.length && <button id="share-btn" className="primary-btn" onClick={handleShare}>Share {hasQualifiedScore ? "Results" : "Progress"}</button>}
          <button id="back-button" onClick={handleBack}>&#9664;</button>
        </main>
      )}
      {page === "how" && <HowTo handleBack={handleBack} />}
      {page === "stats" && <Stats handleBack={handleBack} getScoringAnswers={getScoringAnswers} />}
      <footer>&copy; <span id="year">{new Date().getFullYear()}</span> // <a href="https://kroljs.com" rel="noopener noreferrer">Jacob Krol</a></footer>
    </>
  )
}

export default App
