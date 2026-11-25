# Khảo sát Android — 23/11/2026

> **Cập nhật 25/11/2026:** phạm vi và lược đồ web quản trị nay theo [ADMIN_SPEC.md](../ADMIN_SPEC.md) (lược đồ 2.4: `species`, `users.role/status`, `devices`…). Các “Quyết định triển khai admin” bên dưới (danh mục `plants`, `admin_audit`, không xóa danh mục) không còn áp dụng; phần khảo sát mã Android vẫn giữ làm bằng chứng hiện trạng.

## Phạm vi và bằng chứng

Đã đọc trực tiếp `D:\androidstudio`. Gốc Gradle: `D:\androidstudio`; `settings.gradle.kts` đặt tên `leafyApp`, include `:app`. Module: `D:\androidstudio\app`; `app/build.gradle.kts` khai báo namespace `com.example.leafyapp`, applicationId `leafyapp.dev` (tên này **không** chứng minh đây là môi trường dev).

Trong tài liệu dưới đây, `SRC` là `D:\androidstudio\app\src\main\java\com\example\leafyapp`. Không chỉnh sửa Android, không chạy build/migration/Git mutation tại đó. Bỏ qua build, .gradle, cache và .git. Không tìm thấy AGENTS.md/README, firebase.json, Firestore Rules/indexes hay mã Functions trong phần mã nguồn được khảo sát.

Chỉ lấy `project_info.project_id` từ `D:\androidstudio\app\google-services.json`: `leafyapp-cf95a`. Theo thông tin người dùng, coi project này là production và đưa vào danh sách chặn dev. Không sao chép API key hoặc nội dung cấu hình khác. Không đọc dữ liệu cloud.

## Đã xác minh từ mã nguồn

`app/build.gradle.kts` dùng Firestore, Auth, Analytics, FCM. Không thấy SDK/call Realtime Database, Storage hoặc callable Functions trong Kotlin được khảo sát. Điều này không chứng minh dịch vụ đó không tồn tại trên cloud. `SRC/FirebaseFirestore.kt` là class rỗng, không phải repository thực.

| Collection/path | Schema và nguồn |
| --- | --- |
| `plants/{id dạng chuỗi số}` | `SRC/data/model/plant.kt`: id:Int, name, scientificName, description, light, watering, soil, fertilizer, temperature, humidity, image:String; popularity:Int. `SRC/FirebaseMigrator.kt:17` ghi document theo plant.id.toString(). |
| `diseases/{id dạng chuỗi số}` | `SRC/data/model/disease.kt`: id:Int, diseaseName:String, reasons/solutions/plants:List<String>. `SRC/FirebaseMigrator.kt:26` ghi model theo ID số. plants là chuỗi tên, không phải danh sách document reference. |
| `gardens/{documentId}` | `SRC/data/model/Garden.kt`: id, name, inviteCode, ownerId:String; members:List<String>; createdAt:Long milliseconds. `SRC/ui/garden/GardenFragment.kt` tạo vườn; `GardenViewModel.kt` query và cập nhật thành viên. |
| `users/{uid}` | `SRC/ui/profile/AuthRepository.kt:192-202`: firstName,lastName,displayName,email,photoUrl:String; lastUpdated:Long milliseconds. Ghi merge. Không có trường admin/disabled xác minh ở Firestore. Hồ sơ có thể không tồn tại cho mọi tài khoản Auth. |
| `users/{uid}/user_plants`, `gardens/{id}/plants` | `SRC/data/repository/GardenRepository.kt:61-69`, `SRC/data/model/GardenEntities.kt`: UserPlant gồm id,userId,ownerId:String; plantId:Int (tham chiếu danh mục); nickname:String; imagePath:String?; dateAdded:Long; gardenId:String?. |
| `users/{uid}/care_tasks`, `gardens/{id}/tasks` | Repository:71-78; CareTask trong GardenEntities.kt: id,userPlantId,ownerId:String; plantName:String?; type enum WATER/FERTILIZER/ROTATE/MIST/CUT/OTHER; frequencyDays,timeHour,timeMinute:Int; startDate,nextDueDate:Long; isAutoReminder:Boolean; lastCompletedDate:Long?; gardenId:String?. userPlantId nối UserPlant.id. |
| `users/{uid}/task_history` | Repository:110,163; `SRC/data/model/TaskHistory.kt`: id,taskId:String; completedDate:Long. Lịch sử luôn nằm dưới user, kể cả task vườn chung. |
| `users/{uid}/disease_logs`, `gardens/{id}/disease_logs` | Repository:80-86,174-219; `SRC/data/model/DiseaseLog.kt`: id,plantId,diseaseName:String; timestamp:Long. plantId ở đây là ID cây người dùng (chuỗi), khác Plant.id số. |

## Truy vấn và nghiệp vụ

- `SRC/ui/home/HomeViewModel.kt:47-50`: plants orderBy popularity giảm dần, giới hạn trending; hàm fetch phía dưới tải danh mục. `SRC/ui/information/PlantFragment.kt:99` đọc plants bằng ID chuỗi số. `SRC/ui/search/SearchActivity.kt:111` tải danh mục và tìm phía client; admin không lặp lại cách tải toàn bộ này.
- `SRC/ui/information/DiseaseFragment.kt` dùng DatabaseHelper để lấy bệnh từ SQLite; tên comment Firebase không đủ để kết luận đọc Firestore. Danh mục diseases có writer migration được xác minh, nhưng sửa Firestore chưa chắc cập nhật màn hình bệnh Android hiện tại.
- `SRC/data/repository/GardenRepository.kt` nghe snapshot theo scope user/vườn, CRUD cây/task; ghép task.userPlantId với UserPlant.id; disease_logs whereEqualTo plantId. Delete hiện tại không chứng minh cascade an toàn.
- `SRC/ui/garden/GardenViewModel.kt:179-210`: gardens whereArrayContains members uid; join bằng inviteCode, arrayUnion; leave arrayRemove. `SRC/MainActivity.kt:104-118` subscribe topic user và garden. Không thấy backend xử lý gửi thông báo trong repo.
- `SRC/ui/splash/SplashActivity.kt:68-77` đăng nhập ẩn danh; `SRC/ui/profile/AuthRepository.kt` link Google/email vào anonymous hoặc đăng nhập tài khoản hiện hữu, cập nhật profile, đăng xuất và tự xóa Auth user. Không thấy custom claim admin trong app.

## Quyết định triển khai admin mới

- Thêm/sửa plants và diseases đúng field đã xác minh; ID số nguyên dương và URL HTTPS là validation mới của admin, không phải ràng buộc được chứng minh từ dữ liệu production. Không đổi ID khi sửa.
- Vườn và hồ sơ chỉ đọc; chưa can thiệp thành viên, quyền, dữ liệu cá nhân hoặc lịch chăm sóc. Không thêm trường soft-delete vì các query Android không lọc nó. Không cung cấp xóa danh mục để tránh đứt tham chiếu.
- `admin_audit` và claim `admin:true` là thiết kế **mới**, không phải schema có sẵn. Backend ghi actor UID, server time, action, target và before/after các trường danh mục trong transaction. Frontend không ghi trực tiếp.
- Phân trang cursor tối đa 10 + 1 bản ghi lookahead; tìm tiền tố có phân biệt hoa/thường/dấu. Không full-text. Dashboard dùng count aggregation. Lọc ảnh chỉ trên trang hiện tại, được ghi rõ trên UI.

## Còn thiếu / cần đối chiếu trước tích hợp

Chưa có project dev, cấu hình Web app dev, provider Auth bật trên cloud, region Functions, Rules/indexes production, custom claims thực tế, Functions/FCM backend, dữ liệu tài liệu thực và convention ID ngoài migrator. Chưa xác minh image có luôn là URL HTTPS hay resource name. Chưa xác minh dữ liệu cũ có đủ field.

`firebase/firestore.dev.rules` là baseline cô lập để thử admin, không thay thế Rules Android. Các write của Android và đọc subcollection chưa được mở; phải lấy Rules hiện có, hợp nhất và kiểm thử owner/member/join/leave trước tích hợp Android dev hoặc production. Không thể tuyên bố tương thích quyền hiện hành khi chưa có Rules gốc.
