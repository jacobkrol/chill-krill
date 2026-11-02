import type { MouseEventHandler } from "react";
import PlainKrillion from "./assets/krillion-gray.png";
import Krillion from "./assets/krillion-gold.png";
import Deepcut from "./assets/deepcut.png";
import Rare from "./assets/rare.png";
import Schooler from "./assets/schooler.png";
import Plankton from "./assets/plankton.png";
import { getImgForAnswer, scoreMap } from "./utils";

export default function HowTo({ 
  handleBack
}: { 
  handleBack: MouseEventHandler<HTMLButtonElement>
}) {
  return (
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
  )
}