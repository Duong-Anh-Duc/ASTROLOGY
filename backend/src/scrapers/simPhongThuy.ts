import { request } from 'playwright';
import type { CustomerInfo, ScraperResult } from '../types';

const ENDPOINT = 'https://hocvienlyso.org/boidich/sim.php';
const TIMEOUT_MS = 30_000;
const GENERIC_QUESTION = 'Luận đoán phong thuỷ số điện thoại';

export async function scrapeSimPhongThuy(
  phoneNumber: string,
  customer?: CustomerInfo,
): Promise<ScraperResult> {
  const ctx = await request.newContext({
    timeout: TIMEOUT_MS,
    extraHTTPHeaders: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept-Language': 'vi,en;q=0.9',
    },
  });

  try {
    const now = new Date();
    const formData: Record<string, string> = {
      viecxemmaihoa: customer?.question?.trim() || GENERIC_QUESTION,
      phone: phoneNumber,
      day: String(customer?.day ?? now.getDate()),
      month: String(customer?.month ?? now.getMonth() + 1),
      year: String(customer?.year ?? now.getFullYear()),
      hour: String(customer?.hour ?? now.getHours()),
      minute: String(customer?.minute ?? 0),
      submit: 'Lập quẻ',
    };
    if (customer?.useSolarTerms) {
      formData.tinhtheotietkhi = 'on';
    }
    const res = await ctx.post(ENDPOINT, { form: formData });
    if (!res.ok()) {
      throw new Error(`HTTP ${res.status()}`);
    }
    const html = await res.text();
    const rawText = htmlToText(html);

    // Same trick as maiHoa — extract the pre-rendered chart JPEG URL.
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
        // ignore
      }
    }

    return {
      type: 'sim',
      rawText,
      screenshotPng,
      scrapedAt: new Date(),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Scraper simPhongThuy failed: ${message}`);
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
