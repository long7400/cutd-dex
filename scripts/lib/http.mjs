// fetch có timeout, retry (exponential backoff + jitter, tôn trọng Retry-After)
// và conditional GET (If-None-Match / If-Modified-Since → 304 không tải lại byte nào).

const UA = 'cutd-dex-sync/2 (+https://github.com/long7400/cutd-dex)';
const sleep = ms => new Promise(r => setTimeout(r, ms));

export class HttpError extends Error {
  constructor(url, status) {
    super(`${url} → HTTP ${status}`);
    this.status = status;
    this.retryable = status === 408 || status === 429 || status >= 500;
  }
}

export class TooLarge extends Error {
  constructor(url, size, max) { super(`${url} quá lớn (${size} > ${max} byte)`); }
}

export const stats = { requests: 0, notModified: 0, bytes: 0, retries: 0 };

// maxBytes: chặn server trả về dữ liệu khổng lồ (DoS bộ nhớ) — đọc theo luồng, vượt ngưỡng là huỷ.
export async function request(url, { validator, timeout = 30_000, retries = 3, maxBytes = 8 * 1024 * 1024 } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      const headers = { 'user-agent': UA };
      if (validator?.etag) headers['if-none-match'] = validator.etag;
      if (validator?.lastModified) headers['if-modified-since'] = validator.lastModified;
      stats.requests++;
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(timeout) });
      if (res.status === 304) {
        stats.notModified++;
        return { notModified: true, validator };
      }
      if (!res.ok) {
        const err = new HttpError(url, res.status);
        err.retryAfter = Number(res.headers.get('retry-after')) || 0;
        throw err;
      }
      const declared = Number(res.headers.get('content-length'));
      if (declared > maxBytes) throw new TooLarge(url, declared, maxBytes);
      const chunks = [];
      let size = 0;
      for await (const chunk of res.body) {
        size += chunk.length;
        if (size > maxBytes) throw new TooLarge(url, size, maxBytes);
        chunks.push(chunk);
      }
      const body = Buffer.concat(chunks);
      stats.bytes += body.length;
      return {
        notModified: false,
        body,
        text: () => body.toString('utf8'),
        json: () => JSON.parse(body.toString('utf8')),
        validator: {
          etag: res.headers.get('etag') ?? undefined,
          lastModified: res.headers.get('last-modified') ?? undefined,
        },
      };
    } catch (e) {
      const retryable = e instanceof HttpError ? e.retryable : !(e instanceof TooLarge); // lỗi mạng/timeout → thử lại
      if (!retryable || attempt >= retries) throw e;
      stats.retries++;
      const wait = e.retryAfter ? e.retryAfter * 1000 : 500 * 2 ** attempt + Math.random() * 250;
      await sleep(Math.min(wait, 15_000));
    }
  }
}

// Chạy fn trên items với tối đa `limit` tác vụ song song; không dừng khi 1 item lỗi.
export async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      try { results[i] = { ok: true, value: await fn(items[i], i) }; }
      catch (error) { results[i] = { ok: false, error }; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
