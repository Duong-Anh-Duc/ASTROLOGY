import { Router } from 'express';
import fs from 'node:fs';
import { prisma } from '../db/client';
import { exportExists, exportPathFor } from '../services/xlsx';

const router = Router();

function fileNameFor(reading: { id: string; createdAt: Date; customer: { fullName: string } }): string {
  const safe = reading.customer.fullName.replace(/[^\w\sÀ-ỹà-ỹ-]/g, '').trim().slice(0, 40).replace(/\s+/g, '_') || 'khach';
  const stamp = reading.createdAt.toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `LuanGiai_${safe}_${stamp}.xlsx`;
}

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

export default router;
