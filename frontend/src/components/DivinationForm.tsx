'use client';

import { BookOpen, Phone, Play, Sparkles, User, Calendar, Compass, Info, ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ConfigProvider, DatePicker } from 'antd';
import viVN from 'antd/locale/vi_VN';
import dayjs, { type Dayjs } from 'dayjs';
import 'dayjs/locale/vi';
import type { CustomerInfo, Gender, PackageType } from '../types';
import { Button } from './ui/Button';

dayjs.locale('vi');

interface DivinationFormProps {
  onSubmit: (data: CustomerInfo) => void;
  isSubmitting?: boolean;
}

const CURRENT_YEAR = new Date().getFullYear();

const PACKAGE_DEFS: {
  value: PackageType;
  labelKey: string;
  descKey: string;
  icon: typeof Sparkles;
  iconBg: string;
  iconText: string;
}[] = [
  { value: 'tuTru', labelKey: 'packageTuTru', descKey: 'packageTuTruDesc', icon: Sparkles, iconBg: 'bg-[#F5F3FF]', iconText: 'text-[#7C3AED]' },
  { value: 'maiHoa', labelKey: 'packageMaiHoa', descKey: 'packageMaiHoaDesc', icon: BookOpen, iconBg: 'bg-[#EFF6FF]', iconText: 'text-[#3B82F6]' },
  { value: 'sim', labelKey: 'packageSim', descKey: 'packageSimDesc', icon: Phone, iconBg: 'bg-[#FAF5FF]', iconText: 'text-[#9333EA]' },
];

export function DivinationForm({ onSubmit, isSubmitting }: DivinationFormProps) {
  const t = useTranslations('form');

  const [fullName, setFullName] = useState('');
  const [day, setDay] = useState<string>('');
  const [month, setMonth] = useState<string>('');
  const [year, setYear] = useState<string>('');
  const [hour, setHour] = useState<string>('');
  const [minute, setMinute] = useState<string>('0');
  const [isLunar, setIsLunar] = useState<boolean>(false);
  const [gender, setGender] = useState<Gender>('male');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [question, setQuestion] = useState('Sự nghiệp');
  const [useSolarTerms, setUseSolarTerms] = useState(false);
  const [packages, setPackages] = useState<PackageType[]>(['tuTru', 'maiHoa', 'sim']);
  const [errors, setErrors] = useState<Record<string, string>>({});


  const togglePackage = (pkg: PackageType) => {
    setPackages((prev) =>
      prev.includes(pkg) ? prev.filter((p) => p !== pkg) : [...prev, pkg],
    );
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
      next.birth = 'Ngày/tháng/năm không hợp lệ';
    } else {
      // Validate day matches month (handles Feb, 30/31-day months)
      const daysInMonth = new Date(y, m, 0).getDate();
      if (d > daysInMonth) {
        next.birth = `Tháng ${m}/${y} chỉ có ${daysInMonth} ngày`;
      }
    }

    if (packages.length === 0) next.packages = t('validation.packageRequired');
    if (packages.includes('sim') && !phoneNumber.trim()) {
      next.phoneNumber = t('validation.phoneRequired');
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const clampNumber = (
    val: string,
    min: number,
    max: number,
    setter: (s: string) => void,
  ) => {
    if (val === '') {
      setter('');
      return;
    }
    const n = Number(val);
    if (!Number.isFinite(n)) return;
    if (n < min) setter(String(min));
    else if (n > max) setter(String(max));
    else setter(val);
  };

  const setDigits = (
    val: string,
    maxLen: number,
    setter: (s: string) => void,
    nextRef?: React.RefObject<HTMLInputElement>,
  ) => {
    const digits = val.replace(/\D/g, '').slice(0, maxLen);
    setter(digits);
    // Auto-advance to next field when this one is full
    if (digits.length === maxLen && nextRef?.current) {
      nextRef.current.focus();
      nextRef.current.select();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    const hourNum = hour.trim() === '' ? null : Number(hour);
    onSubmit({
      fullName: fullName.trim(),
      day: Number(day),
      month: Number(month),
      year: Number(year),
      hour: hourNum,
      minute: minute.trim() === '' ? 0 : Number(minute),
      isLunar,
      gender,
      packages,
      phoneNumber: packages.includes('sim') ? phoneNumber.trim() : undefined,
      question: question.trim() ? question.trim() : undefined,
      useSolarTerms: useSolarTerms,
    });
  };

  const cellCls =
    'h-11 w-full rounded border border-gray-200 bg-[#F7F8FC] px-3.5 text-sm text-[#1A1F36] placeholder:text-text-tertiary focus:border-accent-primary focus:bg-white focus:outline-none transition-all duration-200 focus:ring-2 focus:ring-accent-primary/10';
  const errCls = 'border-semantic-error/60 focus:ring-semantic-error/20 focus:border-semantic-error';
  const needsPhone = packages.includes('sim');

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-6"
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Side: Personal Profile Form */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 lg:col-span-7 flex flex-col gap-5 shadow-sm">
          <div className="flex items-center gap-3 border-b border-border/30 pb-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EFF6FF] text-[#5B6CFF]">
              <User size={16} />
            </div>
            <h3 className="text-base font-bold tracking-wide text-text-primary uppercase">
              {t('title')}
            </h3>
          </div>

          <div className="flex flex-col gap-4">
            {/* Full Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">
                {t('customerName')}
              </label>
              <div className="relative">
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={t('customerNamePlaceholder')}
                  autoComplete="off"
                  className={`${cellCls} pl-10 ${errors.fullName ? errCls : ''}`}
                />
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
              </div>
              {errors.fullName && (
                <span className="text-[11px] text-semantic-error font-medium">{errors.fullName}</span>
              )}
            </div>

            {/* Grid for Birth Date & Hour, calendar & gender */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              {/* Birth Date */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">
                  {t('birthDate')}
                </label>
                <ConfigProvider
                  locale={viVN}
                  theme={{
                    token: {
                      colorPrimary: '#5B6CFF',
                      borderRadius: 6,
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
                      } else {
                        setDay('');
                        setMonth('');
                        setYear('');
                      }
                    }}
                    format={['DD/MM/YYYY', 'DDMMYYYY', 'D/M/YYYY']}
                    placeholder="DD/MM/YYYY (vd: 02122003)"
                    size="large"
                    style={{ width: '100%', height: 44 }}
                    minDate={dayjs('1900-01-01')}
                    maxDate={dayjs()}
                    status={errors.birth ? 'error' : undefined}
                  />
                </ConfigProvider>
                {errors.birth && (
                  <span className="text-[11px] text-semantic-error font-medium">{errors.birth}</span>
                )}
              </div>

              {/* Birth Hour + Minute */}
              <div className="flex flex-col gap-1.5 justify-between">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">
                    Giờ sinh
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={2}
                      value={hour}
                      onChange={(e) => setDigits(e.target.value, 2, setHour)}
                      onBlur={(e) => clampNumber(e.target.value, 0, 23, setHour)}
                      placeholder="Giờ"
                      className={`${cellCls} text-center`}
                    />
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={2}
                      value={minute}
                      onChange={(e) => setDigits(e.target.value, 2, setMinute)}
                      onBlur={(e) => clampNumber(e.target.value, 0, 59, setMinute)}
                      placeholder="Phút"
                      className={`${cellCls} text-center`}
                    />
                  </div>
                </div>
                <span className="text-[10px] text-text-tertiary">Để trống nếu không rõ giờ</span>
              </div>

              {/* Calendar type */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">
                  Loại lịch
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIsLunar(false)}
                    className={`flex h-10 items-center justify-center rounded border px-4 text-xs font-semibold transition-all ${
                      !isLunar
                        ? 'border-[#3B82F6] bg-[#EFF6FF] text-[#3B82F6]'
                        : 'border-gray-200 bg-white text-text-secondary hover:border-gray-300 hover:text-text-primary'
                    }`}
                  >
                    Dương lịch
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsLunar(true)}
                    className={`flex h-10 items-center justify-center rounded border px-4 text-xs font-semibold transition-all ${
                      isLunar
                        ? 'border-[#3B82F6] bg-[#EFF6FF] text-[#3B82F6]'
                        : 'border-gray-200 bg-white text-text-secondary hover:border-gray-300 hover:text-text-primary'
                    }`}
                  >
                    Âm lịch
                  </button>
                </div>
              </div>

              {/* Gender */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">
                  {t('gender')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setGender('male')}
                    className={`flex h-10 items-center justify-center gap-1 rounded border px-4 text-xs font-semibold transition-all ${
                      gender === 'male'
                        ? 'border-[#3B82F6] bg-[#EFF6FF] text-[#3B82F6]'
                        : 'border-gray-200 bg-white text-text-secondary hover:border-gray-300 hover:text-text-primary'
                    }`}
                  >
                    <span>♂ Nam</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGender('female')}
                    className={`flex h-10 items-center justify-center gap-1 rounded border px-4 text-xs font-semibold transition-all ${
                      gender === 'female'
                        ? 'border-[#3B82F6] bg-[#EFF6FF] text-[#3B82F6]'
                        : 'border-gray-200 bg-white text-text-secondary hover:border-gray-300 hover:text-text-primary'
                    }`}
                  >
                    <span>♀ Nữ</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Việc cần xem + Lịch tiết khí */}
            <div className="flex flex-col gap-1.5 pt-3 border-t border-border/20">
              <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">
                Việc cần xem
              </label>
              <div className="relative">
                <input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ví dụ: cưới hỏi, sự nghiệp, tài lộc..."
                  autoComplete="off"
                  className={`${cellCls} pl-10 pr-10`}
                />
                <BookOpen size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
                <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" />
              </div>
              <label className="flex items-center gap-2 mt-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={useSolarTerms}
                  onChange={(e) => setUseSolarTerms(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 bg-white text-[#3B82F6] focus:ring-[#3B82F6]/20 cursor-pointer"
                />
                <span className="text-xs text-text-secondary flex items-center gap-1.5">
                  Dùng lịch tiết khí để lập quẻ
                  <Info size={13} className="text-text-tertiary hover:text-text-secondary transition-colors" />
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Right Side: Divination Packages — Blue Gradient Card */}
        <div className="bg-gradient-to-br from-[#1D4ED8] to-[#4F46E5] text-white rounded-card p-6 lg:col-span-5 flex flex-col gap-5 shadow-elevated border border-white/10">
          <div className="flex items-center gap-3 border-b border-white/15 pb-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-white">
              <Compass size={16} />
            </div>
            <div className="flex flex-col leading-none">
              <h3 className="text-base font-bold tracking-wide text-white uppercase">
                {t('servicePackages')}
              </h3>
              <span className="text-[11px] text-white/70 font-medium mt-1">
                {t('packagesHint')}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {PACKAGE_DEFS.map(({ value, labelKey, descKey, icon: Icon, iconBg, iconText }) => {
              const active = packages.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => togglePackage(value)}
                  className="flex items-center gap-4 rounded-card border border-gray-200/50 bg-white p-4 text-left transition-all hover:bg-gray-50 shadow-sm"
                >
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconBg} ${iconText}`}>
                    <Icon size={18} />
                  </div>
                  <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                    <span className="text-sm font-bold tracking-wide text-[#1A1F36]">
                      {t(labelKey)}
                    </span>
                    <span className="text-xs text-[#525866] leading-relaxed">
                      {t(descKey)}
                    </span>
                  </div>
                  <div className="flex items-center justify-center shrink-0 ml-2">
                    {active ? (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#3B82F6] text-white text-[10px] font-bold shadow-sm">
                        ✓
                      </div>
                    ) : (
                      <div className="h-5 w-5 rounded-full border border-gray-300 bg-white" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {errors.packages && (
            <span className="text-[11px] text-red-200 font-medium">{errors.packages}</span>
          )}

          {/* Conditional Phone Number Field with Smooth Expand */}
          <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
            needsPhone ? 'max-h-28 opacity-100 mt-2' : 'max-h-0 opacity-0 pointer-events-none'
          }`}>
            <div className="flex flex-col gap-1.5 border-t border-white/15 pt-3">
              <label className="text-[11px] font-bold text-white/90 uppercase tracking-wider">
                Số điện thoại nhận kết quả
              </label>
              <div className="relative">
                <input
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="Ví dụ: 0944131033"
                  inputMode="tel"
                  autoComplete="off"
                  className="h-11 w-full rounded-card border border-white/25 bg-white/10 pl-10 pr-3.5 text-sm text-white placeholder:text-white/50 focus:bg-white/15 focus:border-white focus:outline-none transition-all"
                />
                <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/60" />
              </div>
              {errors.phoneNumber && (
                <span className="text-[11px] text-red-200 font-medium">{errors.phoneNumber}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex justify-center mt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full sm:w-auto min-w-[320px] h-12 inline-flex items-center justify-center gap-2.5 bg-gradient-to-r from-[#3B82F6] via-[#6366F1] to-[#A855F7] text-white font-bold uppercase tracking-wider rounded-full shadow-elevated hover:scale-[1.01] active:scale-[0.98] transition-all duration-200 border-0 hover:shadow-lg hover:shadow-indigo-500/25 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
        >
          {isSubmitting ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <Sparkles size={16} />
          )}
          <span>{t('runButton')}</span>
        </button>
      </div>
    </form>
  );
}

