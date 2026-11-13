import type { Prompt, Tier } from './types.ts';
import PlainKrillion from "./assets/krillion-gray.png";
import Krillion from "./assets/krillion-gold.png";
import Deepcut from "./assets/deepcut.png";
import Rare from "./assets/rare.png";
import Schooler from "./assets/schooler.png";
import Plankton from "./assets/plankton.png";

export const scoreMap = {
  krillion: 100,
  deepcut: 85,
  rare: 60,
  schooler: 30,
  plankton: 10
};

export function formatIsoDateNoTimezone(isoDateString: string) {
  // Extract YYYY, MM, DD parts directly
  const [year, month, day] = isoDateString.split('-').map(Number);
  
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  
  const monthStr = monthNames[month - 1];
  return `${monthStr} ${day}, ${year}`;
}

export function getScoringAnswers(answers: Prompt[], goalScore: number) {
  if (!answers.length) return [];

  const sortedUserScores = answers.map(x => x.answers.map(y => y.score)).flat().toSorted((a,b) => a > b ? -1 : 1);
  return sortedUserScores.reduce((p1: number[], c1) => {
    const runningTotal = p1.reduce((p2, c2) => p2 + c2, 0);
    return runningTotal >= goalScore ? p1 : [...p1, c1];
  }, []);
}

export function getTierFromScore(x: number) {
  return Object.entries(scoreMap).find(([_,v]) => v === x)?.[0];
}

export function getImgForAnswer(input: Tier | number) {
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

export function getISODate(): string {
  return Intl.DateTimeFormat('sv-SE', { // sweden uses ISO style by default
    timeZone: 'America/New_York',
    dateStyle: 'short'
  }).format(new Date());
}

export function getPromptDiversityScore(
  prompts: Prompt[]
): number {
  const numPrompts = 7;

  const maxPromptSum = 700;
  const threshold = 700;

  // Sum answer scores, applying the per-prompt cap.
  const promptSums = prompts
    .map(prompt =>
      Math.min(
        prompt.answers.reduce((sum, answer) => sum + answer.score, 0),
        maxPromptSum
      )
    )
    .concat(new Array(numPrompts).fill(0))
    .slice(0, numPrompts);

  // check for exactly 100 (ensures 100% even with Math.floor on UI)
  const { allEqual } = promptSums.reduce((acc, curr, i) => ({ 
    value: curr, 
    allEqual: acc.allEqual && (acc.value === curr || i === 0)
  }), { value: -1, allEqual: true });

  if (prompts.length === numPrompts && allEqual) {
    return 100;
  }

  // Transform each prompt's score into a soft contribution.
  const contributions = promptSums.map(
    sum => sum / (sum + threshold)
  );

  const total = contributions.reduce((sum, value) => sum + value, 0);

  if (total === 0) return 0;

  const proportions = contributions.map(value => value / total);

  // Normalized Shannon entropy: 0 for one prompt, 1 for equal distribution.
  // Range: [0,ln(7))
  const entropy = -1 * proportions.reduce(
    (sum, p) => p > 0 ? sum + p * Math.log(p) : sum,
    0
  );

  const base = 20;
  return -100 * Math.log(-1 * entropy * (1 - base ** -1) / Math.log(numPrompts) + 1) / Math.log(base);
}

export async function handleShare(scoringAnswers: number[], promptDiversity: number, score: number, goalScore: number, isoDate: string) {
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
}