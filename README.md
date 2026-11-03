# TaskFlow - Hệ Thống Quản Lý Dự Án & Công Việc Chuẩn Jira

[![Node.js](https://img.shields.io/badge/Node.js-v22.12-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express-v5.2-black?logo=express)](https://expressjs.com/)
[![React](https://img.shields.io/badge/React-v19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-v8.3-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-v16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Render](https://img.shields.io/badge/Deployed_on-Render-46E3B7?logo=render&logoColor=white)](https://render.com/)

> **TaskFlow** là nền tảng quản lý dự án và công việc cộng tác đa nền tảng theo chuẩn **Jira / Agile Workspace**. Hệ thống cung cấp đầy đủ bảng Kanban kéo thả, Dashboard phân tích tiến độ thời gian thực, quản lý đa dự án, phân quyền chặt chẽ theo vai trò (Admin / Project Lead / Member), và hỗ trợ đính kèm tài liệu bảo mật.

---

## 🌟 Tính năng nổi bật

**Không gian Leader:** menu **Quản lý dự án** cung cấp tiến độ toàn dự án, khối lượng theo thành viên, giao việc nhanh và hai quyền thành viên có lịch sử thay đổi. Xem [hướng dẫn sử dụng và chạy migration 013](docs/leader-workspace.md).

### 1. Quản lý Đa dự án & Phân quyền Dự án (Project Governance)
- **Tạo & Quản lý Dự án**: Người dùng có thể tạo dự án với tên và mã định danh riêng (Project Key: ví dụ `TF`, `PRJ`).
- **Mã công việc chuẩn Jira**: Tự động sinh mã công việc dạng `TF-1`, `TF-23` cho từng dự án.
- **Vai trò Project Lead**: Người tạo dự án giữ quyền **Project Lead** – được phép tạo task, chỉnh sửa, xóa task, mời và quản lý thành viên trong dự án. Thành viên thông thường chỉ cập nhật task được giao.
- **Mời thành viên & Phản hồi lời mời**: Mời thành viên theo email; thành viên có thể Chấp nhận (*Accept*) hoặc Từ chối (*Decline*) ngay trên thanh thông báo Navbar.

### 2. Bảng Kanban Kéo Thả (Interactive Kanban Board)
- 3 cột trạng thái chuẩn: **To Do**, **In Progress**, **Done**.
- Kéo thả mượt mà (*HTML5 Drag and Drop*) với cập nhật trạng thái tức thì về máy chủ.
- Thẻ công việc trực quan: hiển thị mã task, tiêu đề, nhãn ưu tiên (High / Medium / Low), hạn chót (cảnh báo đỏ nếu quá hạn), và avatar người thực hiện.

### 3. Dashboard Phân tích Tiến độ Thông minh (Dashboard & Analytics)
- **5 thẻ chỉ số chuẩn logic**:
  $$\text{Total Issues} = \text{To Do} + \text{In Progress} + \text{Done}$$
  kèm thẻ cảnh báo đặc biệt **Overdue (Quá hạn)**.
- **Thanh tiến độ hoàn thành đa phân đoạn**: Thể hiện trực quan tỷ lệ % hoàn thành công việc của toàn bộ dự án.
- **Phân bổ mức độ ưu tiên & Hạn chót**: Thống kê số lượng task High/Medium/Low và đếm nhanh số task sắp đến hạn (trong vòng 48h).
- **Tab Công việc của tôi (My Work Items)**: Phân tách rõ ràng giữa:
  - *Assigned to Me*: Các công việc được giao cho bạn thực hiện.
  - *Created by Me*: Các công việc do bạn tạo ra.
- **Bảng Recent Issues với bộ lọc nhanh**: Lọc tức thì theo *All Recent*, *In Progress*, hoặc *Overdue*.

### 4. Danh sách Công việc Toàn diện (All Issues / All Tasks)
- Bảng danh sách chi tiết toàn bộ công việc trong dự án với phân trang mượt mà.
- **Bộ lọc đa tiêu chí**:
  - Tìm kiếm toàn văn (*Universal Search* trên Navbar theo tiêu đề, mô tả, mã task `TF-23`).
  - Lọc theo Trạng thái (To Do, In Progress, Done, Unassigned).
  - Lọc theo Độ ưu tiên (High, Medium, Low).
  - Lọc theo Hạn chót: *All Dates*, *Today*, *Tomorrow*, *This Week*, *Overdue*, *No Due Date*, và **Chọn ngày cụ thể (Date Picker)**.
  - Nút **Reset Filters** nhanh chóng khi có bộ lọc hoạt động.

### 5. Chi tiết Công việc & Đính kèm Tài liệu (Task Details & Attachments)
- Ngăn trượt (*Slide-over Drawer*) hiển thị chi tiết task mà không cần tải lại trang.
- Đặt hạn chót với độ chính xác đến **Giờ : Phút** (`datetime-local`).
- Bình luận trao đổi thảo luận theo thời gian thực.
- Tải lên tài liệu đính kèm với cơ chế bảo mật: Hỗ trợ tích hợp **Supabase Storage** (Private Bucket với Signed URLs có thời hạn) hoặc tự động chuyển đổi sang Local Storage an toàn.

### 6. Cổng Quản trị Hệ thống (Admin Portal)
- Dành riêng cho tài khoản Quản trị viên (`admin`):
  - Giám sát toàn bộ người dùng, kích hoạt hoặc vô hiệu hóa tài khoản.
  - Xem danh sách và quản trị toàn bộ các dự án trong hệ thống.
  - Xem thông số kỹ thuật điện toán đám mây (Telemetry & Cloud Specs).

---

## 🏗️ Kiến trúc Hệ thống (Architecture)

Dự án được xây dựng theo **Kiến trúc phân tầng (Layered Monolith Architecture)** ở Backend kết hợp mô hình **MVC** thích ứng ở Frontend:

```text
┌─────────────────────────────────┐
│     Tầng Trình diễn (Client)     │  React 19 + Vite 8 + Tailwind CSS
│  (Single Page Application - SPA)│  WorkspaceController (Controller) + Views
└────────────────┬────────────────┘
                 │ HTTPS (RESTful API + JWT Bearer)
┌────────────────▼────────────────┐
│    Tầng Nghiệp vụ (Backend API)  │  Node.js (Express 5.2)
│  (Layered Monolith Architecture)│  routes/ -> controllers/ -> database/
└────────────────┬────────────────┘
                 │ Parameterized SQL / Signed URLs
┌────────────────▼────────────────┐
│   Tầng Dữ liệu & Lưu trữ (Data)  │  - PostgreSQL 16 (Neon Serverless Cloud)
│                                 │  - Supabase Storage (Private Object Storage)
└─────────────────────────────────┘
```

### Cấu trúc thư mục

```text
TaskFlow/
├── backend/
│   ├── src/
│   │   ├── routes/        Khai báo endpoint HTTP, validate dữ liệu (express-validator)
│   │   ├── controllers/   Tiếp nhận HTTP request, xử lý nghiệp vụ, trả JSON
│   │   ├── database/      Kết nối PostgreSQL và các Repository pattern (Parameterized SQL)
│   │   ├── middlewares/   Xác thực JWT, phân quyền RBAC, upload file, bắt lỗi tập trung
│   │   ├── services/      Tích hợp Supabase Storage SDK và Local fallback
│   │   └── utils/         Chuẩn hóa lỗi, logger, định dạng response
│   ├── __tests__/         Bộ kiểm thử tự động Integration Tests
│   ├── .env.example       File mẫu cấu hình biến môi trường
│   └── server.js          Điểm khởi chạy ứng dụng Backend
├── database/
│   ├── migrations/        Các file migration SQL được đánh số theo phiên bản
│   ├── seeds/             Tạo tài khoản admin mặc định và dữ liệu mẫu
│   └── migrate.js         Công cụ tự động chạy migration
├── web/
│   ├── src/
│   │   ├── models/        apiModel.js - Đóng gói các hàm gọi API HTTP
│   │   ├── controllers/   WorkspaceController.jsx - Quản lý toàn bộ State & Logic
│   │   ├── features/      Các phân hệ: auth, dashboard, kanban, tasks, team, profile, admin
│   │   ├── components/    Navbar, Sidebar, Toast thông báo, Pagination
│   │   └── utils/         helpers.js - Các hàm xử lý ngày giờ, màu avatar, mã task
│   ├── index.html         HTML gốc
│   ├── vite.config.js     Cấu hình Vite + Tailwind CSS
│   └── .env.example       File mẫu cấu hình URL backend
├── docs/                  Tài liệu chi tiết về API, kiến trúc, kiểm thử và rà soát
└── render.yaml            Cấu hình triển khai tự động (Blueprint) cho Render.com
```

---

## 🚀 Hướng dẫn Cài đặt & Chạy cục bộ (Local Development)

### Yêu cầu tiên quyết
- **Node.js**: Phiên bản 22.12 trở lên.
- **PostgreSQL 16**: Đang chạy cục bộ hoặc sử dụng PostgreSQL trên đám mây (ví dụ: [Neon.tech](https://neon.tech)).

---

### Bước 1: Khởi tạo Cơ sở dữ liệu & Chạy Backend

1. Mở Terminal / PowerShell và di chuyển vào thư mục `backend`:
   ```bash
   cd backend
   npm install
   ```

2. Tạo file cấu hình `backend/.env` từ file mẫu:
   ```bash
   copy .env.example .env
   ```
   *Cập nhật chuỗi kết nối `DATABASE_URL` tới cơ sở dữ liệu PostgreSQL của bạn và điền `JWT_SECRET`.*

3. Chạy migration để tự động tạo toàn bộ bảng và dữ liệu khởi tạo:
   ```bash
   npm run migrate
   ```

4. *(Tùy chọn)* Tạo tài khoản Quản trị viên (Admin) ban đầu:
   ```bash
   npm run seed:admin
   ```
   *(Mặc định tạo: `admin@example.com` / Mật khẩu: `Admin@123456`)*

5. Khởi động Backend API:
   ```bash
   npm run dev
   ```
   *Backend sẽ chạy tại: `http://localhost:3000` (Kiểm tra sức khỏe tại `http://localhost:3000/api/health`).*

---

### Bước 2: Chạy Web Frontend

1. Mở một cửa sổ Terminal mới và di chuyển vào thư mục `web`:
   ```bash
   cd web
   npm install
   ```

2. Tạo file cấu hình `web/.env`:
   ```bash
   copy .env.example .env
   ```
   *Đảm bảo `VITE_API_URL=http://localhost:3000`.*

3. Khởi chạy giao diện React:
   ```bash
   npm run dev
   ```
   *Frontend sẽ khởi chạy tại: `http://localhost:5173`.*

---

## ☁️ Triển khai lên Render.com (Deployment)

Dự án đã tích hợp sẵn file cấu hình **`render.yaml`** chuẩn Blueprint.

### Cách 1: Triển khai tự động bằng Render Blueprint (Khuyên dùng)
1. Đẩy mã nguồn lên repository GitHub của bạn:
   ```bash
   git remote add origin https://github.com/<username>/<repo-name>.git
   git push -u origin main
   ```
2. Truy cập [Render Dashboard](https://dashboard.render.com) $\rightarrow$ Chọn **New +** $\rightarrow$ **Blueprint**.
3. Chọn Repository vừa tạo $\rightarrow$ Render sẽ tự động nhận diện và tạo cả **Database PostgreSQL**, **Backend API** và **Frontend Static Site**.
4. Điền các biến môi trường nếu cần thiết và nhấn **Apply**.

### Cách 2: Triển khai thủ công
- **Backend Service**:
  - Type: `Web Service` (Node.js)
  - Build Command: `npm ci --prefix backend`
  - Start Command: `npm --prefix backend run migrate && npm --prefix backend start`
  - Env Vars: `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV=production`, `WEB_ORIGIN=*`.
- **Frontend Service**:
  - Type: `Static Site`
  - Root Directory: `web`
  - Build Command: `npm ci && npm run build`
  - Publish Directory: `dist`
  - Env Vars: `VITE_API_URL=https://<your-backend-api>.onrender.com`.

---

## 🧪 Kiểm thử Tự động (Testing)

Hệ thống đi kèm bộ kiểm thử tích hợp toàn diện cho API:

```bash
# Chạy bộ test backend
cd backend
npm test -- --runInBand

# Kiểm tra build frontend
cd web
npm run build
```

---

## 👥 Tài khoản mặc định để thử nghiệm

| Vai trò | Email | Mật khẩu mặc định | Ghi chú |
|---|---|---|---|
| **System Admin** | `admin@example.com` | `Admin@123456` | Toàn quyền quản trị hệ thống, quản lý tài khoản, xem telemetry |
| **Project Lead** | `dang@gmail.com` | `Dang@123456` | Trưởng dự án "dang", tạo/sửa/xóa issue, mời thành viên |
| **User (Member)** | `alice@taskmanager.dev` | `Alice@123456` | Thành viên tham gia dự án, cập nhật task được giao |

---

## 📄 Bản quyền & Đóng góp
Dự án được phát triển phục vụ học phần **Điện toán Đám mây (Cloud Computing)**. Mọi đóng góp và mã nguồn được chia sẻ theo giấy phép ISC.
