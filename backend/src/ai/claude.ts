import { GoogleGenerativeAI } from '@google/generative-ai';
import { getPrompt } from '../lib/store';
import type { CustomerInfo, GeminiAnalysis } from '../types';

export { DEFAULT_PROMPT_SYNTHESIZE as SYSTEM_PROMPT_SYNTHESIZE } from '../lib/defaults';

const MODEL_NAME = 'gemini-3.1-pro-preview';
const AI_TIMEOUT_MS = 120_000;

function getClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured');
  }
  return new GoogleGenerativeAI(apiKey);
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
        `### ${r.type.toUpperCase()} ANALYSIS (JSON)\n${JSON.stringify(
          r.analysis,
          null,
          2,
        )}`,
    )
    .join('\n\n');

  const userMessage = `KHÁCH HÀNG:\n${customerBlock(customer)}\n\nCÁC PHÂN TÍCH ĐÃ ĐƯỢC TRÍCH XUẤT:\n\n${analysesBlock}\n\nHãy soạn bản luận giải hoàn chỉnh dạng Markdown theo cấu trúc đã yêu cầu.`;

  const response = await Promise.race([
    model.generateContent(userMessage),
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('Synthesis timed out after 120s')),
        AI_TIMEOUT_MS,
      ),
    ),
  ]);

  const text = response.response.text().trim();
  if (!text) {
    throw new Error('Synthesis returned an empty response');
  }
  const meta = response.response.usageMetadata;
  return {
    text,
    usage: {
      input: meta?.promptTokenCount ?? 0,
      output: meta?.candidatesTokenCount ?? 0,
    },
  };
}
