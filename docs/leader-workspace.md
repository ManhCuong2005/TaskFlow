# Không gian quản lý Leader

## Phân tích và phạm vi

Dự án đã có Project Lead (`projects.lead_id`), mời/xóa thành viên, tạo và phân công công việc, Kanban và Dashboard. Bổ sung này gom các nhu cầu điều hành vào menu **Quản lý dự án**, chỉ hiện với Leader của dự án đang chọn.

| Tiêu chí | Hành vi |
|---|---|
| Phạm vi | Chỉ dự án do Leader phụ trách; backend kiểm tra lại quyền trên mọi request |
| Theo dõi tiến độ | Thống kê toàn bộ dự án, không bị ảnh hưởng bởi phân trang/tìm kiếm của danh sách công việc |
| Điều phối | Xem khối lượng của từng thành viên, việc quá hạn và mở form giao việc với người nhận đã chọn |
| Quyền thành viên | Cho phép/tạm khóa cập nhật trạng thái phần việc được giao và viết/chỉnh sửa bình luận |
| Lịch sử | Ghi người thay đổi, thành viên, quyền trước/sau và thời điểm; hiển thị 10 bản ghi mới nhất |
| Admin | Giữ quyền quản trị toàn hệ thống; Leader không được khóa tài khoản hoặc cấp quyền Admin |

Quyền xem không bị tắt. Thành viên không được chỉnh metadata, phân công hay xóa task chỉ vì được bật quyền cập nhật trạng thái. Xóa bình luận của chính mình vẫn được phép khi quyền viết đã bị tắt. Leader và Admin không chịu giới hạn của hai quyền thành viên này.

## SQL và cách chạy

SQL mới nằm duy nhất tại [`database/migrations/013_project_member_permissions.sql`](../database/migrations/013_project_member_permissions.sql). Migration thêm ba cột vào `project_members` và bảng `project_permission_history`; không thay đổi vai trò hệ thống, không xóa dữ liệu. Hai quyền mặc định `TRUE` giữ quyền sử dụng hiện tại của thành viên.

1. Kiểm tra `backend/.env` trỏ đúng CSDL mà nhóm thống nhất áp dụng thay đổi. Nếu dùng Neon chung, chỉ một người trong nhóm cần áp dụng migration cho CSDL đó. Thử trên CSDL phát triển trước khi áp dụng cho bản đang sử dụng.
2. Mở **Command Prompt** và chạy:

   ```bat
   cd /d D:\Icloud\TaskFlow\backend
   npm install
   npm run migrate
   ```

3. Kết quả mong đợi nếu các migration trước đã chạy:

   ```text
   [APPLY] 013_project_member_permissions.sql
   Migration complete. 1 migration(s) applied.
   ```

4. Khởi động lại backend (`npm run dev`) và giao diện trong terminal khác (`cd web`, `npm run dev`). Đăng nhập tài khoản Leader, chọn dự án mình phụ trách, mở **Quản lý dự án**.

Chạy lại `npm run migrate` sẽ bỏ qua file đã được ghi nhận trong `schema_migrations`. Không cần copy SQL vào pgAdmin; chạy thủ công mà không ghi nhận migration sẽ làm lịch sử giữa code và CSDL không khớp. Các thay đổi sau này dùng file `014_...sql`, không chỉnh lại file 013 đã áp dụng.

Cấu hình Render hiện chạy migration trước khi khởi động backend. Khi triển khai code mới, migration có thể được áp dụng tự động theo cấu hình đó; thống nhất thời điểm triển khai với nhóm.

## Cách sử dụng

- Các thẻ đầu trang và thanh tiến độ tổng hợp toàn bộ công việc chưa bị xóa của dự án. “Chờ làm” bao gồm việc chưa được giao.
- “Cần Leader chú ý” liệt kê tối đa sáu việc chưa hoàn thành: quá hạn, đến hạn trong 48 giờ, ưu tiên cao hoặc chưa giao. Nhấn để mở chi tiết và điều chỉnh phân công.
- Bảng thành viên cho biết số việc chờ/đang làm, hoàn thành và quá hạn theo **phần việc của từng người**. Một task có nhiều người nhận có thể được tính ở nhiều hàng; tổng các hàng không phải tổng số task duy nhất của dự án.
- **Giao việc** mở form tạo công việc có sẵn người nhận; **Quyền** mở hộp thoại chỉnh hai quyền rồi lưu. Tài khoản đã bị Admin khóa không được nhận việc mới.
- Nếu hai người mở cùng một phiên bản quyền rồi cùng lưu, lần lưu sau nhận xung đột; đóng hộp thoại và mở lại để xem quyền mới trước khi thay đổi tiếp.
- Quyền được kiểm tra ở backend mỗi lần ghi; giao diện cũ đang mở không thể bỏ qua quyền đã bị thu hồi. Thành viên tải lại dữ liệu để các nút trên giao diện phản ánh thiết lập mới.

## Tổ chức code

```text
backend/src/routes/projects.routes.js       Endpoint và validation
backend/src/controllers/leader.controller.js
backend/src/database/leader.repository.js  Tổng hợp, transaction, lịch sử, kiểm tra phiên bản
backend/src/database/projectAccess.js      Chính sách truy cập dự án và kiểm tra người nhận việc
web/src/models/leaderModel.js              Gọi API qua HTTP client hiện có
web/src/features/leader/                   Hook dữ liệu, màn hình và hộp thoại quyền
database/migrations/013_...sql             Thay đổi cấu trúc CSDL
backend/__tests__/leader-workspace.test.js Kiểm thử tích hợp
```

## Kiểm thử an toàn

Suite cần một PostgreSQL **test riêng** đã chạy migration, tên CSDL chứa phân đoạn `test`. Không trỏ `TEST_DATABASE_URL` vào Neon đang dùng chung. Trong PowerShell, đặt cấu hình chỉ cho terminal kiểm thử:

```powershell
cd D:\Icloud\TaskFlow\backend
$env:NODE_ENV = 'test'
$env:TEST_DATABASE_URL = 'postgresql://TEST_USER:TEST_PASSWORD@localhost:5432/taskflow_leader_test'
$env:JWT_SECRET = 'local-integration-test-secret'
$env:DB_SSL = 'false' # Chỉ cho PostgreSQL local không dùng TLS
npm run migrate
npm test -- --runInBand __tests__/leader-workspace.test.js
```

Test kiểm tra thống kê với nhiều người nhận, phân quyền chéo dự án, cập nhật đồng thời, quyền thực tế trên hai API trạng thái và bình luận, lịch sử thay đổi, người nhận ngoài dự án/tài khoản bị khóa. Sau khi kiểm thử, đóng terminal để không dùng nhầm cấu hình test cho ứng dụng thường ngày.

## Ảnh giao diện

Ảnh chụp bằng dữ liệu minh họa trong CSDL kiểm thử riêng:

- [Màn hình desktop](previews/leader-workspace-desktop.png)
- [Màn hình điện thoại](previews/leader-workspace-mobile.png)
- [Hộp thoại quyền](previews/leader-permissions.png)
- [Hộp thoại quyền trên điện thoại](previews/leader-permissions-mobile.png)

Đã kiểm tra build frontend, 26 bài kiểm thử backend liên quan và luồng trình duyệt: đăng nhập, menu Leader, lưu/đọc lại quyền, lịch sử, tìm thành viên, tạo việc với người nhận đã chọn, mở chi tiết, bố cục điện thoại và việc ẩn/chặn chức năng với tài khoản thành viên. Migration được thử trên PostgreSQL local riêng, bao gồm chạy lại để xác nhận bỏ qua file đã áp dụng. Chưa áp dụng migration 013 lên Neon chung.

