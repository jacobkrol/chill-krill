import type { Prompt } from './types.ts';

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