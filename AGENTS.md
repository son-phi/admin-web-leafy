\# Phạm vi làm việc



\- Project đang xây dựng: D:\\admin-web

\- Mã nguồn Android tham khảo: D:\\androidstudio

\- Yêu cầu chi tiết: PROJECT\_BRIEF.md



\# Quy tắc



\- Chỉ tạo và sửa mã nguồn trong D:\\admin-web.

\- Thư mục Android chỉ dùng để đọc và đối chiếu.

\- Không sửa, di chuyển, xóa hoặc chạy lệnh Git thay đổi trạng thái

&#x20; trong thư mục Android.

\- Không thay đổi dữ liệu hoặc deploy lên Firebase production.

\- Không đưa service account, khóa riêng hay thông tin bí mật vào frontend.



\# Khảo sát Android



Trước khi thiết kế lớp truy cập dữ liệu, hãy đọc các phần liên quan:

\- Model dữ liệu.

\- Repository/service truy cập Firebase.

\- Đường dẫn collection hoặc Realtime Database.

\- Cách đăng nhập và phân quyền.

\- Rules, indexes và Functions nếu có.



Bỏ qua các thư mục sinh tự động như build, .gradle và cache.



Không in nội dung khóa bí mật vào log hoặc tài liệu.



Ghi lại kết quả khảo sát trong docs/android-context.md:

\- Đường dẫn file nguồn làm bằng chứng.

\- Cấu trúc dữ liệu đã xác định.

\- Các truy vấn và nghiệp vụ liên quan.

\- Những điểm chưa xác định hoặc cần xác nhận.



Nếu không đọc được thư mục Android, báo rõ lỗi;

không tự suy đoán schema.



\# Triển khai



\- Đọc PROJECT\_BRIEF.md trước khi bắt đầu.

\- Mặc định chạy bằng mock hoặc Firebase dev.

\- Không tự fallback sang Firebase production.

\- Chủ động tạo project React và hoàn thành các bước kiểm tra local.

