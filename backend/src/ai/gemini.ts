import { GoogleGenerativeAI } from '@google/generative-ai';
import { getPrompt } from '../lib/store';
import { getGeminiApiKey } from '../lib/settings';
import { actualCustomerInstruction, customerBlock } from '../lib/customerContext';
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
const AI_TIMEOUT_MS = Number(process.env.GEMINI_ANALYSIS_TIMEOUT_MS ?? 10 * 60_000);

function getClient(): GoogleGenerativeAI {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('Chưa cấu hình Gemini API key — vào "Model AI" để nhập.');
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

function promptRequiresJson(prompt: string): boolean {
  return (
    /YÊU CẦU TRẢ VỀ[\s\S]{0,80}JSON/i.test(prompt) ||
    /JSON nghiêm ngặt/i.test(prompt) ||
    /"fourPillars"|"primaryHexagram"|"phoneNumber"\s*:/i.test(prompt)
  );
}

async function runGemini(
  systemPrompt: string,
  parts: GeminiPart[],
  jsonOutput: boolean,
): Promise<{ text: string; usage: { input: number; output: number } }> {
  const client = getClient();
  const model = client.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction: systemPrompt,
    generationConfig: {
      temperature: 0.6,
      ...(jsonOutput ? { responseMimeType: 'application/json' } : {}),
    },
  });

  const result = await Promise.race([
    model.generateContent(parts as any),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error(`Gemini timed out after ${Math.round(AI_TIMEOUT_MS / 1000)}s`)),
        AI_TIMEOUT_MS,
      ),
    ),
  ]);

  const text = result.response.text();
  const meta = result.response.usageMetadata;
  return {
    text,
    usage: {
      input: meta?.promptTokenCount ?? 0,
      output: meta?.candidatesTokenCount ?? 0,
    },
  };
}

async function runGeminiAnalysis(
  section: PackageType,
  parts: GeminiPart[],
): Promise<{ analysis: Record<string, unknown>; usage: { input: number; output: number } }> {
  const prompt = getPrompt(section);
  const jsonOutput = promptRequiresJson(prompt);
  const { text, usage } = await runGemini(prompt, parts, jsonOutput);
  const trimmed = text.trim();
  if (!trimmed) throw new Error(`Gemini ${section} returned an empty report`);
  return { analysis: jsonOutput ? parseJsonSafe(trimmed) : { report: trimmed }, usage };
}

function parseDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const m = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
  if (!m) return null;
  return { mimeType: m[1], data: m[2] };
}

export async function analyzeTuTru(
  rawText: string,
  customer: CustomerInfo,
): Promise<GeminiAnalysis> {
  const image = parseDataUrl(rawText);
  const parts: GeminiPart[] = [
    `${actualCustomerInstruction(customer)}\n\nBÁT TỰ TỨ TRỤ CHART${image ? ' được đính kèm trong request này' : ''}. Đọc kỹ từng ô trên lá số và thực hiện đúng cấu trúc đầu ra mà prompt hệ thống yêu cầu.`,
  ];
  if (image) {
    parts.push({ inlineData: image });
  } else {
    parts[0] += `\n\nRAW DATA:\n${rawText}`;
  }
  const { analysis, usage } = await runGeminiAnalysis('tuTru', parts);
  return { type: 'tuTru' satisfies PackageType, analysis, usage };
}

export async function analyzeMaiHoa(
  rawText: string,
  customer: CustomerInfo,
  chartImage?: string,
): Promise<GeminiAnalysis> {
  const prompt = `${actualCustomerInstruction(customer)}

ẢNH QUẺ KINH DỊCH${chartImage ? ' được đính kèm trong request này. Hãy đọc ảnh trước theo yêu cầu trong prompt hệ thống.' : ' không trích xuất được; chỉ kết luận điều có thể xác nhận từ dữ liệu text.'}

DỮ LIỆU TEXT TỪ TRANG LẬP QUẺ:
${rawText}`;
  const parts: GeminiPart[] = [prompt];
  if (chartImage) parts.push({ inlineData: { mimeType: 'image/jpeg', data: chartImage } });
  const { analysis, usage } = await runGeminiAnalysis('maiHoa', parts);
  return { type: 'maiHoa' satisfies PackageType, analysis, usage };
}

export async function analyzeSimPhongThuy(
  rawText: string,
  phoneNumber: string,
  customer?: CustomerInfo,
  chartImage?: string,
): Promise<GeminiAnalysis> {
  const prompt = `${customer ? actualCustomerInstruction(customer) : `SỐ ĐIỆN THOẠI: ${phoneNumber}`}

DỮ LIỆU TEXT PHONG THỦY SIM:
${rawText}`;
  const parts: GeminiPart[] = [prompt];
  if (chartImage) parts.push({ inlineData: { mimeType: 'image/jpeg', data: chartImage } });
  const { analysis, usage } = await runGeminiAnalysis('sim', parts);
  return { type: 'sim' satisfies PackageType, analysis, usage };
}

export async function synthesize(
  geminiResults: GeminiAnalysis[],
  customer: CustomerInfo,
): Promise<{ text: string; usage: { input: number; output: number } }> {
  const client = getClient();
  const model = client.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction: getPrompt('synthesize'),
    generationConfig: { temperature: 0.7 },
  });

  const analysesBlock = geminiResults
    .map(
      (r) =>
        `${r.type.toUpperCase()} - DU LIEU PHAN TICH\n${JSON.stringify(r.analysis, null, 2)}`,
    )
    .join('\n\n');

  const userMessage = `KHÁCH HÀNG:\n${customerBlock(customer)}\n\nCÁC PHÂN TÍCH ĐÃ ĐƯỢC TRÍCH XUẤT:\n\n${analysesBlock}\n\nHãy soạn bản luận giải hoàn chỉnh dạng văn bản báo cáo Word theo cấu trúc đã yêu cầu. Không dùng Markdown: không "#", không "##", không "**", không "---", không code fence.`;

  const response = await Promise.race([
    model.generateContent(userMessage),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('Synthesis (Gemini) timed out after 120s')),
        120_000,
      ),
    ),
  ]);

  const text = response.response.text().trim();
  if (!text) throw new Error('Synthesis returned an empty response');
  const meta = response.response.usageMetadata;
  return {
    text,
    usage: {
      input: meta?.promptTokenCount ?? 0,
      output: meta?.candidatesTokenCount ?? 0,
    },
  };
}
