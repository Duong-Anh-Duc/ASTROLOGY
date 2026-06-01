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
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import type { PackageType, ProcessingStep } from '../types';
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
  packages?: PackageType[];
  includeSynthesis?: boolean;
  docxUrl?: string;
  docxFileName?: string;
  cost?: CostInfo;
  errorMessage?: string;
  onMinimize?: () => void;
  onRetry: () => void;
  onReset: () => void;
}

const PACKAGE_LABELS: Record<PackageType, string> = {
  tuTru: 'Bát tự',
  maiHoa: 'Kinh dịch',
  sim: 'Sim phong thủy',
};

type Phase = 'scraping' | 'analyzing' | 'synthesizing' | 'exporting';

interface VisibleStep {
  key: string;
  phase: Phase;
  label: string;
}

const PHASE_ORDER: Record<Phase, number> = {
  scraping: 0,
  analyzing: 1,
  synthesizing: 2,
  exporting: 3,
};

export function StatusPanel({
  step,
  customerName,
  packages = [],
  includeSynthesis = false,
  docxUrl,
  docxFileName,
  cost,
  errorMessage,
  onMinimize,
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
        <div className="flex flex-col items-center text-center gap-3">
          <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-[#EEF5F1] border border-[#1D4D3F]/20">
            <Scroll size={30} className="text-[#1D4D3F]" />
            <Sparkles size={16} className="absolute -top-1 -right-1 text-[#1D4D3F]" />
          </div>
          <div className="flex flex-col gap-1 mt-1">
            <h2 className="text-xl font-bold text-text-primary">
              {t('done')}
            </h2>
            <p className="text-sm font-medium text-text-secondary">
              {t('destinyFor')} <span className="text-[#1D4D3F] font-semibold">{customerName}</span>
            </p>
          </div>
        </div>

        {cost && (
          <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 shadow-sm">
            <div className="flex items-baseline justify-between border-b border-gray-200 pb-2">
              <span className="text-xs font-semibold text-text-tertiary">
                {t('costTitle')}
              </span>
              <span className="text-xl font-bold text-[#1D4D3F]">
                {cost.vnd.toLocaleString('vi-VN')}₫
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex flex-col">
                <span className="text-[11px] font-medium text-text-tertiary">{t('inputTokens')}</span>
                <span className="font-mono text-text-secondary font-medium">{cost.inputTokens.toLocaleString('vi-VN')}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-medium text-text-tertiary">{t('outputTokens')}</span>
                <span className="font-mono text-text-secondary font-medium">{cost.outputTokens.toLocaleString('vi-VN')}</span>
              </div>
              <div className="col-span-2 mt-1 pt-1 border-t border-gray-200 flex items-center justify-between text-text-tertiary">
                <span>{t('usdConversion')}</span>
                <span className="font-mono text-text-secondary">${cost.usd.toFixed(4)}</span>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3.5 sm:flex-row mt-2">
          {docxUrl && (
            <a
              href={docxUrl}
              download={docxFileName ?? true}
              className="inline-flex h-12 flex-1 items-center justify-center gap-2.5 rounded-full bg-[#1D4D3F] px-6 text-sm font-semibold text-white transition-colors duration-200 hover:bg-[#153A2F]"
            >
              <Download size={16} />
              <span>{t('downloadDocx')}</span>
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
            <AlertCircle size={26} className="text-semantic-error" />
          </div>
          <div className="flex flex-col gap-1.5 mt-1">
            <h2 className="text-lg font-bold text-semantic-error">
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
            className="bg-red-600 hover:bg-red-500 text-white border-0 shadow-sm"
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
            {tCommon('back')}
          </Button>
        </div>
      </div>
    );
  }

  const selectedPackages: PackageType[] = packages.length > 0 ? packages : ['tuTru'];
  const visibleSteps: VisibleStep[] = [
    ...selectedPackages.map((pkg) => ({
      key: `scraping-${pkg}`,
      phase: 'scraping' as const,
      label: t('scrapingPackage', { package: PACKAGE_LABELS[pkg] }),
    })),
    ...selectedPackages.map((pkg) => ({
      key: `analyzing-${pkg}`,
      phase: 'analyzing' as const,
      label: t('analyzingPackage', { package: PACKAGE_LABELS[pkg] }),
    })),
    ...(includeSynthesis && selectedPackages.length > 1
      ? [
          {
            key: 'synthesizing',
            phase: 'synthesizing' as const,
            label: t('synthesizingSelected'),
          },
        ]
      : []),
    {
      key: 'exporting',
      phase: 'exporting' as const,
      label: t('exporting'),
    },
  ];
  const currentPhase = step === 'synthesizing'
    ? 'synthesizing'
    : step === 'analyzing'
      ? 'analyzing'
      : step === 'exporting'
        ? 'exporting'
        : 'scraping';
  const currentOrder = PHASE_ORDER[currentPhase];

  return (
    <div className="bg-white relative flex flex-col gap-6 rounded-xl p-6 shadow-2xl border border-gray-200 sm:p-8 overflow-hidden">
      <div className="flex items-center justify-between border-b border-gray-200 pb-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
            <Compass size={16} className="text-[#1D4D3F]" />
            {t('title')}
          </h2>
          <p className="text-xs text-text-tertiary">
            {t('readingFor')} <span className="text-text-secondary font-semibold">{customerName}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full border border-[#1D4D3F]/20 bg-[#EEF5F1] px-3 py-1 text-[10px] font-semibold text-[#1D4D3F]">
            <Clock size={10} className="text-[#1D4D3F]" />
            <span>{Math.floor(elapsed / 60)}m {elapsed % 60}s</span>
          </div>
          {onMinimize && (
            <button
              type="button"
              onClick={onMinimize}
              aria-label={t('hideProgress')}
              className="flex h-8 w-8 items-center justify-center rounded-full text-text-tertiary transition-colors hover:bg-gray-100 hover:text-text-primary"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <ul className="flex flex-col gap-3.5 relative z-10">
        {visibleSteps.map((s) => {
          const order = PHASE_ORDER[s.phase];
          const done = order < currentOrder;
          const active = order === currentOrder;
          return (
            <li
              key={s.key}
              className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3.5 transition-all duration-300 ${
                active
                  ? 'border-[#1D4D3F] bg-[#EEF5F1] text-[#1D4D3F]'
                  : done
                    ? 'border-gray-100 bg-gray-50/50 text-gray-600'
                    : 'border-gray-100/30 bg-white text-gray-400 opacity-60'
              }`}
            >
              <div className="flex items-center gap-3.5 min-w-0">
                {done ? (
                  <CheckCircle2 size={18} className="text-[#1D4D3F] shrink-0" />
                ) : active ? (
                  <Loader2
                    size={18}
                    className="animate-spin text-[#1D4D3F] shrink-0"
                  />
                ) : (
                  <Circle size={18} className="text-text-tertiary shrink-0" />
                )}
                <span className="flex min-w-0 flex-col">
                  <span
                    className={`text-sm font-medium ${
                      active ? 'text-[#1D4D3F] font-semibold' : ''
                    }`}
                  >
                    {s.label}
                  </span>
                  {s.phase === 'synthesizing' && (
                    <span className="truncate text-xs text-text-tertiary">
                      {t('synthesizingHint')}
                    </span>
                  )}
                </span>
              </div>
              
              {active && (
                <span className="flex h-2 w-2 relative shrink-0">
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#1D4D3F]"></span>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
