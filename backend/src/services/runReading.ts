import { prisma } from '../db/client';
import { warmPromptCache } from '../lib/store';
import { scrapeMaiHoa } from '../scrapers/maiHoa';
import { scrapeSimPhongThuy } from '../scrapers/simPhongThuy';
import { scrapeTuTru } from '../scrapers/tuTru';
import {
  analyzeMaiHoa,
  analyzeSimPhongThuy,
  analyzeTuTru,
} from '../ai/gemini';
import { synthesize } from '../ai/claude';
import { addUsage, calcCost, emptyUsage } from '../lib/usage';
import { appendRow } from './sheet';
import { saveScreenshot } from './storage';
import type {
  CustomerInfo,
  GeminiAnalysis,
  PackageType,
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

function bullet(list: unknown): string {
  if (!Array.isArray(list)) return '';
  return list
    .map((x) => (typeof x === 'string' ? `• ${x}` : ''))
    .filter(Boolean)
    .join('\n');
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
  if (type === 'tuTru') return formatTuTru(a);
  if (type === 'maiHoa') return formatMaiHoa(a);
  return formatSim(a);
}

export interface RunResult {
  success: boolean;
  readingId?: string;
  sheetUrl?: string;
  cost?: ReturnType<typeof calcCost>;
  error?: string;
}

export async function runReading(customer: CustomerInfo): Promise<RunResult> {
  // Warm prompt cache up-front so subsequent calls hit the loaded map.
  await warmPromptCache();

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
      useSolarTerms: customer.useSolarTerms ?? false,
      yearcalc: customer.yearcalc ?? null,
      status: 'running',
    },
  });

  try {
    // STEP 1: SCRAPE (parallel)
    console.log(`[${dbReading.id}] STEP 1 — scrape ${customer.packages.join(',')}`);
    const scrapeJobs: Promise<ScraperResult>[] = [];
    if (customer.packages.includes('tuTru')) scrapeJobs.push(scrapeTuTru(customer));
    if (customer.packages.includes('maiHoa')) scrapeJobs.push(scrapeMaiHoa(customer));
    if (customer.packages.includes('sim') && customer.phoneNumber) {
      scrapeJobs.push(scrapeSimPhongThuy(customer.phoneNumber, customer));
    }
    const scraperResults = await Promise.all(scrapeJobs);

    // STEP 2: GEMINI ANALYSE
    console.log(`[${dbReading.id}] STEP 2 — analyse`);
    const analysisJobs: Promise<GeminiAnalysis>[] = scraperResults.map((r) => {
      if (r.type === 'tuTru') return analyzeTuTru(r.rawText, customer);
      if (r.type === 'maiHoa') return analyzeMaiHoa(r.rawText, customer);
      if (r.type === 'sim' && customer.phoneNumber) {
        return analyzeSimPhongThuy(r.rawText, customer.phoneNumber);
      }
      throw new Error(`Unhandled scraper result type: ${r.type}`);
    });
    const analyses = await Promise.all(analysisJobs);

    // STEP 3: SYNTHESISE
    console.log(`[${dbReading.id}] STEP 3 — synthesise`);
    const { text: finalContent, usage: synthUsage } = await synthesize(analyses, customer);

    // Aggregate token usage
    let totalUsage = emptyUsage();
    for (const a of analyses) if (a.usage) totalUsage = addUsage(totalUsage, a.usage);
    totalUsage = addUsage(totalUsage, synthUsage);
    const cost = calcCost(totalUsage);

    // Persist Analysis rows + save screenshots locally
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
    }

    // STEP 4: SHEET SYNC (best-effort, no Drive upload since service account
    // has no Drive quota — images are stored locally on the BE instead).
    console.log(`[${dbReading.id}] STEP 4 — sheet sync (text only)`);
    let sheetUrl: string | undefined;
    try {
      const result = await appendRow(customer, finalContent, {
        cost,
        analyses,
        // screenshots intentionally omitted — Drive upload not possible
      });
      sheetUrl = result.url;
    } catch (sheetErr) {
      const m = sheetErr instanceof Error ? sheetErr.message : String(sheetErr);
      console.error(`[${dbReading.id}] sheet sync failed (continuing):`, m);
    }

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

    return { success: true, readingId: dbReading.id, sheetUrl, cost };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[${dbReading.id}] ERROR`, message);
    await prisma.reading.update({
      where: { id: dbReading.id },
      data: { status: 'error', errorMessage: message, finishedAt: new Date() },
    });
    return { success: false, readingId: dbReading.id, error: message };
  }
}

export { PACKAGE_LABELS };
