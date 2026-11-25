# Leafy Admin

React + TypeScript + Vite, React Router, Material UI; Firebase Web SDK modular và Cloud Functions TypeScript. Mặc định **MOCK**, không khởi tạo Firebase. Mọi mã thay đổi nằm trong `D:\admin-web`.

## Chạy local

Node 22.12+ hoặc Node 24. Cài và chạy:

```powershell
npm ci
npm --prefix functions ci
npm run dev
```

Mở URL Vite in ra. Mock dùng email tùy ý, không cần password; `viewer@example.test` thử trạng thái thiếu quyền. Dữ liệu giả lưu localStorage `leafy-mock-v1`; xóa key này để reset. Không dùng thông tin người thật. Mock audit chỉ minh họa, không có độ tin cậy backend.

Chức năng: dashboard count, danh mục cây/bệnh (thêm, sửa, chi tiết, validation, xác nhận, chống ghi đè bản sửa cũ), vườn/hồ sơ chỉ đọc, audit chỉ đọc, tìm tiền tố, phân trang. Không xóa danh mục vì Android có quan hệ tham chiếu và chưa hỗ trợ soft-delete. Tham khảo [khảo sát và giới hạn](docs/android-context.md).

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
4. Xem `firebase/firestore.dev.rules`. Đây là Rules chỉ phục vụ baseline admin dev, không phải Rules thay thế production. Client không ghi danh mục/audit; Function tự kiểm tra quyền, whitelist dữ liệu và transaction. `firestore.indexes.json` chưa cần composite: query dùng single-field indexes mặc định + document ID. Không thay indexes hiện có bằng file rỗng trên production.
5. Chỉ khi chủ dự án muốn thiết lập dev: build Functions rồi dùng Firebase CLI với **project dev cụ thể** để triển khai Functions/Rules. Không có deploy mặc định hoặc alias production trong repo.

Cấp admin dev, chưa tự chạy:

```powershell
$env:ADMIN_DEV_PROJECT_ID='your-dev-project'
npm --prefix functions run grant-admin -- your-dev-project UID your-dev-project
```

Script kiểm tra project, giữ claims hiện có, chặn production. Đăng nhập lại sau khi cấp claim. Không có nút tự cấp quyền trong UI. Không cung cấp thao tác quản lý Auth hàng loạt khi chưa có nghiệp vụ cụ thể.

## Emulator Suite

Cài Firebase CLI theo tài liệu chính thức và JDK 21+ cho Firestore emulator (máy hiện có Java 17 nên chưa chạy được). Không cần kết nối project production.

```powershell
npm --prefix functions run build
firebase emulators:start --project demo-leafy-admin --only "auth,firestore,functions"
```

Copy env development mẫu, chạy `npm run dev:firebase`. Emulator UI ở http://127.0.0.1:4000: tạo Auth user, lấy UID. Đặt FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 và ADMIN_DEV_PROJECT_ID=demo-leafy-admin rồi chạy script grant-admin ở trên với project demo. Danh mục ban đầu trống, có thể thêm qua admin. Không seed/copy production.

## Android debug / release (chỉ hướng dẫn)

Sau khi chủ dự án chuẩn bị project dev: đăng ký đúng applicationId trong mỗi Firebase project; đặt google-services.json theo source set `app/src/debug/` và `app/src/release/`. Nếu chọn applicationIdSuffix cho debug, đăng ký app dev đúng suffix. Kiểm tra kết quả build và project ID từng variant. Bật provider, cấu hình SHA cho Google sign-in và kiểm tra FCM riêng ở dev. Không sửa Android trong công việc này.

## Kiểm tra và chuẩn bị production

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm --prefix functions run build
```

Trước production: lấy Rules/indexes/Functions hiện hành, hợp nhất thay vì ghi đè; kiểm thử user ẩn danh/owner/member/non-member, join/leave, task và disease log; kiểm tra claim, ID, dữ liệu cũ, region, chi phí, phương án rollback. Kiểm thử Function từ client không đăng nhập, user thường, admin hợp lệ, input sai, xung đột và tính nguyên tử audit. Cần một đợt review riêng để cho phép backend production. Không deploy production trong nhiệm vụ này.

Cloud Functions triển khai cần Blaze; Firestore tính phí reads/writes/storage và aggregation theo index entries. Mock không dùng cloud. Xem tài liệu chính thức (đối chiếu 23/11/2026): [Functions](https://firebase.google.com/docs/functions/manage-functions), [Firestore pricing](https://firebase.google.com/docs/firestore/pricing), [aggregation](https://firebase.google.com/docs/firestore/query-data/aggregation-queries). Đặt budget alert khi tạo dev cloud; không giả định alert tự ngắt chi phí.

Kết quả kiểm tra thực tế: xem [docs/verification.md](docs/verification.md). Chưa có Rules production nên chưa thể xác nhận tương thích quyền Android.

