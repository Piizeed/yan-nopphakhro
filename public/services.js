import { calculateChart } from './astro.js';
import { natalScores, interpretNatal } from './rules.js';
export { places } from './places.js';
export { validateBirth } from './astro.js';
export const ephemerisProvider = {
  async calculate(input) { const chart=await calculateChart(input);chart.scores=natalScores(chart);return chart; },
};
export const interpretationProvider = { async interpret(chart) { return interpretNatal(chart); } };
