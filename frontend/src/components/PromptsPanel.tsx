'use client';

import { Check, RotateCcw, Save, Settings2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { Button } from './ui/Button';

type PromptKey = 'tuTru' | 'maiHoa' | 'sim' | 'synthesize';

interface PromptEntry {
  value: string;
  isDefault: boolean;
}
type PromptsState = Record<PromptKey, PromptEntry>;

const TABS: { key: PromptKey; labelKey: PromptKey }[] = [
  { key: 'tuTru', labelKey: 'tuTru' },
  { key: 'maiHoa', labelKey: 'maiHoa' },
  { key: 'sim', labelKey: 'sim' },
  { key: 'synthesize', labelKey: 'synthesize' },
];

export function PromptsPanel() {
  const t = useTranslations('prompts');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<PromptKey>('tuTru');
  const [prompts, setPrompts] = useState<PromptsState | null>(null);
  const empty: Record<PromptKey, string> = {
    tuTru: '', maiHoa: '', sim: '', synthesize: '',
  };
  const [drafts, setDrafts] = useState(empty);
  const [originals, setOriginals] = useState(empty);
  const [defaults, setDefaults] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  const load = useCallback(async () => {
    const res = await fetch('/api/prompts', { cache: 'no-store' });
    const body = (await res.json()) as { prompts?: PromptsState };
    if (body.prompts) {
      setPrompts(body.prompts);
      const d = {} as Record<PromptKey, string>;
      const o = {} as Record<PromptKey, string>;
      const dflt = {} as Record<PromptKey, string>;
      (['tuTru', 'maiHoa', 'sim', 'synthesize'] as PromptKey[]).forEach((k) => {
        d[k] = body.prompts![k].value;
        o[k] = body.prompts![k].value;
        if (body.prompts![k].isDefault) dflt[k] = body.prompts![k].value;
      });
      setDrafts(d);
      setOriginals(o);
      setDefaults((prev) => ({ ...prev, ...dflt }));
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const dirty =
    prompts !== null &&
    (['tuTru', 'maiHoa', 'sim', 'synthesize'] as PromptKey[]).some(
      (k) => drafts[k] !== originals[k],
    );

  const save = async () => {
    setSaving(true);
    setStatus('idle');
    try {
      const payload: Partial<Record<PromptKey, string>> = {};
      (['tuTru', 'maiHoa', 'sim', 'synthesize'] as PromptKey[]).forEach((k) => {
        if (drafts[k] !== originals[k]) payload[k] = drafts[k];
      });
      const res = await fetch('/api/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      setStatus('saved');
      await load();
      setTimeout(() => setStatus('idle'), 2000);
    } catch {
      setStatus('error');
    } finally {
      setSaving(false);
    }
  };

  const resetActive = () => {
    if (defaults[active]) {
      setDrafts((d) => ({ ...d, [active]: defaults[active] }));
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50 active:scale-95 transition-all"
      >
        <Settings2 size={14} className="text-[#3B82F6]" />
        {t('openButton')}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/50 px-4 py-6 backdrop-blur-sm sm:items-center">
          <div className="flex w-full max-w-[1100px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div className="flex flex-col gap-0.5">
                <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
                  <Settings2 size={16} className="text-[#3B82F6]" />
                  {t('title')}
                </h2>
                <p className="text-xs text-text-tertiary">{t('subtitle')}</p>
              </div>
              <button onClick={() => setOpen(false)} className="rounded p-1 text-text-tertiary hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>

            <div className="flex items-center gap-2 overflow-x-auto border-b border-gray-200 bg-gray-50 px-4 py-2.5">
              {TABS.map((tab) => {
                const isActive = active === tab.key;
                const entry = prompts?.[tab.key];
                const isDirty = entry && drafts[tab.key] !== originals[tab.key];
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActive(tab.key)}
                    className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-white border border-gray-200 text-[#3B82F6] shadow-sm'
                        : 'text-gray-500 hover:bg-gray-200/55'
                    }`}
                  >
                    <span>{t(tab.labelKey)}</span>
                    {entry && !entry.isDefault && !isDirty && (
                      <span className="rounded-full bg-[#EFF6FF] px-1.5 py-0.5 text-[9px] font-bold text-[#3B82F6]">
                        {t('customBadge')}
                      </span>
                    )}
                    {isDirty && <span className="h-1.5 w-1.5 rounded-full bg-[#3B82F6] animate-pulse" />}
                  </button>
                );
              })}
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
              {prompts === null ? (
                <div className="flex flex-1 items-center justify-center text-xs text-text-tertiary">
                  {t('loading')}
                </div>
              ) : (
                <textarea
                  value={drafts[active]}
                  onChange={(e) => setDrafts((d) => ({ ...d, [active]: e.target.value }))}
                  spellCheck={false}
                  className="h-[55vh] w-full resize-none rounded-xl border border-gray-200 bg-gray-50/50 p-4 font-mono text-xs leading-relaxed text-[#1A1F36] focus:border-[#3B82F6] focus:bg-white focus:outline-none transition-all"
                />
              )}

              <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-200">
                <button
                  type="button"
                  onClick={resetActive}
                  disabled={!defaults[active] || drafts[active] === defaults[active]}
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-all shadow-sm"
                >
                  <RotateCcw size={13} />
                  {t('reset')}
                </button>

                <div className="flex items-center gap-2">
                  {status === 'saved' && (
                    <span className="flex items-center gap-1 text-xs text-[#3B82F6]">
                      <Check size={14} />
                      {t('saved')}
                    </span>
                  )}
                  {status === 'error' && <span className="text-xs text-semantic-error">{t('saveError')}</span>}
                  <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>
                    {t('close')}
                  </Button>
                  <Button
                    size="sm"
                    leftIcon={<Save size={14} />}
                    disabled={!dirty || saving}
                    loading={saving}
                    onClick={() => void save()}
                  >
                    {t('save')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
