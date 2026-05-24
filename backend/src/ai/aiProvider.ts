import { getAiProvider, type AiProvider } from '../lib/settings';
import * as gemini from './gemini';
import * as claude from './claude';
import type { CustomerInfo, GeminiAnalysis } from '../types';

type ProviderModule = {
  analyzeTuTru: (rawText: string, customer: CustomerInfo) => Promise<GeminiAnalysis>;
  analyzeMaiHoa: (rawText: string, customer: CustomerInfo) => Promise<GeminiAnalysis>;
  analyzeSimPhongThuy: (rawText: string, phoneNumber: string) => Promise<GeminiAnalysis>;
  synthesize: (
    analyses: GeminiAnalysis[],
    customer: CustomerInfo,
  ) => Promise<{ text: string; usage: { input: number; output: number } }>;
};

const PROVIDERS: Record<AiProvider, ProviderModule> = {
  gemini,
  claude,
};

function active(): ProviderModule {
  return PROVIDERS[getAiProvider()];
}

export function currentProvider(): AiProvider {
  return getAiProvider();
}

export function analyzeTuTru(rawText: string, customer: CustomerInfo): Promise<GeminiAnalysis> {
  return active().analyzeTuTru(rawText, customer);
}

export function analyzeMaiHoa(rawText: string, customer: CustomerInfo): Promise<GeminiAnalysis> {
  return active().analyzeMaiHoa(rawText, customer);
}

export function analyzeSimPhongThuy(rawText: string, phoneNumber: string): Promise<GeminiAnalysis> {
  return active().analyzeSimPhongThuy(rawText, phoneNumber);
}

export function synthesize(
  analyses: GeminiAnalysis[],
  customer: CustomerInfo,
): Promise<{ text: string; usage: { input: number; output: number } }> {
  return active().synthesize(analyses, customer);
}
