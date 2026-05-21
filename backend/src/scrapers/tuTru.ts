import { chromium, type Browser } from 'playwright';
import type { CustomerInfo, ScraperResult } from '../types';

const URL = 'https://hocvienlyso.org/lasotutru';
const TIMEOUT_MS = 45_000;

/**
 * The Tứ Trụ chart is rendered as a single inline JPEG (base64) in the result
 * HTML — there is no scrapeable text. We extract the image and store it as a
 * data URL in `rawText`. The Gemini step reads it as a multimodal input.
 */
export async function scrapeTuTru(customer: CustomerInfo): Promise<ScraperResult> {
  const headless = process.env.PLAYWRIGHT_HEADLESS !== 'false';
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({ headless });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      locale: 'vi-VN',
    });
    const page = await context.newPage();
    page.setDefaultTimeout(TIMEOUT_MS);

    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUT_MS });
    await page.waitForLoadState('load', { timeout: TIMEOUT_MS }).catch(() => undefined);

    const set = async (name: string, value: string) => {
      await page.evaluate(
        ([n, v]) => {
          const w = window as any;
          const $ = w.jQuery;
          if (!$) throw new Error('jQuery missing on tuTru page');
          const sel = $(`form[action$="/lasotutru"] select[name="${n}"]`);
          if (!sel.length) throw new Error(`select ${n} not found`);
          sel.val(v).trigger('change.select2').trigger('change');
        },
        [name, value] as const,
      );
    };

    await page.fill('form[action$="/lasotutru"] input[name="names"]', customer.fullName);
    await set('days', String(customer.day));
    await set('months', String(customer.month));
    await set('years', String(customer.year));
    if (customer.hour !== null) await set('hours', String(customer.hour));
    await set('minutes', String(customer.minute ?? 0));
    await set('loailich', customer.isLunar ? '-1' : '1');
    await set('sex', customer.gender === 'male' ? '1' : '-1');
    if (customer.yearcalc) {
      await set('yearcalc', String(customer.yearcalc));
    }

    await Promise.all([
      page.waitForLoadState('domcontentloaded'),
      page.locator('form[action$="/lasotutru"] button[name="submit"]').click(),
    ]);
    await page.waitForLoadState('networkidle').catch(() => undefined);

    const dataUrl = await page.evaluate(`
      (() => {
        const imgs = Array.from(document.querySelectorAll('img'));
        for (const img of imgs) {
          const src = img.src || '';
          if (src.startsWith('data:image/') && src.length > 50_000) return src;
        }
        const html = document.documentElement.outerHTML;
        const m = html.match(/data:image\\/(jpe?g|png);base64,[A-Za-z0-9+/=]{1000,}/);
        return m ? m[0] : '';
      })()
    `) as string;

    if (!dataUrl) {
      throw new Error('Chart image not found on tuTru result page');
    }

    // The chart IS a JPEG — strip the data URL prefix for screenshot field.
    const screenshotPng = dataUrl.replace(/^data:image\/[^;]+;base64,/, '');

    return {
      type: 'tuTru',
      rawText: dataUrl,
      screenshotPng,
      scrapedAt: new Date(),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Scraper tuTru failed: ${message}`);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
