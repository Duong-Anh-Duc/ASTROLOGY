import { prisma } from '../db/client';
import { warmPromptCache } from '../lib/store';
import { warmSettingsCache } from '../lib/settings';
import { scrapeMaiHoa } from '../scrapers/maiHoa';
import { scrapeSimPhongThuy } from '../scrapers/simPhongThuy';
import { scrapeTuTru } from '../scrapers/tuTru';
import {
  analyzeMaiHoa,
  analyzeSimPhongThuy,
  analyzeTuTru,
  synthesize,
  currentProvider,
  providerForSection,
} from '../ai/aiProvider';
import { addUsage, calcCost, emptyUsage } from '../lib/usage';
import { saveScreenshot } from './storage';
import type {
  CustomerInfo,
  GeminiAnalysis,
  PackageType,
  ProcessingStep,
  ScraperResult,
} from '../types';

const PACKAGE_SOURCE_URL: Record<PackageType, string> = {
  tuTru: 'https://hocvienlyso.org/lasotutru',
  maiHoa: 'https://hocvienlyso.org/boidich/maihoa.php',
  sim: 'https://hocvienlyso.org/boidich/sim.php',
};

const PACKAGE_LABELS: Record<PackageType, string> = {
  tuTru: 'Bát Tự',
  maiHoa: 'Kinh Dịch',
  sim: 'Sim Phong Thuỷ',
};

const HEARTBEAT_MS = 30_000;

function elapsed(start: number): string {
  const ms = Date.now() - start;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function trackTask<T>(
  readingId: string,
  label: string,
  work: () => Promise<T>,
  options: {
    heartbeatMs?: number;
    summarize?: (result: T) => string;
  } = {},
): Promise<T> {
  const start = Date.now();
  console.log(`[${readingId}] ${label} — start`);

  let heartbeat: ReturnType<typeof setInterval> | undefined;
  if (options.heartbeatMs) {
    heartbeat = setInterval(() => {
      console.log(`[${readingId}] ${label} — still running after ${elapsed(start)}`);
    }, options.heartbeatMs);
  }

  try {
    const result = await work();
    const summary = options.summarize?.(result);
    console.log(
      `[${readingId}] ${label} — done in ${elapsed(start)}${summary ? ` — ${summary}` : ''}`,
    );
    return result;
  } catch (err) {
    console.error(`[${readingId}] ${label} — error after ${elapsed(start)}: ${errorMessage(err)}`);
    throw err;
  } finally {
    if (heartbeat) clearInterval(heartbeat);
  }
}

function summarizeScrape(result: ScraperResult): string {
  return `raw=${result.rawText.length.toLocaleString('vi-VN')} chars, screenshot=${result.screenshotPng ? 'yes' : 'no'}`;
}

function summarizeAnalysis(result: GeminiAnalysis): string {
  return `tokens in=${result.usage?.input ?? 0}, out=${result.usage?.output ?? 0}`;
}

function bullet(list: unknown): string {
  if (!Array.isArray(list)) return '';
  return list
    .map((x) => (typeof x === 'string' ? `• ${x}` : ''))
    .filter(Boolean)
    .join('\n');
}

function titleFromKey(key: string): string {
  const labels: Record<string, string> = {
    opening: 'Lời mở đầu',
    banMenhNguHanh: 'Bản mệnh và ngũ hành',
    ban_menh_ngu_hanh: 'Bản mệnh và ngũ hành',
    tenGoiBiDanh: 'Tên gọi và bí danh',
    ten_goi_bi_danh: 'Tên gọi và bí danh',
    ungDungPhongThuy: 'Ứng dụng phong thủy',
    ung_dung_phong_thuy: 'Ứng dụng phong thủy',
    daiVanNamHienTai: 'Đại vận và năm hiện tại',
    dai_van_nam_hien_tai: 'Đại vận và năm hiện tại',
    loiKhuyen: 'Lời khuyên chân thành',
    loi_khuyen: 'Lời khuyên chân thành',
    loiKet: 'Lời kết',
    loi_ket: 'Lời kết',
    displayText: 'Phân tích',
    report: 'Phân tích',
    content: 'Phân tích',
    text: 'Phân tích',
  };
  if (labels[key]) return labels[key];
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-zà-ỹ])([A-ZÀ-Ỹ])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase());
}

const PROSE_KEY_ORDER = [
  'opening',
  'loiMoDau',
  'loi_mo_dau',
  'banMenhNguHanh',
  'ban_menh_ngu_hanh',
  'tenGoiBiDanh',
  'ten_goi_bi_danh',
  'ungDungPhongThuy',
  'ung_dung_phong_thuy',
  'daiVanNamHienTai',
  'dai_van_nam_hien_tai',
  'loiKhuyen',
  'loi_khuyen',
  'loiKet',
  'loi_ket',
];

function sortAnalysisKeys(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    const ai = PROSE_KEY_ORDER.indexOf(a);
    const bi = PROSE_KEY_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

function stringifyAnalysisValue(value: unknown, depth = 0): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (!value) return '';

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        const text = stringifyAnalysisValue(item, depth + 1);
        return text ? `• ${text}` : '';
      })
      .filter(Boolean)
      .join('\n');
  }

  if (typeof value === 'object') {
    const object = value as Record<string, unknown>;
    const keys = Object.keys(object);
    if (keys.length === 1) {
      const onlyKey = keys[0];
      if (
        onlyKey === '$PARAMETER_NAME' ||
        onlyKey === 'analysis' ||
        onlyKey === 'report' ||
        onlyKey === 'result' ||
        onlyKey === 'tuTru'
      ) {
        return stringifyAnalysisValue(object[onlyKey], depth);
      }
    }

    return sortAnalysisKeys(keys)
      .map((key) => {
        const text = stringifyAnalysisValue(object[key], depth + 1);
        if (!text) return '';
        return depth === 0 ? `═══ ${titleFromKey(key).toUpperCase()} ═══\n${text}` : text;
      })
      .filter(Boolean)
      .join('\n\n');
  }

  return '';
}

function fallbackFormatAnalysis(a: Record<string, unknown>): string {
  return stringifyAnalysisValue(a).trim();
}

function formatTuTru(a: Record<string, unknown>): string {
  const fp = a.fourPillars as Record<string, string> | undefined;
  const fe = a.fiveElements as Record<string, string> | undefined;
  const luck = a.luckCycles as Array<{ period: string; interpretation: string }> | undefined;
  const lines: string[] = [];
  if (fp) {
    lines.push('═══ TỨ TRỤ ═══');
    lines.push(`Năm: ${fp.year ?? ''}`);
    lines.push(`Tháng: ${fp.month ?? ''}`);
    lines.push(`Ngày: ${fp.day ?? ''}`);
    lines.push(`Giờ: ${fp.hour ?? ''}`);
  }
  if (fe) {
    lines.push('\n═══ NGŨ HÀNH ═══');
    if (fe.summary) lines.push(fe.summary);
    if (fe.balance) lines.push(`\nCân bằng: ${fe.balance}`);
  }
  if (a.naYin) lines.push(`\n═══ NẠP ÂM ═══\n${a.naYin}`);
  if (Array.isArray(luck) && luck.length > 0) {
    lines.push('\n═══ ĐẠI VẬN ═══');
    for (const l of luck) lines.push(`• ${l.period}: ${l.interpretation}`);
  }
  if (a.annualFortune) lines.push(`\n═══ LƯU NIÊN ═══\n${a.annualFortune}`);
  if (Array.isArray(a.strengths) && a.strengths.length)
    lines.push(`\n═══ ĐIỂM MẠNH ═══\n${bullet(a.strengths)}`);
  if (Array.isArray(a.weaknesses) && a.weaknesses.length)
    lines.push(`\n═══ ĐIỂM YẾU ═══\n${bullet(a.weaknesses)}`);
  if (Array.isArray(a.advice) && a.advice.length)
    lines.push(`\n═══ LỜI KHUYÊN ═══\n${bullet(a.advice)}`);
  return lines.join('\n');
}

function formatMaiHoa(a: Record<string, unknown>): string {
  const pri = a.primaryHexagram as { name: string; meaning: string } | undefined;
  const tr = a.transformedHexagram as { name: string; meaning: string } | undefined;
  const cl = a.changingLines as Array<{ line: string; meaning: string }> | undefined;
  const lines: string[] = [];
  if (pri) lines.push(`═══ QUẺ CHÍNH ═══\n${pri.name}\n\n${pri.meaning}`);
  if (Array.isArray(cl) && cl.length > 0) {
    lines.push('\n═══ HÀO ĐỘNG ═══');
    for (const h of cl) lines.push(`• ${h.line}: ${h.meaning}`);
  }
  if (tr) lines.push(`\n═══ QUẺ BIẾN ═══\n${tr.name}\n\n${tr.meaning}`);
  if (a.overall) lines.push(`\n═══ LUẬN ĐOÁN ═══\n${a.overall}`);
  if (Array.isArray(a.guidance)) lines.push(`\n═══ LỜI KHUYÊN ═══\n${bullet(a.guidance)}`);
  return lines.join('\n');
}

function formatSim(a: Record<string, unknown>): string {
  const pairs = a.pairs as Array<{ pair: string; meaning: string }> | undefined;
  const lines: string[] = [];
  if (a.phoneNumber) lines.push(`Số: ${a.phoneNumber}`);
  if (a.structure) lines.push(`\n═══ CẤU TRÚC ═══\n${a.structure}`);
  if (Array.isArray(pairs) && pairs.length) {
    lines.push('\n═══ CẶP SỐ ═══');
    for (const p of pairs) lines.push(`• ${p.pair}: ${p.meaning}`);
  }
  if (a.elements) lines.push(`\n═══ NGŨ HÀNH / QUẺ ═══\n${a.elements}`);
  if (Array.isArray(a.auspicious)) lines.push(`\n═══ CÁT ═══\n${bullet(a.auspicious)}`);
  if (Array.isArray(a.inauspicious)) lines.push(`\n═══ HUNG ═══\n${bullet(a.inauspicious)}`);
  if (a.verdict) lines.push(`\n═══ KẾT LUẬN ═══\n${a.verdict}`);
  return lines.join('\n');
}

function formatByType(type: PackageType, a: Record<string, unknown>): string {
  const formatted =
    type === 'tuTru' ? formatTuTru(a) : type === 'maiHoa' ? formatMaiHoa(a) : formatSim(a);
  return formatted.trim() || fallbackFormatAnalysis(a);
}

export interface RunResult {
  success: boolean;
  readingId?: string;
  xlsxUrl?: string;
  xlsxFileName?: string;
  cost?: ReturnType<typeof calcCost>;
  error?: string;
}

type ProgressCallback = (
  step: Exclude<ProcessingStep, 'idle' | 'done' | 'error'>,
) => void;

export async function runReading(
  customer: CustomerInfo,
  onProgress?: ProgressCallback,
): Promise<RunResult> {
  // Warm caches up-front so subsequent calls hit loaded data.
  await warmPromptCache();
  await warmSettingsCache();

  // Persist customer + reading shell first so we have an ID for partial saves.
  const dbCustomer = await prisma.customer.create({
    data: {
      fullName: customer.fullName,
      day: customer.day,
      month: customer.month,
      year: customer.year,
      hour: customer.hour,
      minute: customer.minute ?? 0,
      isLunar: customer.isLunar ?? false,
      gender: customer.gender,
      phoneNumber: customer.phoneNumber ?? null,
    },
  });

  const dbReading = await prisma.reading.create({
    data: {
      customerId: dbCustomer.id,
      packages: customer.packages,
      question: customer.question ?? null,
      addressing: customer.addressing ?? null,
      additionalContext: customer.additionalContext ?? null,
      useSolarTerms: customer.useSolarTerms ?? false,
      yearcalc: customer.yearcalc ?? null,
      status: 'running',
    },
  });

  const providerSummary = [
    `global=${currentProvider()}`,
    `tuTru=${providerForSection('tuTru')}`,
    `maiHoa=${providerForSection('maiHoa')}`,
    `sim=${providerForSection('sim')}`,
    `synthesize=${providerForSection('synthesize')}`,
  ].join(', ');
  console.log(
    `[${dbReading.id}] RUN — start packages=${customer.packages.join(',')} providers: ${providerSummary}`,
  );

  try {
    // STEP 1: SCRAPE (parallel)
    onProgress?.('scraping');
    console.log(`[${dbReading.id}] STEP 1 — scrape all — start`);
    const scrapeJobs: Promise<ScraperResult>[] = [];
    if (customer.packages.includes('tuTru')) {
      scrapeJobs.push(
        trackTask(dbReading.id, 'STEP 1.1 — scrape tuTru', () => scrapeTuTru(customer), {
          heartbeatMs: HEARTBEAT_MS,
          summarize: summarizeScrape,
        }),
      );
    }
    if (customer.packages.includes('maiHoa')) {
      scrapeJobs.push(
        trackTask(dbReading.id, 'STEP 1.2 — scrape maiHoa', () => scrapeMaiHoa(customer), {
          heartbeatMs: HEARTBEAT_MS,
          summarize: summarizeScrape,
        }),
      );
    }
    if (customer.packages.includes('sim') && customer.phoneNumber) {
      scrapeJobs.push(
        trackTask(
          dbReading.id,
          'STEP 1.3 — scrape sim',
          () => scrapeSimPhongThuy(customer.phoneNumber as string, customer),
          {
            heartbeatMs: HEARTBEAT_MS,
            summarize: summarizeScrape,
          },
        ),
      );
    }
    const scraperResults = await Promise.all(scrapeJobs);
    console.log(`[${dbReading.id}] STEP 1 — scrape all — done (${scraperResults.length} result(s))`);

    // STEP 2: GEMINI ANALYSE
    onProgress?.('analyzing');
    console.log(`[${dbReading.id}] STEP 2 — analyse all — start`);
    const analysisJobs: Promise<GeminiAnalysis>[] = scraperResults.map((r) => {
      const provider = providerForSection(r.type);
      if (r.type === 'tuTru') {
        return trackTask(
          dbReading.id,
          `STEP 2.${r.type} — analyse tuTru via ${provider}`,
          () => analyzeTuTru(r.rawText, customer),
          { heartbeatMs: HEARTBEAT_MS, summarize: summarizeAnalysis },
        );
      }
      if (r.type === 'maiHoa') {
        return trackTask(
          dbReading.id,
          `STEP 2.${r.type} — analyse maiHoa via ${provider}`,
          () => analyzeMaiHoa(r.rawText, customer, r.screenshotPng),
          { heartbeatMs: HEARTBEAT_MS, summarize: summarizeAnalysis },
        );
      }
      if (r.type === 'sim' && customer.phoneNumber) {
        return trackTask(
          dbReading.id,
          `STEP 2.${r.type} — analyse sim via ${provider}`,
          () => analyzeSimPhongThuy(r.rawText, customer.phoneNumber as string, customer, r.screenshotPng),
          { heartbeatMs: HEARTBEAT_MS, summarize: summarizeAnalysis },
        );
      }
      throw new Error(`Unhandled scraper result type: ${r.type}`);
    });
    const analyses = await Promise.all(analysisJobs);
    console.log(`[${dbReading.id}] STEP 2 — analyse all — done (${analyses.length} result(s))`);

    // STEP 3: SYNTHESISE
    const includeSynthesis = customer.includeSynthesis ?? true;
    let finalContent: string | null = null;
    let synthUsage = emptyUsage();
    if (!includeSynthesis) {
      console.log(
        `[${dbReading.id}] STEP 3 — synthesise skipped by request — selected packages only`,
      );
    } else if (analyses.length === 1) {
      const single = analyses[0];
      finalContent = formatByType(single.type, single.analysis);
      console.log(
        `[${dbReading.id}] STEP 3 — synthesise skipped for single package ${single.type} — chars=${finalContent.length.toLocaleString('vi-VN')}`,
      );
    } else {
      onProgress?.('synthesizing');
      const synthProvider = providerForSection('synthesize');
      const synthesized = await trackTask(
        dbReading.id,
        `STEP 3 — synthesise via ${synthProvider}`,
        () => synthesize(analyses, customer),
        {
          heartbeatMs: HEARTBEAT_MS,
          summarize: (result) =>
            `chars=${result.text.length.toLocaleString('vi-VN')}, tokens in=${result.usage.input}, out=${result.usage.output}`,
        },
      );
      finalContent = synthesized.text;
      synthUsage = synthesized.usage;
    }

    // Aggregate token usage
    let totalUsage = emptyUsage();
    for (const a of analyses) if (a.usage) totalUsage = addUsage(totalUsage, a.usage);
    totalUsage = addUsage(totalUsage, synthUsage);
    const cost = calcCost(totalUsage);
    console.log(
      `[${dbReading.id}] USAGE — total tokens in=${totalUsage.input}, out=${totalUsage.output}, cost=${cost.vnd.toLocaleString('vi-VN')} VND`,
    );

    // Persist Analysis rows + save screenshots locally
    console.log(`[${dbReading.id}] STEP 3.5 — persist analyses — start`);
    for (let i = 0; i < scraperResults.length; i++) {
      const sr = scraperResults[i];
      const ai = analyses[i];
      let screenshotUrl: string | undefined;
      let screenshotPath: string | undefined;
      if (sr.screenshotPng) {
        try {
          const saved = saveScreenshot(dbReading.id, sr.type, sr.screenshotPng);
          screenshotUrl = saved.url;
          screenshotPath = saved.filePath;
        } catch (e) {
          console.error(`[${dbReading.id}] save screenshot ${sr.type} failed:`, e);
        }
      }
      await prisma.analysis.create({
        data: {
          readingId: dbReading.id,
          type: sr.type,
          rawText: sr.rawText,
          analysisJson: ai.analysis as object,
          formattedText: formatByType(sr.type, ai.analysis),
          sourceUrl: PACKAGE_SOURCE_URL[sr.type],
          inputTokens: ai.usage?.input ?? 0,
          outputTokens: ai.usage?.output ?? 0,
          screenshotUrl,
          screenshotPath,
        },
      });
      console.log(`[${dbReading.id}] STEP 3.5 — persist ${sr.type} — done`);
    }
    console.log(`[${dbReading.id}] STEP 3.5 — persist analyses — done`);

    // Finalise reading
    await prisma.reading.update({
      where: { id: dbReading.id },
      data: {
        status: 'done',
        synthesis: finalContent,
        inputTokens: totalUsage.input,
        outputTokens: totalUsage.output,
        costUsd: cost.usd,
        costVnd: cost.vnd,
        finishedAt: new Date(),
      },
    });

    console.log(`[${dbReading.id}] RUN — done`);
    return { success: true, readingId: dbReading.id, cost };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[${dbReading.id}] RUN — error:`, message);
    await prisma.reading.update({
      where: { id: dbReading.id },
      data: { status: 'error', errorMessage: message, finishedAt: new Date() },
    });
    return { success: false, readingId: dbReading.id, error: message };
  }
}

export { PACKAGE_LABELS };
