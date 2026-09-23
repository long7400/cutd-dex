import sharp from 'sharp';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// PNG của game → WebP (~82% nhẹ hơn, chất lượng 82 không phân biệt được bằng mắt; giữ alpha).
// Ảnh đến từ server ngoài nên coi là dữ liệu không tin cậy:
//  • chỉ nhận đúng chữ ký PNG (không cho libvips tự đoán định dạng → không chạm tới parser HEIF/SVG/…)
//  • giới hạn số pixel, báo lỗi ngay với ảnh hỏng (failOn: 'error')
// size: thu nhỏ về size×size nếu ảnh gốc lớn hơn (icon skill chỉ hiển thị ~36px).
export const toWebp = (input, { size } = {}) => {
  if (!Buffer.isBuffer(input) || input.length < 8 || !input.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('không phải file PNG');
  }
  let img = sharp(input, { failOn: 'error', limitInputPixels: 2048 * 2048 });
  if (size) img = img.resize(size, size, { fit: 'inside', withoutEnlargement: true });
  return img.webp({ quality: 82, alphaQuality: 90, effort: 5 }).toBuffer();
};
