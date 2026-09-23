# CUTD Dex — Pokédex cho game CUTD (Moonlit Court)

Trang tra cứu pet cho `https://m.cutd.site`: thông tin, ảnh, chuỗi tiến hóa, kỹ năng chi tiết (kèm hệ số),
bảng trade và wild pools. Dữ liệu bóc từ endpoint `catalog` của chính game.

## Chạy

```bash
npm install
npm run dev        # dev server
npm run build      # build production → dist/
npm run preview    # xem thử bản build
npm run data       # build lại src/data.json từ scripts/catalog.json (khi game cập nhật)
```

## Cấu trúc

```
scripts/            # dữ liệu thô + script build data
  catalog.json      # bóc từ https://m.cutd.site/catalog
  build-data.mjs    # → sinh src/data.json (dịch effect sang tiếng Việt)
public/images/      # 185 ảnh portrait 256×256 (art/portraits của game)
src/
  main.js           # hash router (#/pets, #/pet/:slug, #/trade, #/pools)
  ui.js             # helpers + renderer kỹ năng
  data.json         # dữ liệu đã xử lý (pets/trade/pools)
  pages/            # home, pet detail, trade, pools
```

## Trang

- **Pets** — lọc theo hệ/legendary, tìm kiếm, sort (DPS, HP, catch, số cấp)
- **Chi tiết pet** — chuỗi tiến hóa từng cấp với ảnh riêng, stats đầy đủ, skill bung ra xem
  hệ số (dịch từ effect gốc: damage/heal/modifier/summon…), wild pool spawn, trade liên quan
- **Trade** — 7 slot × 3 recipe, ảnh 2 bên, link về chuỗi tiến hóa pet đem đổi
- **Wild Pools** — 7 pool theo hệ, thanh tỉ lệ xuất hiện, catch %

## Tự cập nhật — cron, không cần nút hay token

GitHub Action chạy **mỗi 2 tiếng** (`7 */2 * * *`), flow tự chống spam request:

1. So `catalog_hash` mới vs cũ — trùng thì thoát ngay, **0 request thừa**
2. Khác → bóc lại bundle JS (map unit→model, hệ, màu), báo cáo **pet mới / pet bị xoá**
3. Tải ảnh portrait thiếu, **tự xoá ảnh rác** của pet không còn trong game
   (guard: bóc mapping bất thường < 100 unit thì bỏ qua bước xoá)
4. Build lại `data.json` (sinh từ đầu → pet bị remove tự biến mất) → commit → Deploy tự chạy

Chạy tay khi muốn: `npm run update` (check hash, bóc nếu đổi) / `npm run update:force` (ép bóc toàn bộ).
Xem lịch sử update: tab **Actions** trên GitHub (link ⚙ góc phải web).

## Thuật toán & cấu trúc dữ liệu

| Nơi | Kỹ thuật | Lợi ích |
|---|---|---|
| build-data | **Map** tra cứu id→object mọi nơi | mọi lookup O(1) |
| build-data | **Danh sách kề** cho rừng tiến hóa + **BFS 1 lần duyệt** O(V+E) | tính chuỗi + map stage→root mà không đi lại chain nào 2 lần |
| build-data | **sort-key tiền tính** (dpsMax/hpMax/stages) | UI sort không phải duyệt chain |
| search.js | **Inverted index** Map<token, Set<idx>> | khớp từ chính xác O(1) |
| search.js | **Trie (cây tiền tố)**, insert tích luỹ id dọc đường | gợi ý tiền tố O(len(prefix)), chết nhánh cắt sớm |
| search.js | intersection nhỏ-dọn-trước (sort theo size) | multi-token query nhanh nhất có thể |
| home.js | **nhóm theo hệ/legendary trước** (Map + list tách sẵn) | filter không scan toàn bộ |
| home.js | `Intl.Collator('vi',{numeric})` cache 1 instance | sort tiếng Việt đúng chuẩn, nhanh hơn localeCompare từng cặp |
| home.js | debounce 90ms + render theo delta | gõ liên tục không giật |
| update.js | stream early-exit (đọc 1KB abort) | check hash không tải 1.7MB |
| scrape.mjs | hash-gate → worker pool 8 luồng → Set membership | không request thừa, tải song song, check rác O(1) |
| scrape.mjs | safety guard (bóc < 100 unit → không xoá) | chống xoá nhầm khi game đổi cấu trúc |

Benchmark search: 10.000 query prefix ≈ 6ms (0.6µs/query trên 422 stage-tokens).
