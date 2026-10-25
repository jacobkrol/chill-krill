import { useState, useEffect, useCallback, useMemo } from 'react';
import './App.css';
import './bubble-button.css';
import PlainKrillion from "./assets/krillion-gray.png";
import BrandKrillion from "./assets/krillion.png";
import Krillion from "./assets/krillion-gold.png";
import Deepcut from "./assets/deepcut.png";
import Rare from "./assets/rare.png";
import Schooler from "./assets/schooler.png";
import Plankton from "./assets/plankton.png";

const PROMPT_STORAGE_NAME = "prompts";
const isoDate = new Date().toISOString().split('T')[0];
const playerId = crypto.randomUUID();

const scoreMap = {
  krillion: 100,
  deepcut: 85,
  rare: 60,
  schooler: 30,
  plankton: 10
};

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
  const [answers, setAnswers] = useState<Prompt[]>([]);
  const [responses, setResponses] = useState<Response[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const fetchAnswers = useCallback(async () => {
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
      if (json.success && json.status === 200) {
        localStorage.setItem(PROMPT_STORAGE_NAME, JSON.stringify(json));
        return json;
      }
    } catch(err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    if (page === "play") {
      if (!reveal || reveal?.date !== isoDate) {
        fetchAnswers().then(res => {
          if (!res) throw new Error("Error loading answers");
          setReveal(res);
        }).catch((err) => {
          console.error(err);
          window.alert("An error occurred loading today's puzzle. Please try again later.");
        });
      }
    }
  }, [page, reveal, fetchAnswers]);

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

  const handleAnswerSubmit = async (evt: any) => {
    setIsSubmitting(true);

    const userValue = evt.currentTarget.previousElementSibling.value;
    const promptId = evt.currentTarget.dataset["promptid"] as PromptId;
    const updatedAnswers = structuredClone(answers);

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

  return (
    <>
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
          <p id="hero-score"><span className="hero-user-score">{scoringAnswers.length}</span> answers <span className="hero-user-score">{scoringAnswers.reduce((p,c) => p + c, 0)}</span> / {goalScore}</p>
          {score >= goalScore
            ? <div id="hero-answers">
                {scoringAnswers.map((a,i) => {
                  const imgSrc = getImgForAnswer(a);
                  const tier = Object.entries(scoreMap).find(([_,v]) => v === a)?.[0];
                  return (
                    <img src={imgSrc} key={i} className="hero-answer-icon" data-tier={tier} alt={tier} />
                )})}
              </div>
            : <p id="unqualified-note">(not yet qualified)</p>}
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
              <div className="prompt-box-area">
                <div className="prompt-box-content">
                  <div className="answer-result-list">
                    {answers.find(a => a.id === p.id)?.answers.length
                      ? answers.find(a => a.id === p.id)?.answers.toSorted((a,b) => a.score > b.score ? -1 : 1).map((a, i) => (
                        <div key={i} className="answer-result-row">
                          <p>{a.answer}</p>
                          <p>+{a.score}</p>
                        </div>
                      )) : (<p>Type an answer below to start earning points.</p>)
                    }
                  </div>
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
          <button id="back-button" onClick={handleBack}>&#9664;</button>
        </main>
      )}
      {page === "how" && (
        <main id="how-page">
          <h1>Chill Krill</h1>
          <button id="back-button" onClick={handleBack}>&#9664;</button>
          <h2>How to Play</h2>
          <p>Blah blah blah ...</p>
        </main>
      )}
      <footer>&copy; <span id="year">{new Date().getFullYear()}</span> // <a href="https://kroljs.com" rel="noopener noreferrer">Jacob Krol</a></footer>
    </>
  )
}

export default App
