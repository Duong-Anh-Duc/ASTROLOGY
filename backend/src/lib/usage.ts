export interface TokenUsage {
  input: number;
  output: number;
}

// Gemini 3.1 Pro Preview pricing (USD per million tokens) — approximation.
const PRICE_PER_M_INPUT = 1.25;
const PRICE_PER_M_OUTPUT = 5.0;
const USD_TO_VND = 25_000;

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
  const usd =
    (usage.input * PRICE_PER_M_INPUT +
      usage.output * PRICE_PER_M_OUTPUT) /
    1_000_000;
  return {
    inputTokens: usage.input,
    outputTokens: usage.output,
    usd,
    vnd: Math.round(usd * USD_TO_VND),
  };
}
