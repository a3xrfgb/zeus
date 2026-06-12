export const WORK_SUGGESTIONS: readonly string[] = [
  "Outline your goal in one sentence, then break it into three concrete tasks.",
  "Review yesterday’s chat for one idea worth turning into a small experiment today.",
  "Spend twenty minutes in Chat on a single problem—you’ll thank yourself later.",
  "Open Study and skim one topic you’ve been postponing; note three takeaways.",
  "Create a new project folder and drop one reference file to anchor the work.",
  "Try a quick image prompt in Gallery to visualize the outcome you want.",
  "Pick one chat thread to rename so your sidebar reflects what matters now.",
  "Draft a message to Zeus explaining the blocker; often writing clarifies it.",
  "Batch similar tasks: models, then chat, then notes—context switching is expensive.",
  "End the day by writing a single line in Notes: what moved forward?",
  "Skim your gallery saves for a color palette or mood for today’s creative work.",
  "Set a timer for deep work; silence notifications until it rings.",
];

export function workSuggestionForToday(): string {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
  return WORK_SUGGESTIONS[dayOfYear % WORK_SUGGESTIONS.length];
}
