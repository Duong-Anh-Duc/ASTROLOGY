'use client';

import {
  AlertCircle,
  CheckCircle2,
  Circle,
  Download,
  Loader2,
  RotateCcw,
  Sparkles,
  Compass,
  Scroll,
  Clock,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import type { ProcessingStep } from '../types';
import { Button } from './ui/Button';

interface CostInfo {
  inputTokens: number;
  outputTokens: number;
  usd: number;
  vnd: number;
}

interface StatusPanelProps {
  step: ProcessingStep;
  customerName: string;
  xlsxUrl?: string;
  xlsxFileName?: string;
  cost?: CostInfo;
  errorMessage?: string;
  onRetry: () => void;
  onReset: () => void;
}

const STEPS: Exclude<ProcessingStep, 'idle' | 'done' | 'error'>[] = [
  'scraping',
  'analyzing',
  'synthesizing',
  'exporting',
];

export function StatusPanel({
  step,
  customerName,
  xlsxUrl,
  xlsxFileName,
  cost,
  errorMessage,
  onRetry,
  onReset,
}: StatusPanelProps) {
  const t = useTranslations('status');
  const tCommon = useTranslations('common');

  const startRef = useRef<number>(Date.now());
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (step === 'done' || step === 'error') return;
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 500);
    return () => clearInterval(id);
  }, [step]);

  if (step === 'done') {
    return (
      <div className="bg-white relative flex flex-col gap-6 rounded-xl p-6 shadow-2xl border border-gray-200 sm:p-8 overflow-hidden">
        {/* Decorative Orbits */}
        <div className="absolute -right-16 -top-16 pointer-events-none opacity-20">
          <div className="w-40 h-40 rounded-full border border-dashed border-[#3B82F6]" />
        </div>

        <div className="flex flex-col items-center text-center gap-3">
          <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-[#EFF6FF] border border-[#3B82F6]/20 animate-pulse">
            <Scroll size={30} className="text-[#3B82F6]" />
            <Sparkles size={16} className="absolute -top-1 -right-1 text-[#3B82F6] animate-bounce" />
          </div>
          <div className="flex flex-col gap-1 mt-1">
            <h2 className="text-xl font-bold tracking-wide uppercase text-text-primary">
              {t('done')}
            </h2>
            <p className="text-sm font-medium text-text-secondary">
              Bản mệnh thư cho: <span className="text-[#3B82F6] font-semibold">{customerName}</span>
            </p>
          </div>
        </div>

        {cost && (
          <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 shadow-sm">
            <div className="flex items-baseline justify-between border-b border-gray-200 pb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">
                Chi phí luận giải
              </span>
              <span className="text-xl font-bold text-[#3B82F6]">
                {cost.vnd.toLocaleString('vi-VN')}₫
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex flex-col">
                <span className="text-[9px] uppercase tracking-wider text-text-tertiary">Token Vào</span>
                <span className="font-mono text-text-secondary font-medium">{cost.inputTokens.toLocaleString('vi-VN')}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] uppercase tracking-wider text-text-tertiary">Token Ra</span>
                <span className="font-mono text-text-secondary font-medium">{cost.outputTokens.toLocaleString('vi-VN')}</span>
              </div>
              <div className="col-span-2 mt-1 pt-1 border-t border-gray-200 flex items-center justify-between text-text-tertiary">
                <span>Quy đổi USD</span>
                <span className="font-mono text-text-secondary">${cost.usd.toFixed(4)}</span>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3.5 sm:flex-row mt-2">
          {xlsxUrl && (
            <a
              href={xlsxUrl}
              download={xlsxFileName ?? true}
              className="inline-flex h-12 flex-1 items-center justify-center gap-2.5 rounded-full bg-gradient-to-r from-[#3B82F6] via-[#6366F1] to-[#A855F7] px-6 text-sm font-bold text-white uppercase tracking-wider transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/25 hover:scale-[1.02] active:scale-98"
            >
              <Download size={16} />
              <span>{t('downloadXlsx')}</span>
            </a>
          )}
          <Button
            variant="secondary"
            size="lg"
            leftIcon={<RotateCcw size={16} />}
            onClick={onReset}
            className="border-gray-200 hover:bg-gray-50 rounded-full h-12 text-gray-700"
          >
            {t('newRun')}
          </Button>
        </div>
      </div>
    );
  }

  if (step === 'error') {
    return (
      <div className="glass-panel-elevated flex flex-col gap-6 rounded-card p-6 shadow-elevated border border-semantic-error/30 sm:p-8">
        <div className="flex flex-col items-center text-center gap-3">
          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-semantic-error/10 border border-semantic-error/30">
            <AlertCircle size={26} className="text-semantic-error animate-bounce" />
          </div>
          <div className="flex flex-col gap-1.5 mt-1">
            <h2 className="text-lg font-bold tracking-wide text-semantic-error uppercase">
              {tCommon('error')}
            </h2>
            <p className="text-sm text-text-secondary max-w-sm">
              {errorMessage}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2.5 mt-2">
          <Button
            size="lg"
            leftIcon={<RotateCcw size={16} />}
            onClick={onRetry}
            fullWidth
            className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white border-0 shadow-lg shadow-red-600/20"
          >
            {tCommon('retry')}
          </Button>
          <Button
            variant="ghost"
            size="md"
            onClick={onReset}
            fullWidth
            className="text-text-tertiary hover:text-text-primary"
          >
            Quay lại
          </Button>
        </div>
      </div>
    );
  }

  const currentIndex = STEPS.indexOf(
    step as (typeof STEPS)[number],
  );

  return (
    <div className="bg-white relative flex flex-col gap-6 rounded-xl p-6 shadow-2xl border border-gray-200 sm:p-8 overflow-hidden">
      {/* Decorative Orbits */}
      <div className="absolute -left-12 -bottom-12 pointer-events-none opacity-10">
        <div className="w-36 h-36 rounded-full border border-dashed border-[#3B82F6]" />
      </div>

      <div className="flex items-center justify-between border-b border-gray-200 pb-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-base font-bold tracking-wide text-text-primary uppercase flex items-center gap-2">
            <Compass size={16} className="text-[#3B82F6] animate-spin-slow" />
            {t('title')}
          </h2>
          <p className="text-xs text-text-tertiary">
            Đang luận đoán cho: <span className="text-text-secondary font-semibold">{customerName}</span>
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-[#3B82F6]/20 bg-[#EFF6FF] px-3 py-1 text-[10px] font-bold text-[#3B82F6] tracking-wide">
          <Clock size={10} className="text-[#3B82F6]" />
          <span>{Math.floor(elapsed / 60)}m {elapsed % 60}s</span>
        </div>
      </div>

      <ul className="flex flex-col gap-3.5 relative z-10">
        {STEPS.map((s, i) => {
          const done = i < currentIndex;
          const active = i === currentIndex;
          return (
            <li
              key={s}
              className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3.5 transition-all duration-300 ${
                active
                  ? 'border-[#3B82F6] bg-[#EFF6FF] text-[#3B82F6]'
                  : done
                    ? 'border-gray-100 bg-gray-50/50 text-gray-600'
                    : 'border-gray-100/30 bg-white text-gray-400 opacity-60'
              }`}
            >
              <div className="flex items-center gap-3.5 min-w-0">
                {done ? (
                  <CheckCircle2 size={18} className="text-[#3B82F6] shrink-0" />
                ) : active ? (
                  <Loader2
                    size={18}
                    className="animate-spin text-[#3B82F6] shrink-0"
                  />
                ) : (
                  <Circle size={18} className="text-text-tertiary shrink-0" />
                )}
                <span
                  className={`text-sm font-medium ${
                    active ? 'text-[#3B82F6] font-semibold' : ''
                  }`}
                >
                  {t(s)}
                </span>
              </div>
              
              {active && (
                <span className="flex h-2 w-2 relative shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#3B82F6] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#3B82F6]"></span>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
