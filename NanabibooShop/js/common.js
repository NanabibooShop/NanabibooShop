/* Hàm dùng chung cho trang khách (app.js) và trang quản lý (admin.js) */
(function () {
  const DAY = 86400000;
  const WEEKDAYS = ["Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"];

  // "2026-09-23" -> Date (00:00 giờ máy)
  function parse(s) {
    if (!s) return null;
    const [y, m, d] = String(s).split("-").map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  }
  // Date -> "2026-09-23"
  function iso(d) {
    const p = (n) => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  }
  function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function today() { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); }
  function diffDays(a, b) { return Math.round((b - a) / DAY); }
  function fmt(d) { const p = (n) => String(n).padStart(2, "0"); return p(d.getDate()) + "/" + p(d.getMonth() + 1); }
  function fmtFull(d) { return fmt(d) + "/" + d.getFullYear(); }
  function weekday(d) { return WEEKDAYS[d.getDay()]; }
  function money(n) { return (Number(n) || 0).toLocaleString("vi-VN") + "đ"; }
  function moneyShort(n) {
    n = Number(n) || 0;
    return n >= 1000 && n % 1000 === 0 ? (n / 1000).toLocaleString("vi-VN") + "K" : money(n);
  }

  /* ---------- 2 bảng giá: Fes (đi sự kiện) & Test (thử tại nhà) ----------
     Giá là giá cả lượt thuê theo bảng giá của shop (không nhân số ngày).
     Giá = 0 → hiện "Liên hệ". Dữ liệu cũ (price/deposit) được hiểu là giá Fes. */
  const PLANS = [
    { key: "fes", label: "Fes", desc: "Đi sự kiện, lễ hội" },
    { key: "test", label: "Test", desc: "Thử tại nhà, không mang ra ngoài" }
  ];
  function plans(c) {
    const pick = (a, b) => Number(a != null && a !== "" ? a : b) || 0;
    return [
      Object.assign({}, PLANS[0], { price: pick(c.priceFes, c.price), deposit: pick(c.depositFes, c.deposit) }),
      Object.assign({}, PLANS[1], { price: pick(c.priceTest, 0), deposit: pick(c.depositTest, 0) })
    ];
  }
  function priceLabel(n, short) { return Number(n) > 0 ? (short ? moneyShort(n) : money(n)) : "Liên hệ"; }

  /* ---------- Lịch thuê ----------
     - "freeFrom" / "freeTo": khoảng shop nhận đặt (freeTo để trống = không giới hạn).
     - "booked": các lượt đã có khách thuê [{from, to, note}] → khoá, khách khác không chọn trùng được.
     Khách chọn được ngày d khi: d ≥ hôm nay, d nằm trong khoảng nhận đặt và không thuộc lượt đã khoá. */
  const HORIZON = 730; // tìm tối đa 2 năm tới

  function freeWindow(costume) {
    const f = parse(costume.freeFrom);
    if (!f) return null;
    const t = today();
    const start = f < t ? t : f;
    const end = parse(costume.freeTo);
    if (end && end < start) return null;
    return { start, end: end || null };
  }

  // Lượt thuê chứa ngày d (hoặc null)
  function bookingOn(costume, d) {
    const t = d.getTime();
    for (const b of costume.booked || []) {
      const f = parse(b.from), e = parse(b.to || b.from);
      if (f && e && t >= f.getTime() && t <= e.getTime()) return b;
    }
    return null;
  }

  // Lượt giữ chỗ tạm (khách vừa bấm "Chốt thuê", đang chờ cọc) chứa ngày d
  function holdOn(costume, d) {
    const k = iso(d), now = Date.now();
    for (const h of costume._holds || []) if (h.expiresAt > now && k >= h.from && k <= h.to) return h;
    return null;
  }

  // Trạng thái 1 ngày: "free" | "booked" (đã có người thuê) | "held" (đang có khách giữ chỗ) | "closed" (ngoài lịch nhận đặt)
  function dayState(costume, d) {
    const w = freeWindow(costume);
    if (!w || d < w.start || (w.end && d > w.end)) return "closed";
    if (bookingOn(costume, d)) return "booked";
    return holdOn(costume, d) ? "held" : "free";
  }

  // Tình trạng tại ngày `on` (mặc định hôm nay):
  // free  → { state:"free", until }            (until = null nếu trống dài hạn)
  // busy  → { state:"busy", from, until }      (hôm đó có người thuê, trống lại từ `from`)
  // soon  → { state:"soon", from, until }      (chưa tới ngày nhận đặt)
  // none  → { state:"none" }
  function availability(costume, on) {
    on = on || today();
    const w = freeWindow(costume);
    if (!w) return { state: "none" };
    const runUntil = (d) => {
      let n = 0;
      while (n < HORIZON && dayState(costume, addDays(d, n + 1)) === "free") n++;
      return n >= HORIZON ? null : addDays(d, n);
    };
    const st = dayState(costume, on);
    if (st === "free") return { state: "free", until: runUntil(on) };
    for (let n = 1; n <= HORIZON; n++) {
      const d = addDays(on, n);
      if (w.end && d > w.end) break;
      if (dayState(costume, d) === "free")
        return { state: st === "booked" || st === "held" ? "busy" : "soon", held: st === "held", from: d, until: runUntil(d) };
    }
    return { state: "none" };
  }

  // Kiểm tra khoảng thuê [start, end]. Trả về null nếu ổn, hoặc lý do.
  function checkRange(costume, start, end) {
    if (end < start) return "Ngày trả phải sau ngày nhận.";
    if (start < today()) return "Ngày nhận đã qua rồi.";
    const w = freeWindow(costume);
    if (!w) return "Bộ này chưa có lịch trống. Nhắn shop để hỏi nhé.";
    if (start < w.start) return "Bộ này chỉ nhận đặt từ ngày " + fmt(w.start) + ".";
    if (w.end && end > w.end) return "Bộ này chỉ nhận đặt đến hết ngày " + fmt(w.end) + ".";
    for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
      if (bookingOn(costume, d)) return "Ngày " + fmt(d) + " đã có người thuê. Hãy chọn khoảng ngày khác.";
      if (holdOn(costume, d)) return "Ngày " + fmt(d) + " đang có khách giữ chỗ (chờ cọc). Chọn ngày khác hoặc thử lại sau ít phút.";
    }
    return null;
  }

  // Dùng riêng cho admin: ngày giặt ủi sau mỗi lượt (chỉ để ghi chú)
  function cleaningOn(costume, d, cleaningDays) {
    if (!cleaningDays) return false;
    const t = d.getTime();
    for (const b of costume.booked || []) {
      const e = parse(b.to || b.from);
      if (e && t > e.getTime() && t <= addDays(e, cleaningDays).getTime()) return true;
    }
    return false;
  }

  // "09/10/2026" -> "2026-10-09" (hoặc "" nếu sai)
  function vnToIso(s) {
    const m = String(s || "").trim().match(/^(\d{1,2})[\/\-. ](\d{1,2})[\/\-. ](\d{4})$/);
    if (!m) return "";
    const d = +m[1], mo = +m[2], y = +m[3];
    const dt = new Date(y, mo - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return "";
    return iso(dt);
  }
  // "2026-10-09" -> "09/10/2026"
  function isoToVn(s) { const d = parse(s); return d ? fmtFull(d) : ""; }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  /* ---------- Ảnh & clip ----------
     Mỗi mục trong "images" có thể là:
     - ảnh:  images/abc.jpg (.png .webp .svg …)
     - clip: images/abc.mp4 (.webm .mov .m4v)
     - link YouTube (kể cả Shorts) hoặc link TikTok dạng https://www.tiktok.com/@ten/video/123… */
  function media(src) {
    const s = String(src || "").trim();
    let m;
    if ((m = s.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/))([\w-]{11})/i))) {
      return { type: "youtube", src: s, id: m[1], vertical: /\/shorts\//i.test(s),
        thumb: "https://i.ytimg.com/vi/" + m[1] + "/hqdefault.jpg",
        embed: "https://www.youtube-nocookie.com/embed/" + m[1] + "?rel=0&playsinline=1" };
    }
    if ((m = s.match(/tiktok\.com\/.*\/video\/(\d+)/i))) {
      return { type: "tiktok", src: s, id: m[1], vertical: true, thumb: "", embed: "https://www.tiktok.com/embed/v2/" + m[1] };
    }
    if (/tiktok\.com\//i.test(s)) return { type: "tiktok-short", src: s, vertical: true, thumb: "", embed: "" };
    if (/\.(mp4|webm|mov|m4v|ogv)(?:[?#].*)?$/i.test(s)) return { type: "video", src: s, thumb: "" };
    return { type: "image", src: s, thumb: s };
  }
  const isImage = (src) => media(src).type === "image";

  // Ảnh thu nhỏ cho thẻ sản phẩm / danh sách admin. `url` dùng khi file chưa lưu (blob:)
  const PLAY = '<span class="play-badge" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg></span>';
  function thumbHtml(src, alt, opt) {
    opt = opt || {};
    const m = media(src);
    const url = opt.url || m.src;
    const lazy = opt.eager ? "" : ' loading="lazy"';
    const fallback = opt.fallback ? ` onerror="this.onerror=null;this.src='${opt.fallback}'"` : "";
    if (m.type === "video")
      return `<video src="${esc(url)}#t=0.1" muted playsinline loop preload="metadata" aria-label="${esc(alt)}" data-autoplay></video>${PLAY}`;
    if (m.type === "youtube")
      return `<img src="${esc(m.thumb)}" alt="${esc(alt)}"${lazy} decoding="async"${fallback}>${PLAY}`;
    if (m.type === "tiktok" || m.type === "tiktok-short")
      return `<span class="m-ph">TikTok</span>${PLAY}`;
    return `<img src="${esc(url || opt.fallback || "")}" alt="${esc(alt)}"${lazy} decoding="async"${fallback}>`;
  }

  window.NB = { media, isImage, thumbHtml, parse, iso, addDays, today, diffDays, fmt, fmtFull, weekday, money, moneyShort, plans, priceLabel, dayState, availability, checkRange, freeWindow, bookingOn, holdOn, cleaningOn, vnToIso, isoToVn, esc };

  /* ---------- Kho dữ liệu dùng chung ----------
     Mặc định lấy từ data.js. Nếu đã kết nối Firebase (js/db.js) thì dữ liệu được thay bằng bản trên mạng
     và tự cập nhật khi shop sửa lịch hoặc khi có khách giữ chỗ. */
  window.FILE_DATA = { shop: window.SHOP || {}, costumes: window.COSTUMES || [] };
  window.NBData = {
    shop: window.SHOP || {}, costumes: window.COSTUMES || [], holds: [],
    mode: "file", ready: false, api: null, _fns: [],
    on(fn) { this._fns.push(fn); if (this.ready) fn(this); },
    set(patch) { Object.assign(this, patch); if (this.ready) this._fns.forEach((f) => { try { f(this); } catch (e) { console.error(e); } }); },
    // Bộ đồ kèm các lượt giữ chỗ còn hiệu lực
    withHolds() {
      const now = Date.now();
      const act = (this.holds || []).filter((h) => h.expiresAt > now);
      return (this.costumes || []).map((c) => Object.assign({}, c, { _holds: act.filter((h) => h.costumeId === c.id) }));
    }
  };
})();
