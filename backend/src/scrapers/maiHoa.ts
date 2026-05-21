import { request } from 'playwright';
import type { CustomerInfo, ScraperResult } from '../types';

const ENDPOINT = 'https://hocvienlyso.org/boidich/maihoa.php';
const TIMEOUT_MS = 30_000;
const GENERIC_QUESTION = 'Luận đoán tổng quan vận mệnh';

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
    const formData: Record<string, string> = {
      viecxemmaihoa: customer.question?.trim() || GENERIC_QUESTION,
      day: String(customer.day),
      month: String(customer.month),
      year: String(customer.year),
      hour: String(customer.hour ?? 0),
      minute: '0',
      submit: 'Lập quẻ',
    };
    if (customer.useSolarTerms) {
      formData.tinhtheotietkhi = 'on';
    }
    const res = await ctx.post(ENDPOINT, { form: formData });
    if (!res.ok()) {
      throw new Error(`HTTP ${res.status()}`);
    }
    const html = await res.text();
    const rawText = htmlToText(html);

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

    return {
      type: 'maiHoa',
      rawText,
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
