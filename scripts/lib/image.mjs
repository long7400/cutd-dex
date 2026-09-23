import sharp from 'sharp';

// PNG của game → WebP (~82% nhẹ hơn, chất lượng 82 không phân biệt được bằng mắt; giữ alpha).
export const toWebp = input => sharp(input).webp({ quality: 82, alphaQuality: 90, effort: 5 }).toBuffer();
