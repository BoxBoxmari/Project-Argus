---
ruleset: Bmad-Fullstack-App
trigger: always_on
alwaysApply: true
version: 1.0
scope: repo
compat: qoder
---

# 01 - Global Standards (Always Apply)

- **Node.js Version:** Sử dụng Node.js LTS (ví dụ: 20.x).
- **Package Manager:** Dùng `npm` cho toàn bộ project. Chạy `npm install` ở cả thư mục gốc và thư mục `client`.
- **Environment Variables:** Cả backend và frontend phải có file `.env.example`. Không commit file `.env`.
- **API:** Tất cả các API endpoint phải có tiền tố `/api/v1/`.
- **Formatting:** Sử dụng Prettier để format code. Phải có file `.prettierrc` ở thư mục gốc.
- **Linting:** Sử dụng ESLint. Phải có file `.eslintrc.js` (hoặc tương đương) ở cả backend và frontend.
- **Case Style:**
    - `camelCase` cho biến và hàm (JavaScript/TypeScript).
    - `PascalCase` cho components (React/Vue) và classes.
    - `kebab-case` cho tên file (trừ component files).
    - `UPPER_SNAKE_CASE` cho biến môi trường và hằng số.

---

# 02 - Backend (Specific Files: /*, !client/**)

- **Entry Point:** File khởi động server phải là `server.js` hoặc `index.js` ở thư mục gốc.
- **Framework:** Sử dụng Express.js.
- **CORS:** Cấu hình CORS để chỉ cho phép request từ frontend URL trong môi trường production.
- **Error Handling:** Phải có một middleware xử lý lỗi tập trung. Các hàm trong controller phải có block `try...catch` hoặc sử dụng `express-async-handler`.
- **Folder Structure:**
    - `config/`: Chứa các file cấu hình (ví dụ: `db.js`).
    - `controllers/`: Chứa logic xử lý request.
    - `models/`: Chứa Mongoose schemas.
    - `routes/`: Chứa định nghĩa các API routes.
    - `middlewares/`: Chứa các custom middlewares (ví dụ: `authMiddleware.js`).
    - `utils/`: Chứa các hàm tiện ích (ví dụ: `generateToken.js`).
- **Mongoose Models:**
    - Tên model phải là số ít và viết hoa chữ cái đầu (ví dụ: `User`).
    - Bật `timestamps: true` để tự động thêm `createdAt` và `updatedAt`.
- **API Response:**
    - **Success (2xx):**
      ```json
      {
          "status": "success",
          "data": { ... }
      }
      ```
    - **Error (4xx, 5xx):**
      ```json
      {
          "status": "error",
          "message": "Error message description"
      }
      ```

---

# 03 - Frontend (Specific Files: client/**)

- **Framework:** Sử dụng React (với Vite).
- **State Management:** Sử dụng Redux Toolkit cho global state.
- **Folder Structure:**
    - `src/app/`: Chứa Redux store và slices.
    - `src/components/`: Chứa các UI components tái sử dụng.
    - `src/features/`: Chứa các components và logic liên quan đến một chức năng cụ thể (ví dụ: `auth`, `products`).
    - `src/hooks/`: Chứa các custom hooks.
    - `src/pages/`: Chứa các trang chính của ứng dụng.
    - `src/services/`: Chứa logic gọi API.
    - `src/utils/`: Chứa các hàm tiện ích.
- **API Calls:**
    - Sử dụng `createAsyncThunk` của Redux Toolkit để xử lý các API request.
    - URL của backend API phải được lưu trong biến môi trường `VITE_API_URL`.
- **Styling:**
    - Sử dụng Tailwind CSS hoặc Styled Components.
    - Tránh viết CSS inline.
- **Components:**
    - Chia nhỏ components. Mỗi component chỉ nên làm một việc.
    - Sử dụng `PascalCase` cho tên file component (ví dụ: `ProductCard.jsx`).

---

# 04 - Code Quality & Git (Always Apply)

- **ESLint Rules:**
    - `no-console`: Cảnh báo khi có `console.log`.
    - `no-unused-vars`: Lỗi khi có biến không được sử dụng.
    - `react/prop-types`: Bắt buộc khai báo PropTypes cho components (nếu không dùng TypeScript).
- **Git:**
    - **Branching:**
        - `main`: Branch chính, chỉ merge code đã ổn định.
        - `develop`: Branch phát triển, chứa các tính năng đã hoàn thành.
        - `feature/<feature-name>`: Branch cho các tính năng mới.
    - **Commit Messages:** Theo chuẩn Conventional Commits.
        - `feat:`: Thêm tính năng mới.
        - `fix:`: Sửa lỗi.
        - `chore:`: Các công việc không liên quan đến code (build, config,...).
        - `docs:`: Chỉnh sửa tài liệu.
        - `style:`: Chỉnh sửa format code.
        - `refactor:`: Tái cấu trúc code.
    - **.gitignore:** Phải có `.gitignore` ở thư mục gốc, và phải ignore các file/thư mục sau:
        - `node_modules/`
        - `dist/`
        - `.env`
        - `*.log`