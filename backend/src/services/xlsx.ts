import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import type { CostBreakdown } from '../lib/usage';
import type { CustomerInfo, GeminiAnalysis, PackageType } from '../types';
import { UPLOADS_PATH } from './storage';

const EXPORTS_DIR = path.join(UPLOADS_PATH, 'exports');
if (!fs.existsSync(EXPORTS_DIR)) fs.mkdirSync(EXPORTS_DIR, { recursive: true });

export const PACKAGE_LABELS: Record<PackageType, string> = {
  tuTru: 'Bát Tự',
  maiHoa: 'Kinh Dịch',
  sim: 'Sim Phong Thuỷ',
};

const SOURCE_URLS: Record<PackageType, string> = {
  tuTru: 'https://hocvienlyso.org/lasotutru',
  maiHoa: 'https://hocvienlyso.org/boidich/maihoa.php',
  sim: 'https://hocvienlyso.org/boidich/sim.php',
};

function bullet(list: unknown): string {
  if (!Array.isArray(list)) return '';
  return list.map((x) => (typeof x === 'string' ? `• ${x}` : '')).filter(Boolean).join('\n');
}

function titleFromKey(key: string): string {
  const labels: Record<string, string> = {
    opening: 'Lời mở đầu',
    banMenhNguHanh: 'Bản mệnh và ngũ hành',
    ban_menh_ngu_hanh: 'Bản mệnh và ngũ hành',
    tenGoiBiDanh: 'Tên gọi và bí danh',
    ten_goi_bi_danh: 'Tên gọi và bí danh',
    ungDungPhongThuy: 'Ứng dụng phong thủy',
    ung_dung_phong_thuy: 'Ứng dụng phong thủy',
    daiVanNamHienTai: 'Đại vận và năm hiện tại',
    dai_van_nam_hien_tai: 'Đại vận và năm hiện tại',
    loiKhuyen: 'Lời khuyên chân thành',
    loi_khuyen: 'Lời khuyên chân thành',
    loiKet: 'Lời kết',
    loi_ket: 'Lời kết',
    analysis: 'Phân tích',
    report: 'Phân tích',
    content: 'Phân tích',
    text: 'Phân tích',
  };
  if (labels[key]) return labels[key];
  return key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-zà-ỹ])([A-ZÀ-Ỹ])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase());
}

const PROSE_KEY_ORDER = [
  'opening',
  'loiMoDau',
  'loi_mo_dau',
  'banMenhNguHanh',
  'ban_menh_ngu_hanh',
  'tenGoiBiDanh',
  'ten_goi_bi_danh',
  'ungDungPhongThuy',
  'ung_dung_phong_thuy',
  'daiVanNamHienTai',
  'dai_van_nam_hien_tai',
  'loiKhuyen',
  'loi_khuyen',
  'loiKet',
  'loi_ket',
];

function sortAnalysisKeys(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    const ai = PROSE_KEY_ORDER.indexOf(a);
    const bi = PROSE_KEY_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

function stringifyAnalysisValue(value: unknown, depth = 0): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (!value) return '';

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        const text = stringifyAnalysisValue(item, depth + 1);
        return text ? `• ${text}` : '';
      })
      .filter(Boolean)
      .join('\n');
  }

  if (typeof value === 'object') {
    const object = value as Record<string, unknown>;
    const keys = Object.keys(object);
    if (keys.length === 1) {
      const onlyKey = keys[0];
      if (
        onlyKey === '$PARAMETER_NAME' ||
        onlyKey === 'analysis' ||
        onlyKey === 'report' ||
        onlyKey === 'result' ||
        onlyKey === 'tuTru'
      ) {
        return stringifyAnalysisValue(object[onlyKey], depth);
      }
    }

    return sortAnalysisKeys(keys)
      .map((key) => {
        const text = stringifyAnalysisValue(object[key], depth + 1);
        if (!text) return '';
        return depth === 0 ? `═══ ${titleFromKey(key).toUpperCase()} ═══\n${text}` : text;
      })
      .filter(Boolean)
      .join('\n\n');
  }

  return '';
}

function fallbackFormatAnalysis(a: Record<string, unknown>): string {
  return stringifyAnalysisValue(a).trim();
}

function formatTuTru(a: Record<string, unknown>): string {
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
    for (const l of luck) lines.push(`• ${l.period}: ${l.interpretation}`);
  }
  if (a.annualFortune) lines.push(`\n═══ LƯU NIÊN ═══\n${a.annualFortune}`);
  if (Array.isArray(a.strengths) && a.strengths.length) lines.push(`\n═══ ĐIỂM MẠNH ═══\n${bullet(a.strengths)}`);
  if (Array.isArray(a.weaknesses) && a.weaknesses.length) lines.push(`\n═══ ĐIỂM YẾU ═══\n${bullet(a.weaknesses)}`);
  if (Array.isArray(a.advice) && a.advice.length) lines.push(`\n═══ LỜI KHUYÊN ═══\n${bullet(a.advice)}`);
  return lines.join('\n');
}

function formatMaiHoa(a: Record<string, unknown>): string {
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

function formatSim(a: Record<string, unknown>): string {
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

export function formatByType(type: PackageType, a: Record<string, unknown>): string {
  const formatted =
    type === 'tuTru' ? formatTuTru(a) : type === 'maiHoa' ? formatMaiHoa(a) : formatSim(a);
  return markdownToPlainText(formatted.trim() || fallbackFormatAnalysis(a));
}

export function markdownToPlainText(md: string): string {
  let s = md.replace(/\r\n/g, '\n');
  s = s.replace(/^#{1,6}\s+(.*)$/gm, '$1');
  s = s.replace(/^\s*(?:-{3,}|—{3,}|═{3,})\s*$/gm, '');
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

function safeFileName(name: string): string {
  return name.replace(/[^\w\sÀ-ỹà-ỹ-]/g, '').trim().slice(0, 40).replace(/\s+/g, '_') || 'khach';
}

export interface GenerateXlsxInput {
  readingId: string;
  customer: CustomerInfo;
  analyses: GeminiAnalysis[];
  finalContent: string;
  cost?: CostBreakdown;
  screenshotPaths?: Partial<Record<PackageType, string>>; // absolute file paths
  provider: 'gemini' | 'claude';
  createdAt: Date;
}

export interface GenerateXlsxResult {
  filePath: string;
  fileName: string;
  url: string;
}

/**
 * Generate a self-contained .xlsx file for a single reading.
 * Layout: 2 sheets — "Thông tin" (key/value summary + synthesis) and one
 * sheet per package containing analysis + embedded screenshot.
 */
export async function generateXlsx(input: GenerateXlsxInput): Promise<GenerateXlsxResult> {
  const { readingId, customer, analyses, finalContent, cost, screenshotPaths, provider, createdAt } = input;

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Tử Vi - Tool Tự Động';
  wb.created = createdAt;

  // ─── Sheet 1: Thông tin + Tổng hợp ───
  const info = wb.addWorksheet('Tổng hợp', {
    properties: { defaultRowHeight: 18 },
    views: [{ showGridLines: false }],
  });
  info.columns = [
    { key: 'k', width: 24 },
    { key: 'v', width: 90 },
  ];

  const titleRow = info.addRow(['BẢN LUẬN GIẢI VẬN MỆNH', '']);
  info.mergeCells(`A${titleRow.number}:B${titleRow.number}`);
  titleRow.font = { name: 'Inter', size: 16, bold: true, color: { argb: 'FF1A1F36' } };
  titleRow.height = 32;
  titleRow.alignment = { vertical: 'middle' };

  info.addRow([]);

  const meta: [string, string][] = [
    ['Họ tên', customer.fullName],
    ['Ngày sinh', `${customer.day}/${customer.month}/${customer.year}${customer.isLunar ? ' (Âm lịch)' : ''}`],
    ['Giờ sinh', customer.hour === null ? 'Không rõ' : `${customer.hour}h${customer.minute ? customer.minute : ''}`],
    ['Giới tính', customer.gender === 'male' ? 'Nam' : 'Nữ'],
    ...(customer.phoneNumber ? [['Số điện thoại', customer.phoneNumber] as [string, string]] : []),
    ...(customer.question ? [['Việc cần xem', customer.question] as [string, string]] : []),
    ['Gói luận giải', customer.packages.map((p) => PACKAGE_LABELS[p]).join(', ')],
    ['AI provider', provider === 'gemini' ? 'Google Gemini' : 'Anthropic Claude'],
    ['Thời điểm tạo', createdAt.toLocaleString('vi-VN')],
  ];
  for (const [k, v] of meta) {
    const r = info.addRow([k, v]);
    r.getCell(1).font = { bold: true, color: { argb: 'FF525866' } };
    r.getCell(1).alignment = { vertical: 'top' };
    r.getCell(2).alignment = { vertical: 'top', wrapText: true };
  }

  if (cost) {
    info.addRow([]);
    const costHeader = info.addRow(['CHI PHÍ AI', '']);
    info.mergeCells(`A${costHeader.number}:B${costHeader.number}`);
    costHeader.font = { bold: true, size: 11, color: { argb: 'FF7C3AED' } };
    const tokRow = info.addRow([
      'Token vào / ra',
      `${cost.inputTokens.toLocaleString('vi-VN')} / ${cost.outputTokens.toLocaleString('vi-VN')}`,
    ]);
    tokRow.getCell(1).font = { bold: true, color: { argb: 'FF525866' } };
    const costRow = info.addRow(['Chi phí ước tính', `${cost.vnd.toLocaleString('vi-VN')} ₫  (~$${cost.usd.toFixed(4)})`]);
    costRow.getCell(1).font = { bold: true, color: { argb: 'FF525866' } };
  }

  info.addRow([]);
  const synthHeader = info.addRow(['LUẬN GIẢI TỔNG HỢP', '']);
  info.mergeCells(`A${synthHeader.number}:B${synthHeader.number}`);
  synthHeader.font = { bold: true, size: 13, color: { argb: 'FFC9A66B' } };
  synthHeader.height = 24;

  const synthRow = info.addRow([markdownToPlainText(finalContent || '')]);
  info.mergeCells(`A${synthRow.number}:B${synthRow.number}`);
  synthRow.getCell(1).alignment = { vertical: 'top', wrapText: true };
  // Generous synthesis row height — Excel will still respect wrapping
  synthRow.height = 400;
  synthRow.font = { name: 'Inter', size: 11 };

  // Border around title
  titleRow.eachCell((cell) => {
    cell.border = { bottom: { style: 'thick', color: { argb: 'FFC9A66B' } } };
  });

  // ─── Per-package sheets ───
  for (const a of analyses) {
    const label = PACKAGE_LABELS[a.type];
    const ws = wb.addWorksheet(label, {
      properties: { defaultRowHeight: 16 },
      views: [{ showGridLines: false }],
    });
    ws.columns = [
      { key: 'k', width: 24 },
      { key: 'v', width: 90 },
    ];

    const titleR = ws.addRow([label.toUpperCase(), '']);
    ws.mergeCells(`A${titleR.number}:B${titleR.number}`);
    titleR.font = { name: 'Inter', size: 16, bold: true, color: { argb: 'FF1A1F36' } };
    titleR.height = 28;
    titleR.alignment = { vertical: 'middle' };

    ws.addRow([]);
    const srcRow = ws.addRow(['Trang gốc', '']);
    const srcCell = srcRow.getCell(2);
    srcCell.value = { text: SOURCE_URLS[a.type], hyperlink: SOURCE_URLS[a.type] };
    srcCell.font = { color: { argb: 'FF3B82F6' }, underline: true };
    srcRow.getCell(1).font = { bold: true, color: { argb: 'FF525866' } };

    ws.addRow([]);
    const analysisHeader = ws.addRow(['PHÂN TÍCH AI', '']);
    ws.mergeCells(`A${analysisHeader.number}:B${analysisHeader.number}`);
    analysisHeader.font = { bold: true, size: 12, color: { argb: 'FF7C3AED' } };
    analysisHeader.height = 22;

    const formatted = formatByType(a.type, a.analysis);
    const analysisRow = ws.addRow([formatted]);
    ws.mergeCells(`A${analysisRow.number}:B${analysisRow.number}`);
    analysisRow.getCell(1).alignment = { vertical: 'top', wrapText: true };
    analysisRow.height = 320;
    analysisRow.font = { name: 'Inter', size: 11 };

    // Embed screenshot if available
    const imgPath = screenshotPaths?.[a.type];
    if (imgPath && fs.existsSync(imgPath)) {
      try {
        const imageId = wb.addImage({
          filename: imgPath,
          extension: 'png',
        });
        ws.addRow([]);
        const imgHeaderRow = ws.addRow(['ẢNH NGUỒN', '']);
        ws.mergeCells(`A${imgHeaderRow.number}:B${imgHeaderRow.number}`);
        imgHeaderRow.font = { bold: true, size: 12, color: { argb: 'FF7C3AED' } };

        const imgStartRow = ws.lastRow!.number + 1;
        ws.addImage(imageId, {
          tl: { col: 0, row: imgStartRow - 1 },
          ext: { width: 900, height: 600 },
          editAs: 'oneCell',
        });
        // reserve vertical space
        for (let i = 0; i < 30; i++) ws.addRow([]);
      } catch (e) {
        console.warn(`[xlsx] embed image failed for ${a.type}:`, e);
      }
    }
  }

  const safeName = safeFileName(customer.fullName);
  const stamp = createdAt.toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const fileName = `LuanGiai_${safeName}_${stamp}.xlsx`;
  const filePath = path.join(EXPORTS_DIR, `${readingId}.xlsx`);
  await wb.xlsx.writeFile(filePath);

  const publicOrigin =
    process.env.PUBLIC_BACKEND_URL ?? `http://localhost:${process.env.PORT ?? 4000}`;
  return {
    filePath,
    fileName,
    url: `${publicOrigin}/api/exports/${readingId}.xlsx`,
  };
}

export function exportPathFor(readingId: string): string {
  return path.join(EXPORTS_DIR, `${readingId}.xlsx`);
}

export function exportExists(readingId: string): boolean {
  return fs.existsSync(exportPathFor(readingId));
}
