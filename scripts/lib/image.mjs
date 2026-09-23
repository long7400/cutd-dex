import sharp from 'sharp';

// PNG của game → WebP (~82% nhẹ hơn, chất lượng 82 không phân biệt được bằng mắt; giữ alpha).
// size: thu nhỏ về size×size nếu ảnh gốc lớn hơn (icon skill chỉ hiển thị ~36px).
export const toWebp = (input, { size } = {}) => {
  let img = sharp(input);
  if (size) img = img.resize(size, size, { fit: 'inside', withoutEnlargement: true });
  return img.webp({ quality: 82, alphaQuality: 90, effort: 5 }).toBuffer();
};
