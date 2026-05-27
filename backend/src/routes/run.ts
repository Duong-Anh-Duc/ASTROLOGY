import { Router } from 'express';
import { z } from 'zod';
import { runReading } from '../services/runReading';
import type { CustomerInfo, ProcessingStep } from '../types';

const router = Router();

const PackageEnum = z.enum(['tuTru', 'maiHoa', 'sim']);
const GenderEnum = z.enum(['male', 'female']);

const CustomerSchema = z
  .object({
    fullName: z.string().min(1),
    day: z.number().int().min(1).max(31),
    month: z.number().int().min(1).max(12),
    year: z.number().int().min(1900).max(2100),
    hour: z.number().int().min(0).max(23).nullable(),
    minute: z.number().int().min(0).max(59).optional(),
    isLunar: z.boolean().optional(),
    gender: GenderEnum,
    packages: z.array(PackageEnum).min(1),
    phoneNumber: z.string().optional(),
    question: z.string().optional(),
    addressing: z.string().max(300).optional(),
    additionalContext: z.string().max(10000).optional(),
    includeSynthesis: z.boolean().optional(),
    useSolarTerms: z.boolean().optional(),
    yearcalc: z.number().int().min(1900).max(2100).optional(),
  })
  .refine(
    (data) =>
      !data.packages.includes('sim') ||
      (data.phoneNumber && data.phoneNumber.trim().length > 0),
    { message: 'phoneNumber required when sim selected' },
  );

router.post('/', async (req, res) => {
  let customer: CustomerInfo;
  try {
    customer = CustomerSchema.parse(req.body) as CustomerInfo;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid body';
    return res.status(400).json({ success: false, error: message });
  }

  const result = await runReading(customer);
  if (!result.success) {
    return res.status(500).json(result);
  }
  return res.json(result);
});

router.post('/stream', async (req, res) => {
  let customer: CustomerInfo;
  try {
    customer = CustomerSchema.parse(req.body) as CustomerInfo;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invalid body';
    return res.status(400).json({ success: false, error: message });
  }

  res.status(200);
  res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const send = (event: unknown) => {
    if (res.writableEnded || res.destroyed) return;
    res.write(`${JSON.stringify(event)}\n`);
  };

  try {
    const result = await runReading(
      customer,
      (step: Exclude<ProcessingStep, 'idle' | 'done' | 'error'>) => {
        send({ type: 'progress', step });
      },
    );
    send({ type: 'result', result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    send({ type: 'result', result: { success: false, error: message } });
  } finally {
    res.end();
  }
});

export default router;
