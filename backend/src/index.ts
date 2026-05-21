import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { prisma } from './db/client';
import runRoute from './routes/run';
import historyRoute from './routes/history';
import promptsRoute from './routes/prompts';
import { UPLOADS_PATH } from './services/storage';

const app = express();
const PORT = Number(process.env.PORT ?? 4000);

app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') ?? '*' }));
app.use(express.json({ limit: '10mb' }));

app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(503).json({ status: 'error', db: err instanceof Error ? err.message : 'fail' });
  }
});

app.use('/api/run', runRoute);
app.use('/api/history', historyRoute);
app.use('/api/prompts', promptsRoute);

// Static: screenshots stored locally (Drive can't host them — service account has no quota)
app.use('/uploads', express.static(UPLOADS_PATH, { maxAge: '1d' }));

app.listen(PORT, () => {
  console.log(`🚀 Backend ready on http://localhost:${PORT}`);
  console.log(`   CORS origin: ${process.env.CORS_ORIGIN ?? '*'}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  await prisma.$disconnect();
  process.exit(0);
});
