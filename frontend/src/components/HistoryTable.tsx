'use client';

import { RefreshCw, Search, Sparkles, Eye, SlidersHorizontal, Plus, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Fragment, useCallback, useEffect, useState } from 'react';

interface HistoryRow {
  id: string;
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

interface HistoryTableProps {
  refreshSignal: number;
}

function formatTimestamp(iso: string): { date: string; time: string } {
  if (!iso) return { date: '', time: '' };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: iso, time: '' };
  return {
    date: d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    time: d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
  };
}

function parsePackages(packages: string): string[] {
  return packages
    .split(',')
    .map((pkg) => {
      const raw = pkg.trim();
      if (!raw) return '';
      if (raw.includes('Bát Tự') || raw.includes('Tứ Trụ') || raw.toLowerCase() === 'tutru')
        return 'Bát tự';
      if (raw.includes('Kinh Dịch') || raw.includes('Mai Hoa') || raw.toLowerCase() === 'maihoa')
        return 'Kinh dịch';
      if (raw.includes('Sim') || raw.toLowerCase() === 'sim')
        return 'Sim';
      return raw.slice(0, 8);
    })
    .filter(Boolean);
}

function PackageChips({ packages }: { packages: string }) {
  const chips = parsePackages(packages);
  return (
    <div className="flex gap-1.5 flex-wrap">
      {chips.map((chip, i) => (
        <span
          key={i}
          className="inline-flex items-center rounded-md bg-[#EEF5F1] text-[#1D4D3F] px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap"
        >
          {chip}
        </span>
      ))}
    </div>
  );
}

function summaryPreview(synthesis: string): string {
  return (
    synthesis
      .replace(/^#+\s*/gm, '')
      .split('\n')
      .find((l) => l.trim() && !l.startsWith('═') && !l.startsWith('─'))
      ?.trim() ?? ''
  );
}

function getInitials(name: string) {
  if (!name) return 'KH';
  const cleanName = name.trim().replace(/\s+/g, ' ');
  const words = cleanName.split(' ');
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
  if (words.length === 2) return (words[0][0] + words[1][0]).toUpperCase();
  return (words[0][0] + words[1][0] + words[words.length - 1][0]).toUpperCase().slice(0, 3);
}

export function HistoryTable({ refreshSignal }: HistoryTableProps) {
  const t = useTranslations('history');
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState<string>('');
  const [expanded, setExpanded] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const h = setTimeout(() => { setDebouncedSearch(searchTerm); setPage(1); }, 300);
    return () => clearTimeout(h);
  }, [searchTerm]);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const res = await fetch(
        `/api/history?page=${page}&pageSize=${pageSize}&search=${encodeURIComponent(debouncedSearch)}`,
        { cache: 'no-store' },
      );
      const body = (await res.json()) as { rows?: HistoryRow[]; total?: number; totalPages?: number; error?: string };
      if (!res.ok || body.error) { setError(body.error ?? `HTTP ${res.status}`); setState('error'); return; }
      setRows(body.rows ?? []);
      setTotal(body.total ?? 0);
      setTotalPages(body.totalPages ?? 1);
      setState('idle');
      setExpanded(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'fetch failed');
      setState('error');
    }
  }, [page, pageSize, debouncedSearch]);

  useEffect(() => { void load(); }, [load, refreshSignal]);
  useEffect(() => { setPage(1); setSearchTerm(''); }, [refreshSignal]);

  const colSpanCount = 9;

  const handleCreateNew = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getGenderTextWithIcon = (genderVal: string) => {
    const clean = genderVal.trim().toLowerCase();
    if (clean.includes('nam') || clean === 'male') return '♂ Nam';
    if (clean.includes('nữ') || clean === 'female') return '♀ Nữ';
    return '⚧ Khác';
  };

  return (
    <section className="flex flex-col gap-5 mt-6">

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-xl font-bold text-[#0C1F19]">
            Lịch sử luận giải
          </h2>
          <p className="text-xs text-text-tertiary">
            Tất cả khách hàng đã được luận giải — lưu trong hệ thống
          </p>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto flex-wrap sm:flex-nowrap">
          {/* Search Input */}
          <div className="relative flex-1 sm:flex-none">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm theo tên, SĐT..."
              className="h-9 w-full sm:w-60 rounded-lg border border-[#E5E7EB] bg-white pl-3.5 pr-9 text-xs text-[#1A1F36] placeholder:text-[#98A2B3] focus:border-[#1D4D3F] focus:outline-none transition-all"
            />
            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#98A2B3]" />
          </div>

          {/* Filter Button */}
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 text-xs font-semibold text-[#475467] hover:bg-gray-50 hover:text-[#1D4D3F] transition-all cursor-pointer"
          >
            <SlidersHorizontal size={13} />
            <span>Bộ lọc</span>
          </button>

          {/* Add New Button */}
          <button
            type="button"
            onClick={handleCreateNew}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1D4D3F] hover:bg-[#153A2F] px-3.5 text-xs font-semibold text-white transition-all cursor-pointer shadow-sm"
          >
            <Plus size={14} strokeWidth={2.5} />
            <span>Tạo mới</span>
          </button>
        </div>
      </div>

      {/* ── Mobile card layout (< 640 px) ── */}
      <div className="flex flex-col gap-2.5 sm:hidden">
        {state === 'loading' && rows.length === 0 && (
          <div className="flex justify-center py-12 text-gray-400">
            <RefreshCw size={20} className="animate-spin" />
          </div>
        )}
        {state === 'error' && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">
            {t('error')}: {error}
          </div>
        )}
        {state === 'idle' && rows.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-12 text-center text-sm text-gray-400">
            {t('empty')}
          </div>
        )}
        {rows.map((r, i) => {
          const isOpen = expanded === i;
          const preview = summaryPreview(r.summary);
          return (
            <div key={i} className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.01)]">
              <button
                type="button"
                className="w-full text-left px-4 pt-3.5 pb-3 border-0 bg-transparent cursor-pointer"
                onClick={() => setExpanded(isOpen ? null : i)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EEF5F1] text-[#1D4D3F] font-bold text-xs">
                      {getInitials(r.fullName)}
                    </div>
                    <div className="flex flex-col leading-tight min-w-0">
                      <span className="font-bold text-sm text-[#1A1F36] truncate">{r.fullName}</span>
                      {r.phoneNumber && (
                        <span className="text-[11px] text-[#667085] font-mono mt-0.5">{r.phoneNumber}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0 pt-0.5">
                    <PackageChips packages={r.packages} />
                    {r.cost && (
                      <span className="text-[11px] font-bold text-[#1D4D3F]">
                        {Number(r.cost).toLocaleString('vi-VN')}đ
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 mt-2.5 text-[11px] text-[#667085]">
                  <span>{r.birthDate}</span>
                  {r.birthHour && <span className="font-medium">{r.birthHour}</span>}
                  <span>{getGenderTextWithIcon(r.gender)}</span>
                </div>

                {preview && (
                  <p className="mt-2 text-[11px] text-gray-500 line-clamp-1 truncate">{preview}</p>
                )}

                <div className="flex items-center justify-end gap-2 mt-3 pt-2.5 border-t border-gray-100">
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-[#1D4D3F]">
                    {isOpen ? '▲ Đóng chi tiết' : '▼ Xem chi tiết'}
                  </span>
                </div>
              </button>
              {isOpen && (
                <div className="border-t border-gray-100 px-4 py-4">
                  <DetailPanel row={r} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Desktop / tablet table (≥ 640 px) ── */}
      <div className="hidden sm:block overflow-hidden rounded-xl border border-[#E5E7EB] bg-white shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] border-collapse table-fixed">
            <thead>
              <tr className="border-b border-[#EAECF0] bg-[#FAFBFB]">
                {[
                  { label: 'Khách hàng', w: 'w-48 text-left pl-5' },
                  { label: 'Số điện thoại', w: 'w-32 text-left' },
                  { label: 'Ngày sinh', w: 'w-28 text-left' },
                  { label: 'Giờ sinh', w: 'w-20 text-left' },
                  { label: 'Giới tính', w: 'w-24 text-left' },
                  { label: 'Gói dịch vụ', w: 'w-44 text-left' },
                  { label: 'Chi phí', w: 'w-24 text-left' },
                  { label: 'Thời gian tạo', w: 'w-32 text-left' },
                  { label: 'Thao tác', w: 'w-20 text-center' },
                ].map((c) => (
                  <th
                    key={c.label}
                    className={`px-3 py-3 text-[11px] font-bold uppercase tracking-wider text-[#667085] ${c.w}`}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAECF0]">
              {state === 'loading' && rows.length === 0 && (
                <tr>
                  <td colSpan={colSpanCount} className="px-4 py-14 text-center">
                    <div className="flex flex-col items-center gap-2 text-[#98A2B3]">
                      <RefreshCw size={20} className="animate-spin" />
                      <span className="text-xs">{t('loading')}</span>
                    </div>
                  </td>
                </tr>
              )}
              {state === 'error' && (
                <tr>
                  <td colSpan={colSpanCount} className="px-4 py-14 text-center text-xs text-red-500">
                    {t('error')}: {error}
                  </td>
                </tr>
              )}
              {state === 'idle' && rows.length === 0 && (
                <tr>
                  <td colSpan={colSpanCount} className="px-4 py-14 text-center text-sm text-[#98A2B3]">
                    {t('empty')}
                  </td>
                </tr>
              )}

              {rows.map((r, i) => {
                const isOpen = expanded === i;
                const { date, time } = formatTimestamp(r.timestamp);
                return (
                  <Fragment key={i}>
                    <tr
                      className={`transition-colors duration-150 ${
                        isOpen ? 'bg-[#EEF5F1]/10' : 'hover:bg-gray-50/40'
                      }`}
                    >
                      {/* KHÁCH HÀNG */}
                      <td className="w-48 text-left pl-5 py-3.5 align-middle">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EEF5F1] text-[#1D4D3F] font-bold text-xs">
                            {getInitials(r.fullName)}
                          </div>
                          <span className="font-bold text-sm text-[#1A1F36] truncate">{r.fullName}</span>
                        </div>
                      </td>

                      {/* SỐ ĐIỆN THOẠI */}
                      <td className="w-32 text-left py-3.5 text-xs font-semibold text-[#1A1F36] align-middle font-mono">
                        {r.phoneNumber || '—'}
                      </td>

                      {/* NGÀY SINH */}
                      <td className="w-28 text-left py-3.5 text-xs font-semibold text-[#1A1F36] align-middle">{r.birthDate}</td>

                      {/* GIỜ */}
                      <td className="w-20 text-left py-3.5 text-xs font-semibold text-[#1A1F36] align-middle">{r.birthHour || '—'}</td>

                      {/* GIỚI TÍNH */}
                      <td className="w-24 text-left py-3.5 text-xs font-semibold text-[#1A1F36] align-middle">{getGenderTextWithIcon(r.gender)}</td>

                      {/* GÓI */}
                      <td className="w-44 text-left py-3.5 align-middle">
                        <PackageChips packages={r.packages} />
                      </td>

                      {/* CHI PHÍ */}
                      <td className="w-24 text-left py-3.5 align-middle">
                        {r.cost ? (
                          <span className="text-xs font-bold text-[#1D4D3F] tabular-nums">
                            {Number(r.cost).toLocaleString('vi-VN')}đ
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>

                      {/* THỜI GIAN TẠO */}
                      <td className="w-32 text-left py-3.5 text-xs text-[#525866] align-middle">
                        <div className="flex flex-col leading-snug">
                          <span className="font-medium">{date}</span>
                          <span className="text-[10px] text-[#8A93A6] mt-0.5">{time}</span>
                        </div>
                      </td>

                      {/* THAO TÁC */}
                      <td className="w-20 text-center py-3.5 align-middle">
                        <div className="flex items-center justify-center">
                          <button
                            type="button"
                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#3B82F6]/20 bg-[#EFF6FF] text-[#3B82F6] hover:bg-[#3B82F6] hover:text-white transition-all cursor-pointer shadow-sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpanded(isOpen ? null : i);
                            }}
                          >
                            <Eye size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {isOpen && (
                      <tr>
                        <td colSpan={colSpanCount} className="px-5 py-5 bg-[#FAFBFB] border-b border-[#EAECF0]">
                          <DetailPanel row={r} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Footer */}
      {total > 0 && (
        <div className="flex items-center justify-between gap-3 mt-1.5">
          {/* Page Size selector */}
          <div className="flex items-center gap-2 text-xs text-[#667085]">
            <span>Hiển thị</span>
            <div className="relative">
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="h-8 cursor-pointer rounded-lg border border-[#E5E7EB] bg-white px-2.5 pr-7 text-xs text-[#475467] font-semibold focus:border-[#1D4D3F] focus:outline-none appearance-none"
              >
                {[10, 20, 50, 100].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#667085] pointer-events-none" />
            </div>
            <span>/ trang</span>
          </div>

          {/* Page numbers */}
          <div className="flex items-center gap-1">
            <PageBtn onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1 || state === 'loading'}>
              <ChevronLeft size={14} />
            </PageBtn>
            {getPageNumbers(page, totalPages).map((p, idx) =>
              p === '…' ? (
                <span key={`gap-${idx}`} className="px-1.5 text-xs text-gray-300">…</span>
              ) : (
                <PageBtn
                  key={p}
                  onClick={() => setPage(p as number)}
                  disabled={state === 'loading'}
                  active={p === page}
                >
                  {p}
                </PageBtn>
              ),
            )}
            <PageBtn onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages || state === 'loading'}>
              <ChevronRight size={14} />
            </PageBtn>
          </div>
        </div>
      )}
    </section>
  );
}

function PageBtn({
  children,
  onClick,
  disabled,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold transition-colors disabled:opacity-30 disabled:cursor-not-allowed border-0 cursor-pointer ${
        active
          ? 'bg-[#1D4D3F] text-white shadow-sm'
          : 'bg-white text-[#475467] hover:bg-gray-50 border border-[#E5E7EB]'
      }`}
    >
      {children}
    </button>
  );
}

function getPageNumbers(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set<number>([1, total, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  for (let i = 0; i < sorted.length; i++) {
    out.push(sorted[i]);
    if (i < sorted.length - 1 && sorted[i + 1] - sorted[i] > 1) out.push('…');
  }
  return sorted;
}

function DetailPanel({ row }: { row: HistoryRow }) {
  const t = useTranslations('history');
  type Tab = 'tuTru' | 'maiHoa' | 'sim' | 'summary';
  const tabs = [
    { key: 'tuTru', label: t('tabTuTru'), color: 'emerald', analysis: row.analysisTuTru, img: row.imgTuTru },
    { key: 'maiHoa', label: t('tabMaiHoa'), color: 'emerald', analysis: row.analysisMaiHoa, img: row.imgMaiHoa },
    { key: 'sim', label: t('tabSim'), color: 'emerald', analysis: row.analysisSim, img: row.imgSim },
    { key: 'summary', label: t('tabSummary'), color: 'emerald', analysis: row.summary, img: '' },
  ].filter((tab) => Boolean(tab.analysis)) as {
    key: Tab;
    label: string;
    color: string;
    analysis: string;
    img: string;
  }[];
  const initialTab: Tab = tabs[0]?.key ?? 'summary';
  const [active, setActive] = useState<Tab>(initialTab);
  const current = tabs.find((tab) => tab.key === active) ?? tabs[0];

  return (
    <div className="flex flex-col gap-3">
      {/* Tab bar */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-gray-200 pb-2.5">
        {tabs.length === 0 ? (
          <p className="text-xs text-gray-400 italic">{t('emptyPackage')}</p>
        ) : tabs.map((tab) => {
          const isActive = active === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={(e) => { e.stopPropagation(); setActive(tab.key); }}
              className={`rounded-lg border px-3 py-1 text-xs font-semibold transition-all border-0 cursor-pointer ${
                isActive
                  ? 'bg-[#EEF5F1] text-[#1D4D3F]'
                  : 'bg-white text-gray-500 border border-[#E5E7EB] hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {current && <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_260px]">
        <div className="flex flex-col gap-2">
          <span className="text-[11px] font-semibold text-gray-500">
            {t('contentLabel', { label: current.label })}
          </span>
          <div className="max-h-[55vh] overflow-y-auto rounded-lg border border-[#E5E7EB] bg-white p-4">
            {current.analysis ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#1A1F36]">
                {current.analysis}
              </p>
            ) : (
              <p className="text-xs text-gray-400 italic">{t('emptyPackage')}</p>
            )}
          </div>
        </div>

        {current.img && current.key !== 'summary' && (
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold text-gray-500">
              {t('imageLabel')}
            </span>
            <a
              href={current.img}
              target="_blank"
              rel="noopener noreferrer"
              className="block overflow-hidden rounded-lg border border-gray-200 hover:border-indigo-400 transition-colors"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={current.img} alt={current.label} className="w-full object-cover" loading="lazy" />
            </a>
            <span className="text-[10px] text-gray-400 text-center">{t('imageHint')}</span>
          </div>
        )}
      </div>}
    </div>
  );
}
