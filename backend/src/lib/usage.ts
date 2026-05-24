import { getAiProvider } from './settings';

export interface TokenUsage {
  input: number;
  output: number;
}

const USD_TO_VND = 25_000;

// Approx pricing (USD per million tokens).
const PRICING = {
  gemini: { input: 1.25, output: 5.0 }, // Gemini 3.1 Pro Preview
  claude: { input: 3.0, output: 15.0 }, // Claude Sonnet 4.5
};

export function emptyUsage(): TokenUsage {
  return { input: 0, output: 0 };
}

export function addUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return { input: a.input + b.input, output: a.output + b.output };
}

export interface CostBreakdown {
  inputTokens: number;
  outputTokens: number;
  usd: number;
  vnd: number;
}

export function calcCost(usage: TokenUsage): CostBreakdown {
  const p = PRICING[getAiProvider()];
  const usd =
    (usage.input * p.input + usage.output * p.output) / 1_000_000;
  return {
    inputTokens: usage.input,
    outputTokens: usage.output,
    usd,
    vnd: Math.round(usd * USD_TO_VND),
  };
}
