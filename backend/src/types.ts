/**
 * Shared TypeScript types for the Divination App.
 * Every data structure that crosses module boundaries should be declared here.
 */

export type Gender = 'male' | 'female';
export type PackageType = 'tuTru' | 'maiHoa' | 'sim';
export type Locale = 'vi' | 'en';

export interface CustomerInfo {
  fullName: string;
  day: number;
  month: number;
  year: number;
  hour: number | null; // null = unknown
  minute?: number; // 0-59, default 0
  gender: Gender;
  isLunar?: boolean; // true if DOB is lunar calendar (Âm lịch), default solar
  packages: PackageType[];
  phoneNumber?: string;
  question?: string; // "việc cần xem" — used by maiHoa & sim
  addressing?: string; // how the report should address the customer
  additionalContext?: string; // per-reading facts and requests, never global prompt content
  includeSynthesis?: boolean; // true = generate the combined summary tab
  useSolarTerms?: boolean; // "Dùng lịch tiết khí" — maiHoa & sim
  yearcalc?: number; // tuTru "Năm tính", default = current year
}

export interface ScraperResult {
  type: PackageType;
  rawText: string;
  screenshotPng?: string; // base64-encoded PNG (no data URL prefix)
  scrapedAt: Date;
}

export interface GeminiAnalysis {
  type: PackageType;
  analysis: Record<string, unknown>; // structured JSON returned by Gemini
  usage?: { input: number; output: number };
}

export interface CostInfo {
  inputTokens: number;
  outputTokens: number;
  usd: number;
  vnd: number;
}

export interface ApiResponse {
  success: boolean;
  sheetUrl?: string;
  cost?: CostInfo;
  error?: string;
}

/**
 * Progress events the API could emit (used by status panel labels).
 * The actual API in this project returns a single response at the end, but
 * keeping the canonical step list in one place makes future streaming simple.
 */
export type ProcessingStep =
  | 'idle'
  | 'scraping'
  | 'analyzing'
  | 'synthesizing'
  | 'exporting'
  | 'done'
  | 'error';
