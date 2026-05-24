import Anthropic from '@anthropic-ai/sdk';
type ContentBlockParam = Anthropic.TextBlockParam | Anthropic.ImageBlockParam;
import { getPrompt } from '../lib/store';
import { getAnthropicApiKey } from '../lib/settings';
import type { CustomerInfo, GeminiAnalysis, PackageType } from '../types';

export { DEFAULT_PROMPT_SYNTHESIZE as SYSTEM_PROMPT_SYNTHESIZE } from '../lib/defaults';

const MODEL_NAME = 'claude-sonnet-4-5-20250929';
const AI_TIMEOUT_MS = 120_000;
const MAX_TOKENS = 8192;

function getClient(): Anthropic {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) {
    throw new Error('Chưa cấu hình Anthropic API key — vào "Model AI" để nhập.');
  }
  return new Anthropic({ apiKey });
}

function customerBlock(customer: CustomerInfo): string {
  return [
    `- Họ tên: ${customer.fullName}`,
    `- Ngày sinh: ${customer.day}/${customer.month}/${customer.year}`,
    `- Giờ sinh: ${customer.hour ?? 'Không rõ'}`,
    `- Giới tính: ${customer.gender === 'male' ? 'Nam' : 'Nữ'}`,
    customer.phoneNumber ? `- Số điện thoại: ${customer.phoneNumber}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function parseDataUrl(dataUrl: string): { mediaType: string; data: string } | null {
  const m = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
  if (!m) return null;
  return { mediaType: m[1], data: m[2] };
}

function extractText(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
}

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
    if (block) return JSON.parse(block) as Record<string, unknown>;
    throw new Error('Claude did not return valid JSON');
  }
}

async function runClaude(
  systemPrompt: string,
  userContent: ContentBlockParam[],
  options: { json?: boolean; timeoutMs?: number } = {},
): Promise<{ text: string; usage: { input: number; output: number } }> {
  const client = getClient();
  const timeoutMs = options.timeoutMs ?? AI_TIMEOUT_MS;

  const systemForJson = options.json
    ? `${systemPrompt}\n\nQuan trọng: phản hồi DUY NHẤT là JSON hợp lệ theo schema yêu cầu, KHÔNG bọc \`\`\`, KHÔNG giải thích trước/sau.`
    : systemPrompt;

  const message = await Promise.race([
    client.messages.create({
      model: MODEL_NAME,
      max_tokens: MAX_TOKENS,
      system: systemForJson,
      messages: [{ role: 'user', content: userContent }],
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Claude timed out after ${Math.round(timeoutMs / 1000)}s`)), timeoutMs),
    ),
  ]);

  return {
    text: extractText(message),
    usage: {
      input: message.usage?.input_tokens ?? 0,
      output: message.usage?.output_tokens ?? 0,
    },
  };
}

export async function analyzeTuTru(
  rawText: string,
  customer: CustomerInfo,
): Promise<GeminiAnalysis> {
  const image = parseDataUrl(rawText);
  const userText = `CUSTOMER:\n${customerBlock(customer)}\n\nBÁT TỰ TỨ TRỤ CHART${image ? ' (xem ảnh đính kèm)' : ''}. Đọc kỹ từng ô trên lá số — trụ, can chi, tàng can, thập thần, đại vận — rồi phân tích đúng JSON schema.`;

  const content: ContentBlockParam[] = [];
  if (image) {
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: image.mediaType as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp',
        data: image.data,
      },
    });
    content.push({ type: 'text', text: userText });
  } else {
    content.push({ type: 'text', text: `${userText}\n\nRAW DATA:\n${rawText}` });
  }

  const { text, usage } = await runClaude(getPrompt('tuTru'), content, { json: true });
  return { type: 'tuTru' satisfies PackageType, analysis: parseJsonSafe(text), usage };
}

export async function analyzeMaiHoa(
  rawText: string,
  customer: CustomerInfo,
): Promise<GeminiAnalysis> {
  const userText = `CUSTOMER:\n${customerBlock(customer)}\n\nRAW MAI HOA DATA:\n${rawText}`;
  const { text, usage } = await runClaude(getPrompt('maiHoa'), [{ type: 'text', text: userText }], { json: true });
  return { type: 'maiHoa' satisfies PackageType, analysis: parseJsonSafe(text), usage };
}

export async function analyzeSimPhongThuy(
  rawText: string,
  phoneNumber: string,
): Promise<GeminiAnalysis> {
  const userText = `PHONE NUMBER: ${phoneNumber}\n\nRAW NUMEROLOGY DATA:\n${rawText}`;
  const { text, usage } = await runClaude(getPrompt('sim'), [{ type: 'text', text: userText }], { json: true });
  return { type: 'sim' satisfies PackageType, analysis: parseJsonSafe(text), usage };
}

export async function synthesize(
  geminiResults: GeminiAnalysis[],
  customer: CustomerInfo,
): Promise<{ text: string; usage: { input: number; output: number } }> {
  const analysesBlock = geminiResults
    .map(
      (r) =>
        `### ${r.type.toUpperCase()} ANALYSIS (JSON)\n${JSON.stringify(r.analysis, null, 2)}`,
    )
    .join('\n\n');

  const userMessage = `KHÁCH HÀNG:\n${customerBlock(customer)}\n\nCÁC PHÂN TÍCH ĐÃ ĐƯỢC TRÍCH XUẤT:\n\n${analysesBlock}\n\nHãy soạn bản luận giải hoàn chỉnh dạng Markdown theo cấu trúc đã yêu cầu.`;

  const { text, usage } = await runClaude(
    getPrompt('synthesize'),
    [{ type: 'text', text: userMessage }],
    { timeoutMs: AI_TIMEOUT_MS },
  );

  const trimmed = text.trim();
  if (!trimmed) throw new Error('Synthesis returned an empty response');
  return { text: trimmed, usage };
}
