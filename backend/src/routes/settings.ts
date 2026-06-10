import { Router } from 'express';
import {
  getSettingsView,
  setSettings,
  SECTION_KEYS,
  getGeminiApiKey,
  getAnthropicApiKey,
  warmSettingsCache,
  isClaudeThinkingLevel,
  type AiProvider,
  type SectionKey,
} from '../lib/settings';

const router = Router();

function isProvider(s: unknown): s is AiProvider {
  return s === 'gemini' || s === 'claude';
}

// Reveal actual key values (for the eye-icon show feature in the UI)
router.get('/keys', async (_req, res) => {
  try {
    await warmSettingsCache();
    res.json({
      geminiApiKey: getGeminiApiKey() ?? null,
      anthropicApiKey: getAnthropicApiKey() ?? null,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'fail' });
  }
});

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
    if (body.claudeThinkingLevel !== undefined) {
      const v = body.claudeThinkingLevel;
      if (v !== null && !isClaudeThinkingLevel(v)) {
        return res.status(400).json({ success: false, error: 'invalid claudeThinkingLevel' });
      }
      updates.claudeThinkingLevel = v;
    }
    if (body.sectionProviders !== undefined && typeof body.sectionProviders === 'object' && body.sectionProviders !== null) {
      const sp = body.sectionProviders as Record<string, unknown>;
      const sectionUpdates: Partial<Record<SectionKey, AiProvider | null>> = {};
      for (const key of SECTION_KEYS) {
        if (sp[key] !== undefined) {
          const v = sp[key];
          if (v === null) {
            sectionUpdates[key] = null;
          } else if (!isProvider(v)) {
            return res.status(400).json({ success: false, error: `invalid sectionProvider for ${key}` });
          } else {
            sectionUpdates[key] = v;
          }
        }
      }
      updates.sectionProviders = sectionUpdates;
    }
    await setSettings(updates);
    const view = await getSettingsView();
    res.json({ success: true, ...view });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'fail' });
  }
});

export default router;
