// Định dạng thời gian hiển thị chuẩn GMT+7 (Bangkok, Hanoi, Jakarta)
export function formatGMT7(isoString: string | Date): string {
  const date = typeof isoString === 'string' ? new Date(isoString) : isoString;
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Bangkok', // GMT+7.00
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date) + ' (GMT+7)';
}

// Chuyển chuỗi từ ô input datetime-local (người dùng nhập theo giờ VN) sang chuẩn ISO UTC để lưu Supabase
export function localGMT7ToISO(localDateTimeStr: string): string {
  // localDateTimeStr có dạng "2026-11-20T14:30"
  if (!localDateTimeStr) return new Date().toISOString();
  return new Date(`${localDateTimeStr}:00+07:00`).toISOString();
}

// Chuyển ISO từ Supabase sang chuỗi "YYYY-MM-DDTHH:mm" theo GMT+7 để điền vào ô input sửa
export function isoToLocalGMT7Input(isoString: string): string {
  const date = new Date(isoString);
  const utcMs = date.getTime() + date.getTimezoneOffset() * 60000;
  const gmt7Date = new Date(utcMs + 7 * 3600000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${gmt7Date.getFullYear()}-${pad(gmt7Date.getMonth() + 1)}-${pad(gmt7Date.getDate())}T${pad(gmt7Date.getHours())}:${pad(gmt7Date.getMinutes())}`;
}
