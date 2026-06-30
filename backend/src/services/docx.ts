import fs from 'node:fs';
import path from 'node:path';
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';
import type { CostBreakdown } from '../lib/usage';
import type { CustomerInfo, GeminiAnalysis, PackageType } from '../types';
import { UPLOADS_PATH } from './storage';
import { formatByType, markdownToPlainText, PACKAGE_LABELS, stripInternalAnalysis } from './xlsx';

const EXPORTS_DIR = path.join(UPLOADS_PATH, 'exports');
if (!fs.existsSync(EXPORTS_DIR)) fs.mkdirSync(EXPORTS_DIR, { recursive: true });

const FONT = 'Times New Roman';
const PURPLE = '7B2D8B';
const PURPLE_DARK = '4A148C';
const PURPLE_SOFT = 'EDE7F6';
const TEXT = '222222';
const MUTED = '4A4A4A';
const BORDER = 'CCCCCC';

const PACKAGE_TITLE: Record<PackageType, string> = {
  tuTru: '🎋 BÁT TỰ CHUYÊN SÂU',
  maiHoa: '☯️ LUẬN GIẢI KINH DỊCH',
  sim: '📱 SIM PHONG THỦY',
};

const CHART_TITLE: Record<PackageType, string> = {
  tuTru: '🎋 LÁ SỐ BÁT TỰ',
  maiHoa: '☯️ LÁ SỐ KINH DỊCH',
  sim: '📱 LÁ SỐ SIM PHONG THỦY',
};

const ORDER: PackageType[] = ['maiHoa', 'tuTru', 'sim'];

export interface GenerateDocxInput {
  readingId: string;
  customer: CustomerInfo;
  analyses: GeminiAnalysis[];
  finalContent: string;
  cost?: CostBreakdown;
  screenshotPaths?: Partial<Record<PackageType, string>>;
  provider: 'gemini' | 'claude';
  createdAt: Date;
}

export interface GenerateDocxResult {
  filePath: string;
  fileName: string;
  url: string;
}

function safeFileName(value: string): string {
  return (
    value
      .replace(/[^\w\sÀ-ỹà-ỹ-]/g, '')
      .trim()
      .slice(0, 40)
      .replace(/\s+/g, '_') || 'khach'
  );
}

function paragraph(
  text: string,
  options: {
    bold?: boolean;
    italics?: boolean;
    color?: string;
    size?: number;
    alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
    spacingAfter?: number;
    spacingBefore?: number;
    heading?: (typeof HeadingLevel)[keyof typeof HeadingLevel];
    indentLeft?: number;
    allCaps?: boolean;
  } = {},
): Paragraph {
  return new Paragraph({
    heading: options.heading,
    alignment: options.alignment,
    spacing: {
      before: options.spacingBefore ?? 0,
      after: options.spacingAfter ?? 160,
      line: 320,
    },
    indent: options.indentLeft ? { left: options.indentLeft } : undefined,
    children: [
      new TextRun({
        text: options.allCaps ? text.toUpperCase() : text,
        bold: options.bold,
        italics: options.italics,
        color: options.color ?? TEXT,
        size: options.size ?? 24,
        font: FONT,
      }),
    ],
  });
}

function emptyLine(): Paragraph {
  return new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: '', font: FONT })] });
}

function sectionTitle(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 260, after: 180 },
    border: {
      bottom: { style: BorderStyle.SINGLE, color: PURPLE, size: 8, space: 8 },
    },
    children: [
      new TextRun({
        text,
        bold: true,
        color: PURPLE_DARK,
        size: 30,
        font: FONT,
      }),
    ],
  });
}

function subTitle(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 120 },
    children: [
      new TextRun({
        text,
        bold: true,
        color: PURPLE,
        size: 26,
        font: FONT,
      }),
    ],
  });
}

function keyCell(text: string): TableCell {
  return new TableCell({
    width: { size: 32, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.CLEAR, fill: PURPLE_SOFT },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 90, bottom: 90, left: 160, right: 160 },
    borders: cellBorders(),
    children: [
      paragraph(text, {
        bold: true,
        color: PURPLE_DARK,
        size: 22,
        spacingAfter: 0,
      }),
    ],
  });
}

function valueCell(text: string): TableCell {
  return new TableCell({
    width: { size: 68, type: WidthType.PERCENTAGE },
    verticalAlign: VerticalAlign.CENTER,
    margins: { top: 90, bottom: 90, left: 160, right: 160 },
    borders: cellBorders(),
    children: [paragraph(text || '-', { size: 22, spacingAfter: 0 })],
  });
}

function cellBorders() {
  return {
    top: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
    left: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
    right: { style: BorderStyle.SINGLE, size: 4, color: BORDER },
  };
}

function metaTable(rows: [string, string][]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [3000, 6360],
    rows: rows.map(
      ([key, value]) =>
        new TableRow({
          children: [keyCell(key), valueCell(value)],
        }),
    ),
  });
}

// Ký hiệu trang trí đứng đầu tiêu đề (emoji, ✦, ★, ◆, ●…)
const LEADING_DECOR =
  /^(?:[←-⇿⌀-➿⬀-⯿☀-⛿️‍]|[\u{1F000}-\u{1FAFF}]|[★☆✦✧❖◆◇●○»→])+\s*/u;

function hasLeadingDecor(line: string): boolean {
  return LEADING_DECOR.test(line.trim());
}

function isMajorHeading(line: string): boolean {
  const clean = line.trim();
  const stripped = clean.replace(LEADING_DECOR, '');
  return (
    /^PHẦN\s+[IVXLC\d]+\s*[:.—–-]/i.test(stripped) ||
    /^\d+\.\s+[A-ZÀ-Ỹ0-9 ,&/-]{6,}$/.test(stripped) ||
    /^(?:LỜI\s+)?(?:MỞ ĐẦU|KẾT|LỜI KẾT|KẾT LUẬN|TỔNG KẾT|LỜI NHẮN(?:\s+GỬI)?|ĐÔI LỜI)\s*:?\s*$/i.test(stripped) ||
    // Tiêu đề mục dạng IN HOA mở đầu bằng từ khoá quen thuộc, có thể có chữ theo sau
    (/^(?:LỜI\s+MỞ\s+ĐẦU|MỞ ĐẦU|ĐÚC KẾT|LỜI KẾT|KẾT LUẬN|TỔNG KẾT|LỜI NHẮN|LUẬN GIẢI BẢN MỆNH|LÁ SỐ BẢN MỆNH)\b/i.test(stripped) &&
      stripped.length <= 80 &&
      stripped === stripped.toLocaleUpperCase('vi-VN')) ||
    /^#{1,3}\s+/.test(clean) ||
    /^═{2,}\s*.+\s*═{2,}$/.test(clean) ||
    /^—\s*.+\s*—$/.test(clean) ||
    // Dòng ngắn dẫn đầu bằng emoji/ký hiệu và phần lớn IN HOA → tiêu đề
    (hasLeadingDecor(clean) &&
      stripped.length > 0 &&
      stripped.length <= 80 &&
      stripped === stripped.toLocaleUpperCase('vi-VN') &&
      /[A-ZÀ-Ỹ]/.test(stripped))
  );
}

function normalizeHeading(line: string): string {
  return line
    .replace(/^#{1,6}\s+/, '')
    .replace(LEADING_DECOR, '')
    .replace(/^═+\s*/, '')
    .replace(/\s*═+$/, '')
    .replace(/^—\s*/, '')
    .replace(/\s*—$/, '')
    .trim();
}

// Emoji chủ đề cho từng phần (giống file mẫu của khách)
function headingEmoji(text: string): string {
  const t = text.toLocaleLowerCase('vi-VN');
  // Tiêu đề chính của bài (đặt trước để không bị quy tắc "bản mệnh" của PHẦN 1 bắt nhầm)
  if (/(lá số bản mệnh|luận giải bản mệnh|báo cáo.*bản mệnh)/.test(t) || /^(lá số|báo cáo)\b/.test(t)) return '🌸';
  if (/(mở đầu|lời ngỏ|lời mở)/.test(t)) return '✨';
  if (/\bphần\s*1\b/.test(t) || /(bản mệnh|hình dáng|tính cách|tướng mạo)/.test(t)) return '🌿';
  if (/\bphần\s*2\b/.test(t) || /(công việc|tài lộc|vận trình|sự nghiệp|tiền bạc)/.test(t)) return '💼';
  if (/\bphần\s*3\b/.test(t) || /(gia đạo|phối ngẫu|hôn nhân|người chồng|người vợ|tình duyên|vợ chồng)/.test(t)) return '💞';
  if (/\bphần\s*4\b/.test(t) || /(con cái|con của|đường con)/.test(t)) return '👥';
  if (/\bphần\s*5\b/.test(t) || /(nhà đất|điền sản|tài sản|bất động sản|nhà cửa)/.test(t)) return '🏡';
  if (/\bphần\s*6\b/.test(t) || /(bạn bè|quan hệ|xã hội)/.test(t)) return '🤝';
  if (/\bphần\s*7\b/.test(t) || /(vận hạn|đại vận|lưu niên|vận trình chi tiết)/.test(t)) return '🌌';
  if (/(lời kết|kết luận|đúc kết|lời nhắn|tổng kết)/.test(t)) return '💐';
  return '';
}

function decorateHeading(text: string): string {
  if (hasLeadingDecor(text)) return text; // đã có emoji từ Claude — giữ nguyên
  const emoji = headingEmoji(text);
  return emoji ? `${emoji} ${text}` : text;
}

/**
 * Bỏ "tật văn AI": gạch ngang dài "—" (em dash) rải khắp nơi thay cho dấu câu.
 * Tiêu đề → đổi thành ":" (giống "PHẦN 1: ..."); thân bài → đổi thành ", ".
 * Giữ nguyên gạch nối ngắn "–" (en dash) dùng cho khoảng năm (2026–2027).
 */
function softenDash(text: string, heading = false): string {
  let out: string;
  if (heading) {
    // Dấu "—" đầu tiên trong tiêu đề → ":", các dấu sau → ","
    let first = true;
    out = text.replace(/\s*—\s*/g, () => {
      if (first) {
        first = false;
        return ': ';
      }
      return ', ';
    });
  } else {
    out = text.replace(/\s*—\s*/g, ', ');
  }
  return out
    .replace(/::+/g, ':')
    .replace(/,\s*,/g, ',')
    .replace(/\s+([,:])/g, '$1');
}

function isTableRow(line: string): boolean {
  const t = line.trim();
  return t.startsWith('|') && t.lastIndexOf('|') > 0 && t.indexOf('|', 1) > 0;
}

function isTableSeparator(line: string): boolean {
  return /^\|?\s*:?-{2,}:?\s*(?:\|\s*:?-{2,}:?\s*)+\|?$/.test(line.trim());
}

function parseTableCells(line: string): string[] {
  let t = line.trim();
  if (t.startsWith('|')) t = t.slice(1);
  if (t.endsWith('|')) t = t.slice(0, -1);
  return t.split('|').map((cell) => cell.trim());
}

function contentTable(rows: string[][]): Table {
  const colCount = Math.max(...rows.map((r) => r.length));
  const colWidth = Math.round(9360 / colCount);
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: Array.from({ length: colCount }, () => colWidth),
    rows: rows.map((cells, rowIdx) => {
      const isHeader = rowIdx === 0;
      const padded = [...cells];
      while (padded.length < colCount) padded.push('');
      return new TableRow({
        tableHeader: isHeader,
        children: padded.map(
          (cell) =>
            new TableCell({
              width: { size: colWidth, type: WidthType.DXA },
              shading: isHeader ? { type: ShadingType.CLEAR, fill: PURPLE_SOFT } : undefined,
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 70, bottom: 70, left: 120, right: 120 },
              borders: cellBorders(),
              children: [
                paragraph(cell, {
                  bold: isHeader,
                  color: isHeader ? PURPLE_DARK : TEXT,
                  size: 21,
                  spacingAfter: 0,
                }),
              ],
            }),
        ),
      });
    }),
  });
}

function markdownToDocxChildren(markdown: string): (Paragraph | Table)[] {
  const text = stripInternalAnalysis(
    markdownToPlainText(markdown).replace(/\r\n/g, '\n'),
  )
    .replace(/^\s*(?:-{3,}|—{3,}|═{3,})\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!text) return [];

  const lines = text.split('\n');
  const children: (Paragraph | Table)[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    // Markdown table: header row followed by a separator row (|---|---|)
    if (isTableRow(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const header = parseTableCells(line);
      const body: string[][] = [];
      i += 2;
      while (i < lines.length && isTableRow(lines[i].trim()) && !isTableSeparator(lines[i].trim())) {
        body.push(parseTableCells(lines[i].trim()));
        i += 1;
      }
      children.push(contentTable([header, ...body]));
      children.push(emptyLine());
      continue;
    }

    if (!line) {
      i += 1;
      continue;
    }

    if (isMajorHeading(line)) {
      // Giữ emoji Claude đã đặt; nếu chưa có thì tự gắn emoji chủ đề.
      const heading = hasLeadingDecor(line)
        ? line.replace(/^#{1,6}\s+/, '').trim()
        : decorateHeading(normalizeHeading(line));
      children.push(subTitle(softenDash(heading, true)));
    } else if (/^[•*-]\s+/.test(line)) {
      children.push(
        paragraph(softenDash(line.replace(/^[•*-]\s+/, '')), {
          size: 23,
          spacingAfter: 90,
          indentLeft: 360,
        }),
      );
    } else {
      children.push(paragraph(softenDash(line), { size: 24, spacingAfter: 140 }));
    }
    i += 1;
  }
  return children;
}

function cleanProseMode(packages: PackageType[], finalContent: string): boolean {
  return packages.length === 1 && packages[0] === 'maiHoa' && !finalContent.trim();
}

// ===== Hỗ trợ layout "bản mệnh hợp nhất" (Kinh Dịch + Bát Tự thành 1 bài) =====

/** Tách phần "lời kết / đúc kết" ra khỏi thân bài. */
function splitLoiKet(text: string): { body: string; loiket: string } {
  const lines = text.split('\n');
  const re = /^[★☆✦✧❖◆◇●○»→\s🌸🌿💼💞👥🏡🤝🌌💐]*(?:lời\s*kết|đúc\s*kết|lời\s*nhắn)/i;
  for (let i = 0; i < lines.length; i++) {
    if (re.test(lines[i].trim())) {
      return { body: lines.slice(0, i).join('\n').trim(), loiket: lines.slice(i).join('\n').trim() };
    }
  }
  return { body: text.trim(), loiket: '' };
}

/** Bỏ dòng tiêu đề lớn (🌸 / "LUẬN GIẢI BẢN MỆNH" / "LÁ SỐ BÁT TỰ"…) ở đầu. */
function stripLeadingTitle(text: string): string {
  const lines = text.split('\n');
  while (lines.length && !lines[0].trim()) lines.shift();
  if (lines.length) {
    const t = lines[0].trim();
    if (
      hasLeadingDecor(t) ||
      /(luận giải|lá số|báo cáo)[^\n]*(bản mệnh|bát tự|kinh dịch|tứ trụ)/i.test(t)
    ) {
      lines.shift();
    }
  }
  return lines.join('\n').trim();
}

/** Bỏ lời chào mở đầu ("Chào chị …, " / "Kính chào …"). */
function stripGreeting(text: string): string {
  return text.replace(/^\s*(?:kính\s+)?chào\s+(?:chị|anh|cô|chú|bạn|ông|bà)[^.\n]*[.,]\s*/i, '').trimStart();
}

/** Bỏ chữ ký/cụm kết ở cuối (Thương mến, Bùi Linh Tường Vân, Chuyên gia phong thủy). */
function stripSignature(text: string): string {
  const lines = text.split('\n');
  while (lines.length) {
    const last = lines[lines.length - 1].trim();
    if (!last || /^(thương mến|trân trọng|kính bút|bùi linh tường vân|chuyên gia phong th)/i.test(last)) {
      lines.pop();
      continue;
    }
    break;
  }
  return lines.join('\n').trim();
}

function ensureTitle(children: (Paragraph | Table)[], body: string, fullName: string): void {
  const first = body.split('\n').map((l) => l.trim()).find(Boolean) ?? '';
  const hasTitle = hasLeadingDecor(first) || /(luận giải bản mệnh|lá số bản mệnh|báo cáo)/i.test(first);
  if (!hasTitle) {
    children.push(
      paragraph(`🌸 LUẬN GIẢI BẢN MỆNH – ${fullName.toLocaleUpperCase('vi-VN')} 🌸`, {
        bold: true,
        color: PURPLE_DARK,
        size: 30,
        alignment: AlignmentType.CENTER,
        spacingAfter: 220,
      }),
    );
  }
}

function imageType(data: Buffer): 'jpg' | 'png' {
  if (data[0] === 0xff && data[1] === 0xd8) return 'jpg';
  return 'png';
}

function imageParagraph(filePath: string): Paragraph | null {
  if (!fs.existsSync(filePath)) return null;
  const data = fs.readFileSync(filePath);
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 80, after: 220 },
    children: [
      new ImageRun({
        type: imageType(data),
        data,
        transformation: { width: 520, height: 360 },
      }),
    ],
  });
}

function packageScope(packages: PackageType[]): string {
  return ORDER.filter((pkg) => packages.includes(pkg))
    .map((pkg) => PACKAGE_LABELS[pkg])
    .join(' & ');
}

function reportTitle(packages: PackageType[]): string {
  const hasTuTru = packages.includes('tuTru');
  const hasMaiHoa = packages.includes('maiHoa');
  const hasSim = packages.includes('sim');
  if (hasTuTru && hasMaiHoa && hasSim) return 'BÁO CÁO PHONG THỦY BÁT TỰ, KINH DỊCH & SIM CHUYÊN SÂU';
  if (hasTuTru && hasMaiHoa) return 'BÁO CÁO PHONG THỦY BÁT TỰ & KINH DỊCH CHUYÊN SÂU';
  if (hasTuTru) return 'BÁO CÁO PHONG THỦY BÁT TỰ CHUYÊN SÂU';
  if (hasMaiHoa) return 'BÁO CÁO PHONG THỦY KINH DỊCH CHUYÊN SÂU';
  if (hasSim) return 'BÁO CÁO PHONG THỦY SIM CHUYÊN SÂU';
  return 'BÁO CÁO PHONG THỦY CHUYÊN SÂU';
}

function birthInfo(customer: CustomerInfo): string {
  return `${String(customer.day).padStart(2, '0')}/${String(customer.month).padStart(2, '0')}/${customer.year}${customer.isLunar ? ' (Âm lịch)' : ''}`;
}

function hourInfo(customer: CustomerInfo): string {
  if (customer.hour === null) return 'Không rõ';
  return `${String(customer.hour).padStart(2, '0')}:${String(customer.minute ?? 0).padStart(2, '0')}`;
}

export async function generateDocx(input: GenerateDocxInput): Promise<GenerateDocxResult> {
  const { readingId, customer, analyses, finalContent, cost, screenshotPaths, provider, createdAt } = input;
  const packages = customer.packages;
  const orderedAnalyses = ORDER.map((pkg) => analyses.find((analysis) => analysis.type === pkg)).filter(
    (analysis): analysis is GeminiAnalysis => Boolean(analysis),
  );
  const cleanProse = cleanProseMode(packages, finalContent);

  const children: (Paragraph | Table)[] = [];

  if (cleanProse) {
    const onlyAnalysis = orderedAnalyses[0];
    if (onlyAnalysis) {
      const imgPath = screenshotPaths?.[onlyAnalysis.type];
      const img = imgPath ? imageParagraph(imgPath) : null;
      if (img) children.push(img, emptyLine());

      const formatted = formatByType(onlyAnalysis.type, onlyAnalysis.analysis);
      // Nếu Claude chưa tự viết tiêu đề lớn ở đầu, tự chèn tiêu đề 🌸.
      const firstLine = formatted.split('\n').map((l) => l.trim()).find(Boolean) ?? '';
      const hasTitle =
        hasLeadingDecor(firstLine) ||
        /(luận giải bản mệnh|lá số bản mệnh|báo cáo|luận giải kinh dịch)/i.test(firstLine);
      if (!hasTitle) {
        children.push(
          paragraph(`🌸 LUẬN GIẢI BẢN MỆNH KINH DỊCH – ${customer.fullName.toLocaleUpperCase('vi-VN')} 🌸`, {
            bold: true,
            color: PURPLE_DARK,
            size: 30,
            alignment: AlignmentType.CENTER,
            spacingAfter: 220,
          }),
        );
      }
      children.push(...markdownToDocxChildren(formatted));
    }
  } else if (
    packages.includes('maiHoa') &&
    packages.includes('tuTru') &&
    !finalContent.trim()
  ) {
    // ===== Layout HỢP NHẤT: 1 bài liền mạch, Bát Tự là PHẦN 8 (như bản mẫu) =====
    const maiHoa = orderedAnalyses.find((a) => a.type === 'maiHoa');
    const tuTru = orderedAnalyses.find((a) => a.type === 'tuTru');
    const sim = orderedAnalyses.find((a) => a.type === 'sim');

    // Ảnh quẻ ở đầu
    for (const a of [maiHoa, tuTru, sim]) {
      if (!a) continue;
      const ip = screenshotPaths?.[a.type];
      const img = ip ? imageParagraph(ip) : null;
      if (img) children.push(img, emptyLine());
    }

    // Kinh Dịch: thân bài (giữ tiêu đề + lời chào + PHẦN 1-7), tách lời kết để dồn xuống cuối
    const kd = splitLoiKet(formatByType('maiHoa', maiHoa!.analysis));
    ensureTitle(children, kd.body, customer.fullName);
    children.push(...markdownToDocxChildren(kd.body));

    // PHẦN 8: BÁT TỰ (bỏ tiêu đề + lời chào + chữ ký + lời kết riêng của bài Bát Tự)
    const btBody = stripSignature(stripGreeting(stripLeadingTitle(splitLoiKet(formatByType('tuTru', tuTru!.analysis)).body)));
    children.push(emptyLine(), sectionTitle('🎋 PHẦN 8: BÁT TỰ CHUYÊN SÂU'));
    children.push(...markdownToDocxChildren(btBody));

    // Sim (nếu có) → PHẦN 9
    if (sim) {
      const simBody = stripSignature(stripGreeting(stripLeadingTitle(splitLoiKet(formatByType('sim', sim.analysis)).body)));
      children.push(emptyLine(), sectionTitle('📱 PHẦN 9: SIM PHONG THỦY'));
      children.push(...markdownToDocxChildren(simBody));
    }

    // Một LỜI KẾT duy nhất ở cuối (ưu tiên lời kết của Kinh Dịch)
    const loiket = kd.loiket || splitLoiKet(formatByType('tuTru', tuTru!.analysis)).loiket;
    children.push(emptyLine());
    if (loiket) {
      children.push(...markdownToDocxChildren(loiket));
    } else {
      children.push(
        paragraph('Thương mến,', { italics: true, size: 24, spacingBefore: 220 }),
        paragraph('Bùi Linh Tường Vân', { bold: true, color: PURPLE_DARK, size: 26, spacingAfter: 40 }),
        paragraph('Chuyên gia phong thủy', { italics: true, color: MUTED, size: 22 }),
      );
    }
  } else {
    children.push(
      paragraph(`🪷 ${reportTitle(packages)}`, {
        bold: true,
        color: PURPLE,
        size: 36,
        alignment: AlignmentType.CENTER,
        spacingAfter: 200,
      }),
      paragraph(customer.fullName, {
        bold: true,
        italics: true,
        color: MUTED,
        size: 28,
        alignment: AlignmentType.CENTER,
        spacingAfter: 240,
      }),
      metaTable([
        ['Họ và tên', customer.fullName],
        ['Ngày sinh', birthInfo(customer)],
        ['Giờ sinh', hourInfo(customer)],
        ['Giới tính', customer.gender === 'male' ? 'Nam' : 'Nữ'],
        ['Nội dung', packageScope(packages)],
        ...(customer.phoneNumber ? ([['Số điện thoại', customer.phoneNumber]] as [string, string][]) : []),
        ...(customer.question ? ([['Việc cần xem', customer.question]] as [string, string][]) : []),
        ...(customer.addressing ? ([['Cách xưng hô', customer.addressing]] as [string, string][]) : []),
        ['Thời điểm tạo', createdAt.toLocaleString('vi-VN')],
        ['Model AI', provider === 'gemini' ? 'Google Gemini' : 'Anthropic Claude'],
        ...(cost ? ([['Chi phí AI', `${cost.vnd.toLocaleString('vi-VN')}đ`]] as [string, string][]) : []),
      ]),
      emptyLine(),
    );

    for (const analysis of orderedAnalyses) {
      const imgPath = screenshotPaths?.[analysis.type];
      if (!imgPath) continue;
      const img = imageParagraph(imgPath);
      if (!img) continue;
      children.push(sectionTitle(CHART_TITLE[analysis.type]), img, emptyLine());
    }

    children.push(new Paragraph({ children: [new PageBreak()] }));

    if (finalContent.trim()) {
      children.push(sectionTitle('🧭 PHẦN I: TỔNG HỢP CHUNG'));
      children.push(...markdownToDocxChildren(finalContent));
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }

    const startIndex = finalContent.trim() ? 2 : 1;
    orderedAnalyses.forEach((analysis, index) => {
      children.push(sectionTitle(`PHẦN ${toRoman(startIndex + index)}: ${PACKAGE_TITLE[analysis.type]}`));
      children.push(...markdownToDocxChildren(formatByType(analysis.type, analysis.analysis)));
      if (index < orderedAnalyses.length - 1) {
        children.push(new Paragraph({ children: [new PageBreak()] }));
      }
    });

    children.push(
      emptyLine(),
      paragraph('Thương mến,', { italics: true, size: 24, spacingBefore: 220 }),
      paragraph('Bùi Linh Tường Vân', { bold: true, color: PURPLE_DARK, size: 26, spacingAfter: 40 }),
      paragraph('Chuyên gia phong thủy', { italics: true, color: MUTED, size: 22 }),
    );
  }

  const doc = new Document({
    creator: 'Bùi Linh Tường Vân',
    title: reportTitle(packages),
    styles: {
      default: {
        document: {
          run: { font: FONT, size: 24, color: TEXT },
          paragraph: { spacing: { line: 320, after: 120 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 900, right: 900, bottom: 900, left: 900 },
          },
        },
        headers: cleanProse
          ? undefined
          : {
              default: new Header({
                children: [
                  paragraph('Bùi Linh Tường Vân - Chuyên gia phong thủy', {
                    alignment: AlignmentType.RIGHT,
                    color: MUTED,
                    size: 18,
                    spacingAfter: 0,
                  }),
                ],
              }),
            },
        footers: cleanProse
          ? undefined
          : {
              default: new Footer({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({ text: 'Trang ', font: FONT, size: 18, color: MUTED }),
                      new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 18, color: MUTED }),
                    ],
                  }),
                ],
              }),
            },
        children,
      },
    ],
  });

  const safeName = safeFileName(customer.fullName);
  const stamp = createdAt.toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const fileName = `BaoCao_${safeName}_${stamp}.docx`;
  const filePath = path.join(EXPORTS_DIR, `${readingId}.docx`);
  await fs.promises.writeFile(filePath, await Packer.toBuffer(doc));

  const publicOrigin =
    process.env.PUBLIC_BACKEND_URL ?? `http://localhost:${process.env.PORT ?? 4000}`;
  return {
    filePath,
    fileName,
    url: `${publicOrigin}/api/exports/${readingId}.docx`,
  };
}

function toRoman(num: number): string {
  const map: [number, string][] = [
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let result = '';
  let n = num;
  for (const [value, roman] of map) {
    while (n >= value) {
      result += roman;
      n -= value;
    }
  }
  return result;
}

export function docxPathFor(readingId: string): string {
  return path.join(EXPORTS_DIR, `${readingId}.docx`);
}

export function docxExists(readingId: string): boolean {
  return fs.existsSync(docxPathFor(readingId));
}
