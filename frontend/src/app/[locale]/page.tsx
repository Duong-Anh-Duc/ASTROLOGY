'use client';

import { Moon, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { DivinationForm } from '../../components/DivinationForm';
import { HistoryTable } from '../../components/HistoryTable';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { ModelPanel } from '../../components/ModelPanel';
import { PromptsPanel } from '../../components/PromptsPanel';
import { StatusPanel } from '../../components/StatusPanel';
import type {
  ApiResponse,
  CostInfo,
  CustomerInfo,
  ProcessingStep,
} from '../../types';

type RunState =
  | { kind: 'idle' }
  | { kind: 'running'; step: ProcessingStep; customer: CustomerInfo }
  | { kind: 'done'; customer: CustomerInfo; xlsxUrl: string; xlsxFileName?: string; cost?: CostInfo }
  | { kind: 'error'; customer: CustomerInfo; message: string };

export default function HomePage() {
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');

  const [state, setState] = useState<RunState>({ kind: 'idle' });
  const [historyRefresh, setHistoryRefresh] = useState(0);

  const startRun = async (data: CustomerInfo) => {
    setState({ kind: 'running', step: 'scraping', customer: data });

    const t1 = setTimeout(
      () =>
        setState((s) =>
          s.kind === 'running' && s.step === 'scraping'
            ? { ...s, step: 'analyzing' }
            : s,
        ),
      8000,
    );
    const t2 = setTimeout(
      () =>
        setState((s) =>
          s.kind === 'running' && s.step === 'analyzing'
            ? { ...s, step: 'synthesizing' }
            : s,
        ),
      20000,
    );
    const t3 = setTimeout(
      () =>
        setState((s) =>
          s.kind === 'running' && s.step === 'synthesizing'
            ? { ...s, step: 'exporting' }
            : s,
        ),
      40000,
    );

    try {
      // /api/run can take 60-120s — bypass Next.js dev rewrite which times out
      // and call backend directly.
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? '';
      const runUrl = backendUrl ? `${backendUrl}/api/run` : '/api/run';
      const res = await fetch(runUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const body = (await res.json()) as ApiResponse;
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);

      if (!res.ok || !body.success || !body.xlsxUrl) {
        setState({
          kind: 'error',
          customer: data,
          message: body.error ?? tErrors('unknownError'),
        });
        return;
      }

      setState({
        kind: 'done',
        customer: data,
        xlsxUrl: body.xlsxUrl,
        xlsxFileName: body.xlsxFileName,
        cost: body.cost,
      });
      setHistoryRefresh((n) => n + 1);
    } catch (err) {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      setState({
        kind: 'error',
        customer: data,
        message:
          err instanceof Error ? err.message : tErrors('unknownError'),
      });
    }
  };

  const dismiss = () => setState({ kind: 'idle' });
  const overlay = state.kind !== 'idle';

  return (
    <main className="relative flex min-h-screen w-full flex-col gap-7 px-4 py-6 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-2">
        <div className="flex items-center gap-3">
          <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-[#1A1F36] shrink-0 shadow-sm">
            <Moon size={22} className="text-amber-400 fill-amber-400" />
          </div>
          <div className="flex flex-col leading-tight">
            <h1 className="text-xl font-bold tracking-wider uppercase text-[#1A1F36]">
              {tCommon('appName')}
            </h1>
            <span className="text-xs text-text-tertiary">
              {tCommon('tagline')}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <ModelPanel />
          <PromptsPanel />
          <LanguageSwitcher />
        </div>
      </header>

      <DivinationForm
        onSubmit={startRun}
        isSubmitting={state.kind === 'running'}
      />

      <HistoryTable refreshSignal={historyRefresh} />

      {overlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 px-4 backdrop-blur-md transition-all duration-300">
          <div className="w-full max-w-[560px]">
            {state.kind === 'running' && (
              <StatusPanel
                step={state.step}
                customerName={state.customer.fullName}
                onRetry={() => startRun(state.customer)}
                onReset={dismiss}
              />
            )}
            {state.kind === 'done' && (
              <StatusPanel
                step="done"
                customerName={state.customer.fullName}
                xlsxUrl={state.xlsxUrl}
                xlsxFileName={state.xlsxFileName}
                cost={state.cost}
                onRetry={() => startRun(state.customer)}
                onReset={dismiss}
              />
            )}
            {state.kind === 'error' && (
              <StatusPanel
                step="error"
                customerName={state.customer.fullName}
                errorMessage={state.message}
                onRetry={() => startRun(state.customer)}
                onReset={dismiss}
              />
            )}
          </div>
        </div>
      )}

      <footer className="mt-auto flex items-center justify-center gap-1.5 pt-6 text-xs text-text-tertiary">
        <Sparkles size={12} className="text-accent-primary" />
        <span>{tCommon('appName')} © {new Date().getFullYear()}</span>
      </footer>
    </main>
  );
}
