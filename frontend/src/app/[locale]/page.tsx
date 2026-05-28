'use client';

import { ChevronUp, Clock, Library, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
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
  | { kind: 'done'; customer: CustomerInfo; xlsxUrl?: string; xlsxFileName?: string; cost?: CostInfo }
  | { kind: 'error'; customer: CustomerInfo; message: string };

type RunningStep = Exclude<ProcessingStep, 'idle' | 'done' | 'error'>;

type RunStreamEvent =
  | { type: 'progress'; step: RunningStep }
  | { type: 'result'; result: ApiResponse };

export default function HomePage() {
  const tCommon = useTranslations('common');
  const tErrors = useTranslations('errors');
  const tStatus = useTranslations('status');

  const [state, setState] = useState<RunState>({ kind: 'idle' });
  const [isProgressOpen, setIsProgressOpen] = useState(true);
  const [historyRefresh, setHistoryRefresh] = useState(0);

  const startRun = async (data: CustomerInfo) => {
    setIsProgressOpen(true);
    setState({ kind: 'running', step: 'scraping', customer: data });

    try {
      // /api/run can take 60-120s — bypass Next.js dev rewrite which times out
      // and call backend directly.
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? '';
      const runUrl = backendUrl ? `${backendUrl}/api/run/stream` : '/api/run/stream';
      const res = await fetch(runUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const contentType = res.headers.get('content-type') ?? '';
        const body = contentType.includes('application/json')
          ? ((await res.json()) as ApiResponse)
          : null;
        throw new Error(body?.error ?? `${res.status} ${res.statusText}`);
      }

      if (!res.body) {
        throw new Error(tErrors('unknownError'));
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let body: ApiResponse | null = null;

      const handleLine = (line: string): ApiResponse | null => {
        const trimmed = line.trim();
        if (!trimmed) return null;

        const event = JSON.parse(trimmed) as RunStreamEvent;
        if (event.type === 'progress') {
          setState((s) =>
            s.kind === 'running' ? { ...s, step: event.step } : s,
          );
          return null;
        }

        if (event.type === 'result') {
          return event.result;
        }

        return null;
      };

      while (true) {
        const { value, done } = await reader.read();
        if (value) {
          buffer += decoder.decode(value, { stream: !done });
        }
        if (done) {
          buffer += decoder.decode();
          break;
        }

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          const result = handleLine(line);
          if (result) body = result;
        }
      }

      if (buffer.trim()) {
        const result = handleLine(buffer);
        if (result) body = result;
      }

      if (!body) {
        throw new Error(tErrors('unknownError'));
      }

      if (!body.success) {
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
      setState({
        kind: 'error',
        customer: data,
        message:
          err instanceof Error ? err.message : tErrors('unknownError'),
      });
    }
  };

  const dismiss = () => setState({ kind: 'idle' });
  const showDialog = state.kind === 'done' || state.kind === 'error';

  useEffect(() => {
    if (!showDialog) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showDialog]);

  return (
    <main className="relative flex min-h-screen w-full flex-col gap-7 px-4 py-6 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pb-2">
        <div className="flex items-center gap-3">
          <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-[#1D4D3F] shrink-0 shadow-sm">
            <Library size={22} className="text-amber-400" />
          </div>
          <div className="flex flex-col leading-tight">
            <h1 className="text-xl font-bold text-[#1D4D3F]">
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

      {state.kind === 'running' && isProgressOpen && (
        <div className="fixed bottom-4 right-4 z-40 w-[calc(100vw-2rem)] max-w-[430px] sm:bottom-6 sm:right-6">
          <StatusPanel
            step={state.step}
            customerName={state.customer.fullName}
            packages={state.customer.packages}
            includeSynthesis={state.customer.includeSynthesis}
            onMinimize={() => setIsProgressOpen(false)}
            onRetry={() => startRun(state.customer)}
            onReset={dismiss}
          />
        </div>
      )}

      {state.kind === 'running' && !isProgressOpen && (
        <button
          type="button"
          onClick={() => setIsProgressOpen(true)}
          className="fixed bottom-4 right-4 z-40 flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full border border-[#1D4D3F]/20 bg-white px-4 py-3 text-sm font-semibold text-[#1D4D3F] shadow-xl transition-colors hover:bg-[#EEF5F1] sm:bottom-6 sm:right-6"
        >
          <Clock size={15} />
          <span>{tStatus('showProgress')}</span>
          <ChevronUp size={15} />
        </button>
      )}

      {showDialog && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#111827]/25 px-4 py-5 transition-all duration-200 sm:items-center sm:py-8"
          onClick={dismiss}
          role="presentation"
        >
          <div
            className="w-full max-w-[560px]"
            onClick={(event) => event.stopPropagation()}
          >
            {state.kind === 'done' ? (
              <StatusPanel
                step="done"
                customerName={state.customer.fullName}
                xlsxUrl={state.xlsxUrl}
                xlsxFileName={state.xlsxFileName}
                cost={state.cost}
                onRetry={() => startRun(state.customer)}
                onReset={dismiss}
              />
            ) : (
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
