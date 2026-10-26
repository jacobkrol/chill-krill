import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './App.css';
import './bubble-button.css';
import PlainKrillion from "./assets/krillion-gray.png";
import BrandKrillion from "./assets/krillion.png";
import Krillion from "./assets/krillion-gold.png";
import Deepcut from "./assets/deepcut.png";
import Rare from "./assets/rare.png";
import Schooler from "./assets/schooler.png";
import Plankton from "./assets/plankton.png";
import BubbleGroup from './BubbleGroup';

const PROMPT_STORAGE_NAME = "prompts";
const ANSWER_STORAGE_NAME = "answers";
const isoDate = Intl.DateTimeFormat('sv-SE', { // sweden uses ISO style by default
  timeZone: 'America/New_York',
  dateStyle: 'short'
}).format(new Date());
const playerId = crypto.randomUUID();

const scoreMap = {
  krillion: 100,
  deepcut: 85,
  rare: 60,
  schooler: 30,
  plankton: 10
};

const getTierFromScore = (x: number) => Object.entries(scoreMap).find(([_,v]) => v === x)?.[0];

const scoreTrackMilestones = [30, 24, 18, 12, 9, 7];

type Tier = "krillion" | "deepcut" | "rare" | "schooler" | "plankton";

interface Answer {
  answer: string;
  quip?: string;
  score: number;
  tier: Tier;
}

type PromptId = "p1" | "p2" | "p3" | "p4" | "p5" | "p6" | "p7";

interface Prompt {
  id: PromptId;
  text: string;
  answers: Answer[];
}

interface Reveal {
  date: string;
  prompts: Prompt[]
}

interface Response {
  promptId: PromptId;
  answer: string;
  correction: string | undefined;
}

function App() {
  const [page, setPage] = useState("home");
  const [reveal, setReveal] = useState<Reveal>();
  const [answers, setAnswers] = useState<Prompt[]>([]); // accepted answers
  const [responses, setResponses] = useState<Response[]>([]); // server non-accepted responses
  const [isSubmitting, setIsSubmitting] = useState(false); // loading state
  const [isPerfect, setIsPerfect] = useState(false);

  const handlePlay = () => {
    setPage("play");
  }

  const handleHow = () => {
    setPage("how");
  }

  const handleBack = () => {
    setPage("home");
  }

  useEffect(() => {
    [...document.querySelectorAll(".prompt-box-area.active")].forEach((box: any) => {
      box.style.maxHeight = box.scrollHeight + "px";
    })
  }, [answers])

  const handleCollapseClick = (evt: any) => {
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
        localStorage.setItem(PROMPT_STORAGE_NAME, JSON.stringify(json));
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
        const res = await fetchReveal()
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

  const scoringAnswers = useMemo(() => {
    if (!answers.length) return [];

    const sortedUserScores = answers.map(x => x.answers.map(y => y.score)).flat().toSorted((a,b) => a > b ? -1 : 1);
    return sortedUserScores.reduce((p1: number[], c1) => {
      const runningTotal = p1.reduce((p2, c2) => p2 + c2, 0);
      return runningTotal >= goalScore ? p1 : [...p1, c1];
    }, []);
  }, [answers, goalScore]);

  const hasQualifiedScore = useMemo(() => (
    goalScore > 0 && scoringAnswers.reduce((p,c) => p + c, 0) >= goalScore
  ), [scoringAnswers, goalScore]);

  const openQualifiedDialog = useCallback(() => {
    const dialog = document.getElementById("qualified-dialog") as HTMLDialogElement;
    dialog.showModal();
  }, []);

  const openPerfectDialog = useCallback(() => {
    const dialog = document.getElementById("perfect-dialog") as HTMLDialogElement;
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

  const saveAnswers = useCallback((answerList: Prompt[]) => {
    localStorage.setItem(ANSWER_STORAGE_NAME, JSON.stringify({ date: isoDate, answers: answerList }));
  }, []);

  const handleAnswerSubmit = async (evt: any) => {
    setIsSubmitting(true);

    const userValue = evt.currentTarget.previousElementSibling.value;
    const promptId = evt.currentTarget.dataset["promptid"] as PromptId;
    const updatedAnswers = structuredClone(answers);
    const wasQualified = hasQualifiedScore;

    // clear input and suggestion/feedback
    const inputElement = evt.currentTarget.previousElementSibling;
    inputElement.value = "";
    const prevResponses = [...responses].filter(r => r.promptId !== promptId);
    setResponses(prevResponses);

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

    if (!serverResponse.accepted) {
      const correction = serverResponse.correction;
      if (correction?.length) inputElement.value = correction;
      setResponses([...prevResponses, { promptId, answer: userValue, correction }]);
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

    saveAnswers(updatedAnswers);
    setAnswers(updatedAnswers);
    setIsSubmitting(false);
  }

  const getImgForAnswer = (input: Tier | number) => {
    let imgSrc;
    const value = typeof input === "number" ? input : scoreMap[input];
    switch(value) {
      case 100:
        imgSrc = Krillion;
        break;
      case 85:
        imgSrc = Deepcut;
        break;
      case 60:
        imgSrc = Rare;
        break;
      case 30:
        imgSrc = Schooler;
        break;
      case 10:
        imgSrc = Plankton;
        break;
      default:
        imgSrc = PlainKrillion;
        break;
    }
    return imgSrc;
  }

  const handleShare = useCallback(async () => {
    const emojiMap = {
      "plankton": "🫧",
      "schooler": "🐟",
      "rare": "🔴",
      "deepcut": "🟣",
      "krillion": "⭐"
    };

    const shareData = {
      title: "🧊 Chill Krill 🦐 " + isoDate,
      text: "Chill Krill  -  " + isoDate + "\n(" + scoringAnswers.length + ") " + scoringAnswers
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
  }, [scoringAnswers]);

  return (
    <>
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
        </main>
      )}
      {page === "play" && (
        <main id="play-page">
          <h1>Chill Krill</h1>
          <div id="hero-section">
            {hasQualifiedScore && <div id="score-track">
              {scoreTrackMilestones.map((val, i) => (
                <span key={i} className="score-track-block">
                  {i > 0 && <div className={`score-track-line ${scoringAnswers.length <= val ? "complete" : ""}`}></div>}
                  <BubbleGroup filled={scoringAnswers.length <= val} label={val.toString()} />
                </span>
              ))}
            </div>}
            <p id="hero-score">
              {hasQualifiedScore
                ? <>using <span className="hero-user-score">{scoringAnswers.length}</span> dives</>
                : <><span className="hero-user-score">{scoringAnswers.reduce((p,c) => p + c, 0)}</span> / {goalScore}</>
              }
            </p>
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
          </div>
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
                        {answers.find(a => a.id === p.id)?.answers.toSorted((a,b) => a.score > b.score ? -1 : 1).map((a, i) => (
                          <React.Fragment key={i}>
                            <p>{a.answer}</p>
                            <p>+{a.score}</p>
                          </React.Fragment>
                        ))}
                    </div>)
                    : (<p>Type an answer below to start earning points.</p>)
                  }
                  <div className="answer-response-row">
                    <p className="answer-response">{response
                      ? typeof response.correction === "string"
                        ? `Did you mean "${response.correction}"?`
                        : `No results found for "${response.answer}" :(`
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
          {hasQualifiedScore && <button id="share-btn" className="primary-btn" onClick={handleShare}>Share Results</button>}
          <button id="back-button" onClick={handleBack}>&#9664;</button>
        </main>
      )}
      {page === "how" && (
        <main id="how-page">
          <h1>Chill Krill</h1>
          <button id="back-button" onClick={handleBack}>&#9664;</button>
          <h2>How to Play</h2>
          <p>You're presented with 7 general knowledge prompts. They'll look something like this:</p>
          <div className="prompt-box">
            <button className="prompt-box-title">
              <img src={PlainKrillion} className="prompt-box-icon" alt="unanswered tier" />
              <p>Name a world capital starting with "A-"</p>
              <i className="toggle"></i>
            </button>
          </div>
          <p>There are 100s to 1000s of possible answers to each prompt. More obscure answers are worth more points.</p>
          <div id="how-score-table">
            <img src={Plankton} data-tier="plankton" alt="plankton" />
            <p>+10</p>
            <img src={Schooler} data-tier="schooler" alt="schooler" />
            <p>+30</p>
            <img src={Rare} data-tier="rare" alt="rare" />
            <p>+60</p>
            <img src={Deepcut} data-tier="deepcut" alt="deep cut" />
            <p>+85</p>
            <img src={Krillion} data-tier="krillion" alt="krillion" />
            <p>+100</p>
          </div>
          <p>Try to reach the goal score with as few "dives" (answers) as possible. But there's no rush!</p>
          <p>Work your way to a perfect score before the puzzle resets at midnight EST.</p>
          <div id="hero-answers">
            {new Array(7).fill(100).map((a,i) => {
              const imgSrc = getImgForAnswer(a);
              const tier = Object.entries(scoreMap).find(([_,v]) => v === a)?.[0];
              return (
                <img src={imgSrc} key={i} className="hero-answer-icon" data-tier={tier} alt={tier} />
            )})}
          </div>
          <p>Good luck!</p>
          <button onClick={handleBack}>Swim Back</button>
        </main>
      )}
      <footer>&copy; <span id="year">{new Date().getFullYear()}</span> // <a href="https://kroljs.com" rel="noopener noreferrer">Jacob Krol</a></footer>
    </>
  )
}

export default App
