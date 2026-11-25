Bạn là lập trình viên full-stack. Hãy xây dựng một web admin bằng React cho ứng dụng Android hiện có của tôi, sử dụng Firebase và tách biệt môi trường dev/test với production.



Bối cảnh:

\- App Android hiện đang chạy trên điện thoại và kết nối Firebase để lấy dữ liệu.

\- Firebase hiện tại đang phục vụ production.

\- Web admin cần xem và thay đổi dữ liệu phục vụ quản trị.

\- Trong quá trình phát triển, mọi hoạt động thử nghiệm phải được cách ly khỏi production.



1\. Khảo sát trước khi triển khai



Nếu workspace có mã nguồn Android:

\- Đọc hướng dẫn repository và khảo sát cách app sử dụng Firebase.

\- Xác định app dùng Cloud Firestore hay Realtime Database, Authentication, Storage và Functions nào.

\- Đọc model, collection/path, kiểu dữ liệu, quan hệ và các truy vấn hiện có.

\- Dựa trên bằng chứng trong mã nguồn để thiết kế chức năng quản trị tương ứng.

\- Không sửa mã Android trong nhiệm vụ này.



Nếu không có đủ thông tin:

\- Hỏi ngắn gọn các thông tin thực sự cần thiết.

\- Trong lúc chờ, tiếp tục dựng giao diện và chế độ mock.

\- Không tự coi cấu trúc dữ liệu phỏng đoán là cấu trúc thật.



2\. Công nghệ



\- React + TypeScript + Vite.

\- React Router.

\- Material UI để dựng giao diện admin.

\- Firebase Web SDK dạng modular.

\- Firebase Authentication để đăng nhập.

\- Cloud Functions bằng TypeScript và Firebase Admin SDK cho các thao tác quản trị quan trọng.

\- Tách rõ UI, lớp truy cập dữ liệu và xử lý nghiệp vụ.

\- Chọn phiên bản thư viện ổn định, tương thích với nhau.



3\. Tách môi trường



\- Giữ nguyên Firebase project hiện tại cho production.

\- Chuẩn bị cấu hình cho một Firebase project dev riêng.

\- Android debug và web admin dev sẽ dùng project dev; Android release và web admin production dùng project production.

\- Tạo file cấu hình mẫu và hướng dẫn điền thông tin Firebase; không tự tạo hoặc sửa tài nguyên cloud nếu chưa được yêu cầu.

\- Mặc định chạy local và build thông thường phải hướng đến dev hoặc mock.

\- Có lệnh riêng, rõ ràng để build production.

\- Kiểm tra Firebase projectId khi khởi động; báo lỗi nếu môi trường và project không khớp.

\- Không được âm thầm fallback sang production khi thiếu cấu hình dev.

\- Hiển thị nhãn môi trường DEV/MOCK/PRODUCTION dễ nhận biết.

\- Khi chưa có Firebase dev, ứng dụng vẫn chạy được bằng dữ liệu mock.

\- Chế độ mock không khởi tạo kết nối Firebase thật.

\- Không sao chép dữ liệu người dùng thật vào dev.



4\. Đăng nhập và phân quyền



\- Có trang đăng nhập và đăng xuất.

\- Chỉ tài khoản có custom claim admin: true mới được dùng chức năng admin.

\- Có trạng thái đang kiểm tra đăng nhập, chưa đăng nhập, không đủ quyền và lỗi.

\- Route guard và việc ẩn nút chỉ phục vụ giao diện; quyền phải được kiểm tra bằng Security Rules hoặc backend.

\- Không cho frontend tự cấp quyền admin.

\- Cung cấp script backend để cấp quyền cho một UID cụ thể, có kiểm tra project đích và giữ lại các custom claims hiện có.

\- Không tự chạy script cấp quyền.

\- Không đưa service account, khóa riêng hoặc Firebase Admin SDK vào frontend.

\- Không xem biến môi trường VITE\_\* là nơi lưu bí mật.



5\. Truy cập dữ liệu



\- Cho phép đọc dữ liệu thông thường bằng Firebase Web SDK với Security Rules phù hợp.

\- Đưa thao tác quan trọng qua Cloud Functions: quản lý tài khoản Authentication, thay đổi quyền, thao tác hàng loạt và cập nhật cần kiểm tra nghiệp vụ.

\- Mỗi Function phải kiểm tra đăng nhập, quyền admin và dữ liệu đầu vào.

\- Firebase Admin SDK bỏ qua Security Rules; không dựa vào Rules để bảo vệ các Function.

\- Chỉ cho sửa những trường đã được xác định và cho phép.

\- Không triển khai một API cho phép client truyền đường dẫn tùy ý để ghi/xóa bất kỳ dữ liệu nào.

\- Dùng transaction hoặc batch khi nghiệp vụ cần tính nhất quán.

\- Không mở Rules kiểu cho phép mọi người đọc/ghi.



6\. Chức năng



Dựa trên schema thực tế, triển khai:

\- Layout có sidebar, header, tài khoản và nhãn môi trường.

\- Dashboard với các thống kê có thể truy vấn hợp lý.

\- Danh sách dữ liệu có phân trang, lọc và tìm kiếm phù hợp khả năng của database.

\- Không tải toàn bộ database chỉ để tìm kiếm hoặc thống kê.

\- Trang chi tiết dữ liệu.

\- Form thêm/sửa có validation.

\- Xác nhận trước thao tác xóa hoặc thao tác có ảnh hưởng lớn.

\- Nếu dữ liệu có quan hệ hoặc cần lưu lịch sử, ưu tiên vô hiệu hóa/xóa mềm khi phù hợp với app Android.

\- Thông báo thành công/thất bại, loading, empty state và xử lý lỗi.

\- Giao diện tiếng Việt, dùng tốt trên desktop và tablet.



Nếu database không hỗ trợ kiểu tìm kiếm được yêu cầu, giải thích giới hạn và đưa ra phương án phù hợp; không hiển thị tính năng tìm kiếm giả.



7\. Lịch sử thao tác



\- Ghi nhận các thao tác quản trị quan trọng từ backend.

\- Lưu UID admin, thời gian server, hành động, đối tượng và nội dung thay đổi cần thiết.

\- Không lưu mật khẩu, token hoặc dữ liệu nhạy cảm không cần thiết.

\- Client không được tùy ý sửa/xóa lịch sử.

\- Nếu một chức năng cần lịch sử đáng tin cậy, đưa thao tác ghi của chức năng đó qua backend.



8\. Rules và khả năng tương thích



\- Chuẩn bị Rules và indexes phù hợp với database thực tế.

\- Không thay toàn bộ Rules hiện có bằng Rules chỉ dành cho admin.

\- Giữ đúng quyền của người dùng Android hiện tại.

\- Nếu chưa có Rules hiện tại, ghi rõ phần nào cần đối chiếu trước khi áp dụng production.

\- Không tự deploy Rules, Functions hoặc Hosting lên production.



9\. Kiểm thử và bàn giao



\- Chạy kiểm tra TypeScript, lint và build.

\- Viết kiểm thử có ý nghĩa cho phân quyền, validation và thao tác quan trọng.

\- Khi có thể, dùng Firebase Emulator Suite để kiểm tra:

&#x20; + Chưa đăng nhập bị từ chối.

&#x20; + Người dùng thường bị từ chối thao tác admin.

&#x20; + Admin được thực hiện thao tác hợp lệ.

&#x20; + Dữ liệu đầu vào sai bị từ chối.

&#x20; + Quyền Android hiện có vẫn hoạt động.

\- Nêu rõ kiểm tra nào đã chạy, kiểm tra nào chưa chạy và lý do.

\- Không báo đã kiểm thử Firebase thật khi chỉ chạy mock.



Tạo README gồm:

\- Cách cài đặt và chạy mock.

\- Cách tạo Firebase dev và đăng ký Web app.

\- Cách cấu hình Auth, database, Rules, indexes và Functions.

\- Cách cấp quyền admin cho tài khoản dev.

\- Cách chạy Emulator Suite.

\- Cách build dev và production.

\- Cách cấu hình Android debug/release dùng hai project, chỉ hướng dẫn và không sửa Android.

\- Các bước kiểm tra trước khi triển khai production.

\- Các yêu cầu gói dịch vụ hoặc chi phí liên quan nếu có, dựa trên tài liệu hiện hành.



Cách làm việc:

\- Trước tiên khảo sát workspace, nêu ngắn gọn kết quả và kế hoạch rồi bắt đầu triển khai.

\- Chủ động thực hiện các quyết định kỹ thuật thông thường.

\- Chỉ hỏi khi thiếu thông tin làm ảnh hưởng trực tiếp đến tính đúng đắn.

\- Hoàn thành project chạy được trong local.

\- Không truy cập, thay đổi dữ liệu hoặc deploy lên production trong nhiệm vụ này.

\- Khi kết thúc, báo cáo những gì đã làm, cách chạy, kết quả kiểm tra và những cấu hình tôi còn cần cung cấp.

