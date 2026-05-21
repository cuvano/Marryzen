/**
 * Marryzen profile prompts library (v1).
 *
 * Use during onboarding. Members pick 3 prompts (one per round) and write short answers.
 * Storage: profiles.prompts as jsonb([{ prompt, answer }, ...]).
 * Store the prompt TEXT (not an id) so future edits never break old profiles.
 */

export const PROMPT_MIN_CHARS = 60;
export const PROMPT_MAX_CHARS = 220;
export const PROMPT_SOFT_TARGET = 120;
export const REQUIRED_PROMPT_COUNT = 3;
export const MAX_PROMPT_COUNT = 5;

export const PROMPT_CATEGORIES = {
  vision: { label: 'Marriage and family vision', round: 1 },
  values: { label: 'Values and non-negotiables', round: 2 },
  faith: { label: 'Faith and spirituality', round: 2 },
  daily: { label: 'Daily life and lifestyle', round: 3 },
  personality: { label: 'Personality and humor', round: 3 },
  light: { label: 'Conversation starters', round: 3 },
  marryzen: { label: 'Marryzen Originals', round: 3, brand: true },
};

export const PROMPT_ROUND_HEADERS = [
  { round: 1, title: 'Pick one about your vision for marriage' },
  { round: 2, title: 'Pick one about your values or faith' },
  { round: 3, title: 'Pick one that shows your personality' },
];

export const PROMPTS = [
  // Round 1 — Marriage and family vision
  { category: 'vision', prompt: 'The marriage I am building toward looks like...' },
  { category: 'vision', prompt: 'The role I hope to play as a spouse...' },
  { category: 'vision', prompt: 'What I learned about love from my parents, and what I would do differently...' },
  { category: 'vision', prompt: 'My non-negotiable for the home we build...' },
  { category: 'vision', prompt: 'How I picture a Friday night five years in...' },
  { category: 'vision', prompt: 'Kids, for me, are...' },
  { category: 'vision', prompt: 'Family, to me, means...' },
  { category: 'vision', prompt: 'What I would want our home to feel like to a guest...' },
  { category: 'vision', prompt: 'The hardest and best part of being married, I think, will be...' },

  // Round 2 — Values and non-negotiables
  { category: 'values', prompt: 'A value I will not compromise on, even when it is inconvenient...' },
  { category: 'values', prompt: 'I respect people who...' },
  { category: 'values', prompt: 'Something I have changed my mind about in the last few years...' },
  { category: 'values', prompt: 'The kind of integrity I am trying to live by...' },
  { category: 'values', prompt: 'What I would want to be remembered for...' },
  { category: 'values', prompt: 'A boundary I have learned to hold...' },

  // Round 2 — Faith and spirituality (tradition-agnostic)
  { category: 'faith', prompt: 'How faith or spirituality shows up in my daily life...' },
  { category: 'faith', prompt: 'What I would want our spiritual life as a couple to look like...' },
  { category: 'faith', prompt: 'Something bigger than me that I orient my life around...' },
  { category: 'faith', prompt: 'How I would want to raise children around faith and values...' },

  // Round 3 — Daily life and lifestyle
  { category: 'daily', prompt: 'My ideal Sunday...' },
  { category: 'daily', prompt: 'Something I do every week that keeps me sane...' },
  { category: 'daily', prompt: 'What I am working on becoming better at...' },
  { category: 'daily', prompt: 'How I spend money says I value...' },
  { category: 'daily', prompt: 'The kind of friend I am...' },
  { category: 'daily', prompt: 'Something I have kept up for years that I am quietly proud of...' },

  // Round 3 — Personality and humor
  { category: 'personality', prompt: 'I will lose track of time talking about...' },
  { category: 'personality', prompt: 'My most useless skill...' },
  { category: 'personality', prompt: 'A small thing that delights me more than it should...' },
  { category: 'personality', prompt: 'How my closest friends would describe me in one sentence...' },
  { category: 'personality', prompt: "The most 'me' thing about me..." },

  // Round 3 — Conversation starters
  { category: 'light', prompt: 'The way to win me over is...' },
  { category: 'light', prompt: 'The compliment I never get tired of hearing...' },
  { category: 'light', prompt: 'A meal that means something to me...' },
  { category: 'light', prompt: 'Something I would want to learn with a partner...' },
  { category: 'light', prompt: 'A book, song, or film I would hand to someone to understand me...' },

  // Round 3 — Marryzen Originals (brand voice differentiators)
  { category: 'marryzen', prompt: 'The kind of old couple I want us to become...' },
  { category: 'marryzen', prompt: 'What I would want my spouse to say about me at our 25th anniversary...' },
  { category: 'marryzen', prompt: 'Marriage, to me, is less about ____ and more about ____.' },
  { category: 'marryzen', prompt: 'Something my future kids should know about their other parent before they meet them...' },
  { category: 'marryzen', prompt: 'The Marryzen reason I am here...' },
];

export function getPromptsForRound(round) {
  return PROMPTS.filter((p) => PROMPT_CATEGORIES[p.category]?.round === round);
}

export function validateAnswer(answer) {
  const len = (answer || '').trim().length;
  if (len < PROMPT_MIN_CHARS) {
    return { ok: false, reason: 'too_short', remaining: PROMPT_MIN_CHARS - len };
  }
  if (len > PROMPT_MAX_CHARS) {
    return { ok: false, reason: 'too_long', over: len - PROMPT_MAX_CHARS };
  }
  return { ok: true };
}
