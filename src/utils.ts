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

export function getMaxRepresentedQuestions(
  prompts: Prompt[],
  scoringAnswers: number[]
): number {
  const promptCount = prompts.length;

  // Count how many answers of each score we need.
  const required = new Map<number, number>();

  for (const score of scoringAnswers) {
    required.set(score, (required.get(score) ?? 0) + 1);
  }

  // A bitmask represents which prompts are included.
  // dp maps a mask to the number of scoring answers assigned.
  let dp = new Map<number, number>([[0, 0]]);

  for (const [score, needed] of required) {
    // Count available answers of this score per prompt.
    const available = prompts.map(
      prompt => prompt.answers.filter(a => a.score === score).length
    );

    const next = new Map<number, number>();

    // Track how many answers of this score we can assign
    // while using each combination of prompts.
    let states = new Map<number, number>([[0, 0]]);

    for (let i = 0; i < promptCount; i++) {
      const updated = new Map(states);

      for (const [mask, count] of states) {
        const maxTake = Math.min(available[i], needed - count);

        for (let take = 1; take <= maxTake; take++) {
          const newMask = mask | (1 << i);
          const newCount = count + take;

          // Keep the highest count for each mask.
          updated.set(
            newMask,
            Math.max(updated.get(newMask) ?? 0, newCount)
          );
        }
      }

      states = updated;
    }

    // Combine valid assignments with previous score tiers.
    for (const [mask, count] of states) {
      if (count !== needed) continue;

      for (const [prevMask] of dp) {
        const combined = prevMask | mask;
        next.set(combined, 1);
      }
    }

    dp = next;
  }

  // Find the maximum number of distinct prompts.
  return Math.max(
    0,
    ...[...dp.keys()].map(mask =>
      mask.toString(2).replace(/0/g, "").length
    )
  );
}

export function getPromptDiversityScore(
  prompts: Prompt[],
  scoringAnswers: number[],
  k = 2
): number {
  const n = scoringAnswers.length;

  if (n === 0 || prompts.length <= 1) return 0;

  const required = new Map<number, number>();

  for (const score of scoringAnswers) {
    required.set(score, (required.get(score) ?? 0) + 1);
  }

  const contributions = prompts.map(prompt => {
    const available = new Map<number, number>();

    for (const answer of prompt.answers) {
      available.set(
        answer.score,
        (available.get(answer.score) ?? 0) + 1
      );
    }

    let count = 0;

    for (const [score, needed] of required) {
      count += Math.min(available.get(score) ?? 0, needed);
    }

    return count;
  });

  const mean = contributions.reduce((a, b) => a + b, 0)
    / prompts.length;

  const variance = contributions.reduce(
    (sum, count) => sum + (count - mean) ** 2,
    0
  ) / prompts.length;

  const maxStdDev =
    (n * Math.sqrt(Math.floor(prompts.length ** 2 / 4)))
    / prompts.length;

  const normalizedDeviation = Math.sqrt(variance) / maxStdDev;

  const score =
    100 * (
      Math.exp(-k * normalizedDeviation) - Math.exp(-k)
    ) / (1 - Math.exp(-k));

  return Math.max(0, Math.min(100, score));
}