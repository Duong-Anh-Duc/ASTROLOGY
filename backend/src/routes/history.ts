import { Router } from 'express';
import { prisma } from '../db/client';
import { exportExists } from '../services/xlsx';

function xlsxUrlIfExists(id: string): string | null {
  if (!exportExists(id)) return null;
  const origin = process.env.PUBLIC_BACKEND_URL ?? `http://localhost:${process.env.PORT ?? 4000}`;
  return `${origin}/api/exports/${id}.xlsx`;
}

const router = Router();

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
        birthDate: `${r.customer.day}/${r.customer.month}/${r.customer.year}`,
        birthHour: r.customer.hour === null ? '' : `${r.customer.hour}h${r.customer.minute || ''}`.replace(/h0$/, 'h'),
        gender: r.customer.gender === 'male' ? 'Nam' : 'Nữ',
        phoneNumber: r.customer.phoneNumber ?? '',
        packages: r.packages.map((p) =>
          p === 'tuTru' ? 'Bát Tự' : p === 'maiHoa' ? 'Kinh Dịch' : 'Sim Phong Thuỷ',
        ).join(', '),
        analysisTuTru: tt?.formattedText ?? '',
        analysisMaiHoa: mh?.formattedText ?? '',
        analysisSim: sm?.formattedText ?? '',
        summary: r.synthesis ?? '',
        cost: r.costVnd > 0 ? String(r.costVnd) : '',
        imgTuTru: tt?.screenshotUrl ?? '',
        imgMaiHoa: mh?.screenshotUrl ?? '',
        imgSim: sm?.screenshotUrl ?? '',
        status: r.status,
        errorMessage: r.errorMessage,
        xlsxUrl: xlsxUrlIfExists(r.id),
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
    // Best-effort cleanup of the generated xlsx file
    try {
      const { exportPathFor } = await import('../services/xlsx');
      const fs = await import('node:fs');
      const p = exportPathFor(id);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch {
      // ignore
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'fail' });
  }
});

export default router;
