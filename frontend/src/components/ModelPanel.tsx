'use client';

import { Bot, Check, Cpu, Eye, EyeOff, KeyRound, Save, Sparkles, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { Button } from './ui/Button';

type Provider = 'gemini' | 'claude';
type SectionKey = 'tuTru' | 'maiHoa' | 'sim' | 'synthesize';

const SECTION_KEYS: SectionKey[] = ['tuTru', 'maiHoa', 'sim', 'synthesize'];

interface KeyInfo {
  present: boolean;
  source: 'db' | 'env' | 'none';
  masked: string;
}

interface SettingsView {
  provider: Provider;
  sectionProviders: Record<SectionKey, Provider>;
  geminiKey: KeyInfo;
  anthropicKey: KeyInfo;
}

const PROVIDER_DEFS: { value: Provider; icon: typeof Sparkles; iconText: string }[] = [
  { value: 'gemini', icon: Sparkles, iconText: 'text-[#3B82F6]' },
  { value: 'claude', icon: Cpu, iconText: 'text-[#EA580C]' },
];

function backendUrl(path: string): string {
  const root = process.env.NEXT_PUBLIC_BACKEND_URL ?? '';
  return root ? `${root}${path}` : path;
}

export function ModelPanel() {
  const t = useTranslations('model');
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<SettingsView | null>(null);
  const [sectionProviders, setSectionProviders] = useState<Record<SectionKey, Provider>>({
    tuTru: 'gemini', maiHoa: 'gemini', sim: 'gemini', synthesize: 'gemini',
  });
  const [geminiKeyDraft, setGeminiKeyDraft] = useState('');
  const [anthropicKeyDraft, setAnthropicKeyDraft] = useState('');
  const [geminiKeyOriginal, setGeminiKeyOriginal] = useState('');
  const [anthropicKeyOriginal, setAnthropicKeyOriginal] = useState('');
  const [showGemini, setShowGemini] = useState(false);
  const [showAnthropic, setShowAnthropic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const load = useCallback(async () => {
    try {
      const [settingsRes, keysRes] = await Promise.all([
        fetch(backendUrl('/api/settings'), { cache: 'no-store' }),
        fetch(backendUrl('/api/settings/keys'), { cache: 'no-store' }),
      ]);
      if (!settingsRes.ok) throw new Error(`HTTP ${settingsRes.status}`);
      const body = (await settingsRes.json()) as SettingsView;
      const keys = keysRes.ok
        ? ((await keysRes.json()) as { geminiApiKey?: string | null; anthropicApiKey?: string | null })
        : {};
      const gk = keys.geminiApiKey ?? '';
      const ak = keys.anthropicApiKey ?? '';
      setView(body);
      setSectionProviders(body.sectionProviders);
      setGeminiKeyDraft(gk);
      setGeminiKeyOriginal(gk);
      setAnthropicKeyDraft(ak);
      setAnthropicKeyOriginal(ak);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'load failed');
    }
  }, []);

  useEffect(() => {
    if (open) {
      setStatus('idle');
      setErrorMsg('');
      void load();
    }
  }, [open, load]);

  const dirty =
    view !== null &&
    (SECTION_KEYS.some((k) => sectionProviders[k] !== view.sectionProviders[k]) ||
      geminiKeyDraft.trim() !== geminiKeyOriginal.trim() ||
      anthropicKeyDraft.trim() !== anthropicKeyOriginal.trim());

  const save = async () => {
    setSaving(true);
    setStatus('idle');
    setErrorMsg('');
    try {
      const payload: Record<string, unknown> = {
        provider: sectionProviders.synthesize,
        sectionProviders,
      };
      if (geminiKeyDraft.trim().length > 0) payload.geminiApiKey = geminiKeyDraft.trim();
      if (anthropicKeyDraft.trim().length > 0) payload.anthropicApiKey = anthropicKeyDraft.trim();
      const res = await fetch(backendUrl('/api/settings'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const body = (await res.json()) as SettingsView & { success: boolean };
      setView(body);
      setSectionProviders(body.sectionProviders);
      setGeminiKeyOriginal(geminiKeyDraft.trim());
      setAnthropicKeyOriginal(anthropicKeyDraft.trim());
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 2000);
    } catch (e) {
      setStatus('error');
      setErrorMsg(e instanceof Error ? e.message : 'save failed');
    } finally {
      setSaving(false);
    }
  };

  const clearKey = async (which: 'gemini' | 'anthropic') => {
    setSaving(true);
    setStatus('idle');
    setErrorMsg('');
    try {
      const payload =
        which === 'gemini' ? { geminiApiKey: null } : { anthropicApiKey: null };
      const res = await fetch(backendUrl('/api/settings'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (which === 'gemini') { setGeminiKeyDraft(''); setGeminiKeyOriginal(''); }
      else { setAnthropicKeyDraft(''); setAnthropicKeyOriginal(''); }
      await load();
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 1500);
    } catch (e) {
      setStatus('error');
      setErrorMsg(e instanceof Error ? e.message : 'clear failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50 active:scale-95 transition-all"
      >
        <Bot size={14} className="text-[#7C3AED]" />
        {t('openButton')}
        {view?.sectionProviders.synthesize && (
          <span className="ml-1 rounded-full bg-[#F5F3FF] px-2 py-0.5 text-[10px] font-bold text-[#7C3AED] capitalize">
            {view.sectionProviders.synthesize}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/50 px-4 py-6 backdrop-blur-sm sm:items-center">
          <div className="flex w-full max-w-[640px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <div className="flex flex-col gap-0.5">
                <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
                  <Bot size={16} className="text-[#7C3AED]" />
                  {t('title')}
                </h2>
                <p className="text-xs text-text-tertiary">{t('subtitle')}</p>
              </div>
              <button onClick={() => setOpen(false)} className="rounded p-1 text-text-tertiary hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-5 p-5">
              {/* Per-section model */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-text-secondary">
                  {t('perSectionLabel')}
                </label>
                <div className="flex flex-col gap-1.5">
                  {(
                    [
                      { key: 'tuTru' as SectionKey, label: t('sectionTuTru') },
                      { key: 'maiHoa' as SectionKey, label: t('sectionMaiHoa') },
                      { key: 'sim' as SectionKey, label: t('sectionSim') },
                      { key: 'synthesize' as SectionKey, label: t('sectionSynthesize') },
                    ] as const
                  ).map(({ key, label }) => (
                    <div
                      key={key}
                      className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-[#F7F8FC] px-3 py-2"
                    >
                      <span className="text-sm font-medium text-[#1A1F36]">{label}</span>
                      <div className="flex gap-1">
                        {PROVIDER_DEFS.map(({ value, icon: Icon, iconText }) => {
                          const active = sectionProviders[key] === value;
                          return (
                            <button
                              key={value}
                              type="button"
                              onClick={() =>
                                setSectionProviders((prev) => ({ ...prev, [key]: value }))
                              }
                              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold capitalize transition-all ${
                                active
                                  ? 'bg-[#3B82F6] text-white shadow-sm'
                                  : `bg-white border border-gray-200 hover:border-gray-300 ${iconText}`
                              }`}
                            >
                              <Icon size={11} />
                              {value}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Gemini key */}
              <KeyField
                label={t('geminiKey')}
                hint={t('geminiKeyHint')}
                info={view?.geminiKey ?? null}
                draft={geminiKeyDraft}
                onChange={setGeminiKeyDraft}
                show={showGemini}
                onToggleShow={() => setShowGemini((s) => !s)}
                onClear={() => void clearKey('gemini')}
                placeholder="AIza…"
                disabled={saving}
                tEnvLabel={t('keyFromEnv')}
                tDbLabel={t('keyFromDb')}
                tClearLabel={t('clearKey')}
                tNoKeyLabel={t('noKey')}
              />

              {/* Anthropic key */}
              <KeyField
                label={t('anthropicKey')}
                hint={t('anthropicKeyHint')}
                info={view?.anthropicKey ?? null}
                draft={anthropicKeyDraft}
                onChange={setAnthropicKeyDraft}
                show={showAnthropic}
                onToggleShow={() => setShowAnthropic((s) => !s)}
                onClear={() => void clearKey('anthropic')}
                placeholder="sk-ant-…"
                disabled={saving}
                tEnvLabel={t('keyFromEnv')}
                tDbLabel={t('keyFromDb')}
                tClearLabel={t('clearKey')}
                tNoKeyLabel={t('noKey')}
              />

              {errorMsg && (
                <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{errorMsg}</div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-gray-200 bg-gray-50 px-5 py-3">
              <span className="text-[11px] text-text-tertiary">{t('storedNote')}</span>
              <div className="flex items-center gap-2">
                {status === 'saved' && (
                  <span className="flex items-center gap-1 text-xs text-[#16A34A]">
                    <Check size={14} />
                    {t('saved')}
                  </span>
                )}
                {status === 'error' && <span className="text-xs text-red-600">{t('saveError')}</span>}
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
      )}
    </>
  );
}

interface KeyFieldProps {
  label: string;
  hint: string;
  info: KeyInfo | null;
  draft: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggleShow: () => void;
  onClear: () => void;
  placeholder: string;
  disabled: boolean;
  tEnvLabel: string;
  tDbLabel: string;
  tClearLabel: string;
  tNoKeyLabel: string;
}

function KeyField({
  label,
  hint,
  info,
  draft,
  onChange,
  show,
  onToggleShow,
  onClear,
  placeholder,
  disabled,
  tEnvLabel,
  tDbLabel,
  tClearLabel,
  tNoKeyLabel,
}: KeyFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-text-secondary">{label}</label>
        {info && info.present && (
          <span className="flex items-center gap-2 text-[10px] text-text-tertiary">
            <span className="font-mono">{info.masked}</span>
            <span
              className={`rounded-full px-2 py-0.5 font-semibold ${
                info.source === 'db' ? 'bg-[#EFF6FF] text-[#3B82F6]' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {info.source === 'db' ? tDbLabel : tEnvLabel}
            </span>
          </span>
        )}
        {info && !info.present && (
          <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-600">{tNoKeyLabel}</span>
        )}
      </div>
      <div className="relative">
        <KeyRound size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
        <input
          type={show ? 'text' : 'password'}
          value={draft}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
          className="h-11 w-full rounded border border-gray-200 bg-[#F7F8FC] pl-9 pr-10 text-sm text-[#1A1F36] placeholder:text-text-tertiary focus:border-accent-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-accent-primary/10 transition-all"
        />
        <button
          type="button"
          onClick={onToggleShow}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-text-tertiary hover:bg-gray-100"
          tabIndex={-1}
        >
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] text-text-tertiary">{hint}</span>
        {info?.source === 'db' && (
          <button
            type="button"
            onClick={onClear}
            disabled={disabled}
            className="text-[10px] font-semibold text-red-600 hover:underline disabled:opacity-50"
          >
            {tClearLabel}
          </button>
        )}
      </div>
    </div>
  );
}
