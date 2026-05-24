import { Router } from 'express';
import { getSettingsView, setSettings, type AiProvider } from '../lib/settings';

const router = Router();

function isProvider(s: unknown): s is AiProvider {
  return s === 'gemini' || s === 'claude';
}

router.get('/', async (_req, res) => {
  try {
    const view = await getSettingsView();
    res.json(view);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'fail' });
  }
});

router.post('/', async (req, res) => {
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const updates: Parameters<typeof setSettings>[0] = {};
    if (body.provider !== undefined) {
      if (!isProvider(body.provider)) {
        return res.status(400).json({ success: false, error: 'invalid provider' });
      }
      updates.provider = body.provider;
    }
    // For keys: empty string / null → clear DB override (back to env)
    if (body.geminiApiKey !== undefined) {
      const v = body.geminiApiKey;
      if (v !== null && typeof v !== 'string') {
        return res.status(400).json({ success: false, error: 'invalid geminiApiKey' });
      }
      updates.geminiApiKey = v === null ? null : v.trim();
    }
    if (body.anthropicApiKey !== undefined) {
      const v = body.anthropicApiKey;
      if (v !== null && typeof v !== 'string') {
        return res.status(400).json({ success: false, error: 'invalid anthropicApiKey' });
      }
      updates.anthropicApiKey = v === null ? null : v.trim();
    }
    await setSettings(updates);
    const view = await getSettingsView();
    res.json({ success: true, ...view });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'fail' });
  }
});

export default router;
