import type { CustomerInfo } from '../types';

const CAN = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'];
const CHI = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'];

const NA_YIN_BY_PAIR = [
  'Hải Trung Kim',
  'Lư Trung Hỏa',
  'Đại Lâm Mộc',
  'Lộ Bàng Thổ',
  'Kiếm Phong Kim',
  'Sơn Đầu Hỏa',
  'Giản Hạ Thủy',
  'Thành Đầu Thổ',
  'Bạch Lạp Kim',
  'Dương Liễu Mộc',
  'Tuyền Trung Thủy',
  'Ốc Thượng Thổ',
  'Tích Lịch Hỏa',
  'Tùng Bách Mộc',
  'Trường Lưu Thủy',
  'Sa Trung Kim',
  'Sơn Hạ Hỏa',
  'Bình Địa Mộc',
  'Bích Thượng Thổ',
  'Kim Bạch Kim',
  'Phúc Đăng Hỏa',
  'Thiên Hà Thủy',
  'Đại Trạch Thổ',
  'Thoa Xuyến Kim',
  'Tang Đố Mộc',
  'Đại Khê Thủy',
  'Sa Trung Thổ',
  'Thiên Thượng Hỏa',
  'Thạch Lựu Mộc',
  'Đại Hải Thủy',
];

const TITLE_RE = /^(anh|chị|chi|bạn|ban|em|cô|co|chú|chu|bác|bac|thầy|thay|cậu|cau|mợ|mo|dì|di|ông|ong|bà|ba|mình|minh)$/i;

function sexagenaryYear(year: number): { canChi: string; naYin: string } {
  const index = ((year - 1984) % 60 + 60) % 60;
  return {
    canChi: `${CAN[index % 10]} ${CHI[index % 12]}`,
    naYin: NA_YIN_BY_PAIR[Math.floor(index / 2)],
  };
}

function defaultTitle(customer: CustomerInfo): string {
  return customer.gender === 'male' ? 'anh' : 'chị';
}

function cleanAddressing(addressing?: string): string {
  return addressing?.replace(/[+_]+/g, ' ').replace(/\s+/g, ' ').trim() ?? '';
}

function explicitPronounPair(addressing?: string): { narrator: string; customer: string } | null {
  const clean = cleanAddressing(addressing);
  if (!clean) return null;
  const match = clean.match(
    /(?:người viết|nguoi viet|bên viết|ben viet)?\s*xưng\s*["“]?([^"”;,]+?)["”]?\s*,?\s*(?:và\s*)?(?:gọi khách là|goi khach la|gọi người xem là|goi nguoi xem la|gọi là|goi la)\s*["“]?([^"”;,]+?)["”]?(?:[;,]|$)/i,
  );
  if (!match) return null;
  const narrator = canonicalTitle(match[1].trim().toLocaleLowerCase('vi-VN'));
  const customer = canonicalTitle(match[2].trim().toLocaleLowerCase('vi-VN'));
  if (!narrator || !customer) return null;
  return { narrator, customer };
}

function explicitDisplayName(addressing?: string): string | null {
  const clean = cleanAddressing(addressing);
  if (!clean) return null;
  const match = clean.match(
    /(?:tên gọi trong bài|ten goi trong bai|cách gọi trong bài|cach goi trong bai)\s*(?:là|la|:)\s*["“]?([^"”;,]+?)["”]?(?:[;,]|$)/i,
  );
  const value = match?.[1]?.trim();
  return value && value.length > 0 ? value : null;
}

function firstWord(value: string): string {
  return value.trim().split(/\s+/)[0]?.toLocaleLowerCase('vi-VN') ?? '';
}

function canonicalTitle(title: string): string {
  const map: Record<string, string> = {
    chi: 'chị',
    ban: 'bạn',
    co: 'cô',
    chu: 'chú',
    bac: 'bác',
    thay: 'thầy',
    cau: 'cậu',
    mo: 'mợ',
    di: 'dì',
    ong: 'ông',
    ba: 'bà',
    minh: 'mình',
  };
  return map[title] ?? title;
}

function displayName(customer: CustomerInfo): string {
  const name = customer.fullName.trim();
  const addressing = cleanAddressing(customer.addressing);
  const explicit = explicitPronounPair(addressing);
  const explicitName = explicitDisplayName(addressing);
  if (explicitName) return explicitName;
  if (!addressing) return `${defaultTitle(customer)} ${name}`;

  const lowerName = name.toLocaleLowerCase('vi-VN');
  const lowerAddressing = addressing.toLocaleLowerCase('vi-VN');
  if (lowerAddressing.includes(lowerName)) return addressing;
  if (explicit?.customer) return `${explicit.customer} ${name}`;
  if (TITLE_RE.test(addressing)) return `${addressing} ${name}`;
  if (TITLE_RE.test(firstWord(addressing))) return addressing;
  return `${defaultTitle(customer)} ${name}`;
}

function customerPronoun(customer: CustomerInfo): string {
  const explicit = explicitPronounPair(customer.addressing);
  if (explicit) return explicit.customer;
  const title = firstWord(displayName(customer));
  if (TITLE_RE.test(title)) return canonicalTitle(title);
  return defaultTitle(customer);
}

function narratorPronoun(customer: CustomerInfo): string {
  const explicit = explicitPronounPair(customer.addressing);
  if (explicit) return explicit.narrator;
  const title = customerPronoun(customer);
  if (title === 'em') return 'chị';
  if (title === 'bạn' || title === 'ban' || title === 'mình' || title === 'minh') return 'mình';
  return 'em';
}

export function customerBlock(customer: CustomerInfo): string {
  const yearInfo = sexagenaryYear(customer.year);
  const display = displayName(customer);
  const customerCall = customerPronoun(customer);
  const narrator = narratorPronoun(customer);
  return [
    `- Họ tên: ${customer.fullName}`,
    `- Tên gọi trong bài: ${display}`,
    `- Cặp xưng hô bắt buộc: người viết xưng "${narrator}", gọi khách là "${customerCall}" xuyên suốt toàn bài`,
    `- Cách gọi khách khi chào/mở bài: ${display}`,
    `- Ngày sinh: ${customer.day}/${customer.month}/${customer.year}${customer.isLunar ? ' (Âm lịch)' : ' (Dương lịch)'}`,
    `- Năm sinh tham chiếu theo năm nhập: ${customer.year} - ${yearInfo.canChi}, nạp âm năm: ${yearInfo.naYin}`,
    `- Giờ sinh: ${customer.hour === null ? 'Không rõ' : `${customer.hour}:${String(customer.minute ?? 0).padStart(2, '0')}`}`,
    `- Giới tính: ${customer.gender === 'male' ? 'Nam' : 'Nữ'}`,
    customer.phoneNumber ? `- Số điện thoại: ${customer.phoneNumber}` : '',
    customer.addressing ? `- Cách xưng hô bắt buộc: ${customer.addressing}` : '',
    customer.question ? `- Việc cần xem: ${customer.question}` : '',
    customer.additionalContext ? `- Thông tin và yêu cầu riêng của lượt này:\n${customer.additionalContext}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export function actualCustomerInstruction(customer: CustomerInfo): string {
  return `DỮ LIỆU THỰC TẾ CỦA LƯỢT LUẬN GIẢI NÀY:
${customerBlock(customer)}

QUY TẮC BẮT BUỘC:
- Luôn dùng dữ liệu thực tế ở trên; mọi tên, danh xưng, ví dụ hoặc tình tiết trong prompt hệ thống chỉ là mẫu nếu khác dữ liệu trên.
- Khóa cứng cặp xưng hô ở dòng "Cặp xưng hô bắt buộc". Từ câu chào, tiêu đề, các phần thân bài đến lời kết đều chỉ dùng đúng cặp này. Không đổi qua lại giữa anh/chị/bạn/em/mình/tớ/cậu hoặc bất kỳ đại từ nào khác ngoài cặp đã khóa.
- Khi viết tiêu đề hoặc mở bài, dùng đúng "Tên gọi trong bài" hoặc "Cách gọi khách khi chào/mở bài". Trong nội dung, gọi khách bằng đúng đại từ đã khóa, không tự suy theo tuổi nếu input đã có cách xưng hô.
- Khi luận nạp âm năm sinh, dùng dòng "Năm sinh tham chiếu theo năm nhập" làm mốc kiểm tra. Không tự đổi nạp âm năm sinh sang mệnh khác nếu lá số nguồn không chứng minh rõ.
- Không tự thêm biến cố, con cái, hôn nhân hoặc nhu cầu chưa được nêu.`;
}
