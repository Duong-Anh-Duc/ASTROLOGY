import Anthropic from '@anthropic-ai/sdk';
type ContentBlockParam = Anthropic.TextBlockParam | Anthropic.ImageBlockParam;
import { getPrompt } from '../lib/store';
import { getAnthropicApiKey } from '../lib/settings';
import type { CustomerInfo, GeminiAnalysis, PackageType } from '../types';

export { DEFAULT_PROMPT_SYNTHESIZE as SYSTEM_PROMPT_SYNTHESIZE } from '../lib/defaults';

const MODEL_NAME = 'claude-sonnet-4-5-20250929';
const ANALYSIS_TIMEOUT_MS = Number(process.env.CLAUDE_ANALYSIS_TIMEOUT_MS ?? 10 * 60_000);
const SYNTHESIS_TIMEOUT_MS = Number(process.env.CLAUDE_SYNTHESIS_TIMEOUT_MS ?? 10 * 60_000);
const MAX_TOKENS = Number(process.env.CLAUDE_MAX_TOKENS ?? 8192);
const REPORT_MAX_TOKENS = Number(process.env.CLAUDE_REPORT_MAX_TOKENS ?? 16_000);

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
    `- Giờ sinh: ${customer.hour === null ? 'Không rõ' : `${customer.hour}:${String(customer.minute ?? 0).padStart(2, '0')}`}`,
    `- Giới tính: ${customer.gender === 'male' ? 'Nam' : 'Nữ'}`,
    customer.phoneNumber ? `- Số điện thoại: ${customer.phoneNumber}` : '',
    customer.addressing ? `- Cách xưng hô bắt buộc: ${customer.addressing}` : '',
    customer.question ? `- Việc cần xem: ${customer.question}` : '',
    customer.additionalContext ? `- Thông tin và yêu cầu riêng của lượt này:\n${customer.additionalContext}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function actualCustomerInstruction(customer: CustomerInfo): string {
  return `DỮ LIỆU THỰC TẾ CỦA LƯỢT LUẬN GIẢI NÀY:
${customerBlock(customer)}

Các tên, danh xưng, ví dụ hoặc tình tiết khách hàng có sẵn trong prompt hệ thống chỉ là mẫu nếu khác dữ liệu trên. Luôn dùng dữ liệu thực tế này. Không tự thêm biến cố, con cái, hôn nhân hoặc nhu cầu chưa được nêu.`;
}

function promptRequiresJson(prompt: string): boolean {
  return (
    /YÊU CẦU TRẢ VỀ[\s\S]{0,80}JSON/i.test(prompt) ||
    /JSON nghiêm ngặt/i.test(prompt) ||
    /"fourPillars"|"primaryHexagram"|"phoneNumber"\s*:/i.test(prompt)
  );
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

function extractToolJson(message: Anthropic.Message): Record<string, unknown> | null {
  for (const block of message.content) {
    if (block.type === 'tool_use' && block.name === 'return_analysis_json') {
      return block.input as Record<string, unknown>;
    }
  }
  return null;
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
  options: { json?: boolean; timeoutMs?: number; maxTokens?: number } = {},
): Promise<{ text: string; usage: { input: number; output: number } }> {
  const client = getClient();
  const timeoutMs = options.timeoutMs ?? ANALYSIS_TIMEOUT_MS;
  const maxTokens = options.maxTokens ?? MAX_TOKENS;

  const systemForJson = options.json
    ? `${systemPrompt}\n\nQuan trọng: phản hồi DUY NHẤT là JSON hợp lệ theo schema yêu cầu, KHÔNG bọc \`\`\`, KHÔNG giải thích trước/sau.`
    : systemPrompt;

  let message: Anthropic.Message;
  try {
    message = await client.messages.create({
      model: MODEL_NAME,
      max_tokens: maxTokens,
      system: systemForJson,
      messages: [{ role: 'user', content: userContent }],
    }, { timeout: timeoutMs, maxRetries: 0 });
  } catch (err) {
    if (err instanceof Anthropic.APIConnectionTimeoutError) {
      throw new Error(`Claude timed out after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw err;
  }

  return {
    text: extractText(message),
    usage: {
      input: message.usage?.input_tokens ?? 0,
      output: message.usage?.output_tokens ?? 0,
    },
  };
}

async function runClaudeJson(
  section: PackageType,
  systemPrompt: string,
  userContent: ContentBlockParam[],
): Promise<{ analysis: Record<string, unknown>; usage: { input: number; output: number } }> {
  const { text, usage, message } = await (async () => {
    const client = getClient();
    const timeoutMs = ANALYSIS_TIMEOUT_MS;
    const systemForJson = `${systemPrompt}\n\nQuan trọng: hãy gọi tool return_analysis_json với object JSON đúng schema. Không trả lời bằng text thường.`;

    let message: Anthropic.Message;
    try {
      message = await client.messages.create({
        model: MODEL_NAME,
        max_tokens: MAX_TOKENS,
        system: systemForJson,
        messages: [{ role: 'user', content: userContent }],
        tools: [
          {
            name: 'return_analysis_json',
            description: 'Return the requested analysis as one valid JSON object.',
            input_schema: {
              type: 'object',
              properties: {
                analysis: {
                  type: 'string',
                  description:
                    'Use this field for the full prose analysis when the prompt asks for a complete written article instead of specific JSON fields.',
                },
              },
              additionalProperties: true,
            },
          },
        ],
        tool_choice: { type: 'tool', name: 'return_analysis_json' },
      }, { timeout: timeoutMs, maxRetries: 0 });
    } catch (err) {
      if (err instanceof Anthropic.APIConnectionTimeoutError) {
        throw new Error(`Claude timed out after ${Math.round(timeoutMs / 1000)}s`);
      }
      throw err;
    }

    return {
      text: extractText(message),
      message,
      usage: {
        input: message.usage?.input_tokens ?? 0,
        output: message.usage?.output_tokens ?? 0,
      },
    };
  })();

  const toolJson = extractToolJson(message);
  if (toolJson) return { analysis: toolJson, usage };

  console.warn(
    `[claude:${section}] Tool JSON missing, falling back to text parse. Preview: ${text.slice(0, 500)}`,
  );
  try {
    return { analysis: parseJsonSafe(text), usage };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'invalid JSON';
    throw new Error(`Claude ${section} did not return valid JSON: ${message}`);
  }
}

async function runClaudeAnalysis(
  section: PackageType,
  userContent: ContentBlockParam[],
): Promise<{ analysis: Record<string, unknown>; usage: { input: number; output: number } }> {
  const prompt = getPrompt(section);
  if (promptRequiresJson(prompt)) {
    return runClaudeJson(section, prompt, userContent);
  }

  const { text, usage } = await runClaude(prompt, userContent, {
    timeoutMs: ANALYSIS_TIMEOUT_MS,
    maxTokens: REPORT_MAX_TOKENS,
  });
  const report = text.trim();
  if (!report) throw new Error(`Claude ${section} returned an empty report`);
  return { analysis: { report }, usage };
}

export async function analyzeTuTru(
  rawText: string,
  customer: CustomerInfo,
): Promise<GeminiAnalysis> {
  const image = parseDataUrl(rawText);
  const userText = `${actualCustomerInstruction(customer)}

BÁT TỰ TỨ TRỤ CHART${image ? ' được đính kèm trong request này' : ''}. Đọc kỹ từng ô trên lá số, gồm trụ, can chi, tàng can, thập thần, đại vận và lưu niên. Thực hiện đúng cấu trúc đầu ra mà prompt hệ thống yêu cầu.`;

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

  const { analysis, usage } = await runClaudeAnalysis('tuTru', content);
  return { type: 'tuTru' satisfies PackageType, analysis, usage };
}

export async function analyzeMaiHoa(
  rawText: string,
  customer: CustomerInfo,
  chartImage?: string,
): Promise<GeminiAnalysis> {
  const userText = `${actualCustomerInstruction(customer)}

ẢNH QUẺ KINH DỊCH${chartImage ? ' được đính kèm trong request này. Hãy đọc ảnh trước theo yêu cầu trong prompt hệ thống.' : ' không trích xuất được; chỉ kết luận điều có thể xác nhận từ dữ liệu text.'}

DỮ LIỆU TEXT TỪ TRANG LẬP QUẺ:
${rawText}`;
  const content: ContentBlockParam[] = [];
  if (chartImage) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: chartImage },
    });
  }
  content.push({ type: 'text', text: userText });
  const { analysis, usage } = await runClaudeAnalysis('maiHoa', content);
  return { type: 'maiHoa' satisfies PackageType, analysis, usage };
}

export async function analyzeSimPhongThuy(
  rawText: string,
  phoneNumber: string,
  customer?: CustomerInfo,
  chartImage?: string,
): Promise<GeminiAnalysis> {
  const userText = `${customer ? actualCustomerInstruction(customer) : `SỐ ĐIỆN THOẠI: ${phoneNumber}`}

DỮ LIỆU TEXT PHONG THỦY SIM:
${rawText}`;
  const content: ContentBlockParam[] = [];
  if (chartImage) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: chartImage },
    });
  }
  content.push({ type: 'text', text: userText });
  const { analysis, usage } = await runClaudeAnalysis('sim', content);
  return { type: 'sim' satisfies PackageType, analysis, usage };
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
    { timeoutMs: SYNTHESIS_TIMEOUT_MS },
  );

  const trimmed = text.trim();
  if (!trimmed) throw new Error('Synthesis returned an empty response');
  return { text: trimmed, usage };
}
