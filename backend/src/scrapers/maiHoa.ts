import { request } from 'playwright';
import type { CustomerInfo, ScraperResult } from '../types';

const ENDPOINT = 'https://hocvienlyso.org/boidich/maihoa.php';
const TIMEOUT_MS = 30_000;
const GENERIC_QUESTION = 'Luận đoán tổng quan vận mệnh';

/**
 * hocvienlyso bị lỗi tính tiết khí với ngày cũ: server in ra cảnh báo PHP
 * "Undefined array key -N" (chỉ số mảng âm) và trả về lá số trống Can Chi/Lục Thân.
 * Phát hiện dấu hiệu này để tự gieo lại KHÔNG tiết khí.
 */
function chartLooksBroken(html: string): boolean {
  return /Undefined array key\s*-\d/i.test(html) || /Undefined offset:\s*-\d/i.test(html);
}

async function fetchMaiHoaChart(
  ctx: Awaited<ReturnType<typeof request.newContext>>,
  customer: CustomerInfo,
  withSolarTerms: boolean,
): Promise<{ html: string; screenshotPng?: string }> {
  // Mai Hoa Dịch số lập quẻ theo THỜI ĐIỂM GIEO QUẺ (hiện tại), không dùng ngày sinh.
  const now = new Date();
  const formData: Record<string, string> = {
    viecxemmaihoa: customer.question?.trim() || GENERIC_QUESTION,
    day: String(now.getDate()),
    month: String(now.getMonth() + 1),
    year: String(now.getFullYear()),
    hour: String(now.getHours()),
    minute: String(now.getMinutes()),
    submit: 'Lập quẻ',
  };
  if (withSolarTerms) {
    formData.tinhtheotietkhi = 'on';
  }
  const res = await ctx.post(ENDPOINT, { form: formData });
  if (!res.ok()) {
    throw new Error(`HTTP ${res.status()}`);
  }
  const html = await res.text();

  // The result page references the actual chart as a pre-rendered JPEG
  // (e.g. <img src="quedich/10_0_1_15_6_1990_<hash>.jpg">).  Download that
  // image directly — gives a clean, cropped chart instead of a full-page
  // screenshot with ads/sidebar.
  let screenshotPng: string | undefined;
  const m = html.match(/<img\s+src="(quedich\/[^"]+\.jpg)"/i);
  if (m) {
    try {
      const imgUrl = new URL(m[1], ENDPOINT).toString();
      const imgCtx = await request.newContext({ timeout: 15_000 });
      const imgRes = await imgCtx.get(imgUrl);
      if (imgRes.ok()) {
        screenshotPng = (await imgRes.body()).toString('base64');
      }
      await imgCtx.dispose();
    } catch {
      // ignore — leave screenshotPng undefined
    }
  }

  return { html, screenshotPng };
}

export async function scrapeMaiHoa(
  customer: CustomerInfo,
): Promise<ScraperResult> {
  const ctx = await request.newContext({
    timeout: TIMEOUT_MS,
    extraHTTPHeaders: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept-Language': 'vi,en;q=0.9',
    },
  });

  try {
    let { html, screenshotPng } = await fetchMaiHoaChart(ctx, customer, !!customer.useSolarTerms);

    // Nếu bật tiết khí mà lá số hỏng (lỗi PHP với ngày cũ) → gieo lại không tiết khí.
    if (customer.useSolarTerms && chartLooksBroken(html)) {
      const retry = await fetchMaiHoaChart(ctx, customer, false);
      if (!chartLooksBroken(retry.html)) {
        html = retry.html;
        screenshotPng = retry.screenshotPng;
      }
    }

    return {
      type: 'maiHoa',
      rawText: htmlToText(html),
      screenshotPng,
      scrapedAt: new Date(),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Scraper maiHoa failed: ${message}`);
  } finally {
    await ctx.dispose();
  }
}

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
