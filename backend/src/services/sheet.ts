import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { google } from 'googleapis';
import type { CustomerInfo, GeminiAnalysis, PackageType } from '../types';
import type { CostBreakdown } from '../lib/usage';

const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file',
];

const HEADERS = [
  'Timestamp',            // A
  'Họ tên',               // B
  'Ngày sinh',            // C
  'Giờ sinh',             // D
  'Giới tính',            // E
  'Số điện thoại',        // F
  'Gói',                  // G
  'Bát Tự',               // H — per-service analysis
  'Kinh Dịch',            // I
  'Sim Phong Thuỷ',       // J
  'Tổng hợp',             // K — synthesis of all
  'Ảnh Bát Tự',           // L — IMAGE() inline
  'Ảnh Kinh Dịch',        // M
  'Ảnh Sim',              // N
  'Trang gốc Bát Tự',     // O — HYPERLINK to source site for customer to verify
  'Trang gốc Kinh Dịch',  // P
  'Trang gốc Sim',        // Q
  'Token vào',            // R
  'Token ra',             // S
  'Chi phí (VNĐ)',        // T
];

// Column widths (pixels) — order matches HEADERS
const COL_WIDTHS = [
  150, 180, 110, 80, 90, 130, 150,       // info
  480, 480, 480, 600,                    // analyses + synthesis
  220, 220, 220,                         // images
  150, 150, 150,                         // source URLs
  80, 80, 110,                           // tokens + cost
];

const SOURCE_URLS: Record<PackageType, string> = {
  tuTru: 'https://hocvienlyso.org/lasotutru',
  maiHoa: 'https://hocvienlyso.org/boidich/maihoa.php',
  sim: 'https://hocvienlyso.org/boidich/sim.php',
};

// Row height for data rows (pixels) — generous for screenshots
const DATA_ROW_HEIGHT = 240;

const PACKAGE_LABELS: Record<PackageType, string> = {
  tuTru: 'Bát Tự',
  maiHoa: 'Kinh Dịch',
  sim: 'Sim Phong Thuỷ',
};

function formatPackagesVi(packages: PackageType[]): string {
  return packages.map((p) => PACKAGE_LABELS[p] ?? p).join(', ');
}

function loadServiceAccountJson(): Record<string, unknown> {
  const rel =
    process.env.GOOGLE_SERVICE_ACCOUNT_PATH ??
    './credentials/google-service-account.json';
  const abs = path.isAbsolute(rel) ? rel : path.resolve(process.cwd(), rel);
  if (!fs.existsSync(abs)) {
    throw new Error(`Service account file not found at: ${abs}`);
  }
  const raw = fs.readFileSync(abs, 'utf-8');
  return JSON.parse(raw) as Record<string, unknown>;
}

function getAuthClient() {
  const creds = loadServiceAccountJson();
  return new google.auth.GoogleAuth({ credentials: creds, scopes: SCOPES });
}

function formatBirthDate(c: CustomerInfo): string {
  return `${c.day}/${c.month}/${c.year}`;
}

function formatHour(c: CustomerInfo): string {
  return c.hour === null ? '' : `${c.hour}h`;
}

function formatGender(c: CustomerInfo): string {
  return c.gender === 'male' ? 'Nam' : 'Nữ';
}

function markdownToPlainText(md: string): string {
  let s = md.replace(/\r\n/g, '\n');
  s = s.replace(/^######\s+(.*)$/gm, (_, t) => t.toUpperCase());
  s = s.replace(/^#####\s+(.*)$/gm, (_, t) => t.toUpperCase());
  s = s.replace(/^####\s+(.*)$/gm, (_, t) => t.toUpperCase());
  s = s.replace(/^###\s+(.*)$/gm, (_, t) => `\n— ${t.toUpperCase()} —`);
  s = s.replace(/^##\s+(.*)$/gm, (_, t) => `\n══ ${t.toUpperCase()} ══`);
  s = s.replace(
    /^#\s+(.*)$/gm,
    (_, t) => `\n${t.toUpperCase()}\n${'═'.repeat(Math.min(50, t.length * 2))}`,
  );
  s = s.replace(/\*\*(.+?)\*\*/g, '$1');
  s = s.replace(/\*(.+?)\*/g, '$1');
  s = s.replace(/__(.+?)__/g, '$1');
  s = s.replace(/_(.+?)_/g, '$1');
  s = s.replace(/`([^`]+)`/g, '$1');
  s = s.replace(/^\s*[-*]\s+/gm, '• ');
  s = s.replace(/^\s*(\d+)\.\s+/gm, '$1. ');
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

function bullet(list: unknown): string {
  if (!Array.isArray(list)) return '';
  return list
    .map((x) => (typeof x === 'string' ? `• ${x}` : ''))
    .filter(Boolean)
    .join('\n');
}

function formatTuTruAnalysis(a: Record<string, unknown>): string {
  const fp = a.fourPillars as Record<string, string> | undefined;
  const fe = a.fiveElements as Record<string, string> | undefined;
  const luck = a.luckCycles as Array<{ period: string; interpretation: string }> | undefined;
  const lines: string[] = [];
  if (fp) {
    lines.push('═══ TỨ TRỤ ═══');
    lines.push(`Năm: ${fp.year ?? ''}`);
    lines.push(`Tháng: ${fp.month ?? ''}`);
    lines.push(`Ngày: ${fp.day ?? ''}`);
    lines.push(`Giờ: ${fp.hour ?? ''}`);
  }
  if (fe) {
    lines.push('\n═══ NGŨ HÀNH ═══');
    if (fe.summary) lines.push(fe.summary);
    if (fe.balance) lines.push(`\nCân bằng: ${fe.balance}`);
  }
  if (a.naYin) lines.push(`\n═══ NẠP ÂM ═══\n${a.naYin}`);
  if (Array.isArray(luck) && luck.length > 0) {
    lines.push('\n═══ ĐẠI VẬN ═══');
    for (const l of luck) {
      lines.push(`• ${l.period}: ${l.interpretation}`);
    }
  }
  if (a.annualFortune) lines.push(`\n═══ LƯU NIÊN ═══\n${a.annualFortune}`);
  const s = a.strengths;
  const w = a.weaknesses;
  const ad = a.advice;
  if (Array.isArray(s) && s.length) lines.push(`\n═══ ĐIỂM MẠNH ═══\n${bullet(s)}`);
  if (Array.isArray(w) && w.length) lines.push(`\n═══ ĐIỂM YẾU ═══\n${bullet(w)}`);
  if (Array.isArray(ad) && ad.length) lines.push(`\n═══ LỜI KHUYÊN ═══\n${bullet(ad)}`);
  return lines.join('\n');
}

function formatMaiHoaAnalysis(a: Record<string, unknown>): string {
  const pri = a.primaryHexagram as { name: string; meaning: string } | undefined;
  const tr = a.transformedHexagram as { name: string; meaning: string } | undefined;
  const cl = a.changingLines as Array<{ line: string; meaning: string }> | undefined;
  const lines: string[] = [];
  if (pri) lines.push(`═══ QUẺ CHÍNH ═══\n${pri.name}\n\n${pri.meaning}`);
  if (Array.isArray(cl) && cl.length > 0) {
    lines.push('\n═══ HÀO ĐỘNG ═══');
    for (const h of cl) lines.push(`• ${h.line}: ${h.meaning}`);
  }
  if (tr) lines.push(`\n═══ QUẺ BIẾN ═══\n${tr.name}\n\n${tr.meaning}`);
  if (a.overall) lines.push(`\n═══ LUẬN ĐOÁN ═══\n${a.overall}`);
  if (Array.isArray(a.guidance)) lines.push(`\n═══ LỜI KHUYÊN ═══\n${bullet(a.guidance)}`);
  return lines.join('\n');
}

function formatSimAnalysis(a: Record<string, unknown>): string {
  const pairs = a.pairs as Array<{ pair: string; meaning: string }> | undefined;
  const lines: string[] = [];
  if (a.phoneNumber) lines.push(`Số: ${a.phoneNumber}`);
  if (a.structure) lines.push(`\n═══ CẤU TRÚC ═══\n${a.structure}`);
  if (Array.isArray(pairs) && pairs.length) {
    lines.push('\n═══ CẶP SỐ ═══');
    for (const p of pairs) lines.push(`• ${p.pair}: ${p.meaning}`);
  }
  if (a.elements) lines.push(`\n═══ NGŨ HÀNH / QUẺ ═══\n${a.elements}`);
  if (Array.isArray(a.auspicious)) lines.push(`\n═══ CÁT ═══\n${bullet(a.auspicious)}`);
  if (Array.isArray(a.inauspicious)) lines.push(`\n═══ HUNG ═══\n${bullet(a.inauspicious)}`);
  if (a.verdict) lines.push(`\n═══ KẾT LUẬN ═══\n${a.verdict}`);
  return lines.join('\n');
}

function formatAnalysisByType(type: PackageType, analysis: Record<string, unknown>): string {
  if (type === 'tuTru') return formatTuTruAnalysis(analysis);
  if (type === 'maiHoa') return formatMaiHoaAnalysis(analysis);
  return formatSimAnalysis(analysis);
}

async function getFirstSheetMeta(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
): Promise<{ title: string; sheetId: number }> {
  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties(title,sheetId)',
  });
  const props = meta.data.sheets?.[0]?.properties;
  if (!props?.title || props.sheetId == null) {
    throw new Error('Spreadsheet has no sheets');
  }
  return { title: props.title, sheetId: props.sheetId };
}

async function ensureHeaderAndFormat(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string,
  tab: string,
  sheetId: number,
): Promise<void> {
  const lastCol = columnLetter(HEADERS.length);
  const range = `${tab}!A1:${lastCol}1`;
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });
  const row = existing.data.values?.[0] ?? [];
  const headerOk =
    row.length === HEADERS.length &&
    row.every((cell, i) => String(cell) === HEADERS[i]);

  if (!headerOk) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'RAW',
      requestBody: { values: [HEADERS] },
    });
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: 0,
              endRowIndex: 1,
              startColumnIndex: 0,
              endColumnIndex: HEADERS.length,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.15, green: 0.09, blue: 0.18 },
                textFormat: {
                  bold: true,
                  foregroundColor: { red: 0.79, green: 0.66, blue: 0.38 },
                  fontSize: 11,
                },
                horizontalAlignment: 'LEFT',
                verticalAlignment: 'MIDDLE',
                padding: { top: 6, bottom: 6, left: 8, right: 8 },
              },
            },
            fields:
              'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,padding)',
          },
        },
        {
          updateSheetProperties: {
            properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
            fields: 'gridProperties.frozenRowCount',
          },
        },
        {
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: 1,
              startColumnIndex: 0,
              endColumnIndex: HEADERS.length,
            },
            cell: {
              userEnteredFormat: {
                verticalAlignment: 'TOP',
                wrapStrategy: 'WRAP',
                textFormat: { fontSize: 10 },
                padding: { top: 6, bottom: 6, left: 8, right: 8 },
              },
            },
            fields:
              'userEnteredFormat(verticalAlignment,wrapStrategy,textFormat,padding)',
          },
        },
        ...COL_WIDTHS.map((px, i) => ({
          updateDimensionProperties: {
            range: {
              sheetId,
              dimension: 'COLUMNS' as const,
              startIndex: i,
              endIndex: i + 1,
            },
            properties: { pixelSize: px },
            fields: 'pixelSize',
          },
        })),
      ],
    },
  });
}

function columnLetter(n: number): string {
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

async function ensureScreenshotsFolder(
  drive: ReturnType<typeof google.drive>,
): Promise<string> {
  const folderName = 'Tử Vi - Screenshots';
  const list = await drive.files.list({
    q: `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id, name)',
    spaces: 'drive',
  });
  const existing = list.data.files?.[0];
  if (existing?.id) return existing.id;
  const created = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
    },
    fields: 'id',
  });
  if (!created.data.id) throw new Error('Failed to create Drive folder');
  return created.data.id;
}

async function uploadScreenshot(
  drive: ReturnType<typeof google.drive>,
  folderId: string,
  base64Png: string,
  fileName: string,
): Promise<{ viewUrl: string; thumbUrl: string }> {
  const buffer = Buffer.from(base64Png, 'base64');
  const created = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
      mimeType: 'image/png',
    },
    media: {
      mimeType: 'image/png',
      body: Readable.from(buffer),
    },
    fields: 'id',
  });
  const fileId = created.data.id;
  if (!fileId) throw new Error('Drive upload returned no id');
  await drive.permissions.create({
    fileId,
    requestBody: { role: 'reader', type: 'anyone' },
  });
  return {
    viewUrl: `https://drive.google.com/file/d/${fileId}/view`,
    thumbUrl: `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`,
  };
}

export interface AppendRowOptions {
  screenshots?: Partial<Record<PackageType, string>>; // base64 PNG (no prefix)
  cost?: CostBreakdown;
  analyses?: GeminiAnalysis[];
}

export interface AppendRowResult {
  url: string;
  driveUrls: Partial<Record<PackageType, string>>;
}

export async function appendRow(
  customer: CustomerInfo,
  finalContent: string,
  options: AppendRowOptions = {},
): Promise<AppendRowResult> {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) {
    throw new Error('GOOGLE_SHEET_ID is not set in environment');
  }

  const auth = getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth });
  const drive = google.drive({ version: 'v3', auth });
  const { title: tab, sheetId } = await getFirstSheetMeta(sheets, spreadsheetId);

  await ensureHeaderAndFormat(sheets, spreadsheetId, tab, sheetId);

  const folderId = options.screenshots ? await ensureScreenshotsFolder(drive) : '';
  const timestamp = new Date();
  const safeName = customer.fullName.replace(/[^\w\s-]/g, '').trim().slice(0, 30) || 'khach';
  const stamp = timestamp.toISOString().replace(/[:.]/g, '-');

  const driveUrls: Partial<Record<PackageType, string>> = {};

  const uploadOne = async (
    pkg: PackageType,
    label: string,
  ): Promise<string> => {
    const b64 = options.screenshots?.[pkg];
    if (!b64) return '';
    try {
      const { thumbUrl } = await uploadScreenshot(
        drive,
        folderId,
        b64,
        `${stamp}_${safeName}_${label}.png`,
      );
      driveUrls[pkg] = thumbUrl;
      return `=IMAGE("${thumbUrl}", 1)`;
    } catch {
      return '';
    }
  };

  const [imgTuTru, imgMaiHoa, imgSim] = await Promise.all([
    uploadOne('tuTru', 'tutru'),
    uploadOne('maiHoa', 'maihoa'),
    uploadOne('sim', 'sim'),
  ]);

  const sourceLink = (pkg: PackageType): string => {
    if (!customer.packages.includes(pkg)) return '';
    return `=HYPERLINK("${SOURCE_URLS[pkg]}", "🌐 Mở trang gốc")`;
  };

  // Per-service analysis text
  const byType: Partial<Record<PackageType, string>> = {};
  if (options.analyses) {
    for (const a of options.analyses) {
      byType[a.type] = formatAnalysisByType(a.type, a.analysis);
    }
  }

  const lastCol = columnLetter(HEADERS.length);
  const row = [
    timestamp.toISOString(),                              // A Timestamp
    customer.fullName,                                    // B Họ tên
    formatBirthDate(customer),                            // C Ngày sinh
    formatHour(customer),                                 // D Giờ sinh
    formatGender(customer),                               // E Giới tính
    customer.phoneNumber ?? '',                           // F SĐT
    formatPackagesVi(customer.packages),                  // G Gói
    byType.tuTru ?? '',                                   // H Bát Tự
    byType.maiHoa ?? '',                                  // I Kinh Dịch
    byType.sim ?? '',                                     // J Sim Phong Thuỷ
    markdownToPlainText(finalContent),                    // K Tổng hợp
    imgTuTru,                                             // L Ảnh Bát Tự
    imgMaiHoa,                                            // M Ảnh Kinh Dịch
    imgSim,                                               // N Ảnh Sim
    sourceLink('tuTru'),                                  // O Trang gốc Bát Tự
    sourceLink('maiHoa'),                                 // P Trang gốc Kinh Dịch
    sourceLink('sim'),                                    // Q Trang gốc Sim
    options.cost?.inputTokens ?? '',                      // R Token vào
    options.cost?.outputTokens ?? '',                     // S Token ra
    options.cost?.vnd ?? '',                              // T Chi phí
  ];

  const append = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${tab}!A:${lastCol}`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });

  const updatedRange = append.data.updates?.updatedRange ?? '';
  const m = updatedRange.match(/!A(\d+):/);
  if (m) {
    const insertedRowIndex = Number(m[1]) - 1;
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            updateDimensionProperties: {
              range: {
                sheetId,
                dimension: 'ROWS',
                startIndex: insertedRowIndex,
                endIndex: insertedRowIndex + 1,
              },
              properties: { pixelSize: DATA_ROW_HEIGHT },
              fields: 'pixelSize',
            },
          },
        ],
      },
    });
  }

  return {
    url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    driveUrls,
  };
}

export interface HistoryRow {
  timestamp: string;
  fullName: string;
  birthDate: string;
  birthHour: string;
  gender: string;
  phoneNumber: string;
  packages: string;
  analysisTuTru: string;
  analysisMaiHoa: string;
  analysisSim: string;
  summary: string;
  cost: string;
  imgTuTru: string;
  imgMaiHoa: string;
  imgSim: string;
}

export const HISTORY_HEADERS = HEADERS;

export async function readRows(limit = 200): Promise<HistoryRow[]> {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  if (!spreadsheetId) {
    throw new Error('GOOGLE_SHEET_ID is not set in environment');
  }

  const auth = getAuthClient();
  const sheets = google.sheets({ version: 'v4', auth });
  const { title: tab } = await getFirstSheetMeta(sheets, spreadsheetId);
  // Two reads: formatted text values + raw formulas (for IMAGE() URLs).
  const [valRes, formulaRes] = await Promise.all([
    sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${tab}!A2:T`,
    }),
    sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${tab}!L2:N`,
      valueRenderOption: 'FORMULA',
    }),
  ]);

  const values = valRes.data.values ?? [];
  const formulas = formulaRes.data.values ?? [];

  const extractImageUrl = (cell: unknown): string => {
    if (typeof cell !== 'string') return '';
    // Match =IMAGE("url", ...) or plain http(s) URL
    const m = cell.match(/=IMAGE\("([^"]+)"/i);
    if (m) return m[1];
    if (cell.startsWith('http')) return cell;
    return '';
  };

  const rows = values.map<HistoryRow>((r, i) => {
    const fRow = formulas[i] ?? [];
    return {
      timestamp: String(r[0] ?? ''),
      fullName: String(r[1] ?? ''),
      birthDate: String(r[2] ?? ''),
      birthHour: String(r[3] ?? ''),
      gender: String(r[4] ?? ''),
      phoneNumber: String(r[5] ?? ''),
      packages: String(r[6] ?? ''),
      analysisTuTru: String(r[7] ?? ''),   // H
      analysisMaiHoa: String(r[8] ?? ''),  // I
      analysisSim: String(r[9] ?? ''),     // J
      summary: String(r[10] ?? ''),         // K
      cost: String(r[19] ?? ''),
      imgTuTru: extractImageUrl(fRow[0]),
      imgMaiHoa: extractImageUrl(fRow[1]),
      imgSim: extractImageUrl(fRow[2]),
    };
  });
  return rows.reverse().slice(0, limit);
}
