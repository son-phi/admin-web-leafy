# Leafy Admin

React + TypeScript + Vite, React Router, Material UI; Firebase Web SDK modular và Cloud Functions TypeScript. Mặc định **MOCK**, không khởi tạo Firebase. Mọi mã thay đổi nằm trong `D:\admin-web`.

## Chạy local

Node 22.12+ hoặc Node 24. Cài và chạy:

```powershell
npm ci
npm --prefix functions ci
npm run dev
```

Mở URL Vite in ra. Mock dùng email tùy ý, không cần password; `viewer@example.test` thử trạng thái thiếu quyền. Dữ liệu giả lưu localStorage `leafy-mock-v2` (phiên đăng nhập mock ở sessionStorage); xóa key này để reset. Danh mục mẫu dùng chung với seed Emulator (`shared/sample-catalog.json`). Không dùng thông tin người thật.

Phạm vi và kế hoạch theo [ADMIN_SPEC.md](ADMIN_SPEC.md): Thống kê, Quản lý tài khoản, Quản lý loài cây (`species`), Quản lý bệnh cây (`diseases`). Mã nguồn tách Boundary – Control – Entity: `src/pages` (giao diện), `src/controllers` (nghiệp vụ), `src/entities` (repository Firestore + mock), `src/services` (Firebase, callable, auth), `shared/` (schema Zod, thông báo, chuẩn hóa – dùng chung web và Functions). Tìm kiếm theo tiền tố trên `searchName` (chữ thường, bỏ dấu); loài cây tìm được theo tên thông thường hoặc tên khoa học nhờ mảng `searchPrefixes`. Không có tìm “chứa” (Firestore không hỗ trợ). Phân trang cursor 10 bản ghi. Ảnh danh mục tải lên Storage (`species/`, `diseases/`, jpg/png/webp ≤ 5 MB) trước khi gọi callable; ảnh cũ/ảnh tạm được dọn tự động. Tiến độ từng bước: [docs/verification.md](docs/verification.md).

## Môi trường

- `npm run dev`, `npm run build`: luôn mode mock, kể cả có file env Firebase.
- Copy `.env.development.example` thành `.env.development.local` để chạy emulator hoặc điền cấu hình project dev riêng; `npm run dev:firebase` / `npm run build:dev`.
- `.env.production.example` là mẫu riêng. `npm run build:production` yêu cầu đủ config và xác nhận project chính xác. Build không deploy. Backend hiện tại chủ động từ chối project production; việc kích hoạt production là công việc riêng sau review.
- Dev kiểm tra projectId bằng VITE_DEV_PROJECT_ID và chặn project Android `leafyapp-cf95a`; thiếu config gây lỗi, không fallback. Kiểm tra cả khi build lẫn runtime.
- VITE_* là dữ liệu công khai. Không đặt credentials/service account/khóa riêng vào frontend hoặc repo.

## Firebase dev (thao tác thủ công, chưa thực hiện)

1. Tạo Firebase project mới khác production, đăng ký Web app. Copy Web config vào `.env.development.local`, đặt VITE_USE_EMULATORS=false, VITE_DEV_PROJECT_ID bằng project dev. Không copy dữ liệu người thật.
2. Tạo Firestore Standard database và bật Auth Email/Password, thêm localhost vào authorized domains nếu cần. Tạo tài khoản thử dev.
3. Backend region hiện là us-central1; VITE_FUNCTIONS_REGION phải khớp. Tạo `functions/.env.<dev-project-id>` với `ADMIN_DEV_PROJECT_ID=<dev-project-id>` (project ID không phải secret). Không commit credentials. Dùng ADC hoặc credential bên ngoài repo cho script backend.
4. Xem `firebase/firestore.dev.rules`. Đây là Rules chỉ phục vụ baseline admin dev, không phải Rules thay thế production. Client không ghi danh mục/lịch sử khóa; callable `saveSpecies`/`saveDisease` tự kiểm tra quyền admin, whitelist dữ liệu (Zod strict), fingerprint chống ghi đè và ghi trong transaction. `firestore.indexes.json` chưa cần composite: query dùng single-field indexes mặc định + document ID. Không thay indexes hiện có bằng file rỗng trên production.
5. Chỉ khi chủ dự án muốn thiết lập dev: build Functions rồi dùng Firebase CLI với **project dev cụ thể** để triển khai Functions/Rules. Không có deploy mặc định hoặc alias production trong repo.

Cấp admin (ADMIN_SPEC D2), không tự chạy: script cấp custom claim `admin: true` (giữ claim cũ) **và** ghi `users/{uid}.role = 'admin'` (merge). Script bắt nhập lại projectId để xác nhận, yêu cầu `ADMIN_DEV_PROJECT_ID` khớp, chặn production, chặn trường hợp Auth trỏ Emulator mà Firestore trỏ cloud (hoặc ngược lại). Đăng nhập lại sau khi cấp.

Project dev (credential backend qua ADC, ngoài repo):

```powershell
$env:ADMIN_DEV_PROJECT_ID='your-dev-project'; npm --prefix functions run grant-admin -- your-dev-project UID your-dev-project
```

Emulator (UID lấy ở http://127.0.0.1:4000/auth):

```powershell
$env:ADMIN_DEV_PROJECT_ID='demo-leafy-admin'; $env:FIREBASE_AUTH_EMULATOR_HOST='127.0.0.1:9099'; $env:FIRESTORE_EMULATOR_HOST='127.0.0.1:8080'; npm --prefix functions run grant-admin -- demo-leafy-admin UID demo-leafy-admin
```

Đăng nhập (F0): chỉ tài khoản có claim `admin: true` giữ được phiên; tài khoản khác bị đăng xuất ngay với thông báo "Tài khoản không có quyền truy cập trang quản trị". Mọi trang quản trị đẩy về `/login` khi chưa đăng nhập. Đây chỉ là chặn giao diện; quyền thật do Rules và Functions kiểm tra. Không có nút tự cấp quyền trong UI.

## Emulator Suite (môi trường phát triển chính – ADMIN_SPEC D7)

Yêu cầu: JDK 21+ và **đường dẫn project không có dấu tiếng Việt / ký tự ngoài ASCII** (Firestore Emulator chạy bằng Java không mở được file trong thư mục như `D:\Đồ án\...`). Máy hiện tại dùng junction `D:\leafy-admin` trỏ tới thư mục project; chạy các lệnh emulator **từ PowerShell** tại `D:\leafy-admin` (Git Bash tự quy junction về đường dẫn có dấu nên vẫn lỗi). Firebase CLI được cài sẵn trong devDependencies (`firebase-tools`), không cần đăng nhập vì dùng project `demo-leafy-admin`.

Chạy 3 lệnh ở 3 terminal:

```powershell
npm run emulators
```

```powershell
npm run seed:emulator
```

```powershell
npm run dev:emulator
```

- `emulators`: build Functions rồi chạy Auth, Firestore, Functions, Storage, Realtime Database; Emulator UI ở http://127.0.0.1:4000.
- `seed:emulator`: xóa sạch dữ liệu emulator rồi tạo dữ liệu giả lập theo lược đồ 2.4: 1 admin, 10 user (2 bị khóa), 5 loài, 5 bệnh, cây, thiết bị, lượt tưới, chẩn đoán rải 12 tháng. Script tự trỏ Admin SDK vào 127.0.0.1 và từ chối project không phải `demo-*`. Tài khoản thử ghi ở đầu `functions/scripts/seed-emulator.mjs`.
- `dev:emulator`: web ở mode `emulator`, cấu hình trong `.env.emulator` (giá trị demo, không bí mật).
- Realtime Database Emulator dùng namespace `demo-leafy-admin`; `firebase.json` khai báo `database[].instance` tương ứng để rules được nạp đúng chỗ. Khi dùng project dev thật, đổi `instance` thành instance RTDB của project đó.

## Android debug / release (chỉ hướng dẫn)

Sau khi chủ dự án chuẩn bị project dev: đăng ký đúng applicationId trong mỗi Firebase project; đặt google-services.json theo source set `app/src/debug/` và `app/src/release/`. Nếu chọn applicationIdSuffix cho debug, đăng ký app dev đúng suffix. Kiểm tra kết quả build và project ID từng variant. Bật provider, cấu hình SHA cho Google sign-in và kiểm tra FCM riêng ở dev. Không sửa Android trong công việc này.

## Kiểm tra và chuẩn bị production

Kiểm tra nhanh (không cần emulator):

```powershell
npm run typecheck
```

```powershell
npm run lint
```

```powershell
npm test
```

```powershell
npm run build
```

Toàn bộ test trên Firebase Emulator Suite (unit + Security Rules Firestore/Storage/RTDB + callable và trigger thật). Tắt emulator dev trước (cùng cổng), chạy bằng PowerShell từ đường dẫn không dấu:

```powershell
Set-Location D:\leafy-admin; npm run test:emulator
```

Index: `firebase/firestore.indexes.json` khai báo index cho mọi truy vấn của web và Functions. Emulator không kiểm index, nên cần deploy lên **project dev** để xác nhận trước production.

Trước production: lấy Rules/indexes/Functions hiện hành, hợp nhất thay vì ghi đè; kiểm thử user ẩn danh/owner/member/non-member, join/leave, task và disease log; kiểm tra claim, ID, dữ liệu cũ, region, chi phí, phương án rollback. Kiểm thử Function từ client không đăng nhập, user thường, admin hợp lệ, input sai, xung đột và tính nguyên tử của transaction. Cần một đợt review riêng để cho phép backend production. Không deploy production trong nhiệm vụ này.

Cloud Functions triển khai cần Blaze; Firestore tính phí reads/writes/storage và aggregation theo index entries. Mock không dùng cloud. Xem tài liệu chính thức (đối chiếu 23/11/2026): [Functions](https://firebase.google.com/docs/functions/manage-functions), [Firestore pricing](https://firebase.google.com/docs/firestore/pricing), [aggregation](https://firebase.google.com/docs/firestore/query-data/aggregation-queries). Đặt budget alert khi tạo dev cloud; không giả định alert tự ngắt chi phí.

Kết quả kiểm tra thực tế: xem [docs/verification.md](docs/verification.md). Chưa có Rules production nên chưa thể xác nhận tương thích quyền Android.

