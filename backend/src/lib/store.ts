import { prisma } from '../db/client';
import {
  DEFAULT_PROMPT_MAI_HOA,
  DEFAULT_PROMPT_SIM,
  DEFAULT_PROMPT_SYNTHESIZE,
  DEFAULT_PROMPT_TU_TRU,
  STYLE_GUIDE_LASO,
} from './defaults';

export type PromptKey = 'tuTru' | 'maiHoa' | 'sim' | 'synthesize';

const DEFAULTS: Record<PromptKey, string> = {
  tuTru: DEFAULT_PROMPT_TU_TRU,
  maiHoa: DEFAULT_PROMPT_MAI_HOA,
  sim: DEFAULT_PROMPT_SIM,
  synthesize: DEFAULT_PROMPT_SYNTHESIZE,
};

let cache: Partial<Record<PromptKey, string>> | null = null;

async function loadAll(): Promise<Partial<Record<PromptKey, string>>> {
  if (cache) return cache;
  const rows = await prisma.promptOverride.findMany();
  const map: Partial<Record<PromptKey, string>> = {};
  for (const r of rows) {
    if (r.content && r.content.trim().length > 0) {
      map[r.key as PromptKey] = r.content;
    }
  }
  cache = map;
  return map;
}

export function getPrompt(key: PromptKey): string {
  const v = cache?.[key];
  const base = v ?? DEFAULTS[key];
  // Lớp phong cách dùng chung — ghép vào đầu mọi bài Bát Tự & Kinh Dịch,
  // bất kể khách dán prompt gì, để khách nào cũng ra cùng một giọng văn.
  if (key === 'tuTru' || key === 'maiHoa') {
    return `${STYLE_GUIDE_LASO}\n\n${base}`;
  }
  return base;
}

export async function warmPromptCache(): Promise<void> {
  cache = null;
  await loadAll();
}

export async function getAllPrompts(): Promise<
  Record<PromptKey, { value: string; isDefault: boolean }>
> {
  const overrides = await loadAll();
  const keys: PromptKey[] = ['tuTru', 'maiHoa', 'sim', 'synthesize'];
  const out = {} as Record<PromptKey, { value: string; isDefault: boolean }>;
  for (const k of keys) {
    const o = overrides[k];
    if (typeof o === 'string' && o.trim().length > 0) {
      out[k] = { value: o, isDefault: false };
    } else {
      out[k] = { value: DEFAULTS[k], isDefault: true };
    }
  }
  return out;
}

export async function setPrompts(
  updates: Partial<Record<PromptKey, string>>,
): Promise<void> {
  for (const [k, v] of Object.entries(updates) as [PromptKey, string][]) {
    if (typeof v !== 'string' || v.trim().length === 0) {
      await prisma.promptOverride.deleteMany({ where: { key: k } });
    } else {
      await prisma.promptOverride.upsert({
        where: { key: k },
        update: { content: v },
        create: { key: k, content: v },
      });
    }
  }
  cache = null;
}
