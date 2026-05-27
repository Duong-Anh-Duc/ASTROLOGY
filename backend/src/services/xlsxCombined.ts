import fs from 'node:fs';
import path from 'node:path';
import ExcelJS from 'exceljs';
import { prisma } from '../db/client';
import type { PackageType } from '../types';
import { UPLOADS_PATH } from './storage';
import { markdownToPlainText, formatByType, PACKAGE_LABELS } from './xlsx';

const EXPORTS_DIR = path.join(UPLOADS_PATH, 'exports');
if (!fs.existsSync(EXPORTS_DIR)) fs.mkdirSync(EXPORTS_DIR, { recursive: true });

function safeSheetName(index: number, name: string): string {
  const prefix = `${index}. `;
  const maxLen = 31 - prefix.length;
  const safeName = name.replace(/[\\/\[\]*?:]/g, '').slice(0, maxLen);
  return `${prefix}${safeName}`;
}

export async function generateCombinedXlsx(): Promise<{ filePath: string; fileName: string; url: string }> {
  const readings = await prisma.reading.findMany({
    include: { customer: true, analyses: true },
    orderBy: { createdAt: 'desc' },
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Tử Vi - Tool Tự Động';
  wb.created = new Date();

  // ─── Sheet 0: Danh sách tổng hợp ───
  const index = wb.addWorksheet('Danh sách', {
    properties: { defaultRowHeight: 18 },
    views: [{ showGridLines: false }],
  });
  index.columns = [
    { key: 'stt',     width: 6  },
    { key: 'time',    width: 20 },
    { key: 'name',    width: 28 },
    { key: 'birth',   width: 16 },
    { key: 'gender',  width: 10 },
    { key: 'phone',   width: 16 },
    { key: 'pkgs',    width: 26 },
    { key: 'cost',    width: 18 },
    { key: 'sheet',   width: 20 },
  ];

  const titleRow = index.addRow(['BÁO CÁO TỔNG HỢP LUẬN GIẢI VẬN MỆNH', '', '', '', '', '', '', '', '']);
  index.mergeCells(`A${titleRow.number}:I${titleRow.number}`);
  titleRow.font = { size: 14, bold: true, color: { argb: 'FF1A1F36' } };
  titleRow.height = 30;
  titleRow.alignment = { vertical: 'middle' };
  titleRow.getCell(1).border = { bottom: { style: 'thick', color: { argb: 'FFC9A66B' } } };

  index.addRow([]);

  const headers = ['STT', 'Thời gian', 'Họ tên', 'Ngày sinh', 'Giới tính', 'Điện thoại', 'Gói dịch vụ', 'Chi phí (₫)', 'Sheet'];
  const headerRow = index.addRow(headers);
  headerRow.height = 22;
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A1F36' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF374151' } } };
  });

  // ─── Per-customer sheets ───
  for (let i = 0; i < readings.length; i++) {
    const reading = readings[i];
    const c = reading.customer;
    const sheetName = safeSheetName(i + 1, c.fullName);

    // Add index row
    const birthStr = `${c.day}/${c.month}/${c.year}${c.isLunar ? ' (Âm)' : ''}`;
    const hourStr = c.hour === null ? '' : `${c.hour}h${c.minute ? String(c.minute).padStart(2, '0') : ''}`;
    const pkgsStr = (reading.packages as PackageType[]).map((p) => PACKAGE_LABELS[p]).join(', ');
    const costStr = reading.costVnd ? reading.costVnd.toLocaleString('vi-VN') : '';
    const timeStr = reading.createdAt.toLocaleString('vi-VN');

    const indexRow = index.addRow([
      i + 1,
      timeStr,
      c.fullName,
      birthStr + (hourStr ? ` | ${hourStr}` : ''),
      c.gender === 'male' ? 'Nam' : 'Nữ',
      c.phoneNumber ?? '',
      pkgsStr,
      costStr,
      sheetName,
    ]);
    indexRow.height = 20;
    indexRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    indexRow.getCell(1).font = { color: { argb: 'FF6B7280' }, size: 10 };
    indexRow.getCell(3).font = { bold: true };
    indexRow.getCell(8).alignment = { horizontal: 'right' };
    indexRow.getCell(9).value = { text: sheetName, hyperlink: `#'${sheetName}'!A1` };
    indexRow.getCell(9).font = { color: { argb: 'FF3B82F6' }, underline: true };
    if (i % 2 === 1) {
      indexRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
      });
    }

    // Build customer sheet
    const ws = wb.addWorksheet(sheetName, {
      properties: { defaultRowHeight: 16 },
      views: [{ showGridLines: false }],
    });
    ws.columns = [
      { key: 'k', width: 22 },
      { key: 'v', width: 90 },
    ];

    const wsTitle = ws.addRow([`BẢN LUẬN GIẢI VẬN MỆNH — ${c.fullName.toUpperCase()}`, '']);
    ws.mergeCells(`A${wsTitle.number}:B${wsTitle.number}`);
    wsTitle.font = { size: 15, bold: true, color: { argb: 'FF1A1F36' } };
    wsTitle.height = 30;
    wsTitle.alignment = { vertical: 'middle' };
    wsTitle.getCell(1).border = { bottom: { style: 'thick', color: { argb: 'FFC9A66B' } } };

    ws.addRow([]);

    // Customer info
    const meta: [string, string][] = [
      ['Họ tên', c.fullName],
      ['Ngày sinh', birthStr],
      ['Giờ sinh', hourStr || 'Không rõ'],
      ['Giới tính', c.gender === 'male' ? 'Nam' : 'Nữ'],
      ...(c.phoneNumber ? [['Số điện thoại', c.phoneNumber] as [string, string]] : []),
      ...(reading.question ? [['Việc cần xem', reading.question] as [string, string]] : []),
      ['Gói luận giải', pkgsStr],
      ['Thời điểm tạo', timeStr],
    ];
    for (const [k, v] of meta) {
      const r = ws.addRow([k, v]);
      r.getCell(1).font = { bold: true, color: { argb: 'FF525866' } };
      r.getCell(1).alignment = { vertical: 'top' };
      r.getCell(2).alignment = { vertical: 'top', wrapText: true };
    }

    if (reading.costVnd || reading.costUsd) {
      ws.addRow([]);
      const costSect = ws.addRow(['CHI PHÍ', '']);
      ws.mergeCells(`A${costSect.number}:B${costSect.number}`);
      costSect.font = { bold: true, size: 11, color: { argb: 'FF7C3AED' } };
      const tokR = ws.addRow(['Token vào / ra', `${reading.inputTokens.toLocaleString('vi-VN')} / ${reading.outputTokens.toLocaleString('vi-VN')}`]);
      tokR.getCell(1).font = { bold: true, color: { argb: 'FF525866' } };
      const costR = ws.addRow(['Chi phí ước tính', `${(reading.costVnd ?? 0).toLocaleString('vi-VN')} ₫  (~$${(reading.costUsd ?? 0).toFixed(4)})`]);
      costR.getCell(1).font = { bold: true, color: { argb: 'FF525866' } };
    }

    // Per-package analyses
    for (const analysis of reading.analyses) {
      ws.addRow([]);
      const pkgHeader = ws.addRow([`══ ${PACKAGE_LABELS[analysis.type as PackageType].toUpperCase()} ══`, '']);
      ws.mergeCells(`A${pkgHeader.number}:B${pkgHeader.number}`);
      pkgHeader.font = { bold: true, size: 13, color: { argb: 'FF7C3AED' } };
      pkgHeader.height = 24;

      const formatted = formatByType(analysis.type as PackageType, analysis.analysisJson as Record<string, unknown>);
      const analysisRow = ws.addRow([formatted]);
      ws.mergeCells(`A${analysisRow.number}:B${analysisRow.number}`);
      analysisRow.getCell(1).alignment = { vertical: 'top', wrapText: true };
      analysisRow.height = 280;
      analysisRow.font = { size: 11 };
    }

    // Synthesis
    if (reading.synthesis) {
      ws.addRow([]);
      const synthHeader = ws.addRow(['══ LUẬN GIẢI TỔNG HỢP ══', '']);
      ws.mergeCells(`A${synthHeader.number}:B${synthHeader.number}`);
      synthHeader.font = { bold: true, size: 13, color: { argb: 'FFC9A66B' } };
      synthHeader.height = 24;

      const synthRow = ws.addRow([markdownToPlainText(reading.synthesis)]);
      ws.mergeCells(`A${synthRow.number}:B${synthRow.number}`);
      synthRow.getCell(1).alignment = { vertical: 'top', wrapText: true };
      synthRow.height = 400;
      synthRow.font = { size: 11 };
    }

    // Back-link to index
    ws.addRow([]);
    const backRow = ws.addRow(['← Về danh sách', '']);
    backRow.getCell(1).value = { text: '← Về danh sách', hyperlink: `#'Danh sách'!A1` };
    backRow.getCell(1).font = { color: { argb: 'FF3B82F6' }, underline: true };
  }

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const fileName = `LuanGiai_TongHop_${stamp}.xlsx`;
  const filePath = path.join(EXPORTS_DIR, `combined_${stamp}.xlsx`);
  await wb.xlsx.writeFile(filePath);

  const publicOrigin = process.env.PUBLIC_BACKEND_URL ?? `http://localhost:${process.env.PORT ?? 4000}`;
  return { filePath, fileName, url: `${publicOrigin}/api/exports/combined/${path.basename(filePath)}` };
}
