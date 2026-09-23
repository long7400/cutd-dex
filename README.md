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

## Tự cập nhật khi game update

Game update 4-5 lần/ngày → GitHub Action chạy **mỗi 2 tiếng** (cron `7 */2 * * *`):

1. So `catalog_hash` mới vs cũ — trùng thì thoát ngay, khác thì mới bóc tiếp (bóc khi có thay đổi)
2. Bóc lại bundle JS mới → map unit→model, hệ, màu
3. In báo cáo: **pet mới thêm / pet bị xoá** khỏi game
4. Tải ảnh portrait mới, **tự xoá ảnh rác** của pet không còn tồn tại (giữ logo; guard: nếu bóc mapping bất thường < 100 unit thì bỏ qua bước xoá)
5. Build lại `data.json` (sinh lại từ đầu nên pet bị remove tự biến mất khỏi web) → commit → Deploy tự chạy

Chạy tay: `npm run update` (check hash) hoặc `npm run update:force` (ép bóc toàn bộ).
