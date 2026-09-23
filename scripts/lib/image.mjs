import sharp from 'sharp';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export const toWebp = (input, { size } = {}) => {
  if (!Buffer.isBuffer(input) || input.length < 8 || !input.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error('không phải file PNG');
  }
  let img = sharp(input, { failOn: 'error', limitInputPixels: 2048 * 2048 });
  if (size) img = img.resize(size, size, { fit: 'inside', withoutEnlargement: true });
  return img.webp({ quality: 82, alphaQuality: 90, effort: 5 }).toBuffer();
};
