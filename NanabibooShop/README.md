# NanabibooShop — web cho thuê đồ cosplay

## Các file trong thư mục

| File | Dùng để |
|---|---|
| `index.html` | Trang khách xem (trang chủ + chi tiết bộ đồ) |
| `admin.html` | Trang quản lý: thêm/sửa đồ, ảnh, lịch, duyệt giữ chỗ |
| `js/firebase-config.js` | **Thông tin kết nối Firebase** (dán 1 lần khi cài đặt) |
| `firestore.rules` | Luật bảo vệ dữ liệu — dán vào Firebase (1 lần) |
| `data.js` | Bản sao lưu dữ liệu, web tự dùng khi Firebase gặp sự cố |
| `images/` | Ảnh / clip sản phẩm |
| `css/`, `js/` | Giao diện và code — không cần sửa |

## Cách web hoạt động (sau khi cài Firebase)

- Toàn bộ thông tin shop, bộ đồ và lịch nằm trên **Firebase**. Bạn sửa trong `admin.html` → bấm **Lưu** → khách thấy **ngay lập tức**, không cần upload gì lên GitHub.
- Khách bấm **Chốt thuê** → web **tự giữ chỗ** các ngày đó trong 30 phút (đổi được trong tab Thông tin shop) và tạo **mã giữ chỗ** (VD `K7P2QX`) nằm trong tin nhắn gửi bạn. Khách khác không chọn được các ngày này nữa.
- Trong admin, khung **Khách đang giữ chỗ** hiện mọi mã. Khách đã cọc → bấm **Xác nhận thuê** (lịch bị khoá hẳn). Khách không cọc → bấm **Huỷ**, hoặc để quá giờ là lịch tự mở lại.
- Mở admin được cả trên **điện thoại**: vào `https://<web-của-bạn>/admin.html` và đăng nhập.
- Chỉ **ảnh / clip mới** vẫn cần upload lên GitHub (vào thư mục `images`), hoặc dán link ảnh/TikTok/YouTube cho nhanh.

## Cài đặt Firebase (làm 1 lần, khoảng 15 phút, miễn phí)

> Luôn để gói **Spark (miễn phí)**. Không bấm nâng cấp Blaze, không nhập thẻ.

1. Vào **console.firebase.google.com** → **Create a project** → đặt tên `nanabibooshop` → tắt Google Analytics → **Create**.
2. **Build → Firestore Database → Create database** → chọn vị trí **asia-southeast1 (Singapore)** → chọn **Production mode** → Create.
3. Trong Firestore, mở tab **Rules** → xoá hết, dán toàn bộ nội dung file `firestore.rules`
   → sửa `EMAIL_ADMIN@gmail.com` thành **email của bạn** → **Publish**.
4. **Build → Authentication → Get started → Email/Password** → bật **Enable** → Save.
   Sang tab **Users → Add user** → nhập email ở bước 3 + mật khẩu (dùng để đăng nhập admin).
5. Bấm **⚙ → Project settings** → kéo xuống **Your apps** → bấm biểu tượng **`</>`** (Web) → đặt tên `nanabiboo-web` → Register app
   (không cần tick Firebase Hosting). Firebase hiện đoạn `firebaseConfig` — chép 4 giá trị `apiKey`, `authDomain`, `projectId`, `appId`
   vào file **`js/firebase-config.js`**.
6. Upload toàn bộ thư mục lên GitHub (hoặc chỉ các file đã đổi).
7. Mở **`https://<web-của-bạn>/admin.html`** → đăng nhập → admin sẽ báo *"Firebase chưa có dữ liệu"* và hiện dữ liệu từ `data.js`
   → kiểm tra lại → bấm **Lưu**. Xong! Trang khách hiện chấm xanh **"Lịch cập nhật trực tiếp"**.

> `apiKey` của Firebase được phép để công khai trên web; dữ liệu được bảo vệ bằng `firestore.rules` (chỉ email admin mới sửa được).

### Giới hạn miễn phí

- Gói Spark: **50.000 lượt đọc / ngày**. Web gộp toàn bộ dữ liệu vào 1 bản ghi nên mỗi lượt khách chỉ tốn ~1–2 lượt đọc
  → chịu được khoảng **25.000–40.000 lượt khách / ngày**. Khách chuyển sang tab khác quá 1 phút thì web tự ngắt kết nối để tiết kiệm.
- Nếu một ngày vượt mức: web **không sập**, tự chuyển sang dùng `data.js` (xem đồ, nhắn chốt thuê vẫn bình thường, chỉ tạm tắt giữ chỗ tự động tới hôm sau).
  Vì vậy thỉnh thoảng hãy bấm **Tải data.js** (tab Thông tin shop) và upload lên GitHub để bản sao lưu luôn mới.
- Mỗi bản ghi tối đa 1MB → đủ cho khoảng 200–300 bộ đồ.

## Cập nhật đồ / lịch thuê (hằng ngày)

1. Mở **`https://<web-của-bạn>/admin.html`** (máy tính hoặc điện thoại) → đăng nhập.
2. Sửa trong form:
   - **+ Thêm đồ**: tạo bộ mới. Mã bộ đồ (VD `NZK01`) không được trùng.
   - **Ảnh & clip**: dán link, hoặc chọn file từ máy (máy tính) rồi upload file đó lên thư mục `images` trên GitHub.
   - **Lịch thuê** (ngày/tháng/năm): khoảng nhận đặt + bấm trên lịch để khoá các lượt đã có khách.
   - Tab **Thông tin shop**: tên shop, link Messenger, thời gian giữ chỗ, hướng dẫn, luật thuê.
3. Bấm **Lưu** → khách thấy ngay.

> Chưa cài Firebase thì admin vẫn chạy như cũ: bấm Lưu → ghi ra `data.js` → upload `data.js` lên GitHub.

## Thêm clip thay cho ảnh

Trong phần **Ảnh & clip** của admin, mỗi bộ đồ có thể có cả ảnh và clip, xếp thứ tự tuỳ ý. Mục đầu tiên là ảnh bìa.

- **Clip từ máy** (.mp4, .webm, .mov): chọn hoặc kéo thả như ảnh. Clip sẽ được chép vào `images/`.
  - Trên trang chủ, clip tự chạy không tiếng khi khách lướt tới. Ở trang chi tiết có nút play và âm thanh.
  - Nên để clip **dưới 20MB** (720p, 10–30 giây) để khách dùng 4G load nhanh. GitHub không nhận file từ 100MB trở lên.
  - Nén clip miễn phí: HandBrake (preset "Fast 720p30"), hoặc CapCut → xuất 720p.
  - File .mov quay từ iPhone có thể không chạy trên Chrome/Android. Nên xuất lại thành .mp4.
- **Link TikTok / YouTube** (không tốn dung lượng repo): dán vào ô "Hoặc dán link…".
  - TikTok: dùng link đầy đủ dạng `https://www.tiktok.com/@ten/video/1234…`. Link rút gọn `vt.tiktok.com/…` không nhúng được, hãy mở nó trên trình duyệt rồi copy link đầy đủ.
  - YouTube: link thường, `youtu.be/…` hay Shorts đều được.

## Link Messenger

Vào trang Facebook của shop, xem username (VD `facebook.com/nanabibooshop`).
Link Messenger là `https://m.me/nanabibooshop`. Dán vào ô "Link Messenger" trong tab Thông tin shop.

## Đưa web lên mạng: Cloudflare Pages (khuyên dùng — không giới hạn băng thông)

Với 1.000–2.000 lượt khách/giờ, GitHub Pages (giới hạn 100GB/tháng) sẽ không đủ. Cloudflare Pages miễn phí và không giới hạn băng thông.

1. Đăng ký **dash.cloudflare.com** (miễn phí).
2. **Workers & Pages → Create → Pages → Connect to Git** → chọn GitHub → chọn repo `Nanabiboo_Web`.
3. Project name: **`nanabibooshop`** → link web sẽ là **`https://nanabibooshop.pages.dev`**.
   Framework preset: *None*; Build command: **để trống**; Build output directory: **`/`** → **Save and Deploy**.
4. Từ giờ mỗi lần bạn upload file lên GitHub, Cloudflare tự cập nhật web sau ~30 giây.
5. Sau khi chạy ổn, có thể tắt GitHub Pages của repo để khách không vào nhầm link cũ.

### Muốn tên miền riêng (VD `nanabiboo.shop`)

1. Mua tên miền (Mắt Bão, PA Việt Nam, Namecheap…).
2. Cloudflare Pages → project `nanabibooshop` → **Custom domains → Set up a custom domain** → làm theo hướng dẫn.

## Lưu ý

- `admin.html` nằm trên web nhưng **phải đăng nhập** bằng email admin mới sửa được. Người lạ mở cũng không làm gì được.
- Đừng ghi tên hay số điện thoại khách vào `data.js`, vì ai cũng xem được file này.
- Đường dẫn trực tiếp tới 1 bộ đồ: `…/#/do/NZK01`. Có thể gửi link này cho khách.
