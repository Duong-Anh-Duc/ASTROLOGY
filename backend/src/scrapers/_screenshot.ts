import { chromium } from 'playwright';

/**
 * Render an HTML string in a headless browser with a <base> tag so relative
 * URLs resolve correctly, then take a full-page screenshot. Returns the PNG
 * bytes as base64 (no data URL prefix).
 */
export async function screenshotHtml(html: string, baseUrl: string): Promise<string> {
  const u = new URL(baseUrl);
  const baseHref = `${u.protocol}//${u.host}${u.pathname.replace(/[^/]*$/, '')}`;
  const withBase = html.replace(/<head>/i, `<head><base href="${baseHref}">`);

  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 1800 },
      locale: 'vi-VN',
    });
    const page = await ctx.newPage();
    page.setDefaultTimeout(20_000);
    await page.setContent(withBase, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load').catch(() => undefined);
    await page.waitForTimeout(800);
    const buf = await page.screenshot({ fullPage: true, type: 'png' });
    return buf.toString('base64');
  } finally {
    await browser.close();
  }
}
