'use client';

import { Globe, ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { locales, type AppLocale } from '../../i18n';

export function LanguageSwitcher() {
  const t = useTranslations('language');
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const switchTo = (target: AppLocale) => {
    if (target === locale) {
      setOpen(false);
      return;
    }
    // Replace the leading /{locale} segment with the new locale.
    const next = pathname.replace(/^\/(vi|en)/, `/${target}`) || `/${target}`;
    router.replace(next);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50 active:scale-95 transition-all"
      >
        <Globe size={14} className="text-[#3B82F6]" />
        <span>{locale === 'vi' ? t('vi') : t('en')}</span>
        <ChevronDown size={12} className="text-gray-400 transition-transform duration-200" style={{ transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg"
        >
          {locales.map((l) => (
            <li key={l}>
              <button
                type="button"
                onClick={() => switchTo(l)}
                className={`flex w-full items-center justify-between px-4 py-3 text-xs font-medium transition-colors duration-150 hover:bg-gray-50 ${
                  l === locale
                    ? 'text-[#3B82F6] bg-[#EFF6FF] font-semibold'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <span>{l === 'vi' ? t('vi') : t('en')}</span>
                {l === locale && (
                  <span className="text-[9px] uppercase tracking-wider text-[#3B82F6]/80 font-bold bg-[#EFF6FF] px-1.5 py-0.5 rounded">
                    {l}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
