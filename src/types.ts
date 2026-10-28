export type Tier = "krillion" | "deepcut" | "rare" | "schooler" | "plankton";

export interface Answer {
  answer: string;
  quip?: string;
  score: number;
  tier: Tier;
}

export type PromptId = "p1" | "p2" | "p3" | "p4" | "p5" | "p6" | "p7";

export interface Prompt {
  id: PromptId;
  text: string;
  answers: Answer[];
}

export interface Reveal {
  date: string;
  prompts: Prompt[]
}

export interface Response {
  promptId: PromptId;
  text: string;
}

export interface History {
  date: string;
  answers: Prompt[];
  goalScore: number;
}