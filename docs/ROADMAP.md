# Aether Champions — archived roadmap

> **Superseded on 11/09/2026 and rebaselined on 12/09/2026.** Product direction changed to Pokémon Vanguard with Pokémon Champions M-A data, 66/32 Stat Points, canonical Mega Evolution, no rarity gacha, banner-configured Roster Ranch recruitment and code-driven Move FX. Follow [`docs/pokemon-vanguard-roadmap.md`](docs/pokemon-vanguard-roadmap.md) in the order R0→R7→M6→M7. The material below remains historical context for completed engineering only.

Phiên bản tài liệu: 1.0 · Lập ngày 11/09/2026 · Trạng thái: kế hoạch đề xuất để triển khai.

**Tài liệu này không có nghĩa các tính năng đã được làm. Lượt lập roadmap chỉ bổ sung tài liệu, không thay đổi code hoặc save.** Các số cân bằng, giá, thời gian, công thức dưới đây là thiết kế riêng đề xuất cho Aether Champions, không phải thông số chính thức của Pokémon Champions.

## Mục lục

1. [Cách sử dụng và định hướng](#1-cách-sử-dụng-và-định-hướng)
2. [Hiện trạng và phạm vi](#2-hiện-trạng-và-phạm-vi)
3. [Quyết định thiết kế](#3-quyết-định-thiết-kế)
4. [Công nghệ và cấu trúc dự án](#4-công-nghệ-và-cấu-trúc-dự-án)
5. [Mô hình dữ liệu và chuyển save](#5-mô-hình-dữ-liệu-và-chuyển-save)
6. [Đặc tả battle engine](#6-đặc-tả-battle-engine)
7. [Nội dung Mon, chiêu, Ability và item](#7-nội-dung-mon-chiêu-ability-và-item)
8. [Training, Box và đội hình](#8-training-box-và-đội-hình)
9. [Tuyển Mon, gacha và kinh tế](#9-tuyển-mon-gacha-và-kinh-tế)
10. [Giao diện, hình ảnh và âm thanh](#10-giao-diện-hình-ảnh-và-âm-thanh)
11. [Private PvP, timer và giao thức](#11-private-pvp-timer-và-giao-thức)
12. [Online, Ranked và mùa giải](#12-online-ranked-và-mùa-giải)
13. [Backlog triển khai theo thứ tự](#13-backlog-triển-khai-theo-thứ-tự)
14. [Kiểm thử và nghiệm thu](#14-kiểm-thử-và-nghiệm-thu)
15. [Quy trình làm việc, phát hành và phục hồi](#15-quy-trình-làm-việc-phát-hành-và-phục-hồi)
16. [Đối chiếu tài liệu tính năng](#16-đối-chiếu-tài-liệu-tính-năng)
17. [Rủi ro, nhánh thay thế và kiểm soát phạm vi](#17-rủi-ro-nhánh-thay-thế-và-kiểm-soát-phạm-vi)
18. [Lệnh và checklist bắt đầu](#18-lệnh-và-checklist-bắt-đầu)
19. [Nguồn và thuật ngữ](#19-nguồn-và-thuật-ngữ)

## 1. Cách sử dụng và định hướng

### 1.1 Mục tiêu sản phẩm

Xây một game đấu Mon theo lượt: người chơi tuyển Mon, dựng build, lưu đội, chuẩn bị matchup, thi đấu và điều chỉnh chiến thuật. Giữ thế giới và 36 Mon nguyên bản; học cách tổ chức tính năng từ tài liệu Pokémon Champions.

Ưu tiên theo thứ tự: **luật đúng → lựa chọn chiến thuật → dễ hiểu → trải nghiệm đẹp → online → nội dung theo mùa**.

Vòng chơi chính:

```text
Tuyển/dùng thử Mon → chọn build → lưu đội → xem đội đối thủ
→ chọn Mon và lead → đấu → xem log/kết quả → nhận thưởng → sửa đội
```

Gym là nơi học chiến thuật. Gacha là một cách mở bộ sưu tập, không là con đường duy nhất để có đội hình mong muốn. Rarity không tự tăng ngân sách chỉ số.

### 1.2 Cách một người triển khai đi theo roadmap

1. Đọc mục 3–6 trước khi viết code; đó là hợp đồng thiết kế.
2. Làm từng ticket trong mục 13 theo thứ tự và phụ thuộc ghi kèm.
3. Mỗi ticket: đọc đầu vào → viết ca kiểm thử → triển khai → kiểm tra giao diện nếu có → ghi bằng chứng nghiệm thu.
4. Ticket chỉ hoàn thành khi đạt tiêu chí; không đánh dấu xong chỉ vì đã có menu hoặc nút.
5. Không sang mốc tiếp nếu cổng nghiệm thu mốc trước còn lỗi chặn.
6. Khi thay quyết định nền tảng, cập nhật mục quyết định và các ticket bị ảnh hưởng trước khi tiếp tục.

Thông số đề xuất trong tài liệu là mặc định triển khai. Không cần hỏi lại từng màu, tên biến, cách chia hàm. Những thay đổi làm khác định hướng — bỏ gacha, đổi hệ thống PP, tăng roster lớn, dùng dịch vụ trả phí hoặc công khai game — cần được chốt riêng khi phát sinh; roadmap không tự cho phép triển khai dịch vụ bên ngoài.

### 1.3 Các bản có thể bàn giao

| Bản | Bao gồm | Chưa cần |
|---|---|---|
| Local Tactical Alpha | M0–M3: engine, build, đội, preview, AI chiến thuật, 36 Mon | PvP, tài khoản, thanh toán |
| Local Complete Beta | M4–M5: recruitment/trial, kinh tế, bốn dạng Ascension, âm thanh và UI hoàn thiện | Ranked và vận hành online |
| Private PvP Alpha | M6: hai client local, timer, reconnect, lệnh kín | Public matchmaking |
| Online Competitive Beta | M7: tài khoản, database, Casual/Ranked, season/regulation | Premium/Membership |
| Live Content | M8: nhiệm vụ, pass miễn phí, cosmetic, cập nhật nội dung | Console và tích hợp Nintendo |

Không ấn định ngày hoàn thành trước khi đo tốc độ thực tế qua M0–M1. Lập lịch theo ticket đạt chuẩn; ước lượng lại sau từng mốc, dành khoảng 25% năng lực cho kiểm thử và sửa lỗi tương tác.

## 2. Hiện trạng và phạm vi

### 2.1 Mã nguồn hiện hành

Thư mục gốc: `D:\Mon\AetherChampions`; ứng dụng: `app/`.

| Thành phần hiện tại | Vai trò | Cách xử lý |
|---|---|---|
| `app/src/logic.js` | Sáu hàm thuần; dữ liệu, battle, kinh tế | Giữ hợp đồng sáu export; mở rộng có kiểm thử |
| `app/local-server.mjs` | HTTP/WebSocket, chủ adventure, lưu JSON | Giữ local; thêm adapter theo mốc |
| `app/public/client.js` | Toàn bộ UI, kết nối và lệnh | Tách dần module theo màn hình, không rewrite framework |
| `app/public/art.js` | 36 minh họa SVG | Giữ ID và asset làm nền; nâng theo pipeline mỹ thuật |
| `app/public/battle-animation.js` | Canvas/WAAPI diễn kết quả server | Giữ; thêm event schema và animation profile |
| `app/.local-data/` | Save người chơi | Không xóa, không dùng làm dữ liệu test |
| `app/tests/*.mjs` | Test local và animation | Mở rộng theo ma trận mục 14 |
| `src/room.ts`, `worker.ts`, cấu hình cloud | Hạ tầng cũ | Chỉ tham khảo; không đưa vào luồng local |

Hiện có 36 loài, 12 hệ, bốn chiêu cố định/loài, sáu item có hiệu ứng, sáu gym, summon, một đội tối đa bốn Mon. Training tăng level; Ability phụ thuộc nhóm loài; weather và terrain chung biến; AI chủ yếu chọn sát thương; replacement tự động; log chỉ lượt gần nhất. Đây là prototype solo, không phải engine Pokémon đầy đủ.

Các thiếu hụt kỹ thuật cần xử lý: định danh loài/instance chưa tách, seed kinh tế có thể dự đoán từ danh tính local, chưa có phiên bản dữ liệu chiến đấu độc lập, chưa có lệnh hai người, chưa có authentication online. Không mang nguyên cơ chế danh tính local lên internet.

### 2.2 Phạm vi cam kết của roadmap

- 36 loài cơ bản: đề xuất 12 Mon đơn hệ và 24 Mon song hệ; 12 hệ giữ bảng khắc hệ hiện có trong bản đầu.
- 48 chiêu khởi đầu, 24 Ability, 12 item thường và bốn Ascension Stone khi tới M5.
- Single và Double; AI và Private PvP; sau đó mới Casual/Ranked online.
- Sáu team slot, ba build cho mỗi loài sở hữu, recruit/trial/gacha, sáu gym.
- Web trên desktop và điện thoại; local trước. Không triển khai Nintendo Account, Pokémon HOME hoặc console native.
- Không sao chép asset Pokémon. Dùng tên, Mon, hình ảnh và âm thanh của Aether.

## 3. Quyết định thiết kế

| Mã | Quyết định mặc định | Lý do và hệ quả |
|---|---|---|
| D01 | Giữ 36 Mon/12 hệ; có cả đơn hệ và song hệ | Phân bổ đề xuất 12 đơn hệ/24 song hệ; mỗi loài có một hoặc hai hệ khác nhau |
| D02 | Chuyển Energy sang PP ở engine v2 | Hỗ trợ quản lý moveset; không chạy hai tài nguyên trong trận v2 |
| D03 | Sáu chỉ số, level battle chuẩn 50 | Build quyết định vai trò; giữ level cũ như dữ liệu tiến trình |
| D04 | Không IV/breeding; 32 Stat Points, tối đa 16/chỉ số | Dựng build dễ hiểu, không cần grind chỉ số ẩn |
| D05 | Alignment +10%/-10%, không tác động HP; có neutral | Đánh đổi rõ ràng |
| D06 | Squad 6; single chọn 3, double chọn 4 | Mỗi trận có bước đọc matchup; sandbox cho chọn ít hơn |
| D07 | Ba build/Mon, sáu team slot miễn phí | Đủ thử chiến thuật; chưa bán slot |
| D08 | Coins đóng vai trò VP; crystals dùng summon | Tránh ba đồng tiền ở giai đoạn local |
| D09 | Giữ gacha, thêm recruit trực tiếp | Giữ yêu cầu ban đầu, giảm phụ thuộc may rủi |
| D10 | Weather, terrain, side condition tách riêng | Cho phép Sun + Meadow + Tailwind cùng tồn tại |
| D11 | Ascension là cơ chế tương tự Mega, một lần/mỗi bên/mỗi trận | Giới hạn lựa chọn, tận dụng ô held item |
| D12 | Server authoritative; animation không quyết định luật hoặc đồng hồ | Skip/2× không thay kết quả |
| D13 | Không public deploy trong M0–M6 | Bảo toàn hướng local đã thống nhất |
| D14 | Giữ JavaScript ES modules, Node/npm, SVG/Canvas | Tận dụng nền hiện có; không đổi framework chỉ để tổ chức code |
| D15 | Closed team sheet ở PvP đầu tiên | Preview thấy loài; move/item/Ability/build chỉ lộ khi luật cho phép |
| D16 | Balance constants có version; trận chốt version lúc bắt đầu | Update không đổi luật giữa trận |

Nếu chọn giữ Energy thay D02: dừng trước M1, thay bảng PP bằng cost/recovery và sửa toàn bộ test/catalog/training/AI. Không thêm chế độ Energy song song trong scope đầu tiên.

## 4. Công nghệ và cấu trúc dự án

### 4.1 Dùng gì, ở đâu

| Nhu cầu | Công cụ | Cách dùng |
|---|---|---|
| Runtime local | Node.js tương thích 22+, npm | Dùng runtime đang chạy dự án; chưa nâng major trong ticket tính năng |
| Giao diện | HTML/CSS + JS modules | Module màn hình, store riêng; không cần React ở quy mô này |
| Battle rendering | SVG + Canvas 2D + Web Animations API | SVG Mon, Canvas projectile/particle, WAAPI pose/hit; [tài liệu WAAPI](https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API) |
| Kết nối | HTTP + thư viện `ws` hiện có | Server kiểm tra lệnh; không thêm Socket.IO |
| Unit/integration | `node:test`, `node:assert/strict` | Test thuần + server port tạm; [Node test runner](https://nodejs.org/download/release/v22.17.0/docs/api/test.html) |
| Browser QA | Browser skill hiện có trong môi trường agent; thao tác thật trên local | Kiểm tra DOM, screenshot, console và hai client; không giả lập thành quả từ code |
| Authoring dữ liệu | JSON + script Node kiểm tra schema | ID ổn định, tài liệu hóa effect, không dùng eval |
| Save local | JSON + atomic rename + hàng đợi mỗi adventure | Một process; adapter save có version và backup |
| Âm thanh | Web Audio cho SFX; audio element cho BGM | Chỉ khởi động sau tương tác người dùng; âm lượng riêng |
| Database online, tới M7 | PostgreSQL + adapter SQL | Transaction cho thưởng/rating; không cài ở M0–M6 |
| Quản lý thay đổi | Git nếu repo đã có; nếu chưa, tạo repo khi bắt đầu triển khai | Bỏ qua saves/logs/node_modules; checkpoint mỗi ticket |

Chốt phiên bản dependency vào lockfile ở ticket setup tương ứng. Không dùng hướng dẫn cloud/Bun cũ thay luồng npm local. Không cần Unity, Unreal, Phaser, Docker hay microservice cho Local Tactical Alpha.

### 4.2 Giữ hợp đồng logic thuần bằng bước ghép mã

AGENTS hiện yêu cầu `src/logic.js` không import, giữ đúng sáu export. Không phá yêu cầu đó khi chia nhỏ code.

Hướng mặc định: **tác giả viết fragment có thứ tự, script Node ghép thành một `src/logic.js` thuần**. Bản sinh ra vẫn là module server import như hiện tại.

```text
app/
  content/                       # dữ liệu thiết kế, không chứa thông tin người chơi
    species.json moves.json abilities.json items.json
    forms.json regulations.json gyms.json economy.json
  logic-src/                     # fragment không import/export ngoài public-api
    00-data.js                   # sinh constants từ content
    10-utils.js 20-builds.js 30-effects.js 40-battle.js
    50-ai.js 60-economy.js 70-adventure.js 90-public-api.js
  src/logic.js                   # GENERATED; đúng sáu export, pure
  server/
    storage-json.mjs migrations.mjs protocol.mjs
    match-coordinator.mjs clock.mjs identity-local.mjs
  public/
    client.js                   # bootstrap
    js/store.js net.js router.js ui.js
    js/screens/{home,box,training,teams,battle,recruit,gym,mail,settings}.js
    js/battle/{scene,events,targets,log,playback}.js
    assets/{monsters,fx,audio}/ manifest.json
    battle-animation.js battle-animation.css style.css
  scripts/
    compile-logic.mjs dev-local.mjs check-content.mjs
    check-logic.mjs simulate-balance.mjs migrate-save.mjs
  tests/{unit,integration,fixtures}/
```

Thư mục ở trên là đích thiết kế, chưa phải những file đã tồn tại. Có thể giữ file gốc làm adapter trong thời gian tách. Không sửa tay `src/logic.js` sau khi bật generator.

Thứ tự triển khai generator:

1. Sao chép nguyên logic hiện tại thành fragment; chưa đổi hành vi.
2. Script đọc JSON, validate, ghi constants rồi nối fragment theo danh sách tường minh, không theo thứ tự filesystem.
3. Không minify. Ghi ranh giới tên fragment và hash đầu file để debug.
4. Ghi ra file tạm, `node --check`, rồi atomic rename; lỗi build giữ file hợp lệ cũ và báo rõ.
5. `npm run check`: compile ở chế độ verify không ghi → check-content → check-logic → syntax các module.
6. `npm run dev`: chạy `dev-local.mjs`; compile thành công trước khi mở server; watch content/fragment, debounce 150 ms, chỉ restart server khi compile thành công. Quản lý child và giải phóng cổng khi Ctrl+C.
7. CI/test kiểm tra compile cùng input cho byte output giống nhau; chặn tên khai báo trùng và export thừa.

Đây là thao tác tổ chức source, không đưa filesystem/network vào hàm luật. Sáu export vẫn là `meta`, `setup`, `validateAction`, `applyAction`, `isGameOver`, `viewFor`.

### 4.3 Ranh giới trách nhiệm

- **Content:** chỉ định chiêu/Ability/item có ID và hiệu ứng nào.
- **Engine:** tính trạng thái tiếp theo từ state/action hợp lệ; không đọc giờ hệ thống.
- **Server:** xác thực danh tính, xếp hàng lệnh, thời gian, lưu, gửi view đúng người.
- **Client:** nhập lệnh, hiển thị public catalog và view; không tự cộng thưởng hoặc đoán outcome.
- **Animator:** nhận event đã che thông tin, phát rồi giải phóng tài nguyên.
- **Clock:** lấy thời gian server, tạo system action được tin cậy; client không được gửi loại action này.

Public catalog có thể gửi client; seed, lệnh chưa công bố, build đối thủ không được gửi. State instance không gộp dữ liệu catalog bất biến vào mỗi frame.

## 5. Mô hình dữ liệu và chuyển save

### 5.1 ID và phiên bản

- `speciesId`: chuỗi ổn định, ví dụ `emberlyn`; giữ `legacyId: 0` và `artId: 0` để dùng art cũ.
- `monId`: ID Mon sở hữu, khác speciesId. Local tạo từ bộ đếm trong state, không dùng random trong pure logic.
- `buildId`, `teamId`, `battleId`, `eventId`: ổn định; event tăng dần trong một trận.
- `schemaVersion`: cấu trúc save; `rulesVersion`: thuật toán battle; `catalogVersion`: balance/content; `regulationId`: luật giải đấu.
- Không dùng vị trí phần tử trong mảng làm ID; slot chỉ là vị trí trên sân.

### 5.2 Các thực thể bắt buộc

| Thực thể | Trường chính | Bất biến |
|---|---|---|
| Species | id, legacyId, artId, nameKey, types, baseStats, abilityIds, moveIds, role, rarity | ID duy nhất; 1–2 hệ; sáu baseStats hợp lệ |
| OwnedMon | monId, speciesId, ownership, trialExpiresAt, legacyLevel, acquiredBy | Một bản permanent/loài; trial không train |
| Build | buildId, monId, name, points, alignment, abilityId, moveIds[4], itemId, revision | Tối đa ba; bốn chiêu khác nhau; hợp movepool |
| Team | teamId, name, buildIds[1..6], revision | Không trùng species; starter có thể chưa đủ sáu |
| Adventure | schemaVersion, owner, revision, catalogVersion, wallet, rngState, mons, builds, teams, gymProgress, mailClaims, rewardReceipts | Wallet số nguyên không âm; thao tác idempotent |
| BattleMon | battleMonId, ownerSide, buildSnapshot, stats, hp, pp, status, stages, volatiles, itemState, formId | Snapshot không đổi khi sửa build ngoài trận |
| Battle | id, versions, phase, turn, sides, field, pending, rngState, events, result | Mỗi slot tối đa một Mon sống; kết quả chỉ ghi một lần |
| Event | id, turn, kind, actorId, sourceId, targets, changes, visibility | Chỉ mô tả điều thực sự xảy ra; không phân tích chuỗi log |
| Regulation | id, version, rosterSize, pickCount, activeCount, bans, clauses, level, timer | Chốt một bản khi tạo trận |

Ví dụ build, đơn vị points không phải EV:

```json
{
  "buildId": "build-1",
  "monId": "mon-1",
  "name": "Emberlyn tốc độ",
  "points": {"hp": 0, "atk": 16, "def": 0, "spa": 0, "spd": 0, "spe": 16},
  "alignment": {"up": "spe", "down": "spa"},
  "abilityId": "dawnbringer",
  "moveIds": ["flame-strike", "gale-lance", "sun-call", "guard"],
  "itemId": "swift-feather",
  "revision": 1
}
```

Field tách ba lớp:

```json
{
  "weather": {"id": "sun", "remaining": 5},
  "terrain": {"id": "meadow", "remaining": 5},
  "sides": {"A": {"tailwind": 4, "barrier": 0}, "B": {"tailwind": 0, "barrier": 3}}
}
```

### 5.3 Hành động và lỗi

Action ứng dụng: `build.save`, `team.save`, `recruit.permanent`, `recruit.trial`, `recruit.refresh`, `summon`, `mail.claim`, `battle.start`, `battle.preview`, `battle.commands`, `battle.replace`, `battle.surrender`.

Mỗi action có `actionId` và revision thích hợp. Server trả `{ok:false,code,details}`; client dịch bằng message dictionary. Mã tối thiểu: `INVALID_BUILD`, `STALE_REVISION`, `INSUFFICIENT_COINS`, `TRIAL_EXPIRED`, `TEAM_ILLEGAL`, `WRONG_PHASE`, `ALREADY_SUBMITTED`, `INVALID_TARGET`, `NO_PP`, `UNAUTHORIZED`, `SAVE_FAILED`.

Không chỉ disable nút: validation phía engine/server bắt buộc cho mọi invariant. Lệnh sửa build chứa bản mới đầy đủ; server tự tính giá và tính hợp lệ, không nhận giá từ client.

### 5.4 Migration v1 → v2

Thực hiện ở storage adapter, trước khi game nhận action v2:

1. Đọc và kiểm tra JSON, schema; không ghi gì nếu file lỗi.
2. Backup nguyên bytes vào thư mục backup ngoài file đích, tên có version và timestamp; ghi checksum. Không upload save.
3. `collection[].id` ánh xạ qua bảng legacyId → speciesId; monId được tạo theo thứ tự legacyId để chạy lại ổn định.
4. Giữ coins/gems/pity/summons/wins/badges/mail; đổi tên gems → crystals trong adapter. Không đổi giá trị kinh tế trong migration.
5. Giữ level thành legacyLevel. Không hoàn coins đã train vì không có ledger lịch sử đáng tin cậy; lưu mức cũ để hiển thị tiến trình và nhận cosmetic ở M8. Battle v2 dùng level 50 cho cả hai bên.
6. Tạo build mặc định neutral, points bằng 0, Ability cũ tương ứng, bốn chiêu ánh xạ qua catalog mới; item ID cũ qua mapping. Khi một chiêu bị gộp gây trùng, bổ sung Guard rồi chiêu hợp lệ đầu tiên theo ID.
7. Team cũ giữ thứ tự tối đa bốn; bổ sung Mon starter sở hữu chưa có tới tối đa sáu. Không tự cấp loài mới. Lưu team tên `Đội chuyển từ bản cũ`.
8. Lưu `migrationReceipt` phiên bản nguồn/đích và mapping. Rerun không tạo thêm Mon/build hoặc tiền.
9. Validate toàn bộ save mới → ghi file tạm → đọc kiểm lại → rename. Lỗi bất kỳ giữ bản gốc.

**Trận v1 đang chơi:** không chuyển nửa trận sang luật PP. M0 giữ bản engine v1 bất biến trong adapter `server/legacy/`; route save có trận v1 chưa kết thúc vào v1, UI nhận `legacyBattle: true` và dùng bố cục cũ. Cho kết thúc/đầu hàng theo luật cũ; migration diễn ra khi trở về adventure. Backup phải bao gồm cả kết quả cũ vừa lưu. Không cho bắt đầu thêm trận v1 sau migration. Test fixture phải có save ở giữa animation/lượt, chiến thắng chưa về menu và collection thiếu trường tùy chọn.

Khi mở save version mới hơn code hỗ trợ: báo cần phiên bản ứng dụng mới, không khởi tạo adventure trắng. Backup/restore là nút có preview; chỉ restore khi không có trận đang hoạt động và server đã dừng ghi save đó.

## 6. Đặc tả battle engine

### 6.1 Máy trạng thái

```text
CREATED → PREVIEW → ENTRY → COMMAND → RESOLVE → END_TURN
                                ↑                    ↓
                                └── REPLACE ←────────┤
                                └────────────────────┘
                                      hoặc FINISHED
```

- PREVIEW: chọn số Mon theo regulation và thứ tự lead. Chưa kích hoạt Ability.
- ENTRY: đưa lead ra sân; xác định thứ tự entry hook bằng speed giảm dần; tie dùng RNG đã seed.
- COMMAND: thu đủ lệnh mỗi slot sống; một bên commit một gói, không sửa sau commit.
- RESOLVE: chạy queue và event; không thay reserve giữa các đòn đang resolve.
- END_TURN: xử lý residual và hết hạn, kiểm tra thắng/thua.
- REPLACE: nếu bên chưa thua có slot trống, chọn reserve đồng thời; không tiêu lượt. Có thể qua nhiều vòng ENTRY/REPLACE nếu entry effect sau này gây KO.
- FINISHED: đóng input chiến đấu; issue result/receipt duy nhất.

Local solo AI dùng cùng command format và validator. Phase kỹ thuật có thể xử lý đồng bộ trong một action; client vẫn xem được chuỗi event.

### 6.2 Stats và sát thương

Level 50 cố định. Base stats sáu số do catalog quy định. Points nguyên 0–16 mỗi stat, tổng tối đa 32, không bắt buộc dùng hết.

```text
HP = 100 + baseHP + 2 × hpPoints
stat khác = floor((baseStat + 20 + 2 × points) × alignment)
alignment = 1.1 cho up; 0.9 cho down; 1.0 còn lại
stage ∈ [-6, +6]
stageMultiplier = (2 + stage)/2 nếu stage ≥ 0; 2/(2 - stage) nếu stage < 0
```

Alignment neutral: up/down đều null; trường hợp khác phải là hai stat khác nhau trong atk/def/spa/spd/spe. Không đổi HP khi đổi dạng ở M5.

Damage v2:

```text
A = floor(attackStat × stageMultiplier × các modifier chỉ số)
D = max(1, floor(defenseStat × stageMultiplier × các modifier chỉ số))
baseDamage = floor(22 × power × A / D / 50) + 2
damage = max(1, floor(baseDamage × STAB × type × field × ability × item × spread × burn))
```

- Physical dùng atk/def; special dùng spa/spd. Status move không qua công thức.
- STAB = 1.5 nếu trùng một hệ hiện tại của người dùng, không nhân hai lần.
- Type lấy tích hệ số trên các hệ thực sự có của target: đơn hệ tính một lần, song hệ nhân hai hệ số. Miễn nhiễm = 0 thì damage = 0, bỏ qua max(1). Không nhân lặp hệ đầu cho Mon đơn hệ.
- Spread = 0.75 khi có ít nhất hai mục tiêu sống hợp lệ ở lúc bắt đầu đòn; mục tiêu Guard vẫn tính vào số đó.
- Burn = 0.5 cho physical; special không giảm.
- Không critical hit hoặc random damage roll ở v2 alpha. Accuracy và secondary chance vẫn dùng RNG. Đừng tự thêm crit của Pokémon.
- Modifier damage nhân một lần rồi floor cuối; modifier chỉ số floor tại bước A/D. Lưu tỷ lệ hữu tỉ khi có thể; không floor qua từng item một cách tùy ý.
- HP mất thực tế = min(hpBefore, damage sau hiệu ứng sống sót); log và animation dùng cùng giá trị.

Thứ tự một hit: xác định target/redirect → Guard → miễn nhiễm hệ → accuracy → tính damage → sturdy-heart → Focus Crystal → trừ HP/đánh dấu KO → Healing Berry nếu target sống → secondary của move → Venom Touch nếu chưa thử poison bằng move → Cure Berry ngay khi status mới áp dụng → Thorn Coat nếu đủ điều kiện. Modifier Ability/item chỉ đọc context của hit đang xét. Không cho Healing Berry hồi Mon đã về 0 HP. Burn/poison không gây residual ngay khi nhận, chỉ ở END_TURN.

Với spread, chốt danh sách target và hệ số spread trước hit đầu, xử lý target theo slot tăng dần nhưng trì hoãn kiểm kết quả trận đến khi toàn move và recoil hoàn tất. Các modifier đồng đội được lấy từ snapshot lúc bắt đầu move để việc hit slot0 làm KO người buff không khiến slot1 chịu công thức khác chỉ do thứ tự mảng. Mỗi target có roll accuracy/secondary riêng theo thứ tự slot. Buff bản thân từ secondary chỉ áp một lần/move; bộ alpha không có secondary trên spread.

Golden test: power 60, A=D=100, STAB 1.5, type=1, không modifier → base=28 → damage=42. Khắc hệ 2× → 84. Miễn nhiễm → 0. HP còn 20 → mất thực tế 20.

### 6.3 Priority, speed và random

Queue theo: switch trước → priority của move giảm dần → speed giảm dần → khóa tie ngẫu nhiên tạo đúng một lần/actor/lượt bằng seeded RNG. Không ưu tiên A vì đưa vào mảng trước.

Speed chốt sau xử lý Ascension, trước tạo queue; thay speed giữa lượt chỉ áp dụng lượt tiếp. Switch nằm trong queue ưu tiên; entry effect của switch chạy ngay sau switch nhưng không sắp xếp lại queue đã chốt. Đây là luật riêng nhằm giữ v2 dễ hiểu.

Không gọi random trong comparator sort. Sinh tie key trước. Tách stream RNG battle khỏi economy; cùng seed/actions/versions cho cùng events. Online seed do server tạo ngoài pure engine, không gửi người chơi hoặc AI; replay phục vụ riêng sau khi trận kết thúc.

### 6.4 PP và khả năng hành động

- Mỗi chiêu có maxPP từ catalog; đầy PP lúc bắt đầu trận, không hồi tự động mỗi lượt.
- Kiểm tra actor còn sống/active → sleep → trừ 1 PP → kiểm target/Guard/immunity/accuracy → resolve.
- Đòn miss, bị Guard hoặc không còn target vẫn mất PP; actor đã KO hoặc ngủ nên không hành động thì không mất PP.
- Hết PP của chiêu đã chọn ở thời điểm execution: báo `moveFailed:noPP`, không tự chọn chiêu khác.
- Nếu tất cả chiêu hết PP ở COMMAND, chỉ cho `Struggle` hoặc switch. Struggle: physical, power 50, accuracy 100, neutral damage (không STAB/type modifier), một foe, không PP; recoil 25% damage thực tế, ít nhất 1 nếu đã gây damage; Guard chặn damage và recoil.
- Không recharge, multi-turn charge, multi-hit hoặc move copy trong scope alpha. Solar-themed chiêu không tự có luật charge nếu catalog không khai báo.

### 6.5 Target, switch và double

Target truyền theo `{side, slot}`, không theo vị trí collection. Hệ thống vẫn lưu actor bằng battleMonId để tránh cho Mon vào thay thực hiện lệnh cũ.

| targetMode | Lựa chọn ở UI | Xử lý khi execution |
|---|---|---|
| self | Không chọn | Actor |
| ally | Đồng đội khác actor | Slot đồng minh đã chọn; rỗng thì fail |
| foe | Một slot địch | Đánh occupant hiện tại của slot, kể cả vừa switch; slot rỗng thì foe sống ở slot thấp nhất; không có thì fail |
| allFoes | Không chọn | Mọi foe sống; mỗi target tính riêng |
| ownSide | Không chọn | Side condition của phe actor |
| field | Không chọn | Weather/terrain toàn sân |

Switch chỉ tới reserve sống chưa active; hai actor không được chọn cùng reserve. Volatile/boost stages/Guard mất khi rời sân; major status và PP giữ. Đã Ascend thì giữ dạng khi switch, không hoàn lượt sử dụng. Lệnh move gắn actor đã rời sân bị hủy.

Redirect chỉ tác động move `foe`; không ảnh hưởng allFoes, self, field. Có nhiều redirect hợp lệ thì hiệu lực vừa tạo gần nhất thắng; tie theo eventId. Target có thể Guard hoặc immune như thường.

Chọn replacement sau END_TURN; số lệnh cần đúng min(slot trống, reserve sống). Khi một Mon ít hơn activeCount, trận tiếp tục với slot còn lại. Tuyệt đối không hồi sinh bằng heal/residual.

### 6.6 Hiệu ứng sân và trạng thái

Thời hạn tính theo lần END_TURN: effect tạo trong lượt T với remaining=5 sẽ giảm còn 4 ở cuối T; effect tạo ở initial ENTRY trước lượt 1 cũng giảm lần đầu ở cuối lượt 1. Effect tạo ở REPLACE sau END_TURN bắt đầu giảm ở cuối lượt sau.

| Hiệu ứng | Quy tắc v2 alpha |
|---|---|
| Sun / Rain | 5 lượt; Flame/Tide ×1.5/×0.5 tương ứng và ngược lại |
| Snow | 5 lượt; def của Mon Frost ×1.5; không tăng spd |
| Sand | 5 lượt; cuối lượt mất floor(maxHP/16), tối thiểu 1, trừ Stone/Steel |
| Meadow terrain | 5 lượt; Bloom damage ×1.3; Mon sống không có hệ Gale hồi floor(maxHP/16), tối thiểu 1 |
| Storm terrain | 5 lượt; Volt damage ×1.3; không thêm miễn sleep trong alpha |
| Tailwind side | 4 lượt; speed ×2 cho phe; không cộng dồn |
| Barrier side | 3 lượt; damage nhận ×0.75, cả physical và special; không giảm residual |
| Burn | Major status; Flame miễn; physical ×0.5, residual maxHP/16; tồn tại tới cure hoặc hết trận |
| Poison | Major status; Venom/Steel miễn; residual maxHP/8; tồn tại tới cure hoặc hết trận |
| Slow | Major status; speed ×0.5; không xác suất mất lượt; cure hoặc hết trận |
| Sleep | Major status; chặn đúng hai lần đến lượt hành động; mỗi lần giảm counter, lần về 0 vẫn bỏ hành động, lần sau tỉnh |
| Guard | Bảo vệ khỏi enemy damage/status trong lượt; không chặn weather/residual |

Chỉ một major status/Mon; không đè trạng thái cũ. Status miễn nhiễm theo luật ở trên và Ability. Chiêu trực tiếp gây status accuracy kiểm như move thường; secondary effect chỉ sau khi target nhận damage > 0 và còn sống. Có thể burn/poison target special hay physical; không dựa nhóm loài nữa.

Guard dùng liên tiếp có xác suất thành công 1, 1/3, 1/9... giới hạn mẫu số 81; lượt actor chọn đòn khác hoặc switch reset chuỗi. Guard fail vẫn tốn PP. Các đội không được stall vô hạn bằng Guard chắc chắn mỗi lượt.

END_TURN theo các bước toàn sân: (1) major residual → (2) weather residual → (3) item hồi → (4) Ability hồi → (5) terrain hồi → (6) hết hạn side/field/volatile → (7) kiểm kết quả → (8) replacement. Trong một bước residual, tính damage từ snapshot cho mọi Mon rồi áp dụng cùng nhóm, tránh thiên vị phe; Mon KO bước trước không nhận heal bước sau.

Một bên hết Mon sống → thua; cả hai hết trong cùng nhóm kết quả → hòa. Recoil và damage của một move là một nhóm cho xét thắng/thua. Trước END_TURN, kiểm kết quả sau mỗi nhóm move hoàn chỉnh để không cho phe đã hết đội nhận hành động sau đó. Hard cap 100 lượt: hòa trong local; online dùng tiebreak mục 11.

### 6.7 Ability/item dispatcher và sự kiện

Dispatcher switch theo effect ID tường minh; không eval string. Hook tối thiểu: `onEntry`, `modifyStat`, `modifyOutgoingDamage`, `modifyIncomingDamage`, `afterDamage`, `onStatusApplied`, `endTurn`.

Mỗi handler nhận context rõ nguồn, target, side, hit; trả thay đổi có cấu trúc. Không tự gọi lại whole damage pipeline. Giới hạn depth 8 và 256 events/một lượt; vượt giới hạn là lỗi engine, abort trận debug với trace, không âm thầm cắt event rồi tiếp tục thưởng.

Event kinds: `turnStarted`, `switchOut`, `switchIn`, `abilityTriggered`, `itemTriggered`, `formChanged`, `moveStarted`, `moveFailed`, `moveMissed`, `guarded`, `damage`, `heal`, `statusApplied`, `statusCured`, `statChanged`, `fieldChanged`, `effectExpired`, `fainted`, `turnEnded`, `battleEnded`.

Payload damage có hpBefore/hpAfter/amount/effectiveness/source; secondary có event riêng. Log dịch từ event. Không giữ snapshot toàn trận lặp lại ở mỗi particle. M1 có thể dùng snapshot của bản hiện tại làm adapter tạm; M3 phải có event delta + snapshot đầu/cuối lượt để tránh tăng payload và lộ dữ liệu PvP.

Giữ log trọn trận tối đa 100 lượt; UI phân trang 20 lượt/lần. Replay local giữ 20 trận gần nhất, hiển thị giới hạn trước khi dọn; không tự xóa adventure save. Replay gồm initial snapshot, versions, committed actions và event stream. Replay v1 cũ được phát từ events nếu không còn engine tương ứng, không tự tính lại bằng v2.

## 7. Nội dung Mon, chiêu, Ability và item

### 7.1 Bộ chỉ số nền theo vai trò

Mọi loài cơ bản dùng ngân sách 480 base points. Bộ khởi đầu dưới đây cho phép triển khai ngay; đây là seed balance, cần điều chỉnh bằng simulation và playtest, không tuyên bố đã cân bằng.

| Role ID | HP | ATK | DEF | SPA | SPD | SPE | Lối chơi |
|---|---:|---:|---:|---:|---:|---:|---|
| physical-fast | 70 | 105 | 65 | 55 | 70 | 115 | Đánh trước, áp lực đơn mục tiêu |
| special-fast | 70 | 55 | 65 | 105 | 70 | 115 | Special attacker nhanh |
| physical-tank | 100 | 100 | 105 | 45 | 80 | 50 | Chịu đòn, phản công |
| special-tank | 100 | 45 | 80 | 100 | 105 | 50 | Chống special, gây áp lực chậm |
| support | 95 | 45 | 90 | 70 | 100 | 80 | Weather, hồi phục, bảo vệ |
| disruptor | 80 | 70 | 80 | 80 | 80 | 90 | Status, speed control |

Tạo JSON tường minh cho từng loài từ role. Không tính role dựa trên ID lúc battle. Khi tinh chỉnh sau playtest, chuyển 5–10 điểm giữa stats, giữ tổng 480; chỉnh tổng chỉ qua quyết định balance version mới.

### 7.2 Ma trận 36 loài

Roster gồm cả Mon đơn hệ và song hệ. Phân bổ khởi đầu đề xuất: 12 Mon đơn hệ ở bảng dưới; 24 Mon còn lại giữ cặp hệ hiện tại. Ability đầu tiên là Ability theo hệ chính trong mục 7.4; cột Ability trong ma trận vai trò là lựa chọn thứ hai. Không đồng thời sở hữu cả hai Ability.

| Mon đơn hệ | `types` v2 | Hệ học chiêu bổ trợ, không phải hệ cơ thể |
|---|---|---|
| Emberlyn | `["Flame"]` | Gale |
| Tideray | `["Tide"]` | Gale |
| Mossprout | `["Bloom"]` | Gale |
| Voltkit | `["Volt"]` | Shadow |
| Frostowl | `["Frost"]` | Gale |
| Pebblit | `["Stone"]` | Tide |
| Zephyroo | `["Gale"]` | Stone |
| Gloomoth | `["Shadow"]` | Venom |
| Solmane | `["Light"]` | Flame |
| Venomble | `["Venom"]` | Tide |
| Ironcub | `["Steel"]` | Stone |
| Astralyn | `["Astral"]` | Shadow |

Quy tắc dữ liệu và giao diện:

- `types` là mảng dài đúng 1 hoặc 2, không trùng phần tử, không dùng null/chuỗi rỗng hoặc lặp một hệ để giả song hệ.
- Mon đơn hệ vẫn học được chiêu hệ khác nếu movepool cho phép. Hệ của chiêu, hệ của Mon và Ability là ba thuộc tính riêng; dùng chiêu Gale không tự biến Emberlyn thành Flame/Gale.
- Thêm `coverageType` vào dữ liệu authoring: Mon song hệ dùng hệ phụ; Mon đơn hệ dùng cột bổ trợ trên. Trường này chỉ giúp dựng movepool, không dùng khi tính phòng thủ hoặc STAB.
- UI chỉ vẽ đúng số type badge; phần so sánh/Team Builder tính từ `types`, không bắt buộc truy cập `types[1]`.
- Ví dụ: Tide đánh Emberlyn Flame → 2×; Tide đánh Cindrake Flame/Stone → 4× theo bảng hiện tại. Chiêu Gale của Emberlyn không nhận STAB; chiêu Flame có STAB.
- Ascension có thể đổi từ đơn hệ sang song hệ: Astralyn thường là Astral, dạng Ascension là Astral/Shadow theo mục 7.6. Chỉ dạng hiện tại được dùng để tính STAB và khắc hệ.
- Thay đổi hệ thuộc catalog v2, không sửa hệ của trận v1 đang chơi; migration chỉ áp khi trận v1 kết thúc theo mục 5.4.

| ID cũ | Loài | Role | Ability thứ hai | Utility bổ sung |
|---|---|---|---|---|
| 0 | Emberlyn | physical-fast | quick-start | rally |
| 1 | Cindrake | special-fast | keen-focus | tailwind-call |
| 2 | Volcaram | physical-tank | sturdy-heart | rally |
| 3 | Tideray | special-fast | rain-swimmer | tailwind-call |
| 4 | Coralisk | disruptor | clean-entry | barrier |
| 5 | Shellure | special-tank | water-shell | redirect |
| 6 | Mossprout | support | sun-runner | barrier |
| 7 | Thornox | physical-tank | thorn-coat | rally |
| 8 | Florawisp | support | healer | tailwind-call |
| 9 | Voltkit | physical-fast | quick-start | rally |
| 10 | Stormaw | special-fast | keen-focus | tailwind-call |
| 11 | Ampillo | physical-tank | sturdy-heart | redirect |
| 12 | Frostowl | special-fast | keen-focus | tailwind-call |
| 13 | Glacirn | special-tank | calm-mind | barrier |
| 14 | Snowmelt | support | healer | redirect |
| 15 | Pebblit | physical-tank | sturdy-heart | barrier |
| 16 | Obsidon | physical-tank | intimidator | redirect |
| 17 | Dunewyrm | disruptor | clean-entry | rally |
| 18 | Zephyroo | physical-fast | quick-start | rally |
| 19 | Galesong | support | healer | barrier |
| 20 | Cyclopup | disruptor | intimidator | redirect |
| 21 | Gloomoth | disruptor | keen-focus | barrier |
| 22 | Noctalon | physical-fast | quick-start | tailwind-call |
| 23 | Umbrawolf | physical-tank | intimidator | rally |
| 24 | Solmane | physical-tank | sun-runner | rally |
| 25 | Aurorix | special-tank | calm-mind | barrier |
| 26 | Lumifin | support | water-shell | redirect |
| 27 | Venomble | support | clean-entry | barrier |
| 28 | Toxipede | physical-fast | thorn-coat | rally |
| 29 | Mirecap | special-tank | healer | redirect |
| 30 | Ironcub | physical-tank | sturdy-heart | redirect |
| 31 | Gearaptor | physical-fast | quick-start | rally |
| 32 | Chromantis | disruptor | thorn-coat | tailwind-call |
| 33 | Astralyn | special-fast | keen-focus | barrier |
| 34 | Runelisk | special-tank | calm-mind | redirect |
| 35 | Orbitail | support | healer | tailwind-call |

Movepool mỗi loài: ba chiêu hệ chính + ba chiêu `coverageType` + Guard + Mend + utility theo hệ chính + utility bổ sung ở bảng, loại trùng. Mỗi loài tối thiểu 8 chiêu khác nhau. Utility theo hệ: Flame Sun Call; Tide Rain Call; Bloom Meadow Call; Volt Storm Call; Frost Snow Call; Stone Sand Call; Gale Tailwind Call; Shadow Rally; Light Barrier; Venom Redirect; Steel Barrier; Astral Rally.

Build mặc định: strike hệ chính, lance của `coverageType`, Guard, utility theo hệ. Người chơi được đổi tự do trong movepool sau khi sở hữu permanent.

### 7.3 Catalog 48 chiêu

**Chiêu có thể có hiệu ứng gameplay riêng, ngoài animation.** Một chiêu có thể chỉ gây damage; gây damage kèm xác suất burn/poison/giảm stat; hoặc chỉ heal/Guard/đổi thời tiết. Không bắt buộc mọi chiêu đều có hiệu ứng phụ. Các hiệu ứng phải khai báo trong dữ liệu, được engine giải quyết và xuất event; animation chỉ trình bày kết quả đó.

Schema move phân biệt `effects` (luật) và `animationId`/`soundId` (hình ảnh/âm thanh). Mỗi effect khai báo `kind`, `timing`, `target`, `chance`, `params`; ví dụ Flame Strike có `kind: applyStatus`, `timing: afterDamage`, `target: hitTarget`, `chance: 0.2`, `params: {status: burn}`. Guard/field/heal dùng effect tại `onUse`, chance 1, với targetMode thích hợp. `chance` dùng số trong [0,1]; bảng phần trăm bên dưới là cách hiển thị.

Effect enum alpha: `applyStatus`, `changeStage`, `heal`, `guard`, `setWeather`, `setTerrain`, `setSideCondition`, `redirect`. Chỉ chấp nhận tổ hợp kind/timing/target được dispatcher hỗ trợ; validator từ chối effect lạ. Damage cơ bản do category/power quyết định, không khai thêm effect damage lần hai. Hiệu ứng đặc biệt phát sinh sau alpha phải có handler, description và test mới trước khi thêm vào movepool.

36 chiêu tấn công = 12 hệ × ba mẫu. ID dạng `flame-strike`, `flame-lance`, `flame-tempest`. Tên hiển thị Strike có thể giữ Ember Fang/Tidal Pulse/... để bảo toàn bản sắc; engine dùng ID, không phân tích tên để suy ra contact hay animation.

| Mẫu | Power | Accuracy | PP | Priority | Target | Category |
|---|---:|---:|---:|---:|---|---|
| strike | 60 | 100 | 20 | 0 | foe | Theo bảng dưới |
| lance | 85 | 95 | 10 | 0 | foe | Đảo physical ↔ special của strike |
| tempest | 65 | 95 | 10 | 0 | allFoes | Special |

Strike physical có `contact:true`; lance/tempest không contact. Accuracy tính riêng mỗi target. Tempest không có secondary trong alpha. Strike dùng secondary riêng:

| Hệ | Strike category | Secondary sau damage |
|---|---|---|
| Flame | Physical | 20% burn |
| Tide | Special | 20% giảm speed stage 1 |
| Bloom | Physical | 20% giảm defense stage 1 |
| Volt | Special | 20% slow |
| Frost | Special | 20% slow |
| Stone | Physical | 20% giảm defense stage 1 |
| Gale | Physical | 20% giảm attack stage 1 |
| Shadow | Physical | 20% giảm special defense stage 1 |
| Light | Special | 20% giảm special attack stage 1 |
| Venom | Physical | 30% poison |
| Steel | Physical | 20% tăng defense bản thân 1 |
| Astral | Special | 10% sleep |

12 utility: accuracy 100, category status, power 0; heal/field không kiểm accuracy RNG vì chắc chắn nếu hợp lệ.

| ID | Type | PP | Priority | Target | Hiệu ứng |
|---|---|---:|---:|---|---|
| sun-call | Flame | 5 | 0 | field | Sun 5 |
| rain-call | Tide | 5 | 0 | field | Rain 5 |
| meadow-call | Bloom | 5 | 0 | field | Meadow 5 |
| storm-call | Volt | 5 | 0 | field | Storm 5 |
| snow-call | Frost | 5 | 0 | field | Snow 5 |
| sand-call | Stone | 5 | 0 | field | Sand 5 |
| guard | Steel | 10 | 4 | self | Guard theo chuỗi xác suất mục 6 |
| mend | Light | 10 | 0 | self | Hồi floor(maxHP × 0.35), clamp HP |
| rally | Astral | 10 | 0 | self | ATK và SPA stage +1, tối đa +6 |
| tailwind-call | Gale | 10 | 0 | ownSide | Tailwind 4 |
| barrier | Light | 10 | 0 | ownSide | Barrier 3 |
| redirect | Shadow | 10 | 2 | self | Redirect đến cuối lượt |

Struggle là system move thứ 49, không nằm trong 48 chiêu học được. Không bắt một loài học đủ mọi support move; dùng movepool đã chốt. Nếu muốn thêm Heal Ally, Cleanse, Trick Room, hazards, multi-hit: tạo ticket content v2.1 sau alpha, không nhét ngầm vào effect string cũ.

### 7.4 Catalog 24 Ability

| ID | Hook và hiệu ứng |
|---|---|
| dawnbringer | onEntry đặt Sun 5 |
| raincaller | onEntry đặt Rain 5 |
| wild-growth | onEntry đặt Meadow 5 |
| static-field | onEntry đặt Storm 5 |
| snowglobe | onEntry đặt Snow 5 |
| sandstream | onEntry đặt Sand 5 |
| tailwind | modifyStat SPE ×1.3 cho bản thân; không phải side Tailwind |
| night-hunter | Damage ×1.25 nếu target trước hit dưới 50% HP |
| radiance | endTurn hồi floor(maxHP ×0.05), tối thiểu 1 nếu còn sống |
| venom-touch | Sau damage, 30% poison; không cộng thêm roll nếu chính chiêu đã thử poison |
| ironhide | Damage nhận ×0.8; không residual |
| mind-link | Đồng đội active có damage ×1.15; không tự buff, không stack nhiều nguồn |
| quick-start | SPE ×1.2 khi HP hiện tại đầy; speed queue vẫn chốt đầu lượt |
| keen-focus | Accuracy cuối = min(100, baseAccuracy +5 điểm phần trăm) |
| sturdy-heart | Một lần/trận, từ đầy HP sống sót lethal hit ở 1 HP |
| rain-swimmer | SPE ×1.5 khi Rain |
| clean-entry | onEntry chữa major status của bản thân |
| water-shell | Damage Flame nhận ×0.5 |
| sun-runner | SPE ×1.5 khi Sun |
| thorn-coat | Sau contact damage >0, attacker mất max(1,floor(maxHP/16)); không kích nếu defender đã KO |
| healer | endTurn hồi 5% maxHP cho một đồng đội active có tỷ lệ HP thấp nhất; tie slot thấp; không tự hồi |
| calm-mind | SPD ×1.2 |
| intimidator | onEntry giảm ATK stage 1 của mọi foe active |
| steady-body | Chặn giảm stats do đối thủ; vẫn chịu status và tự hạ stat |

`steady-body` dành cho Ascension và nội dung sau, vẫn có handler/test từ M2. Không tự thay Ability khi mang item. Nếu sturdy-heart và Focus Crystal cùng hợp lệ, sturdy-heart dùng trước; Crystal không tiêu vì damage không còn lethal sau bước đó. Handler sống sót không áp dụng recoil, poison, sand.

### 7.5 Held items

Tất cả 12 item thường được mở từ đầu trong alpha/beta để không khóa chiến thuật. Không có kho số lượng; item là unlock có thể gắn ở nhiều build, Item Clause áp dụng trong đội thi đấu. Item dùng một lần chỉ tiêu trong battle, phục hồi giữa trận.

| ID | Hiệu ứng |
|---|---|
| vital-seed | endTurn hồi 8% maxHP |
| power-lens | Damage gây ×1.2 |
| aegis-plate | Damage nhận ×0.8 |
| swift-feather | SPE ×1.25 |
| cure-berry | Chữa major status đầu tiên nhận trong trận; một lần, gồm sleep/slow |
| focus-crystal | Từ full HP sống lethal hit ở 1; một lần |
| healing-berry | Sau damage, nếu còn sống và HP ≤25%, hồi 25% maxHP; một lần |
| clear-charm | Chặn giảm stats từ foe như steady-body |
| weather-rock | Weather do người mang tạo kéo dài 7 thay vì 5; không terrain |
| terrain-root | Terrain do người mang tạo kéo dài 7 thay vì 5 |
| special-lens | SPA ×1.15 |
| physical-band | ATK ×1.15 |

`none` là không item, không tính vào Item Clause. Mỗi modifier chỉ dùng một lần; Power Lens thuộc damage, Special Lens thuộc stat. Tooltip phải ghi phân biệt. Item thay trong build không thay snapshot trận đang chơi.

### 7.6 Ascension ở M5

Tên riêng thay cho Mega: **Ascension**, thiết bị cosmetic của trainer là **Aether Ring**. Chỉ effect battle mới tiêu lượt dùng; ring UI không thêm chỉ số.

| Loài | Stone ID | Hệ dạng mới | Thay base stats | Ability dạng mới |
|---|---|---|---|---|
| Cindrake | cindrake-stone | Flame/Steel | SPA +30, DEF +20, SPD +20, SPE +10 | keen-focus |
| Shellure | shellure-stone | Tide/Steel | DEF +30, SPD +30, SPA +20 | steady-body |
| Florawisp | florawisp-stone | Bloom/Light | SPA +30, SPD +20, DEF +10, SPE +20 | healer |
| Astralyn | astralyn-stone | Astral/Shadow | SPA +30, SPE +30, DEF +10, SPD +10 | mind-link |

HP không đổi; tổng tăng 80, stone chiếm ô item. Chỉ một actor/bên được có `ascend:true`; kích trước queue move, tính lại stats rồi chốt speed. Nếu command không hợp lệ thì không tiêu lượt; actor chết/rời sân trước phase activation thì fail không tiêu. Bản đầu không cho Ascend cùng command switch.

Giữ HP hiện tại, PP, major status và stat stages. Thay Ability ngay; nếu Ability mới có onEntry thì KHÔNG tự kích onEntry khi biến hình, chỉ kích khi thực sự vào sân lần sau. Biến hình tồn tại tới hết trận, switch không reset. Stone không bị tiêu khỏi tài khoản. Regulation Alpha không cho Ascension; Beta A cho bốn dạng này.

### 7.7 AI và cân bằng

AI chỉ nhận cùng thông tin người chơi có thể biết: loài, move/item đã lộ, HP công khai, field. Không đọc pending commands hoặc build/seed ẩn của đối thủ.

Ba cấp:

1. Easy: chọn hành động hợp lệ bằng RNG stream AI riêng, ưu tiên đòn có damage; không spam utility vô ích.
2. Normal: scoring một lượt, xem tất cả move-target/switch hợp lệ. Damage score = expected %HP mất; KO +40; nguy cơ bản thân KO −30; heal = %HP hồi hiệu quả; weather/side buff tính trên hai lượt dự kiến.
3. Gym/Hard: lấy top 6 actions/actor, đánh giá tối đa 36 cặp doubles, tránh hai switch cùng reserve và hai weather xung đột. Thêm synergy +15 khi một action hỗ trợ action còn lại; phạt overkill theo HP dư. Chọn trong các phương án gần điểm nhau bằng stream AI, không gọi battle RNG dự đoán.

Không cho AI biết người chơi vừa bấm gì. Hard không có stat boost ngoài regulation. Gym tăng độ khó bằng đội, build và chiến thuật, không level vượt chuẩn.

Simulation: tối thiểu 10.000 trận seeded giữa 12 đội mẫu có phiên bản, chia single/double. Xuất CSV gồm seed, matchup, firstSide, turns, winner, moveUsage, speciesUsage, timeout. Chạy đổi bên với cùng cặp đội để tìm thiên vị. Ngưỡng điều tra: đội vượt 65% win trên tập đối thủ đa dạng, move gần như luôn được chọn, hoặc >10% trận chạm 100 lượt. Đây là tín hiệu sửa, không là chứng minh cân bằng. Bắt buộc thêm playtest người thật.

## 8. Training, Box và đội hình

### 8.1 Box

Archive giữ cả loài chưa sở hữu; Box lọc những Mon đã có. Tab Permanent/Trial, tìm tên, lọc hệ/role, sort tên/rarity. Mỗi card hiện ownership, số build và team đang dùng.

Trong 36-loài đầu, một permanent/loài, không bán Box slot. Trial không được tạo nếu đã permanent; tuyển permanent từ trial nâng cùng monId để không gãy tham chiếu team. Gacha ra loài đang trial cũng nâng thành permanent thay vì tính duplicate.

### 8.2 Luồng Training

```text
Box → Mon detail → chọn build → chỉnh points/alignment/Ability/4 moves/item
→ preview stat và thay đổi → xác nhận giá → lưu → cập nhật team dùng build này
```

- Thanh points hiện còn lại, không nhận âm/số lẻ/tổng vượt 32.
- Chọn move hiển thị category, type, PP, power, accuracy, target và mô tả effect.
- So sánh before/after; reset chỉ reset draft, chưa ghi server.
- Neutral alignment chọn một nút, tránh lưu up/down trùng nhau.
- Ba build có tên tối đa 40 ký tự; sao chép chỉ khi còn slot; delete build bị team dùng phải chọn thay hoặc bỏ khỏi team trước.
- Build mới đầu tiên của mỗi Mon miễn phí; đổi nội dung battle một lần lưu giá 10 coins; đổi tên/team order miễn phí. Preview/sandbox miễn phí. Save no-op không trừ tiền.
- Mon Trial chỉ xem build mẫu; nếu thử train server trả `TRIAL_READ_ONLY`.
- Revision mismatch: trả build mới nhất, giữ draft và cho người dùng xem khác biệt; không ghi đè mù.

### 8.3 Team Builder

Mỗi team có tối đa sáu loài khác nhau. Team draft được lưu chưa đủ slot; nút thi đấu phải chỉ ra lỗi theo regulation. Kiểm tra cả six-mon roster cho species/item clause, không chỉ các Mon đã chọn vào trận.

Hiện tổng hợp vai trò, danh sách kháng/yếu theo hệ và coverage của moves. Không ghi “tỷ lệ thắng 80%” khi không có data. Gợi ý đơn giản: thiếu speed control, >3 Mon cùng yếu một hệ, chưa có support, trùng item, ít damage category.

Export/import đội dùng JSON schema version + species/build specs, không coins, ownership, monId nội bộ hoặc session. Import validate ID/length/points trước; Mon chưa có thì lưu blueprint và đánh dấu chưa đủ điều kiện, không cấp Mon. Giới hạn file 64 KB, không thực thi nội dung.

### 8.4 Team Preview và Regulations

Ba regulation mặc định:

| ID | Roster | Chọn vào trận | Clause | Trial/Ascension |
|---|---|---|---|---|
| sandbox-v2 | 1–6 single, 2–6 double | Tối đa 3/4, min 1/2 | Species; item clause tắt | Trial có, Ascension theo toggle đã mở |
| alpha-single | Đúng 6 | 3, lead 1 | Species + Item | Trial có, Ascension không |
| alpha-double | Đúng 6 | 4, lead 2 | Species + Item | Trial có, Ascension không |

M5 thêm beta-single/beta-double cho bốn Ascensions. M7 Ranked dùng regulation riêng, Trial không hợp lệ. Điều kiện trial phải còn hiệu lực lúc lock đội; đã vào trận giữ snapshot đến kết thúc.

Preview chỉ công khai sáu species và base form, không công khai selected lineup, held item, Ability, stats hoặc move. UI kéo/chọn theo thứ tự; hai vị trí đầu là lead doubles. Confirm cho xem lại lead trước commit. AI chọn từ đội của nó dựa roster công khai; không dựa selected lineup chưa lộ.

### 8.5 Gym và phòng tập

Sáu gym là sáu bài học: Sun; Rain; phòng thủ Snow/Sand; Tailwind; status/redirect; phối hợp Astral + Ascension ở Beta. Mỗi gym có đội single và double riêng, team JSON hợp regulation. Badge dùng chung hai format, thưởng first-clear một lần chung.

Phòng tập có sandbox không thưởng: chọn đối thủ dummy, field, hiển thị damage breakdown, thử build draft và replay. Debug controls chỉ có trong sandbox; server không nhận chúng cho gym/PvP. Sandbox không tiêu trial lượt/thời gian bổ sung; trial vẫn tuân expiry thực.

## 9. Tuyển Mon, gacha và kinh tế

### 9.1 Ví và bảng giá khởi đầu

Giữ balance coins/crystals hiện tại qua migration. Người mới giữ 2.400 coins và 1.800 crystals, sáu starter. Coins là tài nguyên tương đương VP theo nhu cầu game; không bán tiền thật.

| Hành động | Coins | Crystals | Ghi chú |
|---|---:|---:|---|
| Win AI exhibition | +180 | +80 | Giữ prototype; M7 cân chỉnh riêng online |
| Lose AI exhibition | +60 | +20 | Hoàn thành trận, không surrender |
| Draw | +60 | +20 | Một receipt |
| Surrender / sandbox | 0 | 0 | Không farm đầu hàng |
| Gym first-clear | +500 thêm | +300 thêm | Bên cạnh reward trận, một lần/badge |
| Permanent Common/Rare/Epic/Legendary | −600/−900/−1.200/−1.800 | 0 | Rarity không tăng stat budget |
| Trial | 0 | 0 | Một slot trial đồng thời |
| Refresh lineup | −100 | 0 | Tối đa ba refresh trả phí/chu kỳ |
| Lưu thay đổi build | −10 | 0 | Build đầu tiên miễn phí; no-op miễn phí |
| Summon ×1/×10 | 0 | −100/−1.000 | Giữ pity hiện tại |
| Duplicate permanent | +150 | 0 | Không nâng stat |
| Mở mỗi Ascension Stone | −1.200 | 0 | Unlock vĩnh viễn; cho thử miễn phí trong sandbox |

Reward transaction phải cập nhật kết quả + tiền + receipt cùng một lần lưu. Reload/reconnect không cấp lại. Private match không thưởng kinh tế ở alpha để tránh farm bằng hai client.

### 9.2 Roster Ranch

- Hiển thị sáu loài khác nhau trong lineup, giá, trạng thái sở hữu, hai Ability và moveset mẫu.
- Lineup tự đổi mỗi 24 giờ theo server UTC; `cycleId=floor(serverTimeMs/86400000)` do server tính, không từ client.
- Một slot luôn ưu tiên loài chưa có nếu còn; không hứa chưa sở hữu toàn bộ lineup.
- Roll lineup bằng stream RNG recruitment được lưu; reload không reroll. Refresh trả phí là action atomic: kiểm balance/cycle/count → debit → roll → receipt.
- Local không chống người có quyền chỉnh đồng hồ/files; server nhận `effectiveNow=max(lastSeenServerTime,serverNow)` tránh quay ngược thời gian vô tình. Online dùng giờ server trung tâm.
- Trial 24 giờ, tối đa một active trial; mỗi loài chỉ dùng thử một lần trong cùng cycle. Không cho bỏ rồi nhận lại để reset timer.
- Khi hết hạn ngoài trận, đánh dấu expired và team invalid, không âm thầm xóa build/team. Trận đã lock vẫn chơi xong, không gia hạn ownership.
- Từ Trial bấm Recruit permanent: trả đủ giá hiện hành, giữ monId và build mẫu; unlock chỉnh sửa.

### 9.3 Gacha

Giữ 60% Common, 30% Rare, 8% Epic, 2% Legendary trước guarantee; lượt tổng thứ 10 bảo đảm Epic hoặc hơn; pity 50 Legendary. Viết xác suất điều kiện đúng thứ tự: Legendary guarantee/roll trước → Epic guarantee → Rare/Common. Pool không rỗng ở mọi rarity. Rate UI lấy cùng config với engine.

Một batch 10 pull atomic: nếu thiếu 1.000 crystals thì không pull một phần. Receipt chứa kết quả từng pull, pity trước/sau, duplicate compensation. UI reveal có Skip; skip chỉ bỏ animation. Catalog update không được reset pity. Seed economy bí mật khi online; không dùng hash playerId như bản local cũ.

### 9.4 Mail, nhiệm vụ và chống nhận trùng

Giữ ba thư milestone hiện có và trạng thái đã nhận. Mail mới có mailId/rewardSpec/eligibility/expiresAt. Claim dùng receipt `(owner, mailId)`. Hết hạn không xóa lịch sử claim. Batch claim validate rồi ghi một transaction, không vừa cộng một phần vừa báo lỗi chung.

M8 mới thêm daily/weekly và pass. Đừng thêm daily vào M4 để kéo scope; M4 chỉ cần bảng thưởng và đường tuyển có chủ đích hoạt động.

## 10. Giao diện, hình ảnh và âm thanh

### 10.1 Điều hướng và trạng thái mỗi màn hình

| Màn hình | Thành phần cần có | Empty/loading/error bắt buộc |
|---|---|---|
| Home | Đội đang chọn, tiếp tục trận, AI/sandbox, gym, việc mới | Đang load save; lỗi reconnect; chưa có team hợp lệ |
| Box/Archive | Filter/search, ownership, build count | Không match, trial hết hạn, catalog lỗi |
| Training | Draft points/Ability/moves/item, diff, giá | Không đủ tiền, draft invalid, stale revision |
| Teams | Sáu slot, roster, clause, export/import | Chưa đủ Mon, item trùng, build mất tham chiếu |
| Recruitment | Sáu offer, timer, trial/permanent/refresh | Hết hạn trong lúc chọn, đã sở hữu, thiếu tiền |
| Summon | Rates, pity, batch, reveal | Busy, thiếu crystals, receipt đang chờ |
| Preview | Hai roster, pick order, lead, đồng hồ nếu PvP | Chọn thiếu, timeout, đối thủ rời |
| Battle | Sân, HP/status, field layers, commands, target, log, reserve | Đang chờ đối thủ, animation, replacement, reconnect |
| Result | Win/loss/draw, lý do, rewards, xem log/replay | Receipt pending; không nút claim trùng |
| Gym | Sáu bài học, badge, đội khuyến nghị | Locked, đã clear, tiếp tục trận |
| Mail | Milestone, reward, claim status | Empty, expired, đã nhận |
| Settings | Âm lượng, animation speed, reduced motion, contrast, text, ngôn ngữ, backup | Audio chưa được unlock; backup lỗi |

Ngôn ngữ mặc định UI mới: tiếng Việt; giữ English tùy chọn. Tách mọi chuỗi vào dictionary vi/en, tên Mon giữ nguyên. Không nối HTML với tên build/trainer chưa escape. Tooltip desktop và tap-to-open mobile có cùng nội dung.

### 10.2 Bố cục battle

Desktop: arena bên trên; commands bên trái, log bên phải. Mobile: arena → phase/field → commands → log thu gọn. Move card hiện category/type/power/accuracy/PP; mục tiêu được highlight trên sân; hỗ trợ bàn phím.

Weather, terrain và side conditions có chip riêng, biểu tượng, lượt còn lại. Bấm chip đọc effect. Ability/item trigger có banner ngắn kèm source. Người chơi xem battle log được trong lúc animation, nhưng không gửi lệnh lượt tiếp trước phase COMMAND.

Khi redraw, không thay toàn bộ DOM arena cho mỗi particle hoặc tick timer. Giữ scene root, update HP/status/slot từ event. Full page render chỉ khi đổi màn hình. Focus không nhảy khi chọn move/target.

### 10.3 Pipeline đồ họa

Giữ phong cách cel-shaded, silhouette rõ, outline đậm, arena xanh đen. Làm chuẩn một nhóm bốn Mon: Emberlyn, Tideray, Mossprout, Voltkit; duyệt nội bộ bằng cùng cảnh battle trước khi mở rộng 32 loài còn lại.

Phương án mặc định local: SVG chia nhóm `body`, `head`, `limbs`, `tail`, `eyes`, `accent`, `shadow`, mỗi nhóm có transform origin. Dùng `data-part`, không dựa index path. Mỗi loài có profile idle/attack/hit/faint; không phải mọi loài đều nhảy cùng một cách. Loài bay hover; loài nặng nén thân; caster giơ đầu/chi trước; contact tiến ngắn.

Nếu cần bitmap chất lượng cao: dùng image generation ở ticket asset riêng, xuất PNG/WebP có alpha và ghi nguồn/quyền sử dụng trong manifest. Không đổi cả game thành video; không dùng ảnh phẳng có nền trắng chồng lên arena. Chưa bắt buộc công cụ tạo ảnh trả phí.

Asset contract:

```text
monster-id/base.svg hoặc base.webp
monster-id/ascended.svg hoặc ascended.webp
profile: canvasSize 512, anchor (0.5,0.88), facing right, scale 1
pose metadata: idle, cast, contact, hit, faint, enter
fx metadata: element, pattern, impact, soundId
```

SVG hiện tại dùng viewBox riêng: thêm adapter chuẩn hóa anchor, không kéo giãn tỷ lệ. Placeholder vẫn hiển thị nếu thiếu asset; check-content báo lỗi thiếu asset cần cho release.

### 10.4 Animation contract

Mỗi move khai báo `animationId`, `contact`, `projectilePattern`, `impactId`, `soundId`. Không tiếp tục suy contact qua tên Fang/Lash/... như hiện tại.

Timeline mặc định: prepare 180 ms → cast/projectile 300 ms → impact 120 ms → recovery 200 ms. HP đổi tại impact event. Diện rộng phát một cast, nhiều target impact; không làm cả chiêu nối tiếp cho từng mục tiêu. Tổng chuẩn khoảng 800 ms/action; utility 500–650 ms, Ascension tối đa 1.800 ms và có skip.

Tách animation state khỏi authoritative state. Có token hủy khi đổi page/reconnect/resize. Khi skip, apply snapshot cuối đã được server xác nhận, xóa canvas/RAF/listener tạm. Giới hạn particle active 150 desktop/60 mobile, canvas DPR tối đa 2. Reduced motion: bỏ rung, flash, projectile; vẫn tên move/HP/log, chuyển trạng thái nhanh.

Mỗi event chỉ phát sound một lần theo eventId; reconnect không phát lại toàn bộ lượt. Replay có quyền phát lại, battle live thì không. Khi PvP cần che thông tin, animator chỉ nhận projected event, không full server frame.

### 10.5 Âm thanh

SFX tối thiểu: click, confirm, entry, 12 elemental casts, impact nhẹ/nặng, heal, guard, KO, summon, victory/defeat. BGM: menu, exhibition, gym, result; dùng nguồn tự tạo hoặc có quyền dùng, ghi trong manifest.

Master/Music/SFX volume và mute tách riêng, lưu settings. Crossfade BGM 300 ms; không restart cùng track mỗi render. Unlock audio sau click/tap; nếu autoplay bị chặn, game vẫn chạy và hiện nút bật âm thanh. Trình duyệt có thể hạn chế audio tự phát; xem [hướng dẫn autoplay của MDN](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay).

### 10.6 Chỉ tiêu trải nghiệm

- Test viewport 390×844 và 1366×768; không scroll ngang; button quan trọng ít nhất 44×44 CSS px.
- Không chỉ dùng màu biểu thị type/status; có chữ/icon.
- HP/log đọc được trong high contrast và larger text; modal quản lý focus/Escape.
- Animation target không trượt khi Mon đổi slot; log damage khớp HP cuối.
- Mục tiêu 60 fps desktop, không dưới 30 fps kéo dài trên máy test mobile; ghi thiết bị và kết quả đo, không đoán.
- Asset battle đầu tiên mục tiêu ≤3 MB nén, tải lười ảnh còn lại; bộ ảnh 36 Mon không nạp tất cả khi mở trận.

## 11. Private PvP, timer và giao thức

### 11.1 Tách adventure khỏi match

Adventure là tài khoản/collection; match là snapshot của hai người. Không đổi `maxPlayers:1` thành 2 rồi coi như hoàn thành PvP.

Giữ sáu export của logic cho adventure. Fragment battle cung cấp hàm nội bộ `createBattle`, `validateBattleCommand`, `reduceBattle`, `projectBattle`; compile thêm entry `src/match-logic.js` từ cùng fragments cho server match adapter, không copy hai bộ luật. Public export của `logic.js` vẫn đúng sáu tên; match entry có test riêng. `src/match-logic.js` không import hay I/O và không tự sinh identity. Quy tắc adapter này phải được ghi rõ trong AGENTS khi tới M6, không sửa ràng buộc của adventure.

Server lưu match theo matchId, có A/B session được gán; khóa snapshot khi hai bên Ready. Build bên adventure được sửa cho trận sau nếu muốn nhưng không tác động trận hiện tại. Một account chỉ có một trận live có thưởng/rating.

### 11.2 Giao thức v2

Envelope mẫu:

```json
{
  "protocolVersion": 2,
  "type": "battle.commands",
  "actionId": "client-request-123",
  "matchId": "match-19",
  "turn": 4,
  "phaseRevision": 12,
  "commands": [
    {"actorId": "A-0", "kind": "move", "moveSlot": 1, "target": {"side": "B", "slot": 0}, "ascend": false},
    {"actorId": "A-1", "kind": "switch", "reserveId": "A-3"}
  ]
}
```

Không tin ownerSide/playerId trong action; server suy từ session. Hai bên submit dựa cùng phaseRevision; pending flag bên kia không tăng phaseRevision, tránh bên gửi sau bị stale. Chỉ chuyển phase hoặc state gameplay mới tăng revision. Presence có revision riêng.

Response loại `ack`, `error`, `snapshot`, `events`, `phase`, `matchResult`. Server gửi deadline và serverNow cho UI countdown. Gửi lại cùng actionId + cùng payload trả receipt cũ; cùng ID khác payload báo lỗi. Lưu dedupe theo match/phase và các economy receipts lâu dài; giới hạn payload 16 KB, commands đúng activeCount.

### 11.3 View và chống lộ lựa chọn

- Người chơi thấy full đội đã chọn của mình, HP/PP/build mình; opponent chỉ public roster, active species/form, HP phần trăm làm tròn, trạng thái, move/item/Ability đã được công khai bởi events.
- Preview không lộ opponent selection; COMMAND chỉ lộ đối thủ đã khóa lệnh hay chưa.
- Không gửi seed, pending commands, hidden PP/stat/item, reserve selection chưa xuất hiện.
- Tạo projection cho cả snapshot lẫn từng event; test tìm các hidden fields trong JSON thật nhận qua WebSocket, không chỉ test hàm viewFor.
- HP số tuyệt đối và damage amount tuyệt đối của opponent phải được thay bằng hpPercentBefore/hpPercentAfter trong projected event, không chỉ che HP ở snapshot. Floating text phía đối thủ dùng phần trăm mất thay cho số HP; phía mình vẫn có HP chính xác. Source item/Ability chỉ xuất hiện khi trigger được công bố. Không gửi damage breakdown chứa chỉ số bí mật trong PvP.
- Spectator chưa hỗ trợ ở Private Alpha; client không phải A/B bị từ chối match view. Khi thêm spectator sau này, dùng public view với delay theo regulation.

### 11.4 Đồng hồ mặc định

Local AI không timer mặc định; có tùy chọn luyện tập. Private competitive dùng:

| Đồng hồ | Giá trị | Khi chạy |
|---|---:|---|
| Team Preview | 60 giây | Từ khi cả hai kết nối và roster sẵn sàng |
| Mỗi lần chọn command | 45 giây | Từ phase COMMAND, dừng riêng từng bên khi commit |
| Replacement | 30 giây | Từ phase REPLACE, dừng khi commit |
| Player bank | 420 giây/người | Chỉ COMMAND và REPLACE của người chưa commit |
| Match total | 1.200 giây | Từ ENTRY đầu đến FINISHED, tính cả thời gian presentation |
| Presentation window | 3 giây/lượt | Sau resolve; không tiêu player bank; client nào chưa diễn xong phải fast-forward khi phase tiếp mở |

Deadline hiệu lực của người chọn là min(turnDeadline, bankRemaining). Preview timeout: auto chọn đủ theo thứ tự roster hợp lệ, không random. Turn timeout: auto chọn move còn PP ở slot nhỏ nhất, target foe slot nhỏ nhất; nếu không PP Struggle. Replacement timeout: reserve theo thứ tự đã chọn. Quá hạn ngân hàng: thua. Timeout ba phase COMMAND/REPLACE liên tiếp: thua do inactivity; có commit hợp lệ reset streak. Reconnect không reset bất kỳ đồng hồ nào.

Tiebreak hết match total hoặc 100 lượt: số Mon sống của lineup đã chọn → tổng hp/maxHP của lineup (KO=0) → bằng nhau hòa. Không dùng level/rarity. Nếu cả hai hết bank cùng timestamp hiệu lực thì hòa; nếu khác thời điểm, người hết trước thua. Timer và action cùng timestamp: `receivedAt < deadline` mới hợp lệ; bằng deadline xem là timeout.

Server serialize input và system timer trên một queue/match. Timer callback luôn kiểm phaseRevision/deadline trước khi apply, tránh callback lượt cũ đánh vào lượt mới. Thời gian thực lấy ở coordinator; engine chỉ nhận action system do server tạo. Từ chối client gửi `system.timeout`.

### 11.5 Mất kết nối, restart và quyền điều khiển

Một reconnect credential giữ seat, không dùng chỉ playerId tự khai. Local Private cấp token ngẫu nhiên server-side cho seat A/B, trả qua endpoint local; token lưu phía client, không đưa vào URL mời. Không có tài khoản online ở mốc này.

Disconnect không pause clocks. Reconnect nhận snapshot mới nhất và lastEventId, bỏ animation cũ. Tab thứ hai cùng session chỉ view; nhận quyền điều khiển bằng thao tác takeover rõ ràng, thu hồi quyền tab trước. Không cho hai tab cùng commit khác nhau.

Server shutdown có chủ đích: persist phase/deadlines trước đóng socket. Khởi động lại local có thể pause/resume match với thông báo; online không âm thầm phạt người chơi vì downtime server. M7 gặp server crash giữa trận đánh dấu `aborted-server`, không rating/reward, nếu không phục hồi được consistent snapshot. Phải chốt policy recovery trước public beta.

### 11.6 Kịch bản nghiệm thu PvP bắt buộc

Hai danh tính riêng bằng hai profile browser. A submit rồi inspect payload B: không có move A. B submit → hai client cùng turn/result. Thử double click, packet lặp, stale round, disconnect trước/sau commit, refresh giữa animation, timeout đồng thời, hai client thay Mon cùng lúc, surrender trong phase chờ. Không cộng reward local Private. Trước mở LAN/public phải tới gate networking M7, không tự thay host binding.

## 12. Online, Ranked và mùa giải

### 12.1 Thứ tự nâng hạ tầng

1. Hoàn thành Private PvP local.
2. Làm adapter PostgreSQL, migration và transaction tests trên database dev riêng.
3. Thêm account/session và flow liên kết local save có review.
4. Chuẩn bị staging private, HTTPS/WSS, secret ngoài source, log và backup.
5. Nghiệm thu staging, mới đề nghị chủ dự án cho phép publish.
6. Casual queue trước; Ranked sau đủ playtest và ổn định reconnect.

Nhà cung cấp hosting, domain, email/auth và chi phí chỉ chọn ở M7 theo ngân sách lúc đó; đó là cổng bên ngoài được ghi rõ, không phải việc người triển khai tự mua. Stack ứng dụng mặc định vẫn Node/ws/PostgreSQL; không bắt buộc đổi cloud template cũ.

### 12.2 Database và giao dịch

Tables tối thiểu: accounts, sessions, adventures, owned_mons, builds, teams, matches, match_events, action_receipts, economy_ledger, seasons, regulations, ratings, mail_claims, cosmetic_unlocks. Có FK, UNIQUE cho ID và receipt; wallet có ràng buộc không âm. PostgreSQL hỗ trợ các ràng buộc này, xem [Constraints](https://www.postgresql.org/docs/current/ddl-constraints.html).

Save battle command: lock match row → kiểm phase/revision → apply → ghi state/events/receipt → commit → broadcast. Reward và rating: lock match + account/rating theo thứ tự accountId ổn định → nếu result receipt chưa có thì cập nhật tất cả → commit. Transaction bị conflict phải retry bounded, không lặp broadcast trước commit. Cách chọn isolation/locking phải được test cạnh tranh; xem [Transaction Isolation](https://www.postgresql.org/docs/current/transaction-iso.html).

Không cần Redis/multiple game workers ở beta đầu. Một process điều phối match, PostgreSQL lưu bền. Chỉ thêm distributed coordination khi load test chứng minh cần; khi đó phải có owner lease/match và chống split-brain, không chỉ nhân số process.

### 12.3 Account và cross-save

Auth qua nhà cung cấp OIDC được chọn ở M7, session HTTP-only cookie Secure/SameSite phù hợp và kiểm Origin/CSRF. Trước tích hợp xác minh tài liệu provider, không tự viết password storage.

Local save chỉ đáng tin trong local. Khi link online: nhập team blueprint/cosmetic được cho phép; **không tự công nhận coins, crystals, ranked progress hay unlock chỉnh sửa bằng file local**. Phương án mặc định online tạo collection starter mới, cho import build hợp lệ dưới dạng blueprint. UI phải nói rõ trước liên kết, giữ nguyên local adventure.

Cross-save dùng server state duy nhất và revision; không merge hai ví bằng cộng số dư. Chỉ một session có quyền chơi trận tại một thời điểm; thiết bị khác đọc và có thể takeover ngoài phase đang commit. Responsive web đáp ứng desktop/mobile; native app và Nintendo không nằm trong bản này.

### 12.4 Casual/Ranked

- Queue tách single/double và regulationVersion; chỉ team hợp lệ được enqueue.
- Casual không cập nhật rating, vẫn authoritative. Hủy queue idempotent; khi đã được ghép thì phải đi flow accept/decline.
- Ranked dùng Elo ban đầu 1.000, K=32; expected=1/(1+10^((opponentRating-rating)/400)); score win=1/draw=0.5/loss=0. Lưu số thực rating, UI làm tròn; delta hai bên đối nhau.
- Ghép ±100 rating trong 30 giây đầu, sau đó tăng 50 mỗi 15 giây tới ±400. Không đủ người thì thông báo chờ; không giả bot thành người chơi Ranked.
- Match accept 20 giây; nếu một bên không accept, người đã accept trở lại queue giữ thời gian đợi.
- Không nhận Trial vào Ranked; regulation chốt team, versions và timer lúc match tạo.
- Tier hiển thị: Bronze <1.000; Silver 1.000–1.199; Gold 1.200–1.399; Platinum 1.400–1.599; Master ≥1.600. Đây là seed config có thể cân lại theo phân bố người chơi.
- Private/sandbox không tăng rating, season points hoặc thưởng online.

### 12.5 Season và cập nhật balance

Season đề xuất 28 ngày, mốc UTC tường minh; không tính theo ngày mở trình duyệt. Soft reset rating: 1.000 + 0.5×(rating−1.000). Giữ lịch sử season, không xóa achievements.

Trận bắt đầu trước thời điểm đóng season được ghi vào season cũ; payout chỉ chạy sau mọi trận cũ kết thúc/abort, có receipt. Update regulation chỉ tác động match mới. Catalog/rules cũ cần giữ cho trận đang chạy và replay.

Mỗi patch có changelog theo ID, trước/sau, lý do và tests. Đội không hợp lệ sau ban vẫn giữ trong team slot, hiển thị lỗi để sửa. Không tự thay move/item người chơi mà không báo.

### 12.6 M8: nhiệm vụ, pass và cosmetics

Bắt đầu pass miễn phí 20 mốc ×100 season points. Trận Ranked/Casual online hợp lệ: win 20, loss/draw 10, tối đa 200 điểm/ngày; surrender trước lượt 3 không điểm. Mission dùng event server, idempotent receipt. Season points reset; claimed rewards/cosmetic giữ.

Cosmetic gồm trainer portrait, màu áo, pose, entry throw, arena skin, profile frame, BGM. Không thêm buff combat. Membership/Premium là nhánh sản phẩm riêng, mặc định chưa triển khai: cần mô hình entitlement, thanh toán, webhook có dedupe, hoàn tiền và ngân sách vận hành. Không làm nút thanh toán giả hoặc hứa quyền lợi chưa có.

## 13. Backlog triển khai theo thứ tự

### 13.1 Quy ước ticket

Tất cả ô dưới đây chưa thực hiện ở thời điểm lập tài liệu. Kích cỡ tương đối: S = một thay đổi nhỏ; M = một luồng có test; L = nhiều bước phụ thuộc, phải chia thành commit nhỏ. Kích cỡ không là cam kết số ngày.

Mỗi ticket cần ghi vào `docs/progress.md` khi bắt đầu triển khai: trạng thái, ngày, commit/checkpoint, file thay đổi, lệnh test và kết quả, ảnh/video QA nếu có, lỗi còn lại. File progress cũng là sản phẩm tương lai, chưa được tạo ở lượt roadmap.

Mẫu:

```text
ID: M1-03
Status: TODO | DOING | BLOCKED | DONE
Depends on: M1-02
Design references: 6.3, 6.5
Changed files:
Validation commands/results:
Manual scenarios:
Remaining issues:
Checkpoint:
```

### 13.2 M0 — Baseline, hợp đồng dữ liệu và nền refactor

**Đầu vào:** prototype hiện tại + roadmap này. **Đầu ra:** tổ chức code có thể mở rộng, chưa đổi gameplay mặc định.

| Ticket | Size | Việc làm và file chính | Phụ thuộc | Tiêu chí xong |
|---|---|---|---|---|
| M0-01 | S | Kiểm tra Git, runtime/lockfile; chạy check/test baseline; ghi `docs/progress.md`, backup save | Không | Có baseline kết quả và đường backup; không thay user save |
| M0-02 | M | Lập `content/*.json` schemas, enum/ID mappings, validator `scripts/check-content.mjs` | M0-01 | Reject ID trùng, tham chiếu sai, stat/PP/type sai; giữ mapping cả 36 ID |
| M0-03 | L | Generator/fragment và `dev-local.mjs` theo mục 4; đóng băng legacy engine adapter | M0-02 | Logic v1 trước/sau cho state/events giống hệt; compile fail không đè file chạy được |
| M0-04 | M | Tách client store/net/router, giữ màn hình hiện có làm module | M0-01 | Home, battle, summon, training hoạt động như cũ; animation không lặp listener |
| M0-05 | L | Storage adapter, migration pure function, fixtures v1/v2; dry-run và restore flow | M0-02, M0-03 | Rerun migration không đổi kết quả; save lỗi không thành save trắng; active v1 tiếp tục được |

Gate M0: baseline không regression; generator check no-import/six-exports; migration dùng fixture/backup copy, chưa tự nâng save đang chơi khi chưa có v2 UI/engine hoàn chỉnh. Migration production chỉ bật tại M3 release.

### 13.3 M1 — Battle engine v2

**Đầu vào:** contracts mục 5–6. **Đầu ra:** battle v2 chạy bằng fixture/sandbox, giữ legacy game để so sánh.

| Ticket | Size | Việc làm và file chính | Phụ thuộc | Tiêu chí xong |
|---|---|---|---|---|
| M1-01 | M | `20-builds.js`: validation points/alignment, stats, build→BattleMon | M0 | Golden tests stats; reject tổng >32; snapshot không đổi theo build sau đó |
| M1-02 | M | `40-battle.js`: damage, type, PP/Struggle, accuracy và stream RNG | M1-01 | Ví dụ damage 42/84/0 đạt; miss/immune/Guard tiêu PP đúng |
| M1-03 | L | Phase machine, command validator, priority/ties, switch, target slot | M1-02 | Mirror match không ưu tiên A; command hai actor không trùng reserve |
| M1-04 | L | `30-effects.js`: weather/terrain/side/status, 24 Ability và 12 items | M1-03 | Mọi effect có test positive/negative, duration và stacking |
| M1-05 | M | END_TURN, replacement, KO/draw/turn cap, result receipt | M1-04 | Chọn reserve đúng phase; KO đồng thời xử lý đối xứng; reward một lần |
| M1-06 | M | Event schema/log projector, adapter animator hiện tại | M1-05 | Event HP đúng state; weather+terrain cùng hiển thị; skip không đổi result |

Thứ tự nội bộ M1-04: status + weather → terrain/side → entry Ability → damage modifiers → consumables → residual. Không viết mọi effect vào một commit khó review.

Gate M1: test toàn bộ engine thuần; 1.000 trận seeded smoke không crash/hang, max 100 lượt; input state không bị mutate; không có network/time trong luật; bản v2 chỉ bật sandbox/dev đến khi M3 xong.

### 13.4 M2 — Build, đội hình và catalog hoàn chỉnh

| Ticket | Size | Việc làm và file chính | Phụ thuộc | Tiêu chí xong |
|---|---|---|---|---|
| M2-01 | M | Author 36 species, 48 moves, role base stats/movepool theo mục 7 | M1 | Đủ count, mọi loài ≥8 moves, ≥2 ability options; tổng stat480 |
| M2-02 | L | Server build/team actions; cost/revision/ownership validation | M2-01 | Trial bị chặn train, no-op miễn phí, stale save không mất coins |
| M2-03 | L | UI Training editor, stat diff, moveset selector, draft/reset | M2-02 | Tạo hai build khác vai trò, reload vẫn đúng; phí một lần |
| M2-04 | M | Box/permanent/trial view, ownership state, search/filter | M2-02 | Archive phân biệt locked/owned/trial; chưa có recruitment thì trial bằng fixtures |
| M2-05 | L | Sáu team slots, checks, blueprint import/export | M2-03, M2-04 | Đội trùng species/item bị cảnh báo; import không cấp tiền/Mon |

Gate M2: người chơi dựng được physical-fast và support build trên roster phù hợp; server kiểm cùng rules UI; chọn team cũ không mất dữ liệu. Default builds đủ bốn chiêu hợp lệ, có tên và description tiếng Việt.

### 13.5 M3 — Tactical Alpha chơi trọn vòng

| Ticket | Size | Việc làm và file chính | Phụ thuộc | Tiêu chí xong |
|---|---|---|---|---|
| M3-01 | M | Regulation validator và Team Preview pick3/pick4 | M2 | Sai số Mon hoặc clause không bắt đầu; lead chọn đúng slot |
| M3-02 | L | AI Easy/Normal/Hard, 12 đội mẫu, sáu đội gym mỗi format | M3-01 | AI không đọc pending/hidden; đánh/đổi/hỗ trợ có kịch bản chứng minh |
| M3-03 | L | UI phase/target/replacement, field chips, full log và event delta | M3-01, M1-06 | Đủ mobile/desktop; xem lượt trước; không rò full snapshot |
| M3-04 | M | Sandbox damage inspector + simulation CSV | M3-02, M3-03 | Damage breakdown khớp engine; 10k trận có báo cáo matchups/turns |
| M3-05 | L | Bật v2 adventure/migration, hướng dẫn ngắn và nghiệm thu release | M3-04, M0-05 | Save v1 chạy/di chuyển đúng; người mới tạo đội→đấu→thưởng→sửa build được |

Gate Local Tactical Alpha: không lỗi P0/P1 mục 14; 36 Mon sử dụng được; 48 chiêu/24 Ability/12 items hoạt động và có tooltip đúng; single/double/preview/training/team/log/AI chạy trọn vòng. Không cần recruitment/PvP để gọi mốc này hoàn thành.

### 13.6 M4 — Recruitment và kinh tế

| Ticket | Size | Việc làm và file chính | Phụ thuộc | Tiêu chí xong |
|---|---|---|---|---|
| M4-01 | M | Economy config, ledger receipts, giữ reward/mail/gacha v1 | M3 | Claim/pull duplicate action không trừ/cộng lại; pity giữ qua migration |
| M4-02 | L | Server lineup cycle/refresh/recruit/trial, clock adapter | M4-01 | Hết hạn, permanent upgrade, refresh limit và restart đều đúng |
| M4-03 | M | UI Recruitment/Trial và team invalid messages | M4-02 | Trial→battle→expiry→recruit không mất Mon/team reference |
| M4-04 | M | Gacha reveal/skip, economy simulation, tutorial đường tuyển | M4-03 | UI rates từ config; 10-pull atomic; có báo cáo số trận cần để mua từng rarity |

Gate M4: có thể chủ động tuyển một loài mong muốn khi xuất hiện lineup; Trial không train/không bị rút giữa trận; gacha vẫn hoạt động; tiền không âm. Chạy ít nhất 100k pull giả lập để kiểm distribution cơ bản và guarantees, không dùng user wallet.

### 13.7 M5 — Ascension, mỹ thuật và âm thanh

| Ticket | Size | Việc làm và file chính | Phụ thuộc | Tiêu chí xong |
|---|---|---|---|---|
| M5-01 | L | Forms/stones, command flag, transformation stage, beta regulation | M4 | Một Ascension/bên; PP/HP/status giữ; đổi Ability/type/stat đúng |
| M5-02 | M | Bốn asset mẫu, part/anchor/profile chuẩn, animation metadata | M3-03 | Cùng profile/anchor ở single/double/mobile; contact không suy từ tên |
| M5-03 | L | Mở rộng profile cho 36 Mon + bốn forms; 12 elemental FX | M5-01, M5-02 | Không placeholder release; silhouette rõ; reduced motion đầy đủ |
| M5-04 | M | Audio manager/master/music/SFX, manifest nguồn asset | M5-02 | Unlock audio đúng; đổi màn hình không chồng BGM; mute lưu |
| M5-05 | M | Vi/en, keyboard/focus, perf và end-to-end Local Beta | M5-03, M5-04 | Checklist UI mục 10 đạt; reload/bỏ qua không kẹt lượt |

Gate Local Complete Beta: người dùng chạy bằng start-local, chơi mọi màn hình không cần thao tác developer; hướng dẫn đủ; backup/restore đã thử trên copy; 36 base+4 forms và âm thanh phù hợp.

### 13.8 M6 — Private PvP local

| Ticket | Size | Việc làm và file chính | Phụ thuộc | Tiêu chí xong |
|---|---|---|---|---|
| M6-01 | L | Compile match entry dùng chung fragments; coordinator và match storage | M5 | Match engine và solo engine cho cùng mechanics; adventure độc lập |
| M6-02 | L | Seat credential, lobby code, ready/lock snapshots, projected views | M6-01 | Hai danh tính ngồi đúng A/B; người thứ ba không xem hidden state |
| M6-03 | L | Commit commands/preview/replacement, actionId dedupe, revision | M6-02 | Cả hai submit cùng revision được; A không biết move B trước resolve |
| M6-04 | L | Timer, auto command, bank, tiebreak, reconnect/takeover | M6-03 | Fake-clock test đủ race/timeout; 1×/2×/Skip không đổi deadlines |
| M6-05 | M | Hai-client QA 20 trận single và 20 double, restart recovery | M6-04 | Kết quả/state đồng nhất; không duplicate events/rewards; không orphan match |

Gate Private PvP Alpha: pass packet-level privacy tests và race tests; không public port; người chơi local có thể tạo/join/đấu bằng hai profile. Nếu M6 chưa đạt, không làm Ranked.

### 13.9 M7 — Online competitive

| Ticket | Size | Việc làm và file chính | Phụ thuộc | Tiêu chí xong |
|---|---|---|---|---|
| M7-01 | L | PostgreSQL schema/adapter, transaction/receipt/recovery tests | M6 | Hai request đồng thời chỉ một debit/reward; restart không mất receipt |
| M7-02 | L | Chọn provider/budget, OIDC/session, cross-save/blueprint import | M7-01; cấu hình dịch vụ được chốt | Local ID giả không lấy account; cùng account tải đúng save |
| M7-03 | M | Staging private, HTTPS, backup restore, logging, limits | M7-02; môi trường được cấp | Health/restore hoạt động; secrets không có trong client/source |
| M7-04 | L | Casual queue, accept flow, cancellation và reconnect | M7-03 | Không double match; hai queue format không trộn; match assignment atomic |
| M7-05 | L | Elo/tier, season snapshot, regulation/bans, reward/rating settlement | M7-04 | Elo đối xứng; kết quả chỉ ghi một lần; season boundary đúng |
| M7-06 | L | Load/stability, playtest, release checklist và bản staging review | M7-05 | Gate online đạt; chỉ publish sau yêu cầu/cho phép cụ thể |

Gate online: load test ít nhất 100 match đồng thời trên môi trường staging đã chọn, ghi phần cứng/network; mục tiêu p95 server xử lý command <100 ms không tính chờ người còn lại, reconnect snapshot <2 giây trong mạng test. Không tuyên bố scale vô hạn từ số này.

### 13.10 M8 — Nội dung sau launch

| Ticket | Size | Việc làm | Phụ thuộc | Tiêu chí xong |
|---|---|---|---|---|
| M8-01 | M | Daily/weekly và pass miễn phí 20 mốc | M7 ổn định | Claim/reset/idempotency và late match settlement đúng |
| M8-02 | M | Trainer/cosmetic/music unlock và preview | M8-01 | Không đổi combat stat; ownership unlock lưu đúng |
| M8-03 | L | Quy trình patch/catalog/regulation/replay version | M7 | Trận cũ không đổi luật; đội bị ban được giữ nhưng báo invalid |
| M8-04 | M | Thêm roster 36→42, forms/moves theo data đo được | M8-03 | Mỗi loài có niche, art/moves/Ability/test và balance report |
| M8-05 | L | Nghiên cứu/đặc tả riêng Premium/Membership nếu người dùng muốn | Quyết định sản phẩm mới | Chỉ tiếp tục khi scope/thanh toán/entitlement được chốt; mặc định DEFERRED |

### 13.11 Đường phụ thuộc chính

```text
M0 → M1 → M2 → M3 [Tactical Alpha]
                  → M4 → M5 [Local Beta]
                         → M6 [Private PvP]
                              → M7 [Online Competitive]
                                   → M8 [Live Content]
```

Có thể làm M0-04 sau M0-01 trong lúc chuẩn bị schema, và mỹ thuật mẫu sau M3, nhưng không để phần trang trí chặn luật/build. Thứ tự trên không yêu cầu chạy nhiều agent; một người có thể thực hiện tuần tự.

## 14. Kiểm thử và nghiệm thu

### 14.1 Ma trận bắt buộc

| Suite đề xuất | Ca cần chứng minh | Mốc bắt buộc |
|---|---|---|
| `content.test.mjs` | Count/ID, tham chiếu, movepool, 6stats, points, types dài1/2 không trùng, coverageType độc lập, effect schema, asset manifest | M0/M2 |
| `migration.test.mjs` | Save v1 bình thường/giữa trận/lỗi/thiếu trường/newer version; rerun; giữ wallet/pity/mail | M0/M3 |
| `builds.test.mjs` | 32 tổng/16 cap/âm/lẻ/NaN; alignment HP sai; bốn move trùng; item/Ability ngoài pool | M1/M2 |
| `damage.test.mjs` | 42/84/0; đơn hệ và song hệ 0×/¼×/½×/1×/2×/4×; STAB không dùng coverageType; physical/special; stages; weather; low HP clamp | M1 |
| `turn-order.test.mjs` | Guard/switch priority; equal speed mirrored; KO actor; no random in sort | M1 |
| `targets.test.mjs` | Switch vào slot; target slot rỗng; spread 1/2; redirect; ally missing | M1/M3 |
| `conditions.test.mjs` | Sun+Meadow cùng tồn tại; thời hạn T/T+1; immunity; status không đè; sleep counter | M1 |
| `items-abilities.test.mjs` | Từng hook, source ID, fullHP lethal, residual không proc sống sót, hai hồi không revive | M1/M2 |
| `replacement.test.mjs` | Hai KO, thiếu reserve, chọn trùng, entry order, hết đội hai bên | M1 |
| `events.test.mjs` | HP delta/state khớp, log source, đủ expiration, sequence không trùng, unknown event fallback | M1/M3 |
| `ai.test.mjs` | Command luôn hợp lệ, deterministic AI seed; không đọc pending/full private view; support/switch cases | M3 |
| `regulation.test.mjs` | Roster/pick size, species/item clause, bans, trial, form; snapshot version | M3/M5 |
| `economy.test.mjs` | Wallet không âm; giá server; duplicate receipt; no-op build; pity/10pull/claim | M4 |
| `trial.test.mjs` | Refresh limit, clock rollback, expire trước lock/sau lock, permanent upgrade | M4 |
| `ascension.test.mjs` | Hai request cùng bên, stone sai, PP/stage/status giữ, ability/form/STAB mới | M5 |
| `protocol.test.mjs` | Unauthorized, malformed, payload lớn, stale phase, same ID/different payload | M6 |
| `privacy.test.mjs` | Actual WS messages không seed/pending/build/item/PP đối thủ; events cũng lọc | M6 |
| `timer.test.mjs` | Fake clock deadline−1/deadline/deadline+1; reconnect; action/timer race; bank đồng thời | M6 |
| `persistence.test.mjs` | Save fail không broadcast thành công; restart receipt; file corrupt không reset | M0/M6 |
| `settlement.test.mjs` | Concurrent reward/rating; surrender; aborted-server; season boundary | M7 |

Bài test hiện tại không bị xóa chỉ để bộ mới xanh. Có thể cập nhật kỳ vọng đã thay đổi do luật v2, nhưng phải giữ suite legacy để xác nhận active v1 route còn hoạt động tới khi retire.

### 14.2 Invariants để kiểm trên hàng nghìn trận

- `0 ≤ hp ≤ maxHP`; `0 ≤ pp ≤ maxPP`; stage trong [-6,+6].
- Không hai Mon cùng side chiếm một slot; không Mon active ở cả hai side.
- Actor KO không được move; heal không hồi sinh; một move tiêu tối đa một PP cho cả spread.
- Mỗi trận chỉ một result; mỗi bên tối đa một Ascension.
- Replay cùng versions/seed/actions → cùng final state và event IDs.
- Input state không mutate; state JSON roundtrip giữ nghĩa; không NaN/Infinity/undefined ở dữ liệu lưu cần thiết.
- Coins/crystals không âm, không drift khi resend.
- Các modifier cùng loại chỉ áp đúng số lần quy định; weather/terrain independent.

Test RNG dùng fixture seed hoặc stream stub trong harness; không sửa production RNG để ép kết quả. Test harness được phép compile test entry của internal pure functions, production export vẫn giữ contract.

### 14.3 Kịch bản browser acceptance

1. Người mới: mở Home → đọc starter → sửa build → chọn squad → preview → chọn chiêu/target → thắng/thua → xem receipt.
2. Save cũ: clone backup vào thư mục fixture → vào trận v1 còn dang dở → kết thúc → migrate → đủ collection/team/coins/pity.
3. Double: Guard + attack; redirect; switch một bên; spread KO hai; chọn replacements; weather và terrain vẫn đúng.
4. Training: draft vượt điểm → lỗi trước save; đổi tên miễn phí; reload; stale revision hai tab không ghi đè.
5. Trial: nhận → dùng trong trận → expiry xảy ra → chơi hết → team báo expired → recruit permanent → dùng lại.
6. Summon: 10 pull → skip → reload → một receipt, đúng tiền/pity; không gọi API giả để sửa tiền.
7. Animation: 1×/2×/reduced; resize, đổi màn hình, tab ẩn, reconnect giữa impact; không canvas/listener tồn dư.
8. Accessibility: chỉ keyboard chọn team/move/target/confirm, Escape modal, focus trở lại nút mở, large text không che Resolve.
9. PvP: hai profile riêng, A chờ B, timeout, reconnect, takeover, kết quả giống nhau.
10. Audio: lần mở đầu chưa phát; click bật; mute; đổi BGM; reload giữ setting; không phát hai bản khi render.

Mỗi kịch bản ghi expected/actual và ảnh minh chứng ở thời điểm quan trọng. Không cần quay mọi thao tác; battle effects nên có clip ngắn khi công cụ phù hợp sẵn có, nếu không screenshot + state/log đủ để ghi kết quả kiểm tra cụ thể.

### 14.4 Severity và release gate

| Cấp | Ví dụ | Quyết định |
|---|---|---|
| P0 | Mất save, cấp tiền lặp, lộ lệnh/credential, kết quả PvP khác nhau | Dừng release, sửa hoặc rollback |
| P1 | Sai damage/effect, kẹt phase, không vào được mode chính, một Mon không chơi được | Không qua gate milestone |
| P2 | Tooltip lệch, layout một viewport, thiếu thông tin nhưng có workaround | Sửa trước beta hoặc ghi rõ owner/ticket |
| P3 | Chi tiết mỹ thuật nhỏ | Có thể đưa backlog sau |

Đạt gate không có nghĩa mọi stat đã cân bằng hoàn hảo. Balance là vòng lặp có báo cáo; correctness của luật và bảo toàn save là điều kiện bắt buộc.

## 15. Quy trình làm việc, phát hành và phục hồi

### 15.1 Một vòng triển khai chuẩn

1. Đọc `AGENTS.md`, ticket và phần đặc tả liên quan; kiểm tra thay đổi hiện có của người dùng.
2. Tạo checkpoint riêng cho ticket; không sửa nhiều cơ chế không liên quan.
3. Viết fixture cho invariant/edge case của ticket; với thay đổi chỉ copy hoặc styling nhỏ không tạo test máy móc.
4. Implement engine/server trước, UI sau khi API hợp lệ; dùng mock chỉ để bố cục và gỡ trước nghiệm thu.
5. Chạy suite đúng vùng ảnh hưởng; gate milestone chạy toàn bộ check/test.
6. Kiểm browser nếu flow/UI đổi; console không error, save test riêng.
7. Ghi progress, documentation nếu luật đổi, checkpoint commit; báo điều đã xong và hạn chế thực.

Không nâng dependency và đổi balance trong cùng ticket. Không tự xử lý lỗi test bằng cách xóa test. Không chạy simulation vào `.local-data` của người dùng.

### 15.2 Nhánh và file

Nếu có Git: nhánh `feat/m1-battle-core`, `feat/m2-build-editor`…; mỗi ticket commit độc lập. Nếu chưa có Git, tạo repo ở root khi bắt đầu M0-01 và xác minh `.gitignore` trước add. Ignore tối thiểu `app/node_modules/`, `app/.local-data/`, local logs, `.env*` chứa secret, backup/replay người dùng; cho phép `.env.example` không secret.

Catalog JSON là nguồn sự thật. Generated `src/logic.js` có thể commit để local chạy ngay; check verify nó tương ứng fragments. README liệt kê source-of-truth và lệnh regenerate, tránh sửa nhầm artifact sinh ra.

### 15.3 Release local

Mỗi milestone release gồm mã nguồn, lockfile, README chạy game, changelog, checklist tests, catalog/rules/schema versions, và hướng dẫn backup. Không gói `.local-data` thật, logs hoặc token.

`start-local.cmd` tiếp tục là điểm khởi động. Sau thay dev script phải thử đường double-click thật trên Windows. Nếu PATH thiếu Node, thông báo rõ, không âm thầm cài system runtime. Nếu cổng 3100 đã có game thì chỉ mở link hiện có hoặc báo server đang chạy; không kill process chưa xác minh.

### 15.4 Rollback local

1. Dừng server ghi dữ liệu.
2. Backup cả code version hiện tại và save trước khi rollback.
3. Chọn code version khớp schema save; nếu code cũ không đọc schema mới, dùng backup trước migration thay vì cố mở.
4. Khôi phục vào thư mục thử trước, khởi động cổng khác, kiểm collection/wallet/team.
5. Chỉ sau khi xác minh mới chuyển về thư mục hoạt động.

Không ghi đè backup cũ bằng save mới cùng tên. Không khôi phục save đang bị một process khác ghi. Test rollback trên copy, không thử trực tiếp với adventure người dùng.

### 15.5 Vận hành online khi tới M7

Metrics: active matches, queue time, command latency, rejects theo code, disconnect/reconnect, save failures, settlement retries, trận abort. Log dùng matchId/actionId/rulesVersion; không log session token hay pending action ra kênh công khai.

Backup database hàng ngày và trước schema migration; thử restore định kỳ vào database riêng. Health endpoint phân biệt app sống và database sẵn sàng. Nếu storage fail, không ack thành công hoặc broadcast state chưa commit. Disable matchmaking khi lỗi persistence kéo dài; để trận hiện tại phục hồi theo policy, không cấp kết quả giả.

Deploy dùng migration tương thích trước, code sau; không drop field catalog/rules đang được trận live sử dụng. Chuẩn bị gói review staging trước khi hỏi bước publish. Hosting thật và phí dịch vụ nằm ngoài hành động lập roadmap hiện tại.

## 16. Đối chiếu tài liệu tính năng

Nguồn nội bộ: `Pokemon_Champions_Tinh_nang.md`. Số mục giữ theo tài liệu gốc bắt đầu từ 2. “Tương đương” là đáp ứng nhu cầu trong game Aether, không hứa tích hợp Pokémon.

| Mục nguồn | Tính năng | Xử lý trong Aether | Mốc |
|---|---|---|---|
| 2 | Cross-platform | Responsive web trước; cùng server desktop/mobile khi online; không console | M5/M7 |
| 3 | Cross-save | Account server, revision, single controller; local giữ riêng | M7 |
| 4 | Ranked/Casual/Private | Private local → Casual online → Ranked | M6/M7 |
| 5 | Single/Double | Cùng engine, active1/2, pick3/4 | M1/M3 |
| 6 | Roster Ranch | Sáu offer, refresh cycle, recruit | M4 |
| 7 | Trial | 24h, một slot, không train, snapshot trận | M4 |
| 8 | Permanent Recruitment | Mua trực tiếp bằng coins, nâng trial cùng ID | M4 |
| 9 | VP | Coins giữ vai trò chiến đấu/tuyển/build, không thêm tiền thứ ba | M4 |
| 10–12 | Training/Points/Alignment | 32 points, 16 cap, +10%/-10% | M1/M2 |
| 13–14 | Moves/Ability editing | Movepool và lựa chọn Ability theo loài | M2 |
| 15 | Pokémon HOME | Không tích hợp; thay tiện ích bằng blueprint import/export | M2; integration loại khỏi scope |
| 16–17 | Mega/Omni Ring | Ascension/Aether Ring riêng, bốn forms | M5 |
| 18–19 | Regulation/Item Clause | Dữ liệu versioned, validator server và UI | M3/M7 |
| 20 | Battle Timer | Phase deadline, bank, total, deterministic timeout | M6 |
| 21 | Team Preview | Xem roster, pick và lead kín | M3 |
| 22 | Selection Support | Khắc hệ/coverage/role; thống kê thật chỉ sau khi có data | M3/M8 |
| 23 | View Log | Full event log theo lượt, nguồn Ability/item | M1/M3 |
| 24 | Ranked Seasons | Elo, season28 ngày, soft reset và receipt | M7 |
| 25 | Battle Pass | Pass miễn phí 20 mốc, season points | M8 |
| 26–27 | Premium/Membership | Nhánh hoãn; cần scope thanh toán riêng | M8-05 DEFERRED |
| 28–29 | Box/Team Slots | Permanent/Trial Box, sáu đội, ba build/Mon | M2/M4 |
| 30 | Trainer Customization | Cosmetic, pose, entry profile; không stat | M8 |
| 31 | Battle Music | Audio manager, nhạc riêng có quyền sử dụng | M5 |
| 32 | VGC Integration | Học cấu trúc competitive; không giải Pokémon chính thức | Regulation M3/M7; integration loại khỏi scope |
| 33 | Balance riêng | Catalog+rules version, simulation và patch log | M1/M3/M8 |
| 34–35 | Update/Roster mở rộng | Chỉ mở 36→42 sau đo balance, pipeline content chuẩn | M8 |
| 36–37 | Giảm thời gian chuẩn bị, bốn nhóm tính năng | Build nhanh, trial, team slots, chiến đấu, progression | Xuyên suốt |

Yêu cầu gốc ngoài tài liệu: Main menu/Mail/Settings/Gym vẫn giữ và hoàn thiện M3–M5; gacha không bị thay bằng recruitment; 30–50 loài đáp ứng bằng 36 loài cơ bản, bốn forms không tính thành bốn loài mới.

## 17. Rủi ro, nhánh thay thế và kiểm soát phạm vi

| Rủi ro / thay đổi hướng | Cách phát hiện | Cách xử lý mặc định |
|---|---|---|
| Engine càng thêm effect càng nhiều if theo species ID | Review dispatcher/content | Chuyển effect qua ID/hook; không thêm hardcode nhóm loài |
| Generator gây khó debug | Stack trace/compile errors | Không minify, marker fragment; compile verify; giữ source map tuyến tính nếu cần |
| Save migration làm lệch tiến trình | Fixture comparison/checksum | Không release; sửa migration, chạy lại trên copy; không xóa save |
| PvP lộ hidden info qua frame animation | Packet privacy tests | Project events riêng, không gửi full frame rồi “ẩn bằng CSS” |
| Heal/Guard gây stall | Turn distribution/simulation | Giảm PP/độ hồi hoặc tăng cost cơ hội; không bypass luật để ép AI thua |
| Rarity thành pay-to-win | Stat budget và đường tuyển | Giữ 480 mọi loài, recruit trực tiếp, không tiền thật trong beta |
| Effects đẹp nhưng che gameplay | Playtest mobile/reduced mode | Giảm particle/flash, tăng chip/log; không bỏ thông tin để giữ hiệu ứng |
| AI quá yếu | Win/loss người mới, action diversity | Cải thiện team/scoring; không đọc lệnh người chơi |
| Không đủ người cho Ranked | Queue telemetry | Ra Casual/Private trước; không giả người thật; giữ server cost nhỏ |
| Online scale chưa đủ | Load test/latency | Tối ưu payload/queue trước; chỉ sau đó thêm worker coordination |
| Muốn giống Pokémon sâu hơn | Yêu cầu PP/crit/18 hệ/hazards… | Tạo rules v3 riêng và migration; không chắp luật vào catalog v2 giữa release |
| Muốn chuyển sang Unity/3D | Yêu cầu native/3D rõ ràng | Giữ engine/protocol làm backend, làm spike một trận trước; không rewrite toàn bộ ngay |
| Muốn giữ hoàn toàn offline | Quyết định không đi M7 | Dừng ở Local Beta/PvP local; thay online season bằng thử thách AI, không giả Ranked |
| Muốn bỏ gacha | Quyết định sản phẩm mới | Giữ wallet/pity history, thiết kế chuyển đổi crystals có review; không tự xóa currency |

Mốc nào có tính năng mới vượt bảng scope thì tạo ticket sau, nêu dependency và tác động tới test/save/UI. Không đổi số points, damage formula hoặc luật deadline trong lúc chỉ làm mỹ thuật.

Thay đổi nội dung chỉ qua `catalogVersion`; thay đổi cách resolve qua `rulesVersion`; thay schema qua migration. Có thể cả ba cùng tăng, nhưng phải ghi cụ thể. `regulationId` không được dùng thay cho schema version.

## 18. Lệnh và checklist bắt đầu

### 18.1 Lệnh đang có, dùng được ngay trên dự án

Mở PowerShell:

```powershell
cd D:\Mon\AetherChampions\app
npm run check
npm test
npm run dev
```

Nếu PowerShell chặn `npm.ps1`, dùng `npm.cmd` cùng tham số. Nếu Node/npm chưa trên PATH thì kiểm tra đường cài Node của máy trước, không tự giả định cần cài lại. Không cần `npm install` mỗi lần; dùng `npm ci` khi chuẩn bị môi trường sạch từ lockfile và đã xác nhận không ghi vào thư mục phụ thuộc đang có công việc của người dùng.

`npm run dev` giữ terminal chạy; mở `http://localhost:3100`. `Ctrl+C` dừng server. Không gọi `npm run build` cloud cũ cho release local.

### 18.2 Scripts cần tạo theo mốc — CHƯA tồn tại

| Script dự kiến | Tạo ở ticket | Công dụng |
|---|---|---|
| `npm run compile:logic` | M0-03 | Sinh logic từ fragments/content |
| `npm run check:content` | M0-02 | Schema/references/catalog invariants |
| `npm run migrate:save -- --dry-run --input <copy-path>` | M0-05 | Báo migration trên copy, không ghi đè |
| `npm run simulate -- --seed 100 --matches 10000` | M3-04 | Xuất balance CSV vào thư mục reports |
| `npm run test:legacy` | M0-03 | Tương thích engine/save v1 |
| `npm run test:engine` | M1 | Battle/build/effect suites |
| `npm run test:integration` | M4/M6 | HTTP/WS/storage/protocol |

Đừng chạy các lệnh dự kiến như thể đã tồn tại. Khi tạo script, cập nhật README và package scripts; `npm test` cuối cùng phải thu cả suite mới và suite hiện có. Một cách ổn định là Node script tìm file `.test.mjs` trong các thư mục test bằng danh sách rõ ràng rồi gọi test runner, tránh glob PowerShell khác Linux.

### 18.3 Checklist buổi triển khai đầu tiên

- [ ] Đọc root/app AGENTS và ticket M0-01.
- [ ] Kiểm tra trạng thái Git hoặc xác nhận chưa có Git, không reset thay đổi người dùng.
- [ ] Xác định process/cổng game hiện tại, không mở server trùng.
- [ ] Ghi baseline check/test, chưa tuyên bố kết quả từ lượt roadmap.
- [ ] Sao lưu user saves trước thao tác migration về sau, kiểm tra bản copy đọc được.
- [ ] Tạo progress log và checkpoint.
- [ ] Làm M0-02 schema/ID, không bắt đầu Ranked hoặc vẽ lại cả roster.
- [ ] Kết thúc buổi bằng ticket status, tests và việc tiếp theo cụ thể.

### 18.4 Mẫu giao việc cho từng ticket

```text
Triển khai ticket <ID> trong ROADMAP.md của Aether Champions.
Đọc AGENTS và các mục đặc tả ticket tham chiếu. Kiểm tra dependencies đã DONE.
Giữ scope ticket, bảo toàn save, không deploy. Dùng source fragments nếu generator đã bật.
Làm đủ engine/server/UI mà ticket yêu cầu, chạy test có ý nghĩa và QA browser khi liên quan.
Ghi docs/progress.md: thay đổi, lệnh/kết quả, bằng chứng, lỗi còn lại.
Chỉ đánh dấu DONE khi tiêu chí nghiệm thu ticket đạt; không mở rộng sang milestone chưa yêu cầu.
```

## 19. Nguồn và thuật ngữ

### 19.1 Cơ sở lập kế hoạch

- `Pokemon_Champions_Tinh_nang.md`: nguồn yêu cầu tham khảo do người dùng cung cấp; đọc toàn bộ mục 2–37.
- Root/app `AGENTS.md`: luồng local và hợp đồng logic thuần.
- `app/src/logic.js`: baseline roster/build/economy/engine.
- `app/local-server.mjs`: baseline single-owner JSON persistence và WebSocket.
- `app/public/client.js`, `art.js`, `battle-animation.js`: baseline UI, SVG và event playback.
- `app/tests/local.test.mjs`, `animation.test.mjs`, `package.json`: baseline test và scripts. Lượt viết roadmap đọc chúng, không chạy lại test hoặc thay game.

Các liên kết kỹ thuật ở mục 4, 10, 12 đã được tra cứu khi lập tài liệu. Quyết định gameplay và thông số trong roadmap là đề xuất riêng, phải kiểm chứng bằng test/playtest khi triển khai. Phiên bản dịch vụ/dependency online cần xác minh lại ở M7 vì lúc triển khai có thể thay đổi.

### 19.2 Thuật ngữ

| Từ | Ý nghĩa trong tài liệu |
|---|---|
| Species / loài | Định nghĩa chung, ví dụ Emberlyn |
| Owned Mon / instance | Mon thuộc adventure, có ID riêng và ownership |
| Build | Points, alignment, bốn moves, Ability, item |
| Squad / roster team | Đội chuẩn bị tối đa sáu Mon |
| Lineup | Mon được chọn vào trận, ba single/bốn double |
| Active / slot | Mon đang đứng trên sân, một/hai slot mỗi bên |
| PP | Số lần dùng còn lại của từng chiêu |
| Stage | Mức tăng/giảm chỉ số tạm trong trận |
| Weather / terrain | Hai lớp hiệu ứng toàn sân độc lập |
| Side condition | Hiệu ứng chỉ một phe, như Tailwind |
| Snapshot | Bản chốt dữ liệu tại thời điểm cụ thể |
| Projection | Bản dữ liệu chỉ gồm thông tin người nhận được phép thấy |
| Receipt / idempotent | Bản ghi đảm bảo gửi lại cùng hành động không trừ/cộng/xử lý lần nữa |
| Gate | Điều kiện bắt buộc để sang mốc tiếp theo |
| Ascension | Biến hình đặc biệt riêng của Aether |

**Điểm bắt đầu thực thi: M0-01. Mục tiêu bàn giao đầu tiên: Local Tactical Alpha ở cuối M3.**

## R3-101 — Signature Move Presentation Wave 2 + type-aware audio

- Status: DONE after the R3-100 M-A release gate; mechanics scope remains locked.
- Move presentation: 490/490 timelines = **30 signature + 460 parameterized + 0 legacy**, with signature-quality coverage across all 18 move types.
- Architecture: signature authoring is data-driven through `public/js/presentation/signature-move-specs.js` and reusable presentation families rather than per-move runtime branches.
- Audio: move cues now use deterministic type-aware local synthesis; signature cues receive a stronger envelope without external audio dependencies.
- Validation: `npm run check` passes; focused R3-101/release/battle/UI gate 68/68; full regression **1095/1095**.
- Next: continue presentation/asset quality waves while preserving the R3-100 release gate and exact M-A scope.

## R3-102 — Gen III / GBA Pixel Presentation Rebaseline

- Status: visual candidate; functional gates pass, final aesthetic acceptance requires user browser review.
- Adds a final-loaded pixel presentation layer that converts the global shell, battle, Party/Summary/Training, Pokédex and Ranch to one Gen III/GBA-inspired grammar without reopening mechanics.
- Battle uses a 320×180-inspired 16:9 composition, square HUD/windows, hard shadows, stepped HP display and the existing R3-92+ cursor/input state architecture.
- Global navigation becomes a compact horizontal game menu instead of the old dashboard sidebar presentation.
- Keeps offline runtime constraints: no external font/runtime assets added.
- Gate: `npm run check` pass; full regression **1100/1100**.
- Next decision: user visual acceptance. If direction is approved, fold stable overrides into component styles and continue sprite/asset quality; if not, revise palette/density/window proportions before additional polish.


## R3-103 — Resolution Lock + Image Resampling

- Status: DONE as the first user-feedback correction after the R3-102 pixel visual candidate.
- Presentation is authored at a fixed **1280×720 logical resolution** and uniformly scaled to the physical viewport; aspect mismatch produces letterboxing/pillarboxing rather than a different UI layout.
- High-resolution artwork/SVG and current cropped battle GIFs are no longer forced through global nearest-neighbour scaling, eliminating the visible jagged outlines reported in R3-102.
- Legacy viewport media-query reflows are neutralized under the resolution lock so desktop composition stays stable across common resolutions.
- Validation: targeted UI **31/31**, `npm run check` pass, full regression **1105/1105**.
- Next decision: user visual QA at multiple resolutions; keep this baseline if scale/composition now matches the intended PokéRogue-like behavior.

## R3-104 — Locked-Surface Backdrop Restore

- Status: DONE as a narrow visual regression fix on top of R3-103.
- Keeps the fixed 1280×720 logical viewport and uniform fit scale unchanged.
- Restores the accepted Pixel Era blue-grid viewport backdrop in letterbox/pillarbox space by making the full-viewport `#app` host transparent instead of flat dark/black.
- Regression test rejects reintroducing an opaque `#071323` resolution-lock host.
- Validation: focused Pixel Era/resolution tests **10/10**, `npm run check` pass, full regression **1105/1105**.
- Next decision: user visual QA; continue from this backdrop + fixed-resolution baseline if accepted.
