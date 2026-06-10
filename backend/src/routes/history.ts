import { Router } from 'express';
import { prisma } from '../db/client';
import { formatByType, markdownToPlainText } from '../services/xlsx';

const router = Router();

function imageUrl(url?: string | null): string {
  if (!url) return '';
  return url.replace(/^https?:\/\/[^/]+\/uploads\//i, '/uploads/');
}

router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const pageSize = Math.min(Math.max(1, Number(req.query.pageSize ?? 10)), 100);
    const skip = (page - 1) * pageSize;
    const search = req.query.search ? String(req.query.search).trim() : '';

    const where: any = {};
    if (search) {
      where.customer = {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          { phoneNumber: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const [total, readings] = await Promise.all([
      prisma.reading.count({ where }),
      prisma.reading.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: { customer: true, analyses: true },
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    const rows = readings.map((r) => {
      const a = (type: 'tuTru' | 'maiHoa' | 'sim') =>
        r.analyses.find((x) => x.type === type);
      const tt = a('tuTru');
      const mh = a('maiHoa');
      const sm = a('sim');
      return {
        id: r.id,
        timestamp: r.createdAt.toISOString(),
        fullName: r.customer.fullName,
        birthDate: `${String(r.customer.day).padStart(2, '0')}/${String(r.customer.month).padStart(2, '0')}/${r.customer.year}`,
        birthHour: r.customer.hour === null ? '' : `${String(r.customer.hour).padStart(2, '0')}:${String(r.customer.minute ?? 0).padStart(2, '0')}`,
        gender: r.customer.gender === 'male' ? 'Nam' : 'Nữ',
        phoneNumber: r.customer.phoneNumber ?? '',
        packages: r.packages.map((p) =>
          p === 'tuTru' ? 'Bát Tự' : p === 'maiHoa' ? 'Kinh Dịch' : 'Sim Phong Thuỷ',
        ).join(', '),
        analysisTuTru: markdownToPlainText(
          tt?.formattedText ||
            (tt ? formatByType('tuTru', tt.analysisJson as Record<string, unknown>) : ''),
        ),
        analysisMaiHoa: markdownToPlainText(
          mh?.formattedText ||
            (mh ? formatByType('maiHoa', mh.analysisJson as Record<string, unknown>) : ''),
        ),
        analysisSim: markdownToPlainText(
          sm?.formattedText ||
            (sm ? formatByType('sim', sm.analysisJson as Record<string, unknown>) : ''),
        ),
        summary: markdownToPlainText(r.synthesis ?? ''),
        cost: r.costVnd > 0 ? String(r.costVnd) : '',
        imgTuTru: imageUrl(tt?.screenshotUrl),
        imgMaiHoa: imageUrl(mh?.screenshotUrl),
        imgSim: imageUrl(sm?.screenshotUrl),
        status: r.status,
        errorMessage: r.errorMessage,
      };
    });

    res.json({ rows, total, page, pageSize, totalPages });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;
    await prisma.reading.delete({ where: { id } });
    // Best-effort cleanup of generated export files.
    try {
      const { exportPathFor } = await import('../services/xlsx');
      const { docxPathFor } = await import('../services/docx');
      const fs = await import('node:fs');
      for (const p of [exportPathFor(id), docxPathFor(id)]) {
        if (fs.existsSync(p)) fs.unlinkSync(p);
      }
    } catch {
      // ignore
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'fail' });
  }
});

export default router;
