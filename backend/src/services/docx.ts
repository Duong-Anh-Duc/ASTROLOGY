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
import { formatByType, markdownToPlainText, PACKAGE_LABELS } from './xlsx';

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
  tuTru: 'BÁT TỰ CHUYÊN SÂU',
  maiHoa: 'LUẬN GIẢI KINH DỊCH',
  sim: 'SIM PHONG THỦY',
};

const CHART_TITLE: Record<PackageType, string> = {
  tuTru: 'LÁ SỐ BÁT TỰ',
  maiHoa: 'LÁ SỐ KINH DỊCH',
  sim: 'LÁ SỐ SIM PHONG THỦY',
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

function isMajorHeading(line: string): boolean {
  const clean = line.trim();
  return (
    /^PHẦN\s+[IVXLC\d]+[:.]/i.test(clean) ||
    /^\d+\.\s+[A-ZÀ-Ỹ0-9 ,&/-]{6,}$/.test(clean) ||
    /^#{1,3}\s+/.test(clean) ||
    /^═{2,}\s*.+\s*═{2,}$/.test(clean) ||
    /^—\s*.+\s*—$/.test(clean)
  );
}

function normalizeHeading(line: string): string {
  return line
    .replace(/^#{1,6}\s+/, '')
    .replace(/^═+\s*/, '')
    .replace(/\s*═+$/, '')
    .replace(/^—\s*/, '')
    .replace(/\s*—$/, '')
    .trim();
}

function markdownToDocxChildren(markdown: string): Paragraph[] {
  const text = markdownToPlainText(markdown)
    .replace(/\r\n/g, '\n')
    .replace(/^\s*(?:-{3,}|—{3,}|═{3,})\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!text) return [];

  const blocks = text.split(/\n{2,}/);
  const children: Paragraph[] = [];
  for (const block of blocks) {
    const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);
    if (!lines.length) continue;

    if (lines.length === 1 && isMajorHeading(lines[0])) {
      children.push(subTitle(normalizeHeading(lines[0])));
      continue;
    }

    for (const line of lines) {
      if (isMajorHeading(line)) {
        children.push(subTitle(normalizeHeading(line)));
      } else if (/^[•*-]\s+/.test(line)) {
        children.push(
          paragraph(line.replace(/^[•*-]\s+/, ''), {
            size: 23,
            spacingAfter: 90,
            indentLeft: 360,
          }),
        );
      } else {
        children.push(paragraph(line, { size: 24, spacingAfter: 140 }));
      }
    }
  }
  return children;
}

function cleanProseMode(packages: PackageType[], finalContent: string): boolean {
  return packages.length === 1 && packages[0] === 'maiHoa' && !finalContent.trim();
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
      children.push(...markdownToDocxChildren(formatByType(onlyAnalysis.type, onlyAnalysis.analysis)));
    }
  } else {
    children.push(
      paragraph(reportTitle(packages), {
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
      children.push(sectionTitle('PHẦN I: TỔNG HỢP CHUNG'));
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
