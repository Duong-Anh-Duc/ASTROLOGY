import { GoogleGenerativeAI } from '@google/generative-ai';
import { getPrompt } from '../lib/store';
import type { CustomerInfo, GeminiAnalysis, PackageType } from '../types';

/*
 * ===========================================================================
 * SYSTEM PROMPTS — Customize these to match the user's divination expertise.
 *
 * Each prompt is responsible for ONE category only. Do not merge them: the
 * isolation is what makes Gemini focus and produce a richer analysis per
 * topic. Output must be valid JSON only (no markdown fences).
 * ===========================================================================
 */

export {
  DEFAULT_PROMPT_TU_TRU as SYSTEM_PROMPT_TU_TRU,
  DEFAULT_PROMPT_MAI_HOA as SYSTEM_PROMPT_MAI_HOA,
  DEFAULT_PROMPT_SIM as SYSTEM_PROMPT_SIM,
} from '../lib/defaults';
import {
  DEFAULT_PROMPT_TU_TRU,
  DEFAULT_PROMPT_MAI_HOA,
  DEFAULT_PROMPT_SIM,
} from '../lib/defaults';
// Re-exported for test scripts that imported them from this module.
void [DEFAULT_PROMPT_TU_TRU, DEFAULT_PROMPT_MAI_HOA, DEFAULT_PROMPT_SIM];

/* ========================================================================= */

const MODEL_NAME = 'gemini-3.1-pro-preview';
const AI_TIMEOUT_MS = 60_000;

function getClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }
  return new GoogleGenerativeAI(apiKey);
}

/**
 * Strip optional ```json``` code fences and parse JSON safely.
 * Some Gemini outputs still wrap content despite instructions — be defensive.
 */
function extractFirstJsonObject(s: string): string | null {
  const start = s.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\' && inString) {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

function parseJsonSafe(raw: string): Record<string, unknown> {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  }
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    const block = extractFirstJsonObject(cleaned);
    if (block) {
      return JSON.parse(block) as Record<string, unknown>;
    }
    throw new Error('Gemini did not return valid JSON');
  }
}

type GeminiPart = string | { inlineData: { mimeType: string; data: string } };

async function runGemini(
  systemPrompt: string,
  parts: GeminiPart[],
): Promise<{ analysis: Record<string, unknown>; usage: { input: number; output: number } }> {
  const client = getClient();
  const model = client.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction: systemPrompt,
    generationConfig: {
      temperature: 0.6,
      responseMimeType: 'application/json',
    },
  });

  const result = await Promise.race([
    model.generateContent(parts as any),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('Gemini timed out after 60s')),
        AI_TIMEOUT_MS,
      ),
    ),
  ]);

  const text = result.response.text();
  const meta = result.response.usageMetadata;
  return {
    analysis: parseJsonSafe(text),
    usage: {
      input: meta?.promptTokenCount ?? 0,
      output: meta?.candidatesTokenCount ?? 0,
    },
  };
}

function parseDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const m = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
  if (!m) return null;
  return { mimeType: m[1], data: m[2] };
}

function customerBlock(customer: CustomerInfo): string {
  return [
    `- Full name: ${customer.fullName}`,
    `- Date of birth: ${customer.day}/${customer.month}/${customer.year}`,
    `- Hour of birth: ${customer.hour ?? 'unknown'}`,
    `- Gender: ${customer.gender}`,
  ].join('\n');
}

export async function analyzeTuTru(
  rawText: string,
  customer: CustomerInfo,
): Promise<GeminiAnalysis> {
  const image = parseDataUrl(rawText);
  const parts: GeminiPart[] = [
    `CUSTOMER:\n${customerBlock(customer)}\n\nBÁT TỰ TỨ TRỤ CHART (image attached). Read every cell of the chart — pillars, branches, hidden stems, ten gods, luck cycles. Then analyse strictly per the JSON schema.`,
  ];
  if (image) {
    parts.push({ inlineData: image });
  } else {
    parts[0] += `\n\nRAW DATA:\n${rawText}`;
  }
  const { analysis, usage } = await runGemini(getPrompt('tuTru'), parts);
  return { type: 'tuTru' satisfies PackageType, analysis, usage };
}

export async function analyzeMaiHoa(
  rawText: string,
  customer: CustomerInfo,
): Promise<GeminiAnalysis> {
  const prompt = `CUSTOMER:\n${customerBlock(customer)}\n\nRAW MAI HOA DATA:\n${rawText}`;
  const { analysis, usage } = await runGemini(getPrompt('maiHoa'), [prompt]);
  return { type: 'maiHoa' satisfies PackageType, analysis, usage };
}

export async function analyzeSimPhongThuy(
  rawText: string,
  phoneNumber: string,
): Promise<GeminiAnalysis> {
  const prompt = `PHONE NUMBER: ${phoneNumber}\n\nRAW NUMEROLOGY DATA:\n${rawText}`;
  const { analysis, usage } = await runGemini(getPrompt('sim'), [prompt]);
  return { type: 'sim' satisfies PackageType, analysis, usage };
}
