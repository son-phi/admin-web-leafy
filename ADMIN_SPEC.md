# ADMIN_SPEC – Đặc tả Website quản trị Leafy (admin-web-leafy)

> **Nguồn sự thật:** tài liệu đồ án LEAFYAPP_V3, cụ thể là kịch bản **2.2.5.1 – 2.2.5.4**,
> biểu đồ tuần tự **2.3.2.1 – 2.3.2.4** và lược đồ CSDL **2.4**. Khi code hiện tại
> mâu thuẫn với tài liệu này thì **sửa code theo tài liệu**. Khi tài liệu này mâu thuẫn
> với kịch bản thì kịch bản thắng, và ghi lại mâu thuẫn vào mục 10.
>
> **Dành cho AI Agent:** đọc hết file này trước khi sửa code. Làm theo từng mục trong
> **mục 9 – Kế hoạch thực hiện**, mỗi lần một mục; xong mục nào thì chạy `npm run build`,
> `npm test` và kiểm tra "Tiêu chí hoàn thành" của mục đó, báo lại rồi mới làm tiếp.

---

## 1. Tổng quan

Website quản trị dành cho **quản trị viên** của hệ thống Leafy. Website dùng **chung dự án Firebase**
với ứng dụng Android (`leafyapp-cf95a` là production). Phạm vi gồm đúng 5 chức năng:

| # | Chức năng | Kịch bản | Biểu đồ tuần tự |
|---|---|---|---|
| F0 | Đăng nhập trang quản trị | Tiền điều kiện của mọi kịch bản | – |
| F1 | Xem thống kê | 2.2.5.1 | 2.3.2.1 |
| F2 | Quản lý tài khoản người dùng | 2.2.5.2 | 2.3.2.2 |
| F3 | Quản lý loài cây | 2.2.5.3 | 2.3.2.3 |
| F4 | Quản lý bệnh cây | 2.2.5.4 | 2.3.2.4 |

**Ngoài phạm vi (không làm, gỡ khỏi giao diện nếu đang có):** xem vườn cây của người dùng,
sửa hồ sơ người dùng, lịch sử quản trị dạng audit chung (xem mục 3, quyết định D4).

---

## 2. Hiện trạng dự án (tại thời điểm viết)

**Công nghệ:** React 19, TypeScript, Vite 7, React Router 7, MUI 7, Firebase JS SDK 12 (modular), Zod 4.
Cloud Functions TypeScript, Node 22, `firebase-functions` v6, `firebase-admin` v13.

| Thành phần | Hiện có | Giữ / Sửa |
|---|---|---|
| `shared/environment.ts` | Kiểm tra môi trường mock/dev/production; dev bị chặn nếu trỏ vào `leafyapp-cf95a`; production cần `VITE_CONFIRM_PRODUCTION` | **Giữ nguyên**. Bổ sung chế độ Emulator (mục 9, bước B0) |
| `shared/catalog.ts` | Zod schema cho `plants` và `diseases`, `requireAdmin`, `fingerprint` | **Sửa**: đổi `plants` → `species`, bổ sung đủ trường theo mục 4; giữ `requireAdmin`, `fingerprint` |
| `src/data/` | Interface `Repository`, bản `mock.ts` (localStorage) và `firebase.ts` (Firestore); phân trang cursor 10 bản ghi; tìm theo tiền tố; dashboard đếm bằng count aggregation | **Giữ ý tưởng**, tách thành các repository theo thực thể (mục 5) |
| `src/ui/App.tsx` | Toàn bộ giao diện trong 1 file | **Tách** theo Boundary – Control – Entity (mục 5) |
| `functions/src/index.ts` | 1 callable `saveCatalog`: kiểm tra admin, whitelist dữ liệu, ghi danh mục + `admin_audit` trong transaction, từ chối chạy production | **Thay** bằng bộ callable ở mục 6 (giữ cách kiểm tra admin, whitelist, transaction, fingerprint) |
| `functions/scripts/grant-admin.cjs` | Cấp claim `admin: true`, giữ claim cũ, chặn production | **Giữ**. Bổ sung ghi `users/{uid}.role = "admin"` (mục 3, D2) |
| `firebase/firestore.dev.rules` | Rules cho dev, chặn mọi thao tác ghi từ Android | **Viết lại** theo mục 7 |
| Tests | `tests/security.test.ts`, `functions/src/backend.test.ts` – 11 test, Admin SDK giả lập, chưa chạy Emulator | **Giữ**, bổ sung test theo mục 8 và chạy trên Emulator |

**Mức độ hoàn thành so với kịch bản:**

| Kịch bản | Đã có | Còn thiếu |
|---|---|---|
| F0 Đăng nhập | Có màn hình đăng nhập | Kiểm tra claim admin sau đăng nhập, chặn route, thông báo khi không phải admin |
| F1 Thống kê | Dashboard đếm số lượng | 5 chỉ số tổng quan đúng bước 2; chọn 3 loại thống kê; chọn 4 khoảng thời gian; biểu đồ + bảng số liệu; ngoại lệ 4a, 5a, 6a |
| F2 Tài khoản | Xem hồ sơ (chỉ đọc) | Tìm theo tên/email, lọc trạng thái, cột số cây, trang chi tiết (thông tin sử dụng, lịch sử khóa), **khóa/mở khóa** (Auth + Firestore + lịch sử), ngoại lệ 4a, 9a, 9b, 11a, 12a |
| F3 Loài cây | Thêm, sửa (thiếu trường) | Mã nhãn AI, đặc tính chăm sóc, ngưỡng môi trường, ảnh (Storage), cột số cây, xem chi tiết, **xóa**, kiểm tra trùng tên/mã nhãn, **đồng bộ ngưỡng xuống ESP32**, ngoại lệ 2a, 7a–7e, 14a, 17a, 18a |
| F4 Bệnh cây | Thêm, sửa (thiếu trường) | Loài thường mắc (chọn nhiều), hướng xử lý 3 mức độ, ảnh, lọc theo loài, cột số lượt chẩn đoán, xem chi tiết, **xóa** (kèm cảnh báo 18a), ngoại lệ 2a, 7a–7c, 17a, 18a |

---

## 3. Các quyết định kiến trúc (đã chốt – Agent không tự đổi)

| Mã | Quyết định | Lý do |
|---|---|---|
| **D1** | Danh mục loài cây dùng collection **`species`**, không phải `plants`. `plants` là cây của người dùng tại `users/{uid}/plants`. | Đúng lược đồ 2.4. Dùng `plants` cho danh mục sẽ trùng tên với collection group `plants` của app Android |
| **D2** | Quyền admin = custom claim **`admin: true`** (giữ như script hiện tại) **và** `users/{uid}.role = "admin"`. Claim dùng để phân quyền, trường `role` dùng để hiển thị và lọc. | Không phá script đã có; vẫn khớp trường `role` trong lược đồ |
| **D3** | **Mọi thao tác ghi** của website đi qua **Cloud Functions callable** (mở rộng từ `saveCatalog`). Trình duyệt chỉ **đọc** Firestore/RTDB và **tải ảnh** lên Storage. | Đã có sẵn hạ tầng callable; kiểm tra trùng mã nhãn trong transaction; khóa tài khoản cần Admin SDK; không cần thêm API quản trị trên FastAPI |
| **D4** | Bỏ collection `admin_audit`. Chỉ ghi lịch sử ở **`users/{uid}/lockHistory`** đúng kịch bản 2.2.5.2. Giữ cơ chế `fingerprint` để chống ghi đè khi sửa. | `admin_audit` không có trong lược đồ 2.4 và không kịch bản nào yêu cầu |
| **D5** | Đồng bộ ngưỡng xuống ESP32 bằng **Firestore trigger** `onSpeciesThresholdUpdated`, ghi vào RTDB **`devices/{deviceId}/nodes/{nodeId}/config/thresholds`**. | Kịch bản 2.2.5.3 bước 14; ngưỡng thuộc từng node theo lược đồ 2.4 |
| **D6** | Giao diện dùng **MUI 7** (giữ). Biểu đồ dùng **Recharts** (thêm mới). | MUI đã có sẵn; Recharts đúng mục 1.2.6 của báo cáo |
| **D7** | Phát triển và kiểm thử trên **Firebase Emulator Suite** (Auth, Firestore, Functions, Storage, Database). | Chạy được Functions mà không cần dự án dev riêng hay gói Blaze; test bảo mật sát thực tế |
| **D8** | Tìm kiếm dùng **tiền tố** (giữ như hiện tại) trên trường chuẩn hóa chữ thường không dấu (`searchName`). Danh sách phân trang cursor 10 bản ghi (giữ). | Firestore không hỗ trợ tìm "chứa"; ghi rõ giới hạn này trong báo cáo |

---

## 4. Hợp đồng dữ liệu (trích lược đồ 2.4)

Tên collection và tên trường **giữ nguyên**. Định nghĩa bằng Zod trong `shared/catalog.ts`
(dùng chung cho web và functions).

### 4.1. Dữ liệu website được ghi (qua callable)

```ts
// shared/catalog.ts
export const ThresholdSchema = z.object({
  soilMoistureMin: z.number().min(0).max(100),   soilMoistureMax: z.number().min(0).max(100),
  temperatureMin:  z.number().min(-10).max(60),  temperatureMax:  z.number().min(-10).max(60),
  airHumidityMin:  z.number().min(0).max(100),   airHumidityMax:  z.number().min(0).max(100),
  lightMin:        z.number().min(0).max(100000), lightMax:       z.number().min(0).max(100000),
}).refine(t => t.soilMoistureMin <= t.soilMoistureMax && t.temperatureMin <= t.temperatureMax
            && t.airHumidityMin <= t.airHumidityMax && t.lightMin <= t.lightMax,
          { message: 'INVALID_THRESHOLD' });                       // ngoại lệ 7b

export const SpeciesSchema = z.object({                          // species/{speciesId}
  commonName: z.string().trim().min(1),
  scientificName: z.string().trim().min(1),
  aiLabel: z.string().trim().min(1),                             // mã nhãn trong mô hình AI
  imageUrl: z.string().url(), imagePath: z.string(),             // imagePath để xóa ảnh trên Storage
  description: z.string().trim().min(1),
  lightNeed: z.enum(['LOW', 'MEDIUM', 'HIGH', 'DIRECT']),
  wateringCycleDays: z.number().int().positive(),
  fertilizingCycleDays: z.number().int().positive(),
  threshold: ThresholdSchema,
});

export const DiseaseSchema = z.object({                          // diseases/{diseaseId}
  nameVi: z.string().trim().min(1),
  scientificName: z.string().trim().nullable(),
  aiLabel: z.string().trim().min(1),
  imageUrl: z.string().url(), imagePath: z.string(),
  affectedSpeciesIds: z.array(z.string()).min(1),                // loài cây thường mắc
  causes: z.string().trim().min(1), symptoms: z.string().trim().min(1),
  treatmentMild: z.string().trim().min(1),
  treatmentModerate: z.string().trim().min(1),
  treatmentSevere: z.string().trim().min(1),
  prevention: z.string().trim().nullable(),
});
```

Callable tự thêm các trường hệ thống: `searchName` (chữ thường, bỏ dấu, từ `commonName` / `nameVi`),
`createdAt`, `updatedAt`, `updatedBy`.

`users/{uid}/lockHistory/{logId}`: `{ userId, adminId, action: 'LOCK'|'UNLOCK', reason, createdAt }`.
`users/{uid}`: website chỉ đổi `status` (`'active'|'locked'`) qua callable.

### 4.2. Dữ liệu website chỉ đọc

| Đường dẫn | Trường dùng | Dùng cho |
|---|---|---|
| `users/{uid}` | `fullName, email, avatarUrl, role, status, createdAt, lastLoginAt` | F1, F2 |
| `users/{uid}/plants` (collection group `plants`) | `speciesId, useSpeciesThresholds, createdAt` | Số cây theo loài/người dùng, chặn xóa loài, thống kê cây |
| `.../plants/{pid}/diagnoses` (group `diagnoses`) | `diseaseId` | Số lượt chẩn đoán theo bệnh / người dùng |
| `.../plants/{pid}/wateringLogs` (group `wateringLogs`) | `trigger, startedAt` | Thống kê lượt tưới |
| `users/{uid}/chatSessions` | – (chỉ đếm) | Số phiên hội thoại |
| `devices/{deviceId}` | `userId, name, registeredAt, lastSeen` | F1, F2 |
| `devices/{id}/nodes/{nodeId}` (group `nodes`) | `plantId` | Đồng bộ ngưỡng |
| RTDB `devices/{deviceId}/status/lastSeen` | – | Thiết bị trực tuyến (2.2.5.1 bước 5) |

**Trực tuyến:** `now − lastSeen ≤ ONLINE_THRESHOLD_MS` (hằng số trong `shared/catalog.ts`, mặc định 5 phút; thống nhất với chu kỳ gửi dữ liệu của ESP32).

---

## 5. Cấu trúc mã nguồn phía web (Boundary – Control – Entity)

Tách `src/ui/App.tsx` thành cấu trúc dưới đây. Tên lớp/hàm **trùng với biểu đồ tuần tự** để đối chiếu khi bảo vệ.

```
src/
├─ main.tsx
├─ app/            AppRouter.tsx, AdminLayout.tsx, ProtectedRoute.tsx, LoginPage.tsx
├─ pages/          (Boundary) StatisticView.tsx, AccountManagementView.tsx,
│                  SpeciesManagementView.tsx, DiseaseManagementView.tsx
├─ controllers/    (Control)  StatisticController.ts, AccountController.ts,
│                  SpeciesController.ts, DiseaseController.ts
├─ entities/       (Entity)   interface + 2 bản cài đặt (firebase / mock) cho mỗi thực thể:
│   ├─ UserRepository.ts        getAllUser, searchUsers, getUserDetail, countUsage
│   ├─ AccountLockLogRepository.ts  getLockHistory
│   ├─ SpeciesRepository.ts     getAllSpecies, getSpeciesById, countPlantsBySpecies
│   ├─ DiseaseRepository.ts     getAllDiseases, getDiseaseById, countDiagnosesByDisease
│   ├─ stats/UserStat.ts        getUserOverview/countUsers, getUserStat/countUserByPeriod
│   ├─ stats/PlantStat.ts       getPlantOverview/countPlants, getPlantStat/countPlantBySpecies
│   └─ stats/DeviceStat.ts      getDeviceOverview/countDevicesAndOnline,
│                               getDeviceStat/countDeviceByPeriod/countWateringByTrigger
├─ services/       callables.ts (bọc httpsCallable), storage.ts (uploadImage), firebase.ts
├─ components/     ImageUpload, ThresholdFields, ConfirmDialog, StatCard, DateRangeSelect...
└─ utils/          messages.ts, dateRange.ts, groupByPeriod.ts, normalize.ts
```

- Giữ **chế độ mock**: mỗi repository có bản mock (localStorage) để demo giao diện không cần Firebase.
- Controller **không** gọi Firestore trực tiếp; chỉ gọi repository (đọc) và `services/callables.ts` (ghi).
- Các hàm ghi trong biểu đồ (`saveSpecies`, `updateSpecies`, `deleteSpecies`, `updateStatus`, `saveLog`…) được hiện thực trong callable ở mục 6; controller gọi callable tương ứng.

`src/utils/messages.ts` – thông báo **nguyên văn từ kịch bản**:

```ts
export const MSG = {
  LOAD_FAILED: 'Không thể tải dữ liệu, vui lòng thử lại',
  INVALID_RANGE: 'Khoảng thời gian không hợp lệ',
  NO_DATA_RANGE: 'Chưa có dữ liệu trong khoảng thời gian này',
  ACCOUNT_NOT_FOUND: 'Không tìm thấy tài khoản',
  CANNOT_LOCK_SELF: 'Không thể khóa tài khoản đang đăng nhập',
  CANNOT_LOCK_ADMIN: 'Không thể khóa tài khoản quản trị viên',
  STATUS_UPDATED: 'Cập nhật trạng thái tài khoản thành công',
  UPDATE_FAILED: 'Cập nhật thất bại, vui lòng thử lại',
  SPECIES_ADDED: 'Thêm loài cây thành công',
  UPDATED: 'Cập nhật thành công',
  INVALID_THRESHOLD: 'Ngưỡng không hợp lệ',
  SPECIES_EXISTS: 'Loài cây đã có trong danh mục',
  INVALID_IMAGE: 'Ảnh không hợp lệ',
  LABEL_USED: 'Mã nhãn đã được sử dụng',
  SPECIES_IN_USE: 'Không thể xóa loài cây đang được sử dụng',
  CONFIRM_DELETE_SPECIES: 'Bạn có chắc muốn xóa loài cây này?',
  DISEASE_ADDED: 'Thêm bệnh cây thành công',
  DISEASE_EXISTS: 'Bệnh cây đã có trong danh mục',
  CONFIRM_DELETE_DISEASE: 'Bạn có chắc muốn xóa bệnh này?',
  DISEASE_LABEL_WARNING: 'Người dùng sẽ không nhận được hướng xử lý khi mô hình chẩn đoán ra bệnh này',
  NOT_ADMIN: 'Tài khoản không có quyền truy cập trang quản trị',
  CONFLICT: 'Dữ liệu đã được người khác cập nhật, vui lòng tải lại',   // từ cơ chế fingerprint
} as const;
```

---

## 6. Cloud Functions (thay cho `saveCatalog`)

Mọi callable: `requireAdmin(context)` (claim `admin === true`), từ chối khi chạy trên `leafyapp-cf95a` **trừ khi** đã cấu hình cho production (giữ cơ chế hiện có), validate bằng Zod (whitelist), lỗi trả `HttpsError` với `details.code` là **khóa trong `MSG`** để web hiển thị đúng thông báo.

| Callable | Input | Xử lý (theo kịch bản / biểu đồ) | Lỗi |
|---|---|---|---|
| `saveSpecies` | `{ id?, data: Species, fingerprint? }` | Transaction: kiểm tra trùng `commonName` (bỏ qua chính nó) → kiểm tra trùng `aiLabel` (`checkAiLabel`) → kiểm tra `fingerprint` khi sửa → ghi `species`. Khi sửa có ảnh mới thì xóa ảnh cũ theo `imagePath` sau khi commit | `SPECIES_EXISTS` (7c), `LABEL_USED` (7e), `INVALID_THRESHOLD` (7b), `CONFLICT` |
| `deleteSpecies` | `{ id }` | `countPlantsBySpecies` (collection group `plants` where `speciesId == id`) > 0 → từ chối; ngược lại xóa tài liệu và xóa ảnh trên Storage (`deleteImage`) | `SPECIES_IN_USE` (18a) |
| `saveDisease` | `{ id?, data: Disease, fingerprint? }` | Transaction: kiểm tra trùng `nameVi` hoặc `aiLabel` (`checkDuplicate`) → kiểm tra mọi `affectedSpeciesIds` tồn tại → ghi | `DISEASE_EXISTS` (7b), `CONFLICT` |
| `deleteDisease` | `{ id }` | Xóa tài liệu + ảnh. **Không** sửa `diagnoses` cũ (kịch bản 2.2.5.4 bước 14) | – |
| `setAccountStatus` | `{ uid, action: 'LOCK'\|'UNLOCK', reason? }` | `uid == caller` → từ chối (9a). Người bị khóa là admin → từ chối (9b). LOCK: `auth.updateUser(uid,{disabled:true})` (`disableAccount`) + `auth.revokeRefreshTokens(uid)`; UNLOCK: `disabled:false`. Cập nhật `users/{uid}.status` (`updateStatus`) và thêm `lockHistory` (`saveLog`) | `CANNOT_LOCK_SELF`, `CANNOT_LOCK_ADMIN`, `UPDATE_FAILED` (12a) |
| `getUserAuthInfo` | `{ uid }` | Trả `{ lastSignInTime, disabled }` từ `auth.getUser(uid).metadata` – dùng khi `users.lastLoginAt` trống | – |

**Trigger `onSpeciesThresholdUpdated`** (`onDocumentUpdated('species/{speciesId}')`) – tương ứng `findPlantsBySpecies` → `syncThreshold` ở biểu đồ 2.3.2.3:
1. Nếu `before.threshold` và `after.threshold` giống nhau → dừng.
2. `findPlantsBySpecies`: collection group `plants` where `speciesId == id` and `useSpeciesThresholds == true`.
3. Với mỗi cây: collection group `nodes` where `plantId == plant.id`.
4. `syncThreshold`: ghi `after.threshold` vào RTDB `devices/{deviceId}/nodes/{nodeId}/config/thresholds`. ESP32 ngoại tuyến tự nhận khi kết nối lại (14a).

**Ảnh:** web tải ảnh lên Storage trước (`species/{uuid}.{ext}`, `diseases/{uuid}.{ext}`) bằng `uploadImage` trong controller, rồi mới gọi callable với `imageUrl` + `imagePath`. Kiểm tra phía web: jpg/png/webp, ≤ 5 MB (7d / 7c); Storage Rules kiểm tra lại.

---

## 7. Security Rules và Index

**Firestore** (`firebase/firestore.rules` cho production phải **phối hợp với người làm Android** – chỉ thêm các điều kiện dưới đây, không ghi đè phần của app):

```
function isAdmin() { return request.auth != null && request.auth.token.admin == true; }

match /species/{id}  { allow read: if request.auth != null; allow write: if false; }  // ghi qua callable
match /diseases/{id} { allow read: if request.auth != null; allow write: if false; }
match /users/{uid}   { allow read: if request.auth.uid == uid || isAdmin();
  match /lockHistory/{logId} { allow read: if isAdmin(); allow write: if false; } }
match /{path=**}/plants/{id}       { allow read: if isAdmin(); }
match /{path=**}/diagnoses/{id}    { allow read: if isAdmin(); }
match /{path=**}/wateringLogs/{id} { allow read: if isAdmin(); }
match /{path=**}/chatSessions/{id} { allow read: if isAdmin(); }
match /{path=**}/nodes/{id}        { allow read: if isAdmin(); }
match /devices/{id}                { allow read: if isAdmin(); }
```

Lưu ý: rules Android hiện có thể cho người dùng đọc/ghi cây của chính họ – các dòng `{path=**}` ở trên chỉ **bổ sung** quyền đọc cho admin.

**Storage:** `species/**`, `diseases/**` – đọc khi đăng nhập; ghi khi `isAdmin()`, `size < 5MB`, `contentType` là ảnh.
**Realtime Database:** admin đọc `devices/$deviceId/status`.

**Index** (`firebase/firestore.indexes.json`): collection group `plants` (`speciesId`), (`createdAt`), (`speciesId`, `useSpeciesThresholds`); group `nodes` (`plantId`); group `diagnoses` (`diseaseId`); group `wateringLogs` (`startedAt`); `users` (`role`, `createdAt`), (`role`, `status`, `searchName`); `species` (`searchName`); `diseases` (`searchName`), (`affectedSpeciesIds` array-contains, `searchName`).

---

## 8. Đặc tả màn hình (MUI)

### F0 – Đăng nhập (`LoginPage`)
- Email + mật khẩu → `signInWithEmailAndPassword` → `getIdTokenResult(true)`; `claims.admin !== true` → `signOut` + `MSG.NOT_ADMIN`.
- `ProtectedRoute` chặn mọi trang khi chưa đăng nhập hoặc không phải admin.
- `AdminLayout`: `Drawer` bên trái với **đúng 4 mục**: "Thống kê" `/statistics` (mặc định), "Quản lý tài khoản" `/accounts`, "Quản lý loài cây" `/species`, "Quản lý bệnh cây" `/diseases`. `AppBar`: tên admin, nút Đăng xuất. **Gỡ** các mục vườn/hồ sơ/lịch sử quản trị cũ.

### F1 – Xem thống kê (`StatisticView`, kịch bản 2.2.5.1)
- **Bước 2 – 5 thẻ tổng quan:** Tổng số người dùng; Người dùng đăng ký mới trong tháng; Tổng số cây trồng; Tổng số thiết bị IoT đã đăng ký; Thiết bị đang trực tuyến. (`StatisticController.getOverview()` gọi song song 3 hàm overview.)
- **Bước 3 – loại thống kê:** `Tabs`: Người dùng / Cây trồng / Thiết bị IoT.
- **Bước 4 – khoảng thời gian:** `Select`: 7 ngày gần nhất, 30 ngày gần nhất, 12 tháng gần nhất, Tùy chọn (2 ô ngày). 7/30 ngày nhóm theo ngày; 12 tháng nhóm theo tháng; tùy chọn ≤ 62 ngày theo ngày, ngược lại theo tháng. Điền đủ các mốc giá trị 0.
- **Bước 5–6 – `getStatistic(type, from, to)`**, mỗi loại có biểu đồ (Recharts) + bảng số liệu (MUI `Table`):
  - Người dùng: đường số đăng ký mới; số đang hoạt động, số bị khóa.
  - Cây trồng: đường số cây tạo mới; cột số cây theo loài; bảng top 5 loài.
  - Thiết bị IoT: đường số thiết bị đăng ký mới; tròn trực tuyến/ngoại tuyến; bảng thiết bị mất kết nối > 24 giờ; cột xếp chồng lượt tưới AUTO/MANUAL theo ngày.
- **Bước 7:** đổi lựa chọn → tải lại. Ngoại lệ: 4a `INVALID_RANGE`; 5a `LOAD_FAILED`; 6a biểu đồ trống + `NO_DATA_RANGE`.

### F2 – Quản lý tài khoản (`AccountManagementView`, kịch bản 2.2.5.2)
- **Bước 2:** ô tìm theo họ tên hoặc email (tiền tố); `Select` trạng thái Tất cả / Đang hoạt động / Đã khóa; nút "Tải lại"; bảng: ảnh đại diện, họ tên, email, ngày đăng ký, số cây, trạng thái (`Chip`), nút Xem chi tiết, Khóa/Mở khóa. Chỉ liệt kê `role == 'user'`. Phân trang 10.
- **Bước 3–4:** `searchUsers(keyword, status)`; rỗng → `ACCOUNT_NOT_FOUND` (4a).
- **Bước 5–8 – chi tiết** (`Dialog`, nút "Đóng"): Thông tin cá nhân (họ tên, email, ngày đăng ký, lần đăng nhập gần nhất – lấy `lastLoginAt`, trống thì gọi `getUserAuthInfo`, trạng thái); Thông tin sử dụng (số cây, số thiết bị IoT, số lượt chẩn đoán, số phiên hội thoại – `countUsage`); Lịch sử khóa/mở khóa (`getLockHistory`, mới nhất trước).
- **Bước 9–13 – khóa/mở khóa:** `Dialog` xác nhận; khi khóa có `Select` lý do bắt buộc (gợi ý: "Vi phạm điều khoản sử dụng", "Spam hoặc lạm dụng hệ thống", "Theo yêu cầu của người dùng", "Khác"). Xác nhận → `setAccountStatus` → `STATUS_UPDATED` và cập nhật dòng trên bảng. Ngoại lệ 9a, 9b (chặn sớm trên web và chặn lại ở callable), 11a "Hủy" giữ nguyên, 12a `UPDATE_FAILED`.

### F3 – Quản lý loài cây (`SpeciesManagementView`, kịch bản 2.2.5.3)
- **Bước 3:** ô tìm theo tên thông thường hoặc tên khoa học; nút "Thêm mới", "Tải lại"; bảng: ảnh minh họa, tên thông thường, tên khoa học, **số cây người dùng đang trồng** (`countPlantsBySpecies`), nút Xem chi tiết / Chỉnh sửa / Xóa.
- **Bước 5 – biểu mẫu** (dùng chung thêm/sửa, sửa thì điền sẵn) gồm 3 nhóm:
  Thông tin chung (tên thông thường*, tên khoa học*, mã nhãn trong mô hình AI*, ảnh minh họa*);
  Đặc tính chăm sóc (mô tả*, nhu cầu ánh sáng*, chu kỳ tưới gợi ý (ngày)*, chu kỳ bón phân gợi ý (ngày)*);
  Ngưỡng môi trường – 4 cặp tối thiểu/tối đa: độ ẩm đất (%), nhiệt độ (°C), độ ẩm không khí (%), cường độ ánh sáng (lux).
- **Bước 6–8:** `addSpecies` = validate → `uploadImage` → callable `saveSpecies` → `SPECIES_ADDED`, cập nhật danh sách.
- **Bước 9–10:** Xem chi tiết (`Dialog` chỉ đọc, có bảng ngưỡng).
- **Bước 11–14:** sửa → callable `saveSpecies` (kèm `fingerprint`) → `UPDATED`. Trigger tự đồng bộ ngưỡng.
- **Bước 15–18:** `Dialog` `CONFIRM_DELETE_SPECIES` → callable `deleteSpecies`.
- Ngoại lệ: 2a `LOAD_FAILED`; 7a lỗi tại trường; 7b `INVALID_THRESHOLD`; 7c `SPECIES_EXISTS`; 7d `INVALID_IMAGE`; 7e `LABEL_USED`; 17a "Hủy"; 18a `SPECIES_IN_USE`.

### F4 – Quản lý bệnh cây (`DiseaseManagementView`, kịch bản 2.2.5.4)
- **Bước 3:** ô tìm theo tên bệnh; **bộ lọc theo loài cây bị ảnh hưởng** (`Autocomplete` từ `species`, truy vấn `affectedSpeciesIds array-contains`); nút "Thêm mới", "Tải lại"; bảng: ảnh, tên bệnh, mã nhãn, loài cây thường mắc (`Chip` theo `commonName`), **số lượt được chẩn đoán** (`countDiagnosesByDisease`), nút Xem chi tiết / Chỉnh sửa / Xóa.
- **Bước 5 – biểu mẫu:** tên bệnh (tiếng Việt)*, tên khoa học, mã nhãn*, ảnh*; loài cây thường mắc* (`Autocomplete multiple`, nạp bằng `getSpeciesList`); nguyên nhân*, triệu chứng nhận biết trên lá*; hướng xử lý **nhẹ\* / trung bình\* / nặng\***; biện pháp phòng ngừa.
- **Bước 6–8:** `addDisease` = validate → `uploadImage` → callable `saveDisease` → `DISEASE_ADDED`.
- **Bước 9–10:** chi tiết hiển thị triệu chứng, hướng xử lý từng mức, số lượt chẩn đoán.
- **Bước 11–14:** sửa → `saveDisease` → `UPDATED`.
- **Bước 15–18:** `CONFIRM_DELETE_DISEASE` → nếu bệnh có `aiLabel` thì hiện thêm `Dialog` thứ 2 với `DISEASE_LABEL_WARNING` (18a) → callable `deleteDisease`.
- Ngoại lệ: 2a, 7a, 7b `DISEASE_EXISTS`, 7c `INVALID_IMAGE`, 17a, 18a.

---

## 9. Kế hoạch thực hiện (Agent làm lần lượt)

| Bước | Việc | Tiêu chí hoàn thành |
|---|---|---|
| **B0. Chạy được** | Thêm cấu hình Emulator vào `firebase.json` (auth, firestore, functions, storage, database, ui); thêm chế độ `emulator` vào `shared/environment.ts`; `connect*Emulator` trong `src/services/firebase.ts`; script `npm run dev:emulator`, `npm run seed:emulator` (tạo 1 admin, 10 user, 5 loài, 5 bệnh, cây/thiết bị/wateringLogs/diagnoses rải 12 tháng). Sửa lỗi TypeScript hiện có (`tsconfig.json` đang báo 2 lỗi). | `npm run build` sạch; `npm run dev:emulator` mở web, đăng nhập bằng admin seed được |
| **B1. Tái cấu trúc** | Đổi `plants` → `species` trong schema, repository, functions, rules; tách `App.tsx` theo mục 5; tạo `MSG`; gỡ menu vườn/hồ sơ/lịch sử quản trị; bỏ `admin_audit` | Giao diện chạy như cũ trên cấu trúc mới; không còn tham chiếu `admin_audit` và collection `plants` ở cấp gốc |
| **B2. Đăng nhập (F0)** | Mục 8 – F0; `grant-admin.cjs` ghi thêm `users/{uid}.role='admin'` | Tài khoản thường bị chặn đúng thông báo; vào thẳng URL bị đẩy về `/login` |
| **B3. Loài cây (F3)** | Schema mục 4; callable `saveSpecies`, `deleteSpecies`; Storage upload; giao diện mục 8 – F3 | Đủ CRUD; thử đủ 2a, 7a–7e, 17a, 18a |
| **B4. Đồng bộ ngưỡng** | Trigger `onSpeciesThresholdUpdated` | Sửa ngưỡng loài trên Emulator → RTDB `devices/*/nodes/*/config/thresholds` của cây dùng ngưỡng theo loài thay đổi; cây `useSpeciesThresholds=false` không đổi |
| **B5. Bệnh cây (F4)** | Callable `saveDisease`, `deleteDisease`; giao diện F4 | Đủ CRUD + lọc theo loài; thử 2a, 7a–7c, 17a, 18a |
| **B6. Tài khoản (F2)** | Callable `setAccountStatus`, `getUserAuthInfo`; repository user/lockHistory; giao diện F2 | Khóa xong user seed không đăng nhập được (Auth Emulator); lịch sử hiện trong chi tiết; thử 4a, 9a, 9b, 11a, 12a |
| **B7. Thống kê (F1)** | Cài `recharts`; repository stats; giao diện F1 | Số liệu khớp dữ liệu seed cho cả 4 khoảng thời gian; thử 4a, 5a, 6a |
| **B8. Rules, index, test** | Rules mục 7; `firestore.indexes.json`; chuyển test sang chạy trên Emulator (`@firebase/rules-unit-testing`, `firebase-functions-test`); bổ sung test cho từng callable và từng ngoại lệ | `npm test` xanh trên Emulator; user thường không ghi được `species`, không đọc được `lockHistory` |
| **B9. Triển khai** | `firebase deploy --only hosting,functions` theo quy trình production hiện có (`VITE_CONFIRM_PRODUCTION`); thêm domain Hosting vào Authorized domains | Website chạy trên `*.web.app` với dữ liệu thật |

Mỗi bước: tự chạy `npm run build`, `npm test`, cập nhật `docs/verification.md` (ghi đã kiểm tra gì, kết quả).

---

## 10. Việc cần đồng bộ lại trong báo cáo (người làm đồ án tự sửa)

- **Mục 1.2.6:** đổi Ant Design → **MUI**; ghi React 19, Vite 7, React Router 7, thêm **Zod**; phần "Firebase Admin SDK (trên máy chủ FastAPI)" → **Cloud Functions callable** (theo D3). Đoạn Recharts: sửa danh sách số liệu theo kịch bản thống kê (người dùng, cây trồng, thiết bị IoT).
- **Mục 1.1.2 (Backend) và 1.2.2:** ghi rõ Cloud Functions đảm nhận các thao tác quản trị và đồng bộ ngưỡng.
- **Kịch bản 2.2.5.3 bước 14:** `devices/{deviceId}/config` → `devices/{deviceId}/nodes/{nodeId}/config`.
- **Biểu đồ tuần tự:** sửa lỗi chính tả `updateSattus`, `checkAILable`, `getAllSpeacies`, `DieaseManagementView`; thống nhất cách đánh số (biểu đồ bệnh cây đang đánh số lồng nhau, 3 biểu đồ còn lại đánh số liên tục).
- **Lược đồ 2.4:** thêm trường `imagePath`, `searchName`, `updatedAt`, `updatedBy` cho `species` và `diseases` nếu giữ theo D3/D8.

---

## 11. Quy tắc làm việc cho Agent

1. Không đổi tên collection, trường, hàm, thông báo đã quy định; cần đổi thì hỏi trước.
2. Không chạy bất kỳ lệnh ghi nào vào `leafyapp-cf95a`; mọi kiểm thử trên Emulator.
3. Không thêm chức năng ngoài 5 chức năng ở mục 1.
4. Mỗi bước nhỏ, build + test xanh rồi mới sang bước sau; báo lại danh sách file thay đổi.
5. Giữ chế độ mock hoạt động song song để demo không cần mạng.
