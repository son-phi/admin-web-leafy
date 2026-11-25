# Kiểm tra theo ADMIN_SPEC

## B8. Rules, index, test trên Emulator – 26/11/2026

Thay đổi:
- Rules: `firestore.dev.rules`, `storage.rules`, `database.rules.json` theo mục 7. Kiểm claim bằng `request.auth.token.get('admin', false) == true` (token không có claim → từ chối gọn, không lỗi đánh giá). Claim phải đúng boolean `true`.
- `firebase/firestore.indexes.json`: index cho mọi truy vấn của web/Functions:
  - `species` (`searchPrefixes` CONTAINS, `searchName`); `diseases` (`affectedSpeciesIds` CONTAINS, `searchName`).
  - `users` (`role`, `searchPrefixes` CONTAINS, `searchName`), (`role`, `status`, `searchPrefixes` CONTAINS, `searchName`), (`role`, `status`, `searchName`), (`role`, `createdAt`).
  - Collection group: `plants` (`speciesId`, `useSpeciesThresholds`), `wateringLogs` (`trigger`, `startedAt`); field override collection group cho `plants.speciesId`, `plants.createdAt`, `nodes.plantId`, `diagnoses.diseaseId`, `wateringLogs.startedAt`.
- Test trên Emulator (thêm `@firebase/rules-unit-testing` 5.0.x – bản hỗ trợ firebase 12):
  - `functions/test-emulator/rules.test.ts`: Security Rules thật cho Firestore, Storage, RTDB.
  - `functions/test-emulator/functions.test.ts`: gọi **callable thật** trên Functions Emulator qua HTTP với ID token thật từ Auth Emulator, kiểm kết quả bằng Admin SDK; trigger đồng bộ ngưỡng và trigger hồ sơ chạy thật. (Spec gợi ý `firebase-functions-test`; cách gọi HTTP kiểm cả bước xác thực token và cấu hình triển khai nên sát thực tế hơn.)
  - `npm test`: unit test (không cần Java/emulator). `npm run test:emulator`: build Functions → `firebase emulators:exec` khởi động emulator sạch → chạy TOÀN BỘ test (unit + emulator) bằng `vitest.emulator.config.ts`.

Đã chạy:
- `npm run typecheck`, `npm run lint`, `npm test` (50 unit test): đạt.
- `npm run test:emulator` (từ `D:\leafy-admin` bằng PowerShell): **7 file, 63 test đạt**, không bỏ qua test nào. Gồm:
  - Rules: chưa đăng nhập không đọc danh mục; **người dùng thường đọc được nhưng không ghi được `species`/`diseases`; không đọc được `lockHistory` (kể cả của mình)**, hồ sơ người khác, collection group thống kê, `devices`; không tự sửa `status`/`role`. Admin đọc được hồ sơ, lịch sử khóa, `plants`/`diagnoses`/`nodes`, `devices` nhưng vẫn không ghi trực tiếp danh mục/lịch sử. Claim `admin: "true"` (chuỗi) bị từ chối. Storage: chỉ admin tải jpg/png/webp < 5 MB vào `species/`, `diseases/`; GIF, > 5 MB, thư mục khác bị từ chối; chưa đăng nhập không đọc ảnh. RTDB: chỉ admin đọc `devices`, không ai ghi từ web.
  - Callable thật: 6 callable đều từ chối không token (`UNAUTHENTICATED`) và user thường (`PERMISSION_DENIED`). Loài cây: `INVALID_INPUT`, `INVALID_THRESHOLD`, `INVALID_IMAGE`, tạo (có `searchName`, `searchPrefixes`, `updatedBy`), `SPECIES_EXISTS`, `LABEL_USED`, `CONFLICT`, sửa ngưỡng → trigger ghi RTDB cho node dùng ngưỡng loài, node ngưỡng riêng giữ nguyên, `SPECIES_IN_USE`, xóa kèm ảnh Storage, `NOT_FOUND`. Bệnh cây: `SPECIES_NOT_FOUND`, `DISEASE_EXISTS` (tên/nhãn), xóa giữ `diagnoses`. Tài khoản: `CANNOT_LOCK_SELF`, `CANNOT_LOCK_ADMIN`, `INVALID_INPUT` (thiếu lý do), `ACCOUNT_NOT_FOUND`, khóa → đăng nhập `USER_DISABLED` + `status` + `lockHistory`, mở khóa → đăng nhập lại được, `getUserAuthInfo`. Trigger hồ sơ bổ sung trường tìm kiếm.
- Sau khi chạy test: khởi động lại emulator dev, seed lại; trình duyệt: Thống kê 10/1/24/7/4, Quản lý tài khoản 10 dòng, không lỗi.

Chưa kiểm tra / lưu ý:
- Emulator **không bắt buộc index**, nên `firestore.indexes.json` chưa được kiểm trên Firestore thật. Khi có project dev: `firebase deploy --only firestore:indexes --project <dev>` rồi mở từng trang (nếu thiếu index, Firestore trả lỗi kèm link tạo index).
- Rules trong repo là bản dev cho web quản trị: chưa có quyền ghi của app Android. Trước production phải hợp nhất với rules Android hiện có (chỉ thêm các điều kiện admin), rồi chạy lại `npm run test:emulator` + test quyền của Android.
- `npm run test:emulator` dùng cổng emulator mặc định: phải tắt emulator dev trước khi chạy, và chạy từ đường dẫn không dấu (junction `D:\leafy-admin`).

---

## B7. Thống kê (F1) – 26/11/2026

Thay đổi:
- Thêm `recharts` 3.10.1 (+ `react-is`). Trang Thống kê tải theo yêu cầu (`React.lazy`) nên Recharts chỉ nạp khi mở trang (chunk riêng ~441 kB).
- `utils/dateRange.ts`, `utils/groupByPeriod.ts`: 7 / 30 ngày (theo ngày), 12 tháng (theo tháng), Tùy chọn (≤ 62 ngày theo ngày, dài hơn theo tháng, cắt tháng đầu/cuối); điền đủ mốc 0; khoảng sai (thiếu ngày, từ > đến, đến sau hôm nay, ngày không tồn tại) → `INVALID_RANGE` (4a). Ngày tính theo giờ trình duyệt.
- Entity `stats/UserStat`, `PlantStat`, `DeviceStat` (Firebase + mock): mọi số đếm bằng `count()` theo từng mốc, không tải tài liệu. Thiết bị trực tuyến: truy vấn RTDB `devices` theo `status/lastSeen` (`startAt(now − 5 phút)`); mất kết nối > 24 giờ: `endAt(now − 24h)`, tối đa 20, tên lấy từ Firestore.
- `StatisticController.getOverview()` (5 thẻ: tổng người dùng, đăng ký mới trong tháng, tổng cây, thiết bị đã đăng ký, đang trực tuyến) và `getStatistic(type, range)`; lỗi → `LOAD_FAILED` (5a); không phát sinh dữ liệu trong khoảng → `empty` → `NO_DATA_RANGE` (6a).
- Giao diện: Tabs Người dùng / Cây trồng / Thiết bị IoT; mỗi biểu đồ kèm bảng số liệu. Người dùng: đường đăng ký mới + ô đang hoạt động / bị khóa. Cây trồng: đường cây tạo mới, cột số cây theo loài (tổng hiện tại), bảng top 5. Thiết bị: đường đăng ký mới, tròn trực tuyến/ngoại tuyến, cột xếp chồng AUTO/MANUAL, bảng mất kết nối > 24h. Màu theo palette tham chiếu (xanh `#2a78d6`, cam `#eb6834`) – đã chạy `validate_palette.js`: đạt mọi kiểm tra (CVD ΔE 24.7, tương phản ≥ 3:1); nhãn chữ dùng màu chữ, không dùng màu chuỗi.
- RTDB rules: admin đọc `devices` + `.indexOn: status/lastSeen`. Mock thêm lượt tưới.

**Lỗi cấu hình phát hiện và đã sửa:** Database Emulator nạp `database.rules.json` vào namespace `demo-leafy-admin-default-rtdb`, trong khi web, seed và Functions dùng `demo-leafy-admin` → namespace đang dùng chạy rules **mở hoàn toàn** từ B0 tới B6. Đã khai báo `"database": [{ "instance": "demo-leafy-admin", ... }]` trong `firebase.json` và khởi động lại emulator; đã kiểm `/.settings/rules.json?ns=demo-leafy-admin` trả đúng rules. Khi triển khai lên project dev thật cần đổi `instance` thành tên instance của project đó.

Đã chạy:
- `npm run typecheck`, `npm run lint`, `npm run build`: đạt. `npm test`: 50 test đạt (thêm `tests/statistics.test.ts`: mốc 7/30/12 tháng, tùy chọn theo ngày/tháng và cắt biên, 4 trường hợp 4a, tổng quan, tổng chuỗi khớp tổng dữ liệu, 6a, 5a).
- Emulator + trình duyệt (seed lại, đối chiếu với script độc lập đọc thẳng dữ liệu Emulator bằng Admin SDK và tự chia mốc):
  - 5 thẻ: 10 / 1 / 24 / 7 / 4 – khớp.
  - 4 khoảng (7 ngày, 30 ngày, 12 tháng, tùy chọn 01/10–26/11/2026 = 57 mốc ngày): từng mốc của đăng ký người dùng, cây tạo mới, thiết bị đăng ký mới, lượt tưới AUTO, MANUAL **khớp 100%**; đang hoạt động/bị khóa 8/2; top 5 loài 6,6,4,4,4; mất kết nối > 24h: esp32-06, esp32-07; trực tuyến/ngoại tuyến 4/3 – khớp.
  - 4a: từ 20/11 đến 10/11 và đến 31/12/2026 (tương lai) → “Khoảng thời gian không hợp lệ”. 6a: 7 ngày, tab Người dùng → “Chưa có dữ liệu trong khoảng thời gian này”.
  - Xem biểu đồ ở 1366 px: sửa nhãn biểu đồ tròn dùng màu chữ, thứ tự chú giải, bỏ điểm đánh dấu khi > 12 mốc.
- 5a: kiểm bằng unit test (thống kê lỗi → “Không thể tải dữ liệu, vui lòng thử lại”).

Lưu ý:
- Số truy vấn: mỗi mốc 1 count; 12 tháng ≈ 12 (người dùng) + 12 (cây) + 12 (thiết bị) + 24 (lượt tưới) + số loài. Tùy chọn dài nhóm theo tháng nên số mốc nhỏ.
- “Số cây theo loài” là tổng hiện tại (không lọc theo khoảng) vì lược đồ index chỉ có `plants(speciesId)`.
- Thiết bị chưa từng gửi `status/lastSeen` không xuất hiện trong danh sách mất kết nối.
- Index cần ở B8: `users` (`role`, `createdAt`), (`role`, `status`); group `plants` (`createdAt`), (`speciesId`); `devices` (`registeredAt`); group `wateringLogs` (`trigger`, `startedAt`).
- Bundle: chunk `callables` ~653 kB vì mỗi file entity chứa cả bản Firebase lẫn mock nên chế độ mock vẫn đóng gói Firebase SDK (không khởi tạo). Có thể tách file để giảm thêm.

---

## B6. Quản lý tài khoản (F2) – 25/11/2026

Thay đổi:
- `shared/accounts.ts`: `LOCK_REASONS`, `SetAccountStatusInput` (khóa bắt buộc lý do), `UserAuthInfoInput`.
- Functions (`functions/src/accounts.ts`, tách tiện ích chung ra `common.ts`):
  - `setAccountStatus`: 9a tự khóa mình → `CANNOT_LOCK_SELF`; 9b người bị khóa là admin (theo `role` **hoặc** claim) → `CANNOT_LOCK_ADMIN`; không có hồ sơ/tài khoản → `ACCOUNT_NOT_FOUND`. LOCK: `updateUser({disabled:true})` + `revokeRefreshTokens`; UNLOCK: `disabled:false`; rồi batch `users/{uid}.status` + `lockHistory`. Firestore lỗi → hoàn tác Auth, trả `UPDATE_FAILED` (12a). Đã ở đúng trạng thái → không ghi thêm lịch sử.
  - `getUserAuthInfo`: `{ lastSignInTime, disabled }` từ Authentication.
  - Trigger `onUserProfileWritten` (`users/{uid}`): duy trì `searchName` + `searchPrefixes` (họ tên + email) để tìm tiền tố theo họ tên **hoặc** email. Cần vì hồ sơ do app Android ghi. Chỉ ghi khi giá trị khác nên không lặp.
- Web: danh sách `role == 'user'`, tìm họ tên/email, lọc trạng thái, cột số cây, chip trạng thái, nút Khóa/Mở khóa; rỗng khi đang tìm/lọc → `ACCOUNT_NOT_FOUND` (4a). Khi không tìm kiếm, danh sách sắp theo document ID (không bỏ sót hồ sơ thiếu `searchName`). Chi tiết (Dialog, “Đóng”): thông tin cá nhân (lần đăng nhập gần nhất lấy `lastLoginAt`, trống thì `getUserAuthInfo`), thông tin sử dụng (`countUsage`: cây, thiết bị, lượt chẩn đoán, phiên hội thoại), lịch sử khóa/mở khóa mới nhất trước. Hộp xác nhận: khóa bắt buộc chọn lý do (“Khác” cho ghi chi tiết); 9a/9b chặn sớm trên web; Hủy = 11a; thành công cập nhật dòng ngay.
- Mock: thêm thiết bị, phiên hội thoại; callable mock cùng quy tắc.

Đã chạy:
- `npm run typecheck`, `npm run lint`, `npm run build`, `npm --prefix functions run build`: đạt. `npm test`: 44 test đạt (Functions +6: quyền, 9a/9b theo role và claim, không tồn tại, thiếu lý do, khóa/mở khóa/không ghi trùng lịch sử, hoàn tác Auth khi Firestore lỗi, getUserAuthInfo, trigger trường tìm kiếm; web +1: tìm tên/email, 4a, lọc, precheck, khóa có lý do, chi tiết, mô phỏng serializer callable).
- Emulator + trình duyệt (sau khi seed lại):
  - Danh sách 10 người dùng (không có admin), số cây tổng 24. Tìm “dang” (tên không dấu) và “user07” (email) → Đặng Khoa; “zzz” → “Không tìm thấy tài khoản”; lọc “Đã khóa” → Đỗ Minh, Ngô Nhi.
  - Chi tiết Vũ Hà (`lastLoginAt` trống): lần đăng nhập gần nhất lấy từ Auth sau khi đăng nhập thử; số cây/thiết bị/chẩn đoán/hội thoại; “Chưa có lịch sử”. Đỗ Minh: lịch sử khóa từ seed.
  - Khóa Nguyễn An: Hủy (11a) giữ nguyên; bấm Khóa không chọn lý do → “Vui lòng chọn lý do khóa”; chọn lý do → “Cập nhật trạng thái tài khoản thành công”, dòng đổi “Đã khóa”. Đăng nhập `user01` trên Auth Emulator → `USER_DISABLED`.
  - Gọi thẳng callable bằng token admin: tự khóa → `CANNOT_LOCK_SELF`; khóa một admin khác (cấp bằng grant-admin) → `CANNOT_LOCK_ADMIN`; token user thường → `PERMISSION_DENIED`.
  - Mở khóa → thành công, lịch sử “Mở khóa” rồi “Khóa”; `user01` đăng nhập lại được.
  - Trigger: tạo hồ sơ “Trương Quốc Bảo” không có trường tìm kiếm → tự có `searchName = "truong quoc bao"` và 29 tiền tố (cả email).
- Lỗi phát hiện khi kiểm tra trình duyệt và đã sửa: mở khóa báo “Dữ liệu không hợp lệ” vì serializer callable đổi `reason: undefined` thành `null`. Controller không gửi `reason` khi mở khóa; thêm test mô phỏng serializer.

Chưa kiểm tra / lưu ý:
- 12a (Firestore lỗi sau khi đổi Auth) chỉ kiểm bằng unit test.
- Auth Emulator ghi sẵn `lastSignInTime` khi tạo tài khoản bằng Admin SDK, nên tài khoản seed chưa đăng nhập vẫn có giờ đăng nhập; Firebase thật để trống cho tới lần đăng nhập đầu.
- Khóa chặn đăng nhập mới và làm mới token; phiên đang mở trên app Android còn dùng ID token hiện tại tối đa ~1 giờ. App Android nên kiểm `users.status` (ngoài phạm vi web).
- `onUserProfileWritten` chỉ chạy khi hồ sơ được ghi; hồ sơ có sẵn trước khi triển khai cần một lần backfill (chưa làm, vì chưa có dữ liệu thật trên dev).
- Index cần ở B8: `users` (`role`, `status`, `searchPrefixes` array-contains, `searchName`), (`role`, `status`, `__name__`), `devices` (`userId`).

---

## B5. Quản lý bệnh cây (F4) – 25/11/2026

Thay đổi:
- Functions: `saveDisease` kiểm tra trong transaction: trùng tên bệnh (sau chuẩn hóa) hoặc trùng `aiLabel` → `DISEASE_EXISTS` (7b, `checkDuplicate`); mọi `affectedSpeciesIds` phải tồn tại (`tx.getAll`) → `SPECIES_NOT_FOUND`; ảnh chỉ trong `diseases/`, đổi ảnh thì xóa ảnh cũ sau commit. `deleteDisease`: xóa tài liệu + ảnh, **không** sửa `diagnoses` cũ (bước 14).
- Web: lọc theo loài cây bị ảnh hưởng (`Autocomplete`, `affectedSpeciesIds array-contains`) kết hợp tìm tiền tố tên bệnh; cột số lượt chẩn đoán (`countDiagnosesByDisease`, collection group `diagnoses`); biểu mẫu dùng ảnh tải lên Storage + `Autocomplete multiple` nạp bằng `getSpeciesList`; chi tiết có số lượt chẩn đoán; xóa 2 bước: `CONFIRM_DELETE_DISEASE` → nếu có mã nhãn thì `DISEASE_LABEL_WARNING` (18a) → `deleteDisease`. `usePagedList` thêm `filter` (về trang 1 khi đổi bộ lọc). Mock thêm dữ liệu `diagnoses`. Thông báo bổ sung: `DISEASE_DELETED`, `SPECIES_NOT_FOUND`.

Đã chạy:
- `npm run typecheck`, `npm run lint`, `npm run build`, `npm --prefix functions run build`: đạt. `npm test`: 37 test đạt (thêm: Functions – loài phải tồn tại, ảnh sai thư mục, trùng tên/nhãn, xóa không đụng diagnoses; web – lọc theo loài, đếm chẩn đoán, trùng 7b, loài không tồn tại, lỗi trường 7a, xóa).
- Emulator + trình duyệt:
  - Cột “Lượt chẩn đoán” tổng 30, khớp seed. Lọc “Sen đá” → Phấn trắng, Rệp sáp, Thối rễ; thêm tìm “rep” → Rệp sáp.
  - 7a: biểu mẫu trống → lỗi tại trường (kể cả “Chọn ít nhất 1 mục” cho loài, “Vui lòng chọn ảnh minh họa”).
  - 7c: ảnh GIF → “Ảnh không hợp lệ”. 7b: tên “dom la” và mã nhãn `root_rot` → “Bệnh cây đã có trong danh mục”.
  - Thêm “Bệnh QA” (Monstera, Lan ý, ảnh PNG) → “Thêm bệnh cây thành công”; ảnh tạm của các lần lỗi đã được dọn. Bệnh mới ẩn đúng khi đang lọc “Sen đá”.
  - Sửa (điền sẵn loài, đổi ảnh) → “Cập nhật thành công”, ảnh cũ bị xóa. Chi tiết hiện triệu chứng, 3 mức xử lý, số lượt chẩn đoán.
  - 17a: Hủy ở hộp xác nhận → còn. 18a: hộp cảnh báo “Người dùng sẽ không nhận được hướng xử lý…” → Hủy → còn; “Vẫn xóa” → “Xóa bệnh cây thành công”.
  - Xóa “Phấn trắng”: số tài liệu `diagnoses` có `diseaseId = phan-trang` vẫn là 6 trước và sau; ảnh bị xóa khỏi Storage.
- Mock + trình duyệt: danh sách bệnh có bộ lọc và cột lượt chẩn đoán.

Cần xác nhận / lưu ý:
- Xóa loài cây (B3) hiện chỉ chặn khi còn cây người dùng; nếu bệnh còn liệt kê loài đó trong `affectedSpeciesIds`, bệnh vẫn giữ id cũ và giao diện hiện “(không còn trong danh mục)”. Kịch bản không quy định; có thể chặn thêm hoặc tự gỡ id khỏi bệnh.
- Index cần ở B8: `diseases` (`affectedSpeciesIds` array-contains + `searchName`), collection group `diagnoses` (`diseaseId`).

---

## B4. Đồng bộ ngưỡng xuống ESP32 – 25/11/2026

Thay đổi:
- `functions/src/thresholdSync.ts` + trigger `onSpeciesThresholdUpdated` (`onDocumentUpdated('species/{speciesId}')`, us-central1):
  1. So sánh `before.threshold` / `after.threshold` (JSON thứ tự khóa ổn định) → giống nhau thì dừng.
  2. `findPlantsBySpecies`: collection group `plants` where `speciesId == id` and `useSpeciesThresholds == true`.
  3. Collection group `nodes` where `plantId in [...]` (chia lô 30 giá trị – giới hạn của `in`). Nếu node có `userId` khác chủ cây thì bỏ qua (ID cây chỉ duy nhất trong phạm vi một người dùng).
  4. `syncThreshold`: một lần multi-path update RTDB `devices/{deviceId}/nodes/{nodeId}/config/thresholds`.
  - Ngưỡng sau khi sửa được kiểm lại bằng `ThresholdSchema`; không hợp lệ thì không ghi. Trigger cũng từ chối chạy trên project không được phép (production).

Đã chạy:
- `npm run typecheck`, `npm run lint`, `npm --prefix functions run build`: đạt. `npm test`: 34 test đạt (thêm 5 test đồng bộ: không đổi ngưỡng thì không truy vấn/ghi, chỉ node của cây dùng ngưỡng theo loài, bỏ node của người dùng khác, ngưỡng sai/loài không có cây, chia lô 65 cây = 1 + 3 truy vấn).
- Emulator: Functions nạp `onSpeciesThresholdUpdated`. Trước khi sửa, Lưỡi hổ có 4 node: `esp32-01/node-1`, `esp32-07/node-2` (dùng ngưỡng loài: độ ẩm đất min 15, nhiệt độ max 35) và `esp32-04/node-1`, `esp32-07/node-1` (ngưỡng riêng: 20 / 35).
  - Sửa ngưỡng Lưỡi hổ trên web (độ ẩm đất min 18, nhiệt độ max 34) → “Cập nhật thành công”; log trigger: `plants: 4, nodes: 2`. RTDB: 2 node dùng ngưỡng loài → 18 / 34; 2 node ngưỡng riêng giữ 20 / 35. Cây không có thiết bị không phát sinh ghi.
  - Chỉ sửa mô tả → trigger chạy 4 ms, không đồng bộ.

Chưa kiểm tra:
- ESP32 thật nhận cấu hình (ngoại lệ 14a – thiết bị ngoại tuyến tự nhận khi kết nối lại) phụ thuộc firmware lắng nghe đường dẫn RTDB trên; ngoài phạm vi web.
- Index cần khai báo ở B8: collection group `plants` (`speciesId`, `useSpeciesThresholds`), `nodes` (`plantId`).

---

## B3. Quản lý loài cây (F3) – 25/11/2026

Thay đổi:
- Functions: `saveSpecies` kiểm tra trùng tên thông thường (so sánh sau chuẩn hóa, bỏ qua chính bản ghi) → `SPECIES_EXISTS` (7c) và trùng `aiLabel` (`checkAiLabel`) → `LABEL_USED` (7e) ngay trong transaction; chỉ nhận `imagePath` trong `species/` (`isImagePath`); khi đổi ảnh, xóa ảnh cũ **sau** khi commit. `deleteSpecies`: kiểm tra `countPlantsBySpecies` (collection group `plants` where `speciesId == id`) trong cùng transaction → `SPECIES_IN_USE` (18a); xóa tài liệu rồi xóa ảnh (`deleteImage`).
- Web: `services/storage.ts` (`uploadImage` → `species/<uuid>.<ext>`, kiểm tra jpg/png/webp ≤ 5 MB → `INVALID_IMAGE` 7d); `controllers/catalogImage.ts`: validate → kiểm tra ảnh → upload → callable, **xóa ảnh vừa tải nếu callable thất bại**. Trang loài cây: cột số cây đang trồng (đếm aggregation theo từng dòng trang hiện tại), Xem chi tiết (có số cây + bảng ngưỡng), Chỉnh sửa (điền sẵn, đổi ảnh), Xóa (Dialog `CONFIRM_DELETE_SPECIES`, Hủy = 17a). Thông báo bổ sung: `SPECIES_DELETED`, `IMAGE_REQUIRED`.
- Tìm theo tên thông thường **hoặc** tên khoa học: thêm trường hệ thống `searchPrefixes` (mảng tiền tố đã chuẩn hóa của 2 tên, tối đa 40 ký tự mỗi tên) và truy vấn `array-contains`, sắp theo `searchName`. Seed đã bổ sung trường này.

Đã chạy:
- `npm run typecheck`, `npm run lint`, `npm run build`, `npm --prefix functions run build`: đạt. `npm test`: 29 test đạt (web 22, Functions 7 với Firestore/Storage giả lập trong bộ nhớ: trùng tên/nhãn, sửa chính nó, imagePath ngoài thư mục, xóa ảnh cũ chỉ khi đổi ảnh và đã commit, chặn xóa khi còn cây, xóa kèm ảnh).
- Emulator + trình duyệt (`admin@leafy.test`, sau khi seed lại):
  - Cột “Số cây đang trồng”: 4/6/4/6/4 = 24, khớp seed. Tìm “Dracaena” (tên khoa học) và “luoi” (không dấu) → Lưỡi hổ.
  - 7a: gửi biểu mẫu trống → lỗi tại từng trường + “Vui lòng chọn ảnh minh họa”.
  - 7b: nhiệt độ min 40 > max 30 → “Ngưỡng không hợp lệ”.
  - 7d: chọn ảnh GIF → “Ảnh không hợp lệ”.
  - 7c: tên “trau ba” → “Loài cây đã có trong danh mục”; 7e: mã nhãn `monstera_deliciosa` → “Mã nhãn đã được sử dụng”. Sau các lần thất bại, Storage chỉ còn 5 ảnh seed (ảnh tạm đã được dọn).
  - Thêm “Cây QA” kèm ảnh PNG → “Thêm loài cây thành công”, ảnh nằm trong `species/`, số cây = 0.
  - Sửa “Cây QA” + đổi ảnh → “Cập nhật thành công”; ảnh cũ bị xóa khỏi Storage.
  - Xem chi tiết Lưỡi hổ: thông tin, số cây 6, bảng ngưỡng.
  - 17a: Xóa → Hủy → vẫn còn. 18a: xóa Lưỡi hổ → “Không thể xóa loài cây đang được sử dụng”, bản ghi còn nguyên. Xóa “Cây QA” → “Xóa loài cây thành công”, ảnh bị xóa.
  - 2a: kiểm bằng unit test (repository lỗi → “Không thể tải dữ liệu, vui lòng thử lại”); chưa giả lập mất kết nối trên trình duyệt.
- Mock + trình duyệt: danh sách loài có cột số cây.

Lưu ý / cần đồng bộ:
- `searchPrefixes` là trường mới ngoài lược đồ 2.4 (bổ sung vào mục 10 khi sửa báo cáo, cùng `imagePath`, `searchName`, `updatedAt`, `updatedBy`).
- Index cần khai báo ở B8: `species` (`searchPrefixes` array-contains + `searchName`), collection group `plants` (`speciesId`). Emulator không bắt buộc index nên chưa phát hiện thiếu.
- Kiểm tra trùng dùng truy vấn trong transaction: hai yêu cầu tạo đồng thời cùng tên vẫn có thể lọt (Firestore không khóa “bản ghi chưa tồn tại”). Nếu cần tuyệt đối, dùng tài liệu khóa theo tên/nhãn – chưa làm.
- Ảnh trong chế độ mock là ảnh minh họa chung (không lưu file).

---

## B2. Đăng nhập (F0) – 25/11/2026

Thay đổi:
- `src/services/auth.ts`: `signInWithEmailAndPassword` → `getIdTokenResult(true)`; `claims.admin !== true` → `signOut` + `MSG.NOT_ADMIN`. Phiên khôi phục (reload) cũng kiểm tra claim và tự đăng xuất nếu thiếu quyền. Lỗi Auth ánh xạ sang thông báo tiếng Việt (`LOGIN_FAILED`, `ACCOUNT_DISABLED`, `TOO_MANY_ATTEMPTS`, `NETWORK_ERROR` – bổ sung vào `shared/messages.ts`).
- `ProtectedRoute`: chưa đăng nhập admin → `/login` (nhớ trang định vào, đăng nhập xong quay lại). Header hiển thị tên admin (email ở tooltip) + Đăng xuất.
- `grant-admin.cjs`: thêm ghi `users/{uid}.role='admin'` (merge); tách `checkArgs` để kiểm thử; chặn mục tiêu lẫn Emulator/cloud và project `demo-*` ngoài Emulator.

Đã chạy:
- `npm run typecheck`, `npm run lint`: đạt. `npm test`: 22 test đạt (thêm: mock không giữ phiên cho viewer và báo NOT_ADMIN, giữ phiên admin qua reload; ánh xạ lỗi Auth; `checkArgs` của grant-admin).
- Emulator + trình duyệt:
  - Đăng xuất rồi mở thẳng `/diseases` → bị đẩy về `/login`.
  - Tạo tài khoản mới (chưa có claim) trong Auth Emulator, đăng nhập → “Tài khoản không có quyền truy cập trang quản trị”, vẫn ở `/login`.
  - Chạy `grant-admin` với biến Emulator → claim `admin` + `users/{uid}.role = "admin"` (kiểm tra qua REST Emulator); chạy thiếu `FIRESTORE_EMULATOR_HOST` → bị từ chối, exit 1.
  - Đăng nhập lại tài khoản đó → vào được, quay về `/diseases`.
  - `user09` (bị khóa) → “Tài khoản đã bị khóa”; sai mật khẩu → “Email hoặc mật khẩu không đúng”.

---

## B1. Tái cấu trúc – 25/11/2026

Thay đổi:
- `shared/catalog.ts`: `ThresholdSchema`, `SpeciesSchema`, `DiseaseSchema` theo mục 4 (strict whitelist, ảnh chỉ http/https), `SaveSpeciesInput`/`SaveDiseaseInput`, fingerprint ổn định trên trường nghiệp vụ (kể cả `threshold` lồng nhau). Thêm `shared/messages.ts` (MSG nguyên văn + vài khóa kỹ thuật), `shared/normalize.ts`, `shared/sample-catalog.json` (dùng chung seed + mock).
- Functions: thay `saveCatalog` bằng `saveSpecies`, `saveDisease` (kiểm tra admin, chặn production, Zod, transaction, fingerprint, tự thêm `searchName/createdAt/updatedAt/updatedBy`, lỗi trả `details.code` là khóa MSG). Bỏ `admin_audit`.
- Rules dev viết lại theo mục 7; `src/` tách theo mục 5: `app/`, `pages/`, `controllers/`, `entities/` (+ `mock/`, `stats/`), `services/`, `components/`, `utils/`. Xóa `src/ui/App.tsx`, `src/data/`.
- Menu đúng 4 mục; gỡ vườn / hồ sơ / lịch sử quản trị. Route: `/login`, `/statistics`, `/accounts`, `/species`, `/diseases`.

Đã chạy:
- `npm run typecheck`, `npm run lint`: đạt. `npm test`: 18 test đạt (13 web: quyền, whitelist, ngưỡng 7b, id dạng đường dẫn, fingerprint, chuẩn hóa, môi trường, mock backend + controller: chặn non-admin, thêm/tìm không dấu/xung đột sửa, lỗi theo trường; 5 Functions với Admin SDK giả lập: chặn auth/non-admin/production, mã lỗi MSG, trường hệ thống, not-found/CONFLICT, disease nullable).
- `npm run build`, `npm run build:emulator`: đạt.
- `grep` `src functions/src shared firebase`: không còn `admin_audit` hay collection `plants` cấp gốc (chỉ còn collection group `plants` để đếm cây).
- Emulator + trình duyệt (admin seed): Thống kê 10 người dùng / 24 cây / 5 loài / 5 bệnh khớp seed; danh sách loài, bệnh (chip tên loài), tài khoản (2 đã khóa) hiển thị; sửa “Lan ý” với nhiệt độ min 50 > max 30 → “Ngưỡng không hợp lệ”; sửa hợp lệ → “Cập nhật thành công”, tài liệu Firestore có `updatedBy=admin-seed`, `searchName=lan y`, `createdAt` giữ nguyên.
- Mock + trình duyệt: đăng nhập, thống kê, danh sách loài có ảnh mock; phiên mock giữ qua reload.

Lưu ý:
- Emulator đọc lại rules đúng lúc file đang ghi dở → báo “Rules content empty”; lưu lại file là hết. Chỉ xảy ra khi sửa rules lúc emulator đang chạy.
- Chưa làm (theo kế hoạch): kiểm tra trùng tên/mã nhãn, tải ảnh Storage, xóa (B3/B5), lọc theo loài (B5), khóa tài khoản (B6), thống kê theo thời gian (B7), test trên Emulator (B8).

---

## B0. Chạy được – 25/11/2026

Đã chạy:
- `npm ci`, `npm --prefix functions ci`.
- `npm run typecheck`: đạt (frontend + Functions). Lỗi tsconfig cũ: `functions/tsconfig.json` dùng `moduleResolution: Node` (TypeScript 7 báo TS5108); đã chuyển Functions sang ESM `NodeNext`, kiểm tra đạt trên TS 5.9 và TS 7.0.
- `npm run lint`: đạt. `npm test`: 12 test đạt (thêm test chế độ emulator chỉ nhận `demo-*`).
- `npm run build` (mock) và `npm run build:emulator`: đạt; còn cảnh báo chunk > 500 kB như trước.
- `npm run emulators` (JDK 25, chạy từ junction `D:\leafy-admin` bằng PowerShell): Auth, Firestore, Functions, Storage, Database, UI đều sẵn sàng; Functions nạp `saveCatalog`.
- `npm run seed:emulator`: 11 users (1 admin), 5 species, 5 diseases, 24 plants, 30 diagnoses, 265 wateringLogs, 13 chatSessions, 7 devices, 15 nodes.
- `npm run dev:emulator` + trình duyệt: nhãn EMULATOR hiển thị; `admin@leafy.test` đăng nhập vào dashboard (đọc count từ Firestore Emulator); `user01@leafy.test` bị chặn "Tài khoản không có quyền admin."; không có lỗi console.

Chưa kiểm tra / giới hạn:
- Dashboard và menu vẫn là giao diện cũ (`plants` gốc, vườn, hồ sơ…) nên “Danh mục cây” = 0; sẽ đổi ở B1.
- Đường dẫn có dấu (`D:\Đồ án`) làm Firestore Emulator (Java) không mở được file rules; phải chạy từ đường dẫn ASCII.
- Functions emulator dùng Node 24 của máy (runtime khai báo Node 22).

---

# Kiểm tra local — 23/11/2026

## Đã chạy

- Cài dependencies frontend/backend, lưu package-lock.json cho từng package.
- `npm run typecheck`: đạt, frontend và Cloud Functions.
- `npm run lint`: đạt.
- `npm test`: 11 tests đạt ở 2 file. Kiểm tra custom claim đúng boolean, từ chối thiếu auth/quyền, whitelist payload, ID/URL, môi trường thiếu/sai/production, phân trang/tìm tiền tố, ID trùng và xung đột sửa; handler callable với Admin SDK mock kiểm tra audit + dữ liệu cùng transaction và lỗi audit không commit.
- `npm run build`: đạt, tạo dist ở chế độ mock.
- `npm --prefix functions run build`: đạt, Node runtime target 22. Máy local Node 24 nên npm báo engine warning cho functions; chưa kiểm tra runtime Node 22 thật.
- `npm run dev`: Vite phục vụ `http://127.0.0.1:5173/`; HTTP GET trả 200.

## Chưa xác minh

- Firebase Emulator Suite: đã thử lệnh project `demo-leafy-admin`, CLI dừng vì Java hiện tại là 17 và yêu cầu JDK 21+. Chưa chạy Rules integration hoặc callable qua HTTP emulator. Tests backend dùng mock SDK, không thay thế kiểm tra emulator.
- Browser QA: browser access host không khả dụng; thử native Chrome bị chặn do cửa sổ minimized và không lấy được state. Chưa xác minh thao tác/hiển thị trực tiếp ở desktop/tablet; HTTP 200 và build không thay thế browser QA.
- Chưa dùng Firebase dev thật vì chưa có cấu hình. Chưa kiểm tra production, chưa deploy, chưa chạy cấp admin.
- Chưa xác minh quyền Android hiện có: thiếu Rules/indexes/Functions gốc. Rules dev hiện chủ động chặn writes Android và subcollections; cần hợp nhất Rules gốc trước khi thử Android.

## Cảnh báo build

Rollup báo annotation trong dependency Zod và kích thước chunk trên 500 kB. Build thành công. Firebase được lazy import và không khởi tạo ở mock. Có thể tối ưu split UI sau khi đo thực tế; không che cảnh báo bằng việc tăng ngưỡng.

## Các bước người dùng có thể thử

1. Chạy `npm run dev`, đăng nhập email demo bất kỳ, không nhập password.
2. Mở Danh mục cây, chuyển trang, tìm `Trầu`, mở chi tiết và sửa mô tả; xác nhận lưu.
3. Mở Lịch sử quản trị và kiểm tra thay đổi. Thử thêm ID đã tồn tại, ID âm hoặc URL không HTTPS để kiểm tra validation.
4. Đăng xuất, dùng `viewer@example.test`: phải thấy không đủ quyền.
5. Cài/chọn JDK 21+ rồi dùng lệnh Emulator trong README. Sau đó mới thực hiện integration tests Rules/callable và kiểm tra Android với Rules gốc đã hợp nhất.
