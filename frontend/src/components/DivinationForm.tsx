'use client';

import { BookOpen, Calendar, ChevronDown, Clock, Compass, Info, MessageSquareText, Phone, Sparkles, User, Shield, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { ConfigProvider, DatePicker } from 'antd';
import viVN from 'antd/locale/vi_VN';
import dayjs, { type Dayjs } from 'dayjs';
import 'dayjs/locale/vi';
import type { CustomerInfo, Gender, PackageType } from '../types';

dayjs.locale('vi');

interface DivinationFormProps {
  onSubmit: (data: CustomerInfo) => void;
  isSubmitting?: boolean;
}

const CURRENT_YEAR = new Date().getFullYear();

export function DivinationForm({ onSubmit, isSubmitting }: DivinationFormProps) {
  const t = useTranslations('form');
  const questionRef = useRef<HTMLSelectElement>(null);

  const [fullName, setFullName] = useState('');
  const [day, setDay] = useState<string>('');
  const [month, setMonth] = useState<string>('');
  const [year, setYear] = useState<string>('');
  const [hour, setHour] = useState<string>('');
  const [minute, setMinute] = useState<string>('');
  const [isLunar, setIsLunar] = useState<boolean>(false);
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [question, setQuestion] = useState('');
  const [addressing, setAddressing] = useState('');
  const [additionalContext, setAdditionalContext] = useState('');
  const [includeSynthesis, setIncludeSynthesis] = useState(false);
  const [useSolarTerms, setUseSolarTerms] = useState(false);
  const [packages, setPackages] = useState<PackageType[]>(['tuTru', 'maiHoa', 'sim']);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const clearError = (field: string) => {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const togglePackage = (pkg: PackageType) => {
    setPackages((prev) => {
      const next = prev.includes(pkg)
        ? prev.filter((p) => p !== pkg)
        : [...prev, pkg];

      if (next.length > 0) clearError('packages');
      if (!next.includes('sim')) clearError('phoneNumber');
      if (next.length < 2) setIncludeSynthesis(false);
      return next;
    });
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!fullName.trim()) next.fullName = t('validation.nameRequired');

    const d = Number(day);
    const m = Number(month);
    const y = Number(year);
    if (!day || !month || !year) {
      next.birth = t('validation.birthRequired');
    } else if (
      !Number.isInteger(d) || d < 1 || d > 31 ||
      !Number.isInteger(m) || m < 1 || m > 12 ||
      !Number.isInteger(y) || y < 1900 || y > CURRENT_YEAR
    ) {
      next.birth = t('validation.invalidDate');
    } else {
      const daysInMonth = new Date(y, m, 0).getDate();
      if (d > daysInMonth) {
        next.birth = t('validation.invalidDayInMonth', { month: m, year: y, days: daysInMonth });
      }
    }

    const hasPackages = packages.length > 0;
    if (!hasPackages) next.packages = t('validation.packageRequired');

    const needsPhone = packages.includes('sim');
    if (needsPhone && !phoneNumber.trim()) {
      next.phoneNumber = t('validation.phoneRequired');
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const hourNum = hour.trim() === '' ? null : Number(hour);
    const minuteNum = minute.trim() === '' ? 0 : Number(minute);
    onSubmit({
      fullName: fullName.trim(),
      day: Number(day),
      month: Number(month),
      year: Number(year),
      hour: hourNum,
      minute: minuteNum,
      isLunar,
      gender: gender === 'other' ? 'male' : gender, // Map 'other' to 'male' for backend compatibility
      packages,
      phoneNumber: packages.includes('sim') ? phoneNumber.trim() : undefined,
      question: question.trim() ? question.trim() : undefined,
      addressing: addressing.trim() ? addressing.trim() : undefined,
      additionalContext: additionalContext.trim() ? additionalContext.trim() : undefined,
      includeSynthesis: packages.length > 1 && includeSynthesis,
      useSolarTerms: useSolarTerms,
    });
  };

  const cellCls =
    'h-11 w-full rounded-lg border border-[#E5E7EB] bg-white px-3.5 text-sm text-[#1A1F36] placeholder:text-[#98A2B3] transition-all duration-200 focus:border-[#1D4D3F] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1D4D3F]/5';
  const errCls = 'border-semantic-error/60 focus:ring-semantic-error/20 focus:border-semantic-error';
  const needsPhone = packages.includes('sim');
  const canSynthesize = packages.length > 1;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">

        {/* LEFT COLUMN: Customer Information */}
        <div className="lg:col-span-7 flex flex-col gap-5">
          <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-[0_4px_20px_rgba(0,0,0,0.02)]">

            {/* Main Header */}
            <div className="border-b border-[#EAECF0] px-6 py-4 bg-white flex items-center gap-2.5">
              <User size={20} className="text-[#1D4D3F]" />
              <h2 className="text-[17px] font-bold text-[#0C1F19] tracking-tight">
                {t('title')}
              </h2>
            </div>

            <div className="flex flex-col gap-6 px-6 py-6 bg-white">

              {/* SECTION: Hồ sơ cơ bản */}
              <section className="flex flex-col gap-4">
                <div className="flex items-center gap-2 pb-1">
                  <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[#EEF5F1] text-[#1D4D3F]">
                    <User size={12} strokeWidth={2.5} />
                  </div>
                  <span className="text-sm font-semibold text-[#475467]">
                    Hồ sơ cơ bản
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-[#475467]">
                      {t('customerName')}
                    </label>
                    <div className="relative">
                      <input
                        value={fullName}
                        onChange={(e) => {
                          setFullName(e.target.value);
                          if (e.target.value.trim()) clearError('fullName');
                        }}
                        placeholder={t('customerNamePlaceholder')}
                        autoComplete="off"
                        className={`${cellCls} pr-10 ${errors.fullName ? errCls : ''}`}
                      />
                      <User size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#98A2B3]" />
                    </div>
                    {errors.fullName && (
                      <span className="text-[11px] text-semantic-error font-medium">{errors.fullName}</span>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-[#475467]">
                      {t('addressingLabel')}
                    </label>
                    <div className="relative">
                      <input
                        value={addressing}
                        onChange={(e) => setAddressing(e.target.value)}
                        placeholder={t('addressingPlaceholder')}
                        autoComplete="off"
                        className={cellCls}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mt-1">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-[#475467]">
                      {t('birthDate')}
                    </label>
                    <ConfigProvider
                      locale={viVN}
                      theme={{
                        token: {
                          colorPrimary: '#1D4D3F',
                          borderRadius: 8,
                          fontFamily: 'var(--font-inter)',
                        },
                      }}
                    >
                      <DatePicker
                        value={
                          day && month && year
                            ? dayjs(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`)
                            : null
                        }
                        onChange={(d: Dayjs | null) => {
                          if (d) {
                            setDay(String(d.date()));
                            setMonth(String(d.month() + 1));
                            setYear(String(d.year()));
                            clearError('birth');
                          } else {
                            setDay('');
                            setMonth('');
                            setYear('');
                          }
                        }}
                        format={{ format: 'DD/MM/YYYY', type: 'mask' }}
                        placeholder="dd/mm/yyyy"
                        size="large"
                        style={{
                          width: '100%',
                          height: 44,
                          borderRadius: 8,
                          border: errors.birth ? '1px solid #EF4444' : '1px solid #E5E7EB',
                          background: 'white',
                        }}
                        minDate={dayjs('1900-01-01')}
                        maxDate={dayjs()}
                      />
                    </ConfigProvider>
                    {errors.birth && (
                      <span className="text-[11px] text-semantic-error font-medium">{errors.birth}</span>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-[#475467]">
                      Giờ sinh <span className="text-[10px] text-[#8A93A6] font-normal">({t('birthHourHint').toLowerCase()})</span>
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="relative">
                        <select
                          value={hour}
                          onChange={(e) => setHour(e.target.value)}
                          className={`${cellCls} pr-8 appearance-none font-medium text-center`}
                        >
                          <option value="">Giờ</option>
                          {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map((h) => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#98A2B3] pointer-events-none" />
                      </div>
                      <div className="relative">
                        <select
                          value={minute}
                          onChange={(e) => setMinute(e.target.value)}
                          className={`${cellCls} pr-8 appearance-none font-medium text-center`}
                        >
                          <option value="">00</option>
                          {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                        <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#98A2B3] pointer-events-none" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mt-1">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-[#475467]">
                      {t('gender')}
                    </label>
                    <div className="flex rounded-lg border border-[#E5E7EB] overflow-hidden h-11 bg-white">
                      <button
                        type="button"
                        onClick={() => setGender('male')}
                        className={`flex-1 flex items-center justify-center text-sm font-semibold border-0 cursor-pointer transition-all ${
                          gender === 'male'
                            ? 'bg-[#1D4D3F] text-white'
                            : 'bg-white text-[#475467] hover:bg-gray-50'
                        }`}
                      >
                        ♂ Nam
                      </button>
                      <div className="w-[1px] bg-[#E5E7EB]" />
                      <button
                        type="button"
                        onClick={() => setGender('female')}
                        className={`flex-1 flex items-center justify-center text-sm font-semibold border-0 cursor-pointer transition-all ${
                          gender === 'female'
                            ? 'bg-[#1D4D3F] text-white'
                            : 'bg-white text-[#475467] hover:bg-gray-50'
                        }`}
                      >
                        ♀ Nữ
                      </button>
                      <div className="w-[1px] bg-[#E5E7EB]" />
                      <button
                        type="button"
                        onClick={() => setGender('other')}
                        className={`flex-1 flex items-center justify-center text-sm font-semibold border-0 cursor-pointer transition-all ${
                          gender === 'other'
                            ? 'bg-[#1D4D3F] text-white'
                            : 'bg-white text-[#475467] hover:bg-gray-50'
                        }`}
                      >
                        ⚧ Khác
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-semibold text-[#475467]">
                      {t('calendarType')}
                    </label>
                    <div className="flex rounded-lg border border-[#E5E7EB] overflow-hidden h-11 bg-white">
                      <button
                        type="button"
                        onClick={() => setIsLunar(false)}
                        className={`flex-1 flex items-center justify-center text-sm font-semibold border-0 cursor-pointer transition-all px-4 ${
                          !isLunar
                            ? 'bg-[#1D4D3F] text-white'
                            : 'bg-white text-[#475467] hover:bg-gray-50'
                        }`}
                      >
                        Dương lịch
                      </button>
                      <div className="w-[1px] bg-[#E5E7EB]" />
                      <button
                        type="button"
                        onClick={() => setIsLunar(true)}
                        className={`flex-1 flex items-center justify-center text-sm font-semibold border-0 cursor-pointer transition-all px-4 ${
                          isLunar
                            ? 'bg-[#1D4D3F] text-white'
                            : 'bg-white text-[#475467] hover:bg-gray-50'
                        }`}
                      >
                        Âm lịch
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              {/* SECTION: Nội dung cần xem */}
              <section className="flex flex-col gap-4 border-t border-[#EAECF0] pt-5">
                <div className="flex items-center gap-2 pb-1">
                  <div className="flex h-5 w-5 items-center justify-center rounded-md bg-[#EEF5F1] text-[#1D4D3F]">
                    <MessageSquareText size={12} strokeWidth={2.5} />
                  </div>
                  <span className="text-sm font-semibold text-[#475467]">
                    Nội dung cần xem
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-[#475467]">
                    {t('questionLabel')}
                  </label>
                  <div className="relative">
                    <select
                      ref={questionRef}
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      className={`${cellCls} pl-10 pr-10 appearance-none`}
                    >
                      <option value="" disabled hidden>Chọn nội dung cần xem</option>
                      <option value="Sự nghiệp, công danh">Sự nghiệp, công danh</option>
                      <option value="Tình duyên, gia đạo">Tình duyên, gia đạo</option>
                      <option value="Tài lộc, tiền tài">Tài lộc, tiền tài</option>
                      <option value="Sức khỏe, tật ách">Sức khỏe, tật ách</option>
                      <option value="Cưới hỏi, hôn nhân">Cưới hỏi, hôn nhân</option>
                      <option value="Tổng hợp toàn diện">Tổng hợp toàn diện</option>
                    </select>
                    <BookOpen size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#98A2B3] pointer-events-none" />
                    <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#98A2B3] pointer-events-none" />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-semibold text-[#475467]">
                    {t('additionalContextLabel')}
                  </label>
                  <textarea
                    value={additionalContext}
                    onChange={(e) => setAdditionalContext(e.target.value)}
                    placeholder={t('additionalContextPlaceholder')}
                    rows={4}
                    className={`${cellCls} h-auto min-h-24 resize-y py-3 leading-relaxed`}
                  />
                </div>

                <label className="flex w-fit items-center gap-2 cursor-pointer select-none mt-1">
                  <div className={`flex h-4 w-4 items-center justify-center rounded border transition-all ${
                    useSolarTerms
                      ? 'border-[#1D4D3F] bg-[#1D4D3F] text-white'
                      : 'border-[#D0D5DD] bg-white text-transparent'
                  }`}>
                    <Check size={10} strokeWidth={3} />
                  </div>
                  <input
                    type="checkbox"
                    checked={useSolarTerms}
                    onChange={(e) => setUseSolarTerms(e.target.checked)}
                    className="sr-only"
                  />
                  <span className="text-xs text-[#475467] flex items-center gap-1.5">
                    {t('useSolarTermsLabel')}
                    <Info size={13} className="text-[#98A2B3] hover:text-[#667085] transition-colors" />
                  </span>
                </label>
              </section>

            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Divination Services */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-[0_4px_20px_rgba(0,0,0,0.02)] flex flex-col gap-5">

            <div className="flex flex-col leading-none border-b border-[#F2F4F7] pb-4">
              <h2 className="text-lg font-bold text-[#1A1F36]">
                {t('servicePackages')}
              </h2>
              <span className="text-sm text-[#667085] font-medium mt-1.5">
                Chọn các gói phù hợp với nhu cầu của bạn.
              </span>
            </div>

            <div className="flex flex-col gap-3">

              {/* Package 1: Bát tự */}
              <button
                type="button"
                onClick={() => togglePackage('tuTru')}
                className={`flex items-center gap-4 rounded-xl border p-4 text-left transition-all hover:bg-[#FAF9F6] shadow-[0_2px_8px_rgba(0,0,0,0.01)] border-0 cursor-pointer ${
                  packages.includes('tuTru')
                    ? 'border border-[#1D4D3F] bg-[#FAFBFB]'
                    : 'border border-[#E5E7EB] bg-white'
                }`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#EEF5F1] text-[#1D4D3F]">
                  <Sparkles size={18} strokeWidth={2.5} />
                </div>
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <span className="text-base font-bold text-[#1A1F36]">
                    {t('packageTuTru')}
                  </span>
                  <span className="text-xs text-[#667085] leading-relaxed">
                    {t('packageTuTruDesc')}
                  </span>
                </div>
                <div className="flex items-center justify-center shrink-0 ml-2">
                  <div className={`flex h-5 w-5 items-center justify-center rounded-md border transition-all ${
                    packages.includes('tuTru')
                      ? 'border-[#1D4D3F] bg-[#1D4D3F] text-white'
                      : 'border-gray-300 bg-white text-transparent'
                  }`}>
                    <Check size={12} strokeWidth={3} />
                  </div>
                </div>
              </button>

              {/* Package 2: Kinh dịch */}
              <button
                type="button"
                onClick={() => togglePackage('maiHoa')}
                className={`flex items-center gap-4 rounded-xl border p-4 text-left transition-all hover:bg-[#FAF9F6] shadow-[0_2px_8px_rgba(0,0,0,0.01)] border-0 cursor-pointer ${
                  packages.includes('maiHoa')
                    ? 'border border-[#1D4D3F] bg-[#FAFBFB]'
                    : 'border border-[#E5E7EB] bg-white'
                }`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#EEF5F1] text-[#1D4D3F]">
                  <BookOpen size={18} strokeWidth={2.5} />
                </div>
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <span className="text-base font-bold text-[#1A1F36]">
                    {t('packageMaiHoa')}
                  </span>
                  <span className="text-xs text-[#667085] leading-relaxed">
                    {t('packageMaiHoaDesc')}
                  </span>
                </div>
                <div className="flex items-center justify-center shrink-0 ml-2">
                  <div className={`flex h-5 w-5 items-center justify-center rounded-md border transition-all ${
                    packages.includes('maiHoa')
                      ? 'border-[#1D4D3F] bg-[#1D4D3F] text-white'
                      : 'border-gray-300 bg-white text-transparent'
                  }`}>
                    <Check size={12} strokeWidth={3} />
                  </div>
                </div>
              </button>

              {/* Package 3: Sim phong thủy */}
              <button
                type="button"
                onClick={() => togglePackage('sim')}
                className={`flex items-center gap-4 rounded-xl border p-4 text-left transition-all hover:bg-[#FAF9F6] shadow-[0_2px_8px_rgba(0,0,0,0.01)] border-0 cursor-pointer ${
                  packages.includes('sim')
                    ? 'border border-[#1D4D3F] bg-[#FAFBFB]'
                    : 'border border-[#E5E7EB] bg-white'
                }`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#EEF5F1] text-[#1D4D3F]">
                  <Compass size={18} strokeWidth={2.5} />
                </div>
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <span className="text-base font-bold text-[#1A1F36]">
                    {t('packageSim')}
                  </span>
                  <span className="text-xs text-[#667085] leading-relaxed">
                    {t('packageSimDesc')}
                  </span>
                </div>
                <div className="flex items-center justify-center shrink-0 ml-2">
                  <div className={`flex h-5 w-5 items-center justify-center rounded-md border transition-all ${
                    packages.includes('sim')
                      ? 'border-[#1D4D3F] bg-[#1D4D3F] text-white'
                      : 'border-gray-300 bg-white text-transparent'
                  }`}>
                    <Check size={12} strokeWidth={3} />
                  </div>
                </div>
              </button>

            </div>

            {errors.packages && (
              <span className="text-[11px] text-semantic-error font-medium">{errors.packages}</span>
            )}

            <button
              type="button"
              disabled={!canSynthesize}
              onClick={() => setIncludeSynthesis((prev) => !prev)}
              className={`flex w-full items-start gap-4 rounded-xl border px-4 py-3.5 text-left transition-all shadow-[0_2px_8px_rgba(0,0,0,0.01)] ${
                !canSynthesize
                  ? 'cursor-not-allowed border-[#E5E7EB] bg-[#F7F8FA] opacity-60'
                  : includeSynthesis
                    ? 'cursor-pointer border-[#D3E7DA] bg-[#EEF5F1]'
                    : 'cursor-pointer border-[#E5E7EB] bg-white hover:bg-[#FAF9F6]'
              }`}
            >
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                includeSynthesis && canSynthesize
                  ? 'bg-[#1D4D3F] text-white'
                  : 'bg-[#F2F4F7] text-[#667085]'
              }`}>
                <Check size={16} strokeWidth={2.5} />
              </div>
              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <span className="text-base font-bold text-[#1A1F36]">
                  {t('includeSynthesisLabel')}
                </span>
                <span className="text-xs leading-relaxed text-[#525866]">
                  {t('includeSynthesisHint')}
                </span>
              </div>
              <div className="flex items-center justify-center shrink-0 ml-2 mt-1">
                <div className={`relative h-6 w-11 rounded-full transition-colors duration-200 ${
                  includeSynthesis && canSynthesize ? 'bg-[#1D4D3F]' : 'bg-gray-200'
                }`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-in-out mt-1 ${
                    includeSynthesis && canSynthesize ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </div>
              </div>
            </button>

            {/* Conditional Phone Number Field with Smooth Expand */}
            <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
              needsPhone ? 'max-h-24 opacity-100' : 'max-h-0 opacity-0 pointer-events-none'
            }`}>
              <div className="flex flex-col gap-1 border-t border-[#EAECF0] pt-3.5 mt-1">
                <label className="text-[11px] font-semibold text-[#475467]">
                  Số điện thoại cần xem <span className="text-[10px] text-[#8A93A6] font-normal">(không bắt buộc)</span>
                </label>
                <div className="relative">
                  <input
                    value={phoneNumber}
                    onChange={(e) => {
                      setPhoneNumber(e.target.value);
                      if (e.target.value.trim()) clearError('phoneNumber');
                    }}
                    placeholder={t('phoneNumberPlaceholder')}
                    inputMode="tel"
                    autoComplete="off"
                    className="h-10 w-full rounded-lg border border-[#E5E7EB] bg-[#FAFBFB] pl-9 pr-3.5 text-xs text-[#1A1F36] placeholder:text-[#98A2B3] focus:border-[#1D4D3F] focus:bg-white focus:outline-none transition-all"
                  />
                  <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#98A2B3]" />
                </div>
                {errors.phoneNumber && (
                  <span className="text-[11px] text-semantic-error font-medium">{errors.phoneNumber}</span>
                )}
              </div>
            </div>

            {/* Bảo mật thông tin Card */}
            <div className="flex items-center gap-3 rounded-xl border border-[#E3EBE6] bg-[#F4F7F5] p-2.5 px-3.5 mt-1.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1D4D3F]/10 text-[#1D4D3F]">
                <Shield size={14} />
              </div>
              <p className="text-[11px] leading-normal text-[#525866]">
                <strong className="font-bold text-[#1D4D3F] mr-1">Bảo mật thông tin:</strong>
                Mọi dữ liệu bạn cung cấp sẽ được bảo mật tuyệt đối và chỉ phục vụ cho mục đích luận giải.
              </p>
            </div>

            {/* Submit Button */}
            <div className="flex justify-center mt-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 inline-flex items-center justify-center gap-2 bg-[#1D4D3F] text-white font-bold rounded-lg shadow-[0_4px_14px_rgba(29,77,63,0.15)] hover:bg-[#153A2F] active:scale-[0.98] transition-all duration-200 border-0 disabled:opacity-50 disabled:pointer-events-none cursor-pointer text-sm"
              >
                {isSubmitting ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <>
                    <span>Tạo hồ sơ & Bắt đầu luận giải</span>
                    <span className="text-base font-medium ml-1">→</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>

      </div>
    </form>
  );
}
