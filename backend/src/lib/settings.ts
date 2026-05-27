import { prisma } from '../db/client';

export type AiProvider = 'gemini' | 'claude';
export type SectionKey = 'tuTru' | 'maiHoa' | 'sim' | 'synthesize';

type SectionProviderKey = `aiProvider_${SectionKey}`;
export type SettingKey = 'aiProvider' | 'geminiApiKey' | 'anthropicApiKey' | SectionProviderKey;

export const SECTION_KEYS: SectionKey[] = ['tuTru', 'maiHoa', 'sim', 'synthesize'];

const ALL_KEYS: SettingKey[] = [
  'aiProvider',
  'geminiApiKey',
  'anthropicApiKey',
  'aiProvider_tuTru',
  'aiProvider_maiHoa',
  'aiProvider_sim',
  'aiProvider_synthesize',
];

let cache: Partial<Record<SettingKey, string>> | null = null;

async function loadAll(): Promise<Partial<Record<SettingKey, string>>> {
  if (cache) return cache;
  const rows = await prisma.setting.findMany();
  const map: Partial<Record<SettingKey, string>> = {};
  for (const r of rows) {
    if (ALL_KEYS.includes(r.key as SettingKey) && typeof r.value === 'string') {
      map[r.key as SettingKey] = r.value;
    }
  }
  cache = map;
  return map;
}

export async function warmSettingsCache(): Promise<void> {
  cache = null;
  await loadAll();
}

function isProvider(s: unknown): s is AiProvider {
  return s === 'gemini' || s === 'claude';
}

export function getAiProvider(): AiProvider {
  const v = cache?.aiProvider;
  return isProvider(v) ? v : 'gemini';
}

export function getAiProviderForSection(section: SectionKey): AiProvider {
  const key: SectionProviderKey = `aiProvider_${section}`;
  const v = cache?.[key];
  return isProvider(v) ? v : getAiProvider();
}

export function getGeminiApiKey(): string | undefined {
  const v = cache?.geminiApiKey?.trim();
  if (v) return v;
  const env = process.env.GEMINI_API_KEY?.trim();
  return env && env.length > 0 ? env : undefined;
}

export function getAnthropicApiKey(): string | undefined {
  const v = cache?.anthropicApiKey?.trim();
  if (v) return v;
  const env = process.env.ANTHROPIC_API_KEY?.trim();
  return env && env.length > 0 && env !== 'your_anthropic_api_key' ? env : undefined;
}

function maskKey(k: string | undefined): string {
  if (!k) return '';
  if (k.length <= 8) return '••••';
  return `${k.slice(0, 4)}…${k.slice(-4)}`;
}

export interface SettingsView {
  provider: AiProvider;
  sectionProviders: Record<SectionKey, AiProvider>;
  geminiKey: {
    present: boolean;
    source: 'db' | 'env' | 'none';
    masked: string;
  };
  anthropicKey: {
    present: boolean;
    source: 'db' | 'env' | 'none';
    masked: string;
  };
}

export async function getSettingsView(): Promise<SettingsView> {
  await loadAll();
  const dbGemini = cache?.geminiApiKey?.trim();
  const dbAnthropic = cache?.anthropicApiKey?.trim();
  const envGemini = process.env.GEMINI_API_KEY?.trim();
  const envAnthropic = process.env.ANTHROPIC_API_KEY?.trim();
  const envAnthValid = envAnthropic && envAnthropic !== 'your_anthropic_api_key' ? envAnthropic : undefined;

  const geminiSource: 'db' | 'env' | 'none' = dbGemini ? 'db' : envGemini ? 'env' : 'none';
  const anthSource: 'db' | 'env' | 'none' = dbAnthropic ? 'db' : envAnthValid ? 'env' : 'none';
  const geminiEffective = dbGemini ?? envGemini ?? '';
  const anthEffective = dbAnthropic ?? envAnthValid ?? '';

  return {
    provider: getAiProvider(),
    sectionProviders: {
      tuTru: getAiProviderForSection('tuTru'),
      maiHoa: getAiProviderForSection('maiHoa'),
      sim: getAiProviderForSection('sim'),
      synthesize: getAiProviderForSection('synthesize'),
    },
    geminiKey: {
      present: geminiSource !== 'none',
      source: geminiSource,
      masked: maskKey(geminiEffective),
    },
    anthropicKey: {
      present: anthSource !== 'none',
      source: anthSource,
      masked: maskKey(anthEffective),
    },
  };
}

export interface SettingsUpdate {
  provider?: AiProvider;
  sectionProviders?: Partial<Record<SectionKey, AiProvider | null>>;
  geminiApiKey?: string | null;
  anthropicApiKey?: string | null;
}

export async function setSettings(updates: SettingsUpdate): Promise<void> {
  const writes: { key: SettingKey; value: string | null }[] = [];
  if (updates.provider) writes.push({ key: 'aiProvider', value: updates.provider });
  if (updates.sectionProviders) {
    for (const section of SECTION_KEYS) {
      const v = updates.sectionProviders[section];
      if (v !== undefined) {
        writes.push({ key: `aiProvider_${section}`, value: v });
      }
    }
  }
  if (updates.geminiApiKey !== undefined) {
    writes.push({ key: 'geminiApiKey', value: updates.geminiApiKey });
  }
  if (updates.anthropicApiKey !== undefined) {
    writes.push({ key: 'anthropicApiKey', value: updates.anthropicApiKey });
  }
  for (const { key, value } of writes) {
    if (value === null || (typeof value === 'string' && value.trim().length === 0)) {
      await prisma.setting.deleteMany({ where: { key } });
    } else {
      await prisma.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });
    }
  }
  cache = null;
}
