'use client';

import { Download, RefreshCw, Sparkles } from 'lucide-react';
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
  xlsxUrl: string | null;
}

interface HistoryTableProps {
  refreshSignal: number;
}

function formatTimestamp(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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

  // Debounce the search term to avoid hammering API
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1); // Reset to page 1 on new search
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const res = await fetch(
        `/api/history?page=${page}&pageSize=${pageSize}&search=${encodeURIComponent(debouncedSearch)}`,
        {
          cache: 'no-store',
        }
      );
      const body = (await res.json()) as {
        rows?: HistoryRow[];
        total?: number;
        totalPages?: number;
        error?: string;
      };
      if (!res.ok || body.error) {
        setError(body.error ?? 'HTTP ' + res.status);
        setState('error');
        return;
      }
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

  useEffect(() => {
    void load();
  }, [load, refreshSignal]);

  // When a new run happens (refreshSignal change), jump back to page 1 and clear search
  useEffect(() => {
    setPage(1);
    setSearchTerm('');
  }, [refreshSignal]);

  const cols: { key: keyof HistoryRow | 'stt' | 'images' | 'download'; label: string; width: string }[] = [
    { key: 'stt', label: 'STT', width: 'w-[60px]' },
    { key: 'timestamp', label: t('colTime'), width: 'w-[150px]' },
    { key: 'fullName', label: t('colName'), width: 'w-[180px]' },
    { key: 'birthDate', label: t('colBirth'), width: 'w-[110px]' },
    { key: 'birthHour', label: t('colHour'), width: 'w-[75px]' },
    { key: 'gender', label: t('colGender'), width: 'w-[90px]' },
    { key: 'phoneNumber', label: t('colPhone'), width: 'w-[130px]' },
    { key: 'packages', label: t('colPackages'), width: 'w-[180px]' },
    { key: 'cost', label: 'Chi phí', width: 'w-[100px]' },
    { key: 'download', label: 'Excel', width: 'w-[90px]' },
    { key: 'summary', label: 'Xem chi tiết', width: 'w-auto' },
  ];

  return (
    <section className="flex flex-col gap-4 mt-4">
      {/* Table Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-lg font-bold tracking-wide text-[#1A1F36] flex items-center gap-2">
            <Sparkles size={16} className="text-accent-gold" />
            {t('title')}
          </h2>
          <p className="text-xs text-text-tertiary">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm theo họ tên, sđt..."
              className="h-9 w-64 rounded-xl border border-gray-200 bg-[#F7F8FC] pl-9 pr-3 text-xs text-[#1A1F36] placeholder:text-gray-400 focus:border-indigo-300 focus:bg-white focus:outline-none transition-all duration-200 shadow-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={state === 'loading'}
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-xs font-semibold text-gray-700 transition-all duration-200 hover:bg-gray-50 active:scale-95 disabled:opacity-50 shadow-sm"
          >
            <RefreshCw
              size={13}
              className={`text-gray-500 ${state === 'loading' ? 'animate-spin' : ''}`}
            />
            {t('refresh')}
          </button>
        </div>
      </div>

      {/* Responsive Table Wrapper */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
                {cols.map((c) => (
                  <th
                    key={c.key}
                    className={`${c.width} px-4 py-3.5 font-semibold text-gray-600`}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {state === 'loading' && rows.length === 0 && (
                <tr>
                  <td
                    colSpan={cols.length}
                    className="px-4 py-16 text-center text-sm text-text-tertiary"
                  >
                    <div className="flex flex-col items-center justify-center gap-3">
                      <RefreshCw size={24} className="animate-spin text-accent-gold" />
                      <span>{t('loading')}</span>
                    </div>
                  </td>
                </tr>
              )}
              {state === 'error' && (
                <tr>
                  <td
                    colSpan={cols.length}
                    className="px-4 py-16 text-center text-sm text-semantic-error"
                  >
                    {t('error')}: {error}
                  </td>
                </tr>
              )}
              {state !== 'loading' && rows.length === 0 && state !== 'error' && (
                <tr>
                  <td
                    colSpan={cols.length}
                    className="px-4 py-16 text-center text-sm text-text-tertiary"
                  >
                    {t('empty')}
                  </td>
                </tr>
              )}
              {rows.map((r, i) => {
                const isOpen = expanded === i;
                return (
                  <Fragment key={i}>
                    <tr
                      onClick={() => setExpanded(isOpen ? null : i)}
                      className={`cursor-pointer text-[#1A1F36] transition-all duration-200 hover:bg-gray-50/70 ${
                        isOpen ? 'bg-indigo-50/30 border-l-2 border-indigo-500' : ''
                      }`}
                    >
                      <td className="px-4 py-3.5 text-center text-xs font-bold text-gray-500">
                        {(page - 1) * pageSize + i + 1}
                      </td>
                      <td className="px-3 py-3.5 text-xs text-gray-600 font-medium">
                        {formatTimestamp(r.timestamp)}
                      </td>
                      <td className="px-3 py-3.5 font-semibold text-[#1A1F36]">
                        # {r.fullName}
                      </td>
                      <td className="px-3 py-3.5 text-xs text-gray-600">
                        {r.birthDate}
                      </td>
                      <td className="px-3 py-3.5 text-xs text-gray-600">
                        {r.birthHour || '—'}
                      </td>
                      <td className="px-3 py-3.5 text-xs text-gray-600">
                        {r.gender}
                      </td>
                      <td className="px-3 py-3.5 text-xs text-gray-600 font-mono">
                        {r.phoneNumber || '—'}
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="flex flex-wrap gap-1">
                          {r.packages.split(',').map((pkg, idx) => {
                            const raw = pkg.trim();
                            if (!raw) return null;
                            const lower = raw.toLowerCase();
                            let display = raw;
                            let badgeClass = 'bg-gray-100 text-gray-600 border-gray-200';
                            if (lower === 'tutru' || raw.includes('Bát Tự') || raw.includes('Bát tự') || raw.includes('Tứ Trụ')) {
                              display = 'Bát Tự';
                              badgeClass = 'bg-[#FEF3C7] text-[#D97706] border border-[#F59E0B]/20';
                            } else if (lower === 'maihoa' || raw.includes('Kinh Dịch') || raw.includes('Kinh dịch') || raw.includes('Mai Hoa')) {
                              display = 'Kinh Dịch';
                              badgeClass = 'bg-[#EDE9FE] text-[#7C3AED] border border-[#7C3AED]/20';
                            } else if (lower === 'sim' || raw.includes('Sim') || raw.includes('SĐT') || raw.includes('Số điện thoại')) {
                              display = 'Sim Phong Thuỷ';
                              badgeClass = 'bg-[#DBEAFE] text-[#3B82F6] border border-[#3B82F6]/20';
                            }
                            return (
                              <span
                                key={idx}
                                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-wide ${badgeClass}`}
                              >
                                {display}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-3 py-3.5 text-right text-xs">
                        {r.cost ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100/50 px-2.5 py-0.5 text-[11px] font-semibold">
                            {Number(r.cost).toLocaleString('vi-VN')}₫
                          </span>
                        ) : (
                          <span className="text-text-tertiary">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3.5 text-center">
                        {r.xlsxUrl ? (
                          <a
                            href={r.xlsxUrl}
                            onClick={(e) => e.stopPropagation()}
                            download
                            className="inline-flex items-center gap-1 rounded-full border border-[#3B82F6]/20 bg-[#EFF6FF] px-2.5 py-1 text-[10px] font-bold text-[#3B82F6] hover:bg-[#DBEAFE] transition-colors"
                          >
                            <Download size={11} />
                            <span>Tải</span>
                          </a>
                        ) : (
                          <span className="text-text-tertiary text-[10px]">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3.5 text-xs text-text-secondary">
                        <div className="flex items-center gap-2">
                          <span className="line-clamp-1 flex-1 truncate text-gray-600">
                            {r.summary ? r.summary.split('\n').find((l) => l.trim() && !l.startsWith('═')) ?? r.summary : '—'}
                          </span>
                          <span className={`shrink-0 text-[10px] font-bold ${isOpen ? 'text-indigo-600' : 'text-gray-400'}`}>
                            {isOpen ? '▲ Đóng' : '▼ Mở'}
                          </span>
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-gray-50/30">
                        <td colSpan={cols.length} className="px-5 py-5 border-b border-gray-200">
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

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>
              <span className="font-semibold text-gray-700">{total}</span> bản ghi
            </span>
            <span className="text-gray-300">·</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="h-8 cursor-pointer rounded-lg border border-gray-200 bg-white px-2.5 text-xs text-gray-700 focus:border-indigo-500 focus:outline-none shadow-sm"
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n} / trang
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || state === 'loading'}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ‹
            </button>
            {getPageNumbers(page, totalPages).map((p, idx) =>
              p === '…' ? (
                <span key={`gap-${idx}`} className="px-1 text-gray-400">
                  …
                </span>
              ) : (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p as number)}
                  disabled={state === 'loading'}
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                    p === page
                      ? 'bg-[#3B82F6] text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-indigo-600'
                  }`}
                >
                  {p}
                </button>
              ),
            )}
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || state === 'loading'}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ›
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

// Compact page list with ellipses: always show 1, last, current ±1, and gaps
function getPageNumbers(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set<number>([1, total, current - 1, current, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  for (let i = 0; i < sorted.length; i++) {
    out.push(sorted[i]);
    if (i < sorted.length - 1 && sorted[i + 1] - sorted[i] > 1) out.push('…');
  }
  return out;
}

function DetailPanel({ row }: { row: HistoryRow }) {
  type Tab = 'tuTru' | 'maiHoa' | 'sim' | 'summary';
  const tabs: { key: Tab; label: string; color: string; analysis: string; img: string }[] = [
    { key: 'tuTru', label: 'Bát Tự', color: 'amber', analysis: row.analysisTuTru, img: row.imgTuTru },
    { key: 'maiHoa', label: 'Kinh Dịch', color: 'violet', analysis: row.analysisMaiHoa, img: row.imgMaiHoa },
    { key: 'sim', label: 'Sim Phong Thuỷ', color: 'sky', analysis: row.analysisSim, img: row.imgSim },
    { key: 'summary', label: 'Tổng hợp', color: 'gold', analysis: row.summary, img: '' },
  ];
  const initialTab: Tab = row.summary ? 'summary' : 'tuTru';
  const [active, setActive] = useState<Tab>(initialTab);
  const current = tabs.find((t) => t.key === active)!;
  const colorMap: Record<string, string> = {
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    violet: 'border-violet-200 bg-violet-50 text-violet-800',
    sky: 'border-sky-200 bg-sky-50 text-sky-800',
    gold: 'border-[#F59E0B]/30 bg-amber-50 text-[#D97706]',
  };

  return (
    <div className="flex flex-col gap-3 text-left">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-gray-200 pb-2">
        {tabs.map((tab) => {
          const isActive = active === tab.key;
          const empty = !tab.analysis;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setActive(tab.key);
              }}
              disabled={empty}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                isActive
                  ? colorMap[tab.color]
                  : empty
                    ? 'border-gray-100 bg-gray-50 text-gray-400 opacity-50 cursor-not-allowed'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {tab.label}
              {empty && <span className="ml-1 text-[9px]">—</span>}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto]">
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
            Nội dung — {current.label}
          </span>
          <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-gray-200 bg-white p-4 shadow-inner">
            {current.analysis ? (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#1A1F36]">
                {current.analysis}
              </p>
            ) : (
              <p className="text-xs text-gray-400 italic">Khách chưa chạy gói này.</p>
            )}
          </div>
        </div>

        {current.img && current.key !== 'summary' && (
          <div className="flex flex-col gap-2 lg:w-[260px]">
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Ảnh minh chứng từ trang gốc
            </span>
            <a
              href={current.img}
              target="_blank"
              rel="noopener noreferrer"
              className="block overflow-hidden rounded-xl border-2 border-gray-200 hover:border-indigo-500 transition-colors"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={current.img} alt={current.label} className="w-full object-cover" loading="lazy" />
            </a>
            <span className="text-[10px] text-gray-400 text-center">Click để xem to</span>
          </div>
        )}
      </div>
    </div>
  );
}
