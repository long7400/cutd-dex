# CUTD Wiki — Moonlit Court

Wiki cho game [CUTD](https://cutd.site): toàn bộ pet + cây tiến hóa (kể cả rẽ nhánh), 731 sinh vật,
kỹ năng mô tả **y như trong game** (dùng bảng dịch tiếng Việt chính thức của game), đợt quái của mọi chế độ,
trade, wild pool, nghiên cứu, luật chơi, bảng sát thương và lịch sử cập nhật. Tự đồng bộ với server game.

## Chạy

```bash
npm install
npm run dev          # dev server (tự build src/data/db.json trước)
npm run build        # build production → dist/
npm test             # unit test + kiểm tra toàn vẹn data + test UI (jsdom) crawl mọi link
npm run sync         # kéo dữ liệu mới từ game (chỉ tải khi có thay đổi)
npm run sync:force   # bỏ qua cache, tải + kiểm tra lại toàn bộ
```

## Cấu trúc

```
data/                    # dữ liệu thô từ game (commit vào git → xem diff mỗi lần game update)
  catalog.json           #   GET /catalog (pretty-print để diff đọc được)
  client.json            #   bóc từ bundle JS: model, unit→model, màu hệ, bảng dịch vi
  changelog.json         #   lịch sử thay đổi tự sinh
  state.json             #   ETag/Last-Modified cho conditional GET
public/portraits, research/, skills/   # portrait, icon nghiên cứu, icon skill (WebP, chuyển từ PNG của game bằng sharp)
scripts/
  sync.mjs               # đồng bộ: check → tải → validate → ghi atomic → build
  build.mjs              # data/ → src/data/db.json (chuẩn hoá, gitignored)
  lib/literal.mjs        #   parser literal an toàn (không eval code của server)
  lib/client.mjs         #   bóc dữ liệu từ bundle
  lib/game.mjs           #   port logic client: gia phả, hệ, model cho mọi species
  lib/describe.mjs       #   port bộ mô tả skill/status của client
  lib/diff.mjs           #   so catalog cũ/mới → changelog
  lib/http.mjs           #   fetch: timeout, retry+backoff, conditional GET, pool song song
  test/                  # node:test
src/
  main.js                # router hash + lazy load trang & DB
  db.js                  # nạp DB + index (wavesOf, tradesOf…)
  lib/html.js            # tagged template tự escape
  lib/search.js          # inverted index + trie + BK-tree (chịu gõ sai)
  pages/                 # pets, pet, units, unit, waves, trade, pools, research, rules, changelog
```

## Tự cập nhật

Workflow `Sync & Deploy` chạy mỗi 2 tiếng (và khi push / bấm tay):

1. `GET /catalog` + `GET /` song song kèm `If-None-Match` → không đổi thì server trả **304, 0 byte**, dừng luôn.
2. Tên bundle JS có content-hash → chỉ tải bundle (~2.5MB) khi tên đổi.
3. Catalog/bundle đổi → validate trước khi ghi đè, sinh changelog, revalidate ảnh bằng ETag (ảnh không đổi = 304).
4. Commit `data/` + `public/` → build → test → deploy GitHub Pages **trong cùng workflow**
   (push bằng `GITHUB_TOKEN` không kích hoạt workflow khác, nên tách ra là site không bao giờ deploy lại).

## Dữ liệu chuẩn như game

| Thứ | Cách lấy |
|---|---|
| Hệ của pet | affinity của wild pool chứa gia phả (logic client) — khớp research theo hệ 80/83 pet |
| Portrait mọi species | map trực tiếp → model của dạng nông nhất trong gia phả → hash FNV-1a trong danh sách model cùng hệ |
| Mô tả kỹ năng | port hàm mô tả của client + bảng dịch vi chính thức; bỏ skill hệ thống, gộp `shared_execution_id` |
| Thời gian | 32 tick/giây (`1/32` trong client) |

## Bảo mật

Dữ liệu từ server game được coi là **không tin cậy**:

- Không `eval` bundle của game — dùng parser literal riêng, bỏ key `__proto__`/`constructor`.
- Hash, id, tên model phải khớp whitelist (`[A-Za-z0-9_-]`) trước khi dùng làm tên file; đường dẫn ghi ảnh bị khoá trong `public/<dir>/`.
- Giới hạn dung lượng mọi response; ảnh phải đúng chữ ký PNG, giới hạn pixel trước khi đưa vào `sharp`.
- Log được lọc ký tự điều khiển và `::` để server không giả được lệnh workflow; CI bọc bước sync bằng `::stop-commands::`.
- Wiki: mọi chuỗi qua `html` tagged template (escape), màu ép kiểu số, bản build có **CSP** `script-src 'self'`.

CI/CD: action ghim theo commit SHA, `permissions: {}` mặc định + quyền tối thiểu từng job, token không nằm trên đĩa khi xử lý dữ liệu lạ,
`npm ci --ignore-scripts`, `npm audit --audit-level=high` chặn deploy. Bookmarklet: xem trang **Công cụ** của wiki.
`scripts/test/security.test.mjs` giữ các điểm trên không bị hồi quy.
