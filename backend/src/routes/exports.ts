import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../db/client';
import { docxExists, docxPathFor, generateDocx } from '../services/docx';
import { exportExists, exportPathFor } from '../services/xlsx';
import { generateCombinedXlsx } from '../services/xlsxCombined';
import { getAiProvider } from '../lib/settings';
import type { CustomerInfo, GeminiAnalysis, PackageType } from '../types';

const router = Router();

function fileNameFor(reading: { id: string; createdAt: Date; customer: { fullName: string } }): string {
  const safe = reading.customer.fullName.replace(/[^\w\sÀ-ỹà-ỹ-]/g, '').trim().slice(0, 40).replace(/\s+/g, '_') || 'khach';
  const stamp = reading.createdAt.toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `LuanGiai_${safe}_${stamp}.xlsx`;
}

function docxFileNameFor(reading: { id: string; createdAt: Date; customer: { fullName: string } }): string {
  const safe = reading.customer.fullName.replace(/[^\w\sÀ-ỹà-ỹ-]/g, '').trim().slice(0, 40).replace(/\s+/g, '_') || 'khach';
  const stamp = reading.createdAt.toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `BaoCao_${safe}_${stamp}.docx`;
}

// POST /api/exports/combined — generate combined xlsx for all readings
router.post('/combined', async (_req, res) => {
  try {
    const result = await generateCombinedXlsx();
    res.json({ success: true, xlsxUrl: result.url, xlsxFileName: result.fileName });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'fail' });
  }
});

// GET /api/exports/combined/:filename — download a previously generated combined file
router.get('/combined/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  if (!filename.startsWith('combined_') || !filename.endsWith('.xlsx')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  const filePath = path.join(path.dirname(exportPathFor('_')), filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
  );
  const stat = fs.statSync(filePath);
  res.setHeader('Content-Length', String(stat.size));
  fs.createReadStream(filePath).pipe(res);
});

router.get('/:id.xlsx', async (req, res) => {
  const id = req.params.id;
  if (!exportExists(id)) {
    return res.status(404).json({ error: 'Export file not found for this reading' });
  }
  try {
    const reading = await prisma.reading.findUnique({
      where: { id },
      include: { customer: true },
    });
    const fileName = reading ? fileNameFor(reading) : `LuanGiai_${id}.xlsx`;
    const filePath = exportPathFor(id);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    );
    const stat = fs.statSync(filePath);
    res.setHeader('Content-Length', String(stat.size));
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'fail' });
  }
});

router.get('/:id.docx', async (req, res) => {
  const id = req.params.id;
  if (!docxExists(id)) {
    return res.status(404).json({ error: 'Word report not found for this reading' });
  }
  try {
    const reading = await prisma.reading.findUnique({
      where: { id },
      include: { customer: true },
    });
    const fileName = reading ? docxFileNameFor(reading) : `BaoCao_${id}.docx`;
    const filePath = docxPathFor(id);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    );
    const stat = fs.statSync(filePath);
    res.setHeader('Content-Length', String(stat.size));
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'fail' });
  }
});

// POST /api/exports/:id — regenerate docx for an existing reading
router.post('/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const reading = await prisma.reading.findUnique({
      where: { id },
      include: { customer: true, analyses: true },
    });
    if (!reading) return res.status(404).json({ error: 'Reading not found' });

    const c = reading.customer;
    const customer: CustomerInfo = {
      fullName: c.fullName,
      day: c.day,
      month: c.month,
      year: c.year,
      hour: c.hour ?? null,
      minute: c.minute,
      isLunar: c.isLunar,
      gender: c.gender as 'male' | 'female',
      packages: reading.packages as PackageType[],
      phoneNumber: c.phoneNumber ?? undefined,
      question: reading.question ?? undefined,
      addressing: reading.addressing ?? undefined,
      additionalContext: reading.additionalContext ?? undefined,
      useSolarTerms: reading.useSolarTerms,
      yearcalc: reading.yearcalc ?? undefined,
    };

    const analyses: GeminiAnalysis[] = reading.analyses.map((a) => ({
      type: a.type as PackageType,
      analysis: a.analysisJson as Record<string, unknown>,
      usage: { input: a.inputTokens, output: a.outputTokens },
    }));

    const screenshotPaths: Partial<Record<PackageType, string>> = {};
    for (const a of reading.analyses) {
      if (a.screenshotPath && fs.existsSync(a.screenshotPath)) {
        screenshotPaths[a.type as PackageType] = a.screenshotPath;
      }
    }

    const cost = {
      inputTokens: reading.inputTokens,
      outputTokens: reading.outputTokens,
      usd: reading.costUsd,
      vnd: reading.costVnd,
    };

    const result = await generateDocx({
      readingId: id,
      customer,
      analyses,
      finalContent: reading.synthesis ?? '',
      cost,
      screenshotPaths,
      provider: getAiProvider(),
      createdAt: reading.createdAt,
    });

    res.json({ success: true, docxUrl: result.url, docxFileName: result.fileName });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'fail' });
  }
});

export default router;
