import { getAiProvider, getAiProviderForSection, type AiProvider } from '../lib/settings';
import * as gemini from './gemini';
import * as claude from './claude';
import type { CustomerInfo, GeminiAnalysis } from '../types';

type ProviderModule = {
  analyzeTuTru: (rawText: string, customer: CustomerInfo) => Promise<GeminiAnalysis>;
  analyzeMaiHoa: (rawText: string, customer: CustomerInfo, chartImage?: string) => Promise<GeminiAnalysis>;
  analyzeSimPhongThuy: (
    rawText: string,
    phoneNumber: string,
    customer?: CustomerInfo,
    chartImage?: string,
  ) => Promise<GeminiAnalysis>;
  synthesize: (
    analyses: GeminiAnalysis[],
    customer: CustomerInfo,
  ) => Promise<{ text: string; usage: { input: number; output: number } }>;
};

const PROVIDERS: Record<AiProvider, ProviderModule> = {
  gemini,
  claude,
};

export function currentProvider(): AiProvider {
  return getAiProvider();
}

export function providerForSection(section: 'tuTru' | 'maiHoa' | 'sim' | 'synthesize'): AiProvider {
  return getAiProviderForSection(section);
}

export function analyzeTuTru(rawText: string, customer: CustomerInfo): Promise<GeminiAnalysis> {
  return PROVIDERS[getAiProviderForSection('tuTru')].analyzeTuTru(rawText, customer);
}

export function analyzeMaiHoa(rawText: string, customer: CustomerInfo, chartImage?: string): Promise<GeminiAnalysis> {
  return PROVIDERS[getAiProviderForSection('maiHoa')].analyzeMaiHoa(rawText, customer, chartImage);
}

export function analyzeSimPhongThuy(
  rawText: string,
  phoneNumber: string,
  customer?: CustomerInfo,
  chartImage?: string,
): Promise<GeminiAnalysis> {
  return PROVIDERS[getAiProviderForSection('sim')].analyzeSimPhongThuy(
    rawText,
    phoneNumber,
    customer,
    chartImage,
  );
}

export function synthesize(
  analyses: GeminiAnalysis[],
  customer: CustomerInfo,
): Promise<{ text: string; usage: { input: number; output: number } }> {
  return PROVIDERS[getAiProviderForSection('synthesize')].synthesize(analyses, customer);
}
