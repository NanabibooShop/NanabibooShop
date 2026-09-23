# NanabibooShop — web cho thuê đồ cosplay

## Các file trong thư mục

| File | Dùng để |
|---|---|
| `index.html` | Trang khách xem (trang chủ + chi tiết bộ đồ) |
| `admin.html` | Trang quản lý của bạn: thêm/sửa đồ, ảnh, lịch thuê |
| `data.js` | **Toàn bộ dữ liệu shop** (admin.html tự ghi file này) |
| `images/` | Ảnh sản phẩm |
| `css/`, `js/` | Giao diện và code — không cần sửa |

Ảnh trong `images/` hiện là **ảnh mẫu**, thay bằng ảnh thật của shop.

## Cập nhật đồ / lịch thuê (hằng ngày)

1. Mở `admin.html` bằng **Chrome hoặc Edge** trên máy tính (nháy đúp file là được).
2. Sửa trong form:
   - **+ Thêm đồ**: tạo bộ mới. Mã bộ đồ (VD `NZK01`) không được trùng.
   - **Ảnh**: bấm "Chọn ảnh từ máy" hoặc kéo thả. Ảnh đầu tiên là ảnh chính. Nên dùng ảnh dọc 4:5, dưới 500KB.
   - **Lịch thuê** (ngày viết kiểu Việt Nam: ngày/tháng/năm, VD `09/10/2026`):
     - **Nhận đặt từ ngày / Đến ngày**: khoảng shop nhận đặt bộ này ("Đến ngày" để trống = không giới hạn).
     - **Khoá lịch**: bấm ngày nhận rồi ngày trả trên lịch để khoá một lượt đã có khách (VD khách A 05/09–10/09, khách B 20/10–25/10).
       Khách khác không chọn được ngày đã khoá nhưng vẫn chọn được những ngày ở giữa. Bấm ✕ ở lượt đó để mở khoá.
   - Tab **Thông tin shop**: tên shop, link Messenger, số ngày giặt ủi, hướng dẫn, quy định.
3. Bấm **Lưu** → **Chọn thư mục & lưu** → chọn thư mục `D:\NanabibooShop`.
   Trang sẽ tự ghi đè `data.js` và chép ảnh mới vào `images/`.
4. Đưa lên mạng: vào repo trên GitHub → Add file → Upload files → kéo `data.js` vào → Commit changes. Khoảng 1 phút sau web cập nhật.

> Khách chỉ chọn được ngày trong khoảng nhận đặt và không trùng lượt đã khoá. Số ngày giặt ủi chỉ để tô màu vàng trên lịch admin, không khoá ngày.

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

## Đưa web lên mạng miễn phí (GitHub Pages)

1. Tạo organization trên GitHub tên **nanabibooshop** (như cách bạn làm với `arambuilder`).
2. Tạo repo tên **nanabibooshop.github.io** trong organization đó, đẩy toàn bộ thư mục này lên.
3. Repo → Settings → Pages → Source: *Deploy from a branch* → `main` / `root`.
4. Web chạy tại `https://nanabibooshop.github.io/`.

### Muốn tên miền riêng (VD `nanabiboo.shop`)

1. Mua tên miền (Mắt Bão, PA Việt Nam, Namecheap…).
2. Repo → Settings → Pages → **Custom domain** → nhập tên miền → bật *Enforce HTTPS*.
3. Ở trang quản lý tên miền, thêm DNS theo hướng dẫn của GitHub Pages
   (4 bản ghi `A` trỏ về IP của GitHub, và `CNAME` cho `www` → `nanabibooshop.github.io`).

## Lưu ý

- `admin.html` cũng nằm trên web nhưng **không sửa được gì trên mạng**. Nó chỉ ghi được file trên máy bạn, nên người lạ mở cũng không làm hỏng dữ liệu.
- Đừng ghi tên hay số điện thoại khách vào `data.js`, vì ai cũng xem được file này.
- Đường dẫn trực tiếp tới 1 bộ đồ: `…/#/do/NZK01`. Có thể gửi link này cho khách.
