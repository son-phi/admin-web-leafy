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
