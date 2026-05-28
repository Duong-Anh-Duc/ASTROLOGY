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

const TITLE_RE = /^(anh|chị|chi|bạn|ban|em|cô|co|chú|chu|bác|bac|thầy|thay|cậu|cau|mợ|mo|dì|di|ông|ong|bà|ba)$/i;

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

function displayName(customer: CustomerInfo): string {
  const name = customer.fullName.trim();
  const addressing = customer.addressing?.trim();
  if (!addressing) return `${defaultTitle(customer)} ${name}`;

  const lowerName = name.toLocaleLowerCase('vi-VN');
  const lowerAddressing = addressing.toLocaleLowerCase('vi-VN');
  if (lowerAddressing.includes(lowerName)) return addressing;
  if (TITLE_RE.test(addressing)) return `${addressing} ${name}`;
  return `${defaultTitle(customer)} ${name}`;
}

export function customerBlock(customer: CustomerInfo): string {
  const yearInfo = sexagenaryYear(customer.year);
  return [
    `- Họ tên: ${customer.fullName}`,
    `- Tên gọi trong bài: ${displayName(customer)}`,
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
- Khi viết tiêu đề hoặc mở bài, ưu tiên đúng "Tên gọi trong bài". Trong nội dung, tuân thủ "Cách xưng hô bắt buộc" nếu có; nếu không có thì xưng theo giới tính.
- Khi luận nạp âm năm sinh, dùng dòng "Năm sinh tham chiếu theo năm nhập" làm mốc kiểm tra. Không tự đổi nạp âm năm sinh sang mệnh khác nếu lá số nguồn không chứng minh rõ.
- Không tự thêm biến cố, con cái, hôn nhân hoặc nhu cầu chưa được nêu.`;
}
