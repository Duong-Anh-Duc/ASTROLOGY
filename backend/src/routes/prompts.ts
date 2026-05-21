import { Router } from 'express';
import { getAllPrompts, setPrompts, type PromptKey } from '../lib/store';

const router = Router();
const VALID: PromptKey[] = ['tuTru', 'maiHoa', 'sim', 'synthesize'];

router.get('/', async (_req, res) => {
  try {
    const prompts = await getAllPrompts();
    res.json({ prompts });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'fail' });
  }
});

router.post('/', async (req, res) => {
  try {
    const body = (req.body ?? {}) as Partial<Record<string, unknown>>;
    const updates: Partial<Record<PromptKey, string>> = {};
    for (const k of VALID) {
      const v = body[k];
      if (typeof v === 'string') updates[k] = v;
    }
    await setPrompts(updates);
    const prompts = await getAllPrompts();
    res.json({ success: true, prompts });
  } catch (err) {
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'fail' });
  }
});

export default router;
