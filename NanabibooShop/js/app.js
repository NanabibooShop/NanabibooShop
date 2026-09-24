/* NanabibooShop — trang dành cho khách */
(function () {
  let SHOP = {};
  let ALL = [];
  const MYHOLD_KEY = "nb-myholds";
  const $ = (s, el = document) => el.querySelector(s);
  const { media, isImage, thumbHtml, esc, fmt, fmtFull, weekday, money, moneyShort, parse, iso, addDays, today, diffDays } = window.NB;

  const app = $("#app");
  const PLACEHOLDER = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 100"><rect width="80" height="100" fill="#DDD6EA"/><path d="M40 34c0-5 7-5 7 0 0 3-7 4-7 8L20 56h40L40 42" fill="none" stroke="#8C849D" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>');

  const ICON = {
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="m20 20-3.5-3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    cal: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3.5 10h17M8 3v4m8-4v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    hanger: '<svg viewBox="0 0 48 32" aria-hidden="true"><path d="M24 9c0-4 6-4 6 0 0 3-6 3.5-6 7L4 28h40L24 16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  /* ---------- Tiện ích ---------- */
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove("show"), 2600);
  }
  function img(src, alt, eager) {
    return `<img src="${esc(src || PLACEHOLDER)}" alt="${esc(alt)}" ${eager ? "" : 'loading="lazy"'} decoding="async" onerror="this.onerror=null;this.src='${PLACEHOLDER}'">`;
  }
  function statusOf(c, on) {
    const ref = on || today();
    const isToday = !on || +on === +today();
    const a = window.NB.availability(c, ref);
    const till = (u) => u ? " đến hết " + fmt(u) : "";
    if (a.state === "free") return {
      cls: "free",
      label: isToday ? "Trống hôm nay" : "Trống ngày " + fmt(ref),
      note: a.until ? "Còn trống" + till(a.until) : "Đặt được từ " + (isToday ? "hôm nay" : fmt(ref)),
      a
    };
    if (a.state === "busy") return {
      cls: "busy",
      label: a.held ? (isToday ? "Đang có khách giữ chỗ" : "Có khách giữ chỗ " + fmt(ref)) : (isToday ? "Đang có người thuê" : "Đã có người thuê " + fmt(ref)),
      note: "Trống lại từ " + weekday(a.from) + ", " + fmt(a.from) + till(a.until),
      a
    };
    if (a.state === "soon") return {
      cls: "soon",
      label: "Trống từ " + fmt(a.from),
      note: "Đặt được từ " + weekday(a.from) + ", " + fmt(a.from) + till(a.until),
      a
    };
    return { cls: "none", label: "Chưa có lịch trống", note: "Nhắn shop để hỏi lịch", a };
  }

  /* ---------- Giao diện sáng/tối ---------- */
  (function theme() {
    const root = document.documentElement;
    let saved = null;
    try { saved = localStorage.getItem("nb-theme"); } catch (e) {}
    if (saved) root.dataset.theme = saved;
    const isDark = () => root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    const sync = () => { if (!root.dataset.theme) root.dataset.theme = isDark() ? "dark" : "light"; };
    sync();
    $("#themeBtn").addEventListener("click", () => {
      root.dataset.theme = isDark() ? "light" : "dark";
      try { localStorage.setItem("nb-theme", root.dataset.theme); } catch (e) {}
    });
  })();

  const topbar = $(".topbar");
  addEventListener("scroll", () => topbar.classList.toggle("is-scrolled", scrollY > 4), { passive: true });

  /* ---------- Dữ liệu (data.js hoặc Firebase thời gian thực) ---------- */
  function myHolds() {
    let list = [];
    try { list = JSON.parse(localStorage.getItem(MYHOLD_KEY) || "[]"); } catch (e) {}
    return list.filter((h) => h && h.expiresAt > Date.now());
  }
  function saveMyHold(h) {
    const list = myHolds().filter((x) => x.code !== h.code);
    list.push(h);
    try { localStorage.setItem(MYHOLD_KEY, JSON.stringify(list)); } catch (e) {}
  }
  function findMyHold(costumeId, from, to) {
    return myHolds().find((h) => h.costumeId === costumeId && (!from || (h.from === from && h.to === to)));
  }
  let pendingHold = null;   // đang tạo giữ chỗ (chưa biết mã) → không tính là "người khác giữ"
  function applyData(D) {
    SHOP = D.shop || {};
    const mine = new Set(myHolds().map((h) => h.code));
    const p = pendingHold;
    const isMine = (h) => mine.has(h.code) || (p && h.costumeId === p.costumeId && h.from === p.from && h.to === p.to);
    ALL = D.withHolds().filter((c) => !c.hidden).map((c) => Object.assign(c, { _holds: c._holds.filter((h) => !isMine(h)) }));
  }
  const isLive = () => window.NBData.mode === "firebase" && !!window.NBData.api;
  const hhmm = (ms) => new Date(ms).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

  /* ---------- Footer ---------- */
  function renderChrome() {
  $("#brandName").textContent = SHOP.name || "NanabibooShop";
  $("#rulesTopBtn").hidden = !parsePolicy().count;
  $("#footer").innerHTML = `
    <b>${esc(SHOP.name || "NanabibooShop")}</b>
    <span>${esc(SHOP.tagline || "")}${SHOP.address ? " · " + esc(SHOP.address) : ""}</span>
    <span>
      ${SHOP.messenger ? `<a href="${esc(SHOP.messenger)}" target="_blank" rel="noopener">Nhắn Messenger</a>` : ""}
      ${SHOP.facebook ? ` · <a href="${esc(SHOP.facebook)}" target="_blank" rel="noopener">Trang Facebook</a>` : ""}
      ${SHOP.phone ? ` · SĐT: <b>${esc(SHOP.phone)}</b>` : ""}
    </span>`;
  }

  /* =========================================================
     TRANG CHỦ
     ========================================================= */
  const home = { q: "", cat: "Tất cả", date: "", onlyFree: false, scroll: 0 };

  function renderHome() {
    document.title = SHOP.name || "NanabibooShop";
    document.body.classList.remove("has-dock");
    const cats = ["Tất cả", ...new Set(ALL.map((c) => c.category).filter(Boolean))];
    const steps = (SHOP.howTo || []).map((s) => `<li>${esc(s)}</li>`).join("");

    const R = parsePolicy();
    const intro = R.sections[0] && !R.sections[0].title ? R.sections[0].items[0] : null;
    app.innerHTML = `
      ${R.count ? `
      <section class="rules view-enter" aria-labelledby="rulesH">
        <div class="rules__head">
          <svg class="rules__pin" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 3l6 6-3 1-4 4 1 4-2 2-4-4-5 5-1-1 5-5-4-4 2-2 4 1 4-4z" fill="currentColor"/></svg>
          <h2 id="rulesH">Luật thuê của shop</h2>
          <button class="rules__open" type="button" data-rules="">Đọc toàn bộ ${R.count} điều <span aria-hidden="true">→</span></button>
        </div>
        ${intro ? `<p class="rules__intro">${intro.html}</p>` : ""}
        ${R.sections.filter((x) => x.title).length ? `<div class="rules__chips">${R.sections.map((x, i) => x.title ? `<button class="rules__chip" type="button" data-rules="${i}">${esc(x.title)} <small>${x.items.length}</small></button>` : "").join("")}</div>` : ""}
      </section>` : ""}
      <section class="hero view-enter">
        <h1>Welcome to NanabibooShop <em></em>.</h1>
        ${steps ? `<div class="howto"><p class="howto__title">Cách thuê đồ</p><ol>${steps}</ol></div>` : ""}
      </section>

      <section class="filters" aria-label="Tìm và lọc">
        <div class="search">${ICON.search}
          <label class="sr-only" for="q">Tìm bộ đồ</label>
          <input id="q" type="search" placeholder="Tìm tên nhân vật, anime, game…" value="${esc(home.q)}" autocomplete="off">
        </div>
        <div class="filter-row" role="toolbar" aria-label="Bộ lọc">
          <label class="chip chip--date ${home.date ? "is-set" : ""}" id="dateChip">
            ${ICON.cal}<span id="dateLbl">${home.date ? "Cần ngày " + fmt(parse(home.date)) : "Cần đồ ngày nào?"}</span>
            <input id="needDate" type="date" min="${iso(today())}" value="${esc(home.date)}" aria-label="Chọn ngày bạn cần đồ">
            <span class="chip__x" id="dateClear" role="button" aria-label="Bỏ chọn ngày">✕</span>
          </label>
          <button class="chip" type="button" id="onlyFree" aria-pressed="${home.onlyFree}">Chỉ đồ còn trống</button>
          ${cats.map((c) => `<button class="chip" type="button" data-cat="${esc(c)}" aria-pressed="${home.cat === c}">${esc(c)}</button>`).join("")}
        </div>
      </section>

      <div class="list-meta"><span id="count"></span><span id="refNote"></span></div>
      <section class="grid" id="grid" aria-live="polite"></section>
    `;

    app.querySelectorAll("[data-rules]").forEach((btn) => btn.addEventListener("click", () => openRules(btn.dataset.rules)));
    $("#q").addEventListener("input", (e) => { home.q = e.target.value; drawGrid(); });
    $("#needDate").addEventListener("click", (e) => { try { e.target.showPicker && e.target.showPicker(); } catch (err) {} });
    $("#needDate").addEventListener("change", (e) => { home.date = e.target.value; syncDateChip(); drawGrid(); });
    $("#dateClear").addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); home.date = ""; $("#needDate").value = ""; syncDateChip(); drawGrid(); });
    $("#onlyFree").addEventListener("click", (e) => { home.onlyFree = !home.onlyFree; e.currentTarget.setAttribute("aria-pressed", home.onlyFree); drawGrid(); });
    app.querySelectorAll("[data-cat]").forEach((b) => b.addEventListener("click", () => {
      home.cat = b.dataset.cat;
      app.querySelectorAll("[data-cat]").forEach((x) => x.setAttribute("aria-pressed", x === b));
      drawGrid();
    }));
    drawGrid();
  }

  /* ---------- Luật thuê ----------
     Mỗi dòng trong ô "Luật thuê" là một điều.
     Dòng tiêu đề nhóm: bắt đầu bằng "#" hoặc 👉, hoặc VIẾT HOA và kết thúc bằng dấu ":". */
  const EMOJI_RE = /^((?:\p{Extended_Pictographic}|\p{Regional_Indicator})(?:️|‍(?:\p{Extended_Pictographic}))*)\s*/u;
  const KEEP_UPPER = new Set(["STK", "CCCD", "FB", "UT", "MVD", "CK", "TK", "SĐT"]);
  function niceCase(t) {
    const letters = t.replace(/[^\p{L}]/gu, "");
    const upper = letters.replace(/[^\p{Lu}]/gu, "");
    if (letters.length < 4 || upper.length / letters.length < 0.7) return t;
    const low = t.split(/(\s+)/).map((w) => KEEP_UPPER.has(w.replace(/[^\p{L}]/gu, "")) ? w : w.toLocaleLowerCase("vi")).join("");
    return low.replace(/\p{L}/u, (c) => c.toLocaleUpperCase("vi"));
  }
  function linkify(text) {
    return esc(text).replace(/https?:\/\/[^\s<]+/g, (u) => {
      let label = u.replace(/^https?:\/\/(www\.|m\.)?/, "").replace(/[?#].*$/, "");
      if (label.length > 38) label = label.slice(0, 36) + "…";
      return `<a href="${u}" target="_blank" rel="noopener">${label}</a>`;
    });
  }
  function parsePolicy() {
    const raw = String(SHOP.policy || "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
    const sections = [];
    let cur = { title: "", items: [] };
    let count = 0;
    for (let line of raw) {
      const m = line.match(EMOJI_RE);
      const emoji = m ? m[1] : "";
      let text = (m ? line.slice(m[0].length) : line).replace(/^[#+\-*•·]+\s*/, "").trim();
      const letters = text.replace(/[^\p{L}]/gu, "");
      const upperRatio = letters ? letters.replace(/[^\p{Lu}]/gu, "").length / letters.length : 0;
      const isHead = /^#/.test(line) || (/:\s*$/.test(text) && (emoji === "👉" || upperRatio > 0.7) && text.length < 70);
      if (isHead) {
        if (cur.items.length || cur.title) sections.push(cur);
        cur = { title: niceCase(text.replace(/[:*\s]+$/, "").replace(/^\*+/, "").trim()), items: [] };
        continue;
      }
      if (!text) continue;
      const acct = (text.match(/\b\d{8,}\b/) || [])[0] || "";
      cur.items.push({ emoji, html: linkify(text), acct });
      count++;
    }
    if (cur.items.length || cur.title) sections.push(cur);
    return { sections, count };
  }

  const rulesSheet = $("#rulesSheet");
  function openRules(idx) {
    const R = parsePolicy();
    $("#rulesNav").innerHTML = R.sections.length > 1 ? R.sections.map((x, i) => `<button type="button" class="rules__chip" data-go="${i}">${esc(x.title || "Thông tin chung")}</button>`).join("") : "";
    $("#rulesBody").innerHTML = R.sections.map((x, i) => `
      <section class="rsec" id="rsec${i}">
        ${R.sections.length > 1 ? `<h3>${esc(x.title || "Thông tin chung")}</h3>` : ""}
        <ul>${x.items.map((it) => `<li><span class="rsec__b" aria-hidden="true">${it.emoji || "•"}</span><span>${it.html}${it.acct ? ` <button type="button" class="rsec__copy" data-acct="${it.acct}">Sao chép STK</button>` : ""}</span></li>`).join("")}</ul>
      </section>`).join("");
    rulesSheet.showModal();
    const body = $("#rulesBody");
    body.scrollTop = 0;
    const go = (i) => { const t = $("#rsec" + i); if (t) body.scrollTo({ top: t.offsetTop - body.offsetTop - 4, behavior: "smooth" }); };
    $("#rulesNav").querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => go(b.dataset.go)));
    body.querySelectorAll("[data-acct]").forEach((b) => b.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(b.dataset.acct); toast("Đã sao chép số tài khoản " + b.dataset.acct); }
      catch (e) { toast("Số tài khoản: " + b.dataset.acct); }
    }));
    if (idx !== "" && idx != null) requestAnimationFrame(() => go(idx));
  }
  rulesSheet.addEventListener("click", (e) => {
    const r = rulesSheet.getBoundingClientRect();
    if (e.clientY < r.top || e.clientY > r.bottom || e.clientX < r.left || e.clientX > r.right) rulesSheet.close();
  });
  $("#rulesTopBtn").addEventListener("click", () => openRules(""));
  document.addEventListener("click", (e) => { const a = e.target.closest("[data-open-rules]"); if (a) { e.preventDefault(); openRules(""); } });

  function syncDateChip() {
    $("#dateChip").classList.toggle("is-set", !!home.date);
    $("#dateLbl").textContent = home.date ? "Cần ngày " + fmt(parse(home.date)) : "Cần đồ ngày nào?";
  }

  function norm(s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d"); }

  function drawGrid() {
    const ref = home.date ? parse(home.date) : null;
    const q = norm(home.q.trim());
    const list = ALL.map((c) => ({ c, s: statusOf(c, ref) })).filter(({ c, s }) => {
      if (home.cat !== "Tất cả" && c.category !== home.cat) return false;
      if (home.onlyFree && s.cls !== "free") return false;
      if (q && !norm([c.name, c.series, c.category, c.id].join(" ")).includes(q)) return false;
      return true;
    });
    if (ref || home.onlyFree) list.sort((x, y) => (x.s.cls === "free" ? 0 : 1) - (y.s.cls === "free" ? 0 : 1));

    $("#count").innerHTML = `<b>${list.length}</b> bộ đồ`;
    $("#refNote").innerHTML = ref ? esc("Tình trạng ngày " + weekday(ref) + ", " + fmt(ref)) : (isLive() ? '<span class="live-dot">Lịch cập nhật trực tiếp</span>' : "");

    const grid = $("#grid");
    if (!list.length) {
      grid.innerHTML = `<div class="empty" style="grid-column:1/-1">${ICON.hanger}<p>Không có bộ đồ nào khớp. Thử bỏ bớt bộ lọc hoặc chọn ngày khác nhé.</p></div>`;
      return;
    }
    grid.innerHTML = list.map(({ c, s }, i) => `
      <a class="card" href="#/do/${encodeURIComponent(c.id)}" style="--i:${i}">
        <div class="card__img">${(c.images || [])[0] ? thumbHtml(c.images[0], c.name, { fallback: PLACEHOLDER }) : img("", c.name)}</div>
        <div class="card__body">
          <span class="eyebrow">${esc(c.series)}</span>
          <h2 class="card__name">${esc(c.name)}</h2>
          <div class="card__meta"><span class="size">Size ${esc(c.size || "—")}</span><span>${esc(c.category || "")}</span></div>
          <div class="card__foot">
            <span class="status status--${s.cls}">${esc(s.label)}</span>
            <span class="card__meta">${esc(s.note)}</span>
            <span class="pricetag">${moneyShort(c.price)}<small>/ngày</small></span>
          </div>
        </div>
      </a>`).join("");
    watchVideos(grid);
  }

  // Clip trong thẻ: tự chạy (tắt tiếng) khi lướt tới, dừng khi lướt qua
  const calm = matchMedia("(prefers-reduced-motion: reduce)").matches || (navigator.connection && navigator.connection.saveData);
  const vio = "IntersectionObserver" in window ? new IntersectionObserver((ents) => {
    ents.forEach((e) => {
      const v = e.target;
      if (e.isIntersecting && !calm) { const p = v.play(); p && p.catch(() => {}); } else v.pause();
    });
  }, { threshold: 0.6 }) : null;
  function watchVideos(root) {
    root.querySelectorAll("video[data-autoplay]").forEach((v) => { v.muted = true; vio && vio.observe(v); });
  }

  /* =========================================================
     TRANG CHI TIẾT
     ========================================================= */
  let cur = null; // { c, month: Date(1st), start, end, picking }

  function renderDetail(id) {
    const c = ALL.find((x) => String(x.id) === id);
    if (!c) {
      document.body.classList.remove("has-dock");
      app.innerHTML = `<a class="back" href="#/">${ICON.back} Tất cả đồ</a><div class="empty">${ICON.hanger}<p>Bộ đồ này không còn trên trang. Quay lại xem các bộ khác nhé.</p></div>`;
      return;
    }
    const t0 = today();
    const win = window.NB.freeWindow(c);
    const av0 = window.NB.availability(c);
    const m0 = av0.state === "free" ? t0 : av0.from || (win ? win.start : t0);
    cur = { c, win, month: new Date(m0.getFullYear(), m0.getMonth(), 1), start: null, end: null, picking: false };
    // Khách đang giữ chỗ bộ này → chọn sẵn đúng khoảng đã giữ
    const mh = findMyHold(c.id);
    if (mh) { cur.start = parse(mh.from); cur.end = parse(mh.to); cur.picking = false; cur.month = new Date(cur.start.getFullYear(), cur.start.getMonth(), 1); }
    // Nếu khách đã chọn "cần đồ ngày" ở trang chủ và ngày đó trống, chọn sẵn
    else if (home.date) {
      const d = parse(home.date);
      if (d && !window.NB.checkRange(c, d, d)) { cur.start = d; cur.end = d; cur.picking = true; cur.month = new Date(d.getFullYear(), d.getMonth(), 1); }
    }

    document.title = c.name + " · " + (SHOP.name || "NanabibooShop");
    document.body.classList.add("has-dock");
    const s = statusOf(c);
    const all = c.images && c.images.length ? c.images : [""];
    const photos = all.filter(isImage);            // danh sách ảnh cho chế độ xem lớn
    const first = media(all[0]);
    const embedFirst = /youtube|tiktok/.test(first.type);
    const rest = embedFirst ? all : all.slice(1);  // clip YouTube/TikTok đầu tiên được phát ở phần dưới
    const hasClip = all.some((x) => !isImage(x));
    const coverHtml = first.type === "image"
      ? `<button class="d-cover" type="button" data-img="${photos.indexOf(all[0])}" aria-label="Xem ảnh lớn">${img(all[0], c.name, true)}</button>`
      : first.type === "video"
        ? `<div class="d-cover is-video"><video src="${esc(first.src)}" autoplay muted loop playsinline controls preload="metadata" aria-label="Clip ${esc(c.name)}"></video></div>`
        : `<button class="d-cover" type="button" data-jump="m0" aria-label="Xem clip">${thumbHtml(all[0], c.name, { eager: true, fallback: PLACEHOLDER })}</button>`;
    const galleryHtml = rest.map((src, i) => {
      const m = media(src);
      const n = embedFirst ? i : i + 1;
      if (m.type === "image")
        return `<button class="gallery__item" type="button" data-img="${photos.indexOf(src)}" aria-label="Xem ảnh lớn">${img(src, c.name + " – ảnh " + (n + 1))}</button>`;
      if (m.type === "video")
        return `<div class="gallery__item is-wide is-video" id="m${n}"><video src="${esc(m.src)}#t=0.1" controls playsinline preload="metadata" aria-label="Clip ${esc(c.name)}"></video></div>`;
      if (m.embed)
        return `<div class="gallery__item is-wide is-embed is-${m.type} ${m.vertical ? "is-vertical" : "is-landscape"}" id="m${n}"><iframe src="${esc(m.embed)}" title="Clip ${esc(c.name)}" loading="lazy" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>`;
      return `<a class="gallery__item is-wide is-link" id="m${n}" href="${esc(m.src)}" target="_blank" rel="noopener">${thumbHtml(src, c.name)}<span>Xem clip trên TikTok</span></a>`;
    }).join("");

    app.innerHTML = `
      <a class="back" href="#/">${ICON.back} Tất cả đồ</a>
      <article class="detail">
        <div class="d-left">
          <div class="d-top">
            ${coverHtml}
            <div class="d-info">
              <span class="eyebrow">${esc(c.series)}</span>
              <h1>${esc(c.name)}</h1>
              <span class="d-code">MÃ ${esc(c.id)} · ${esc(c.category || "")}</span>
              <div class="d-price"><span class="pricetag">${moneyShort(c.price)}<small>/ngày</small></span></div>
              <span class="d-deposit">Cọc: <b>${money(c.deposit)}</b></span>
              <span class="size" style="align-self:flex-start">Size ${esc(c.size || "—")}</span>
            </div>
          </div>

          <div class="avail avail--${s.cls}" id="availBox">
            <span class="avail__big">${esc(s.label)}</span>
            <span class="avail__small">${esc(s.note)}</span>
          </div>

          <section class="panel" aria-labelledby="infoH">
            <h2 id="infoH">Thông tin bộ đồ</h2>
            <dl class="specs">
              <div><dt>Size</dt><dd>${esc(c.size || "—")}${c.fit ? " · " + esc(c.fit) : ""}</dd></div>
              <div><dt>Gồm có</dt><dd><div class="includes">${(c.includes || []).map((x) => `<span>${esc(x)}</span>`).join("") || "—"}</div></dd></div>
              ${c.description ? `<div><dt>Ghi chú</dt><dd>${esc(c.description)}</dd></div>` : ""}
              <div><dt>Giá thuê</dt><dd>${money(c.price)} / ngày · cọc ${money(c.deposit)}</dd></div>
            </dl>
          </section>

          ${rest.length ? `
          <section class="gallery" aria-labelledby="galH">
            <h2 id="galH">${hasClip ? "Ảnh & clip chi tiết" : "Ảnh chi tiết"}</h2>
            <div class="gallery__list ${rest.filter(isImage).length === 1 ? "is-single" : ""}">
              ${galleryHtml}
            </div>
          </section>` : ""}
        </div>

        <div class="d-right">
          <section class="panel" id="bookPanel" aria-labelledby="calH">
            <h2 id="calH">Lịch thuê & chốt đồ</h2>
            <p class="panel__sub">${win
              ? `Ô xanh là ngày còn trống, ô gạch là đã có người thuê hoặc đang có khách giữ chỗ. Chạm ngày <b>nhận đồ</b>, rồi chạm ngày <b>trả đồ</b>.${isLive() ? ` Lịch cập nhật trực tiếp.` : ""}`
              : `Bộ này chưa có lịch trống. Nhắn shop qua Messenger để hỏi lịch nhé.`}</p>
            <div class="cal" id="cal"></div>
            <div class="legend">
              <span><i class="lg-free"></i>Còn trống</span>
              <span><i class="lg-booked"></i>Đã có người thuê</span>
              ${isLive() ? `<span><i class="lg-held"></i>Đang giữ chỗ</span>` : ""}
              <span><i class="lg-closed"></i>Chưa nhận đặt</span>
              <span><i class="lg-pick"></i>Bạn chọn</span>
            </div>
            <div class="pick">
              <div class="pick__box" id="pbStart"><span class="pick__lbl">Ngày nhận</span><span class="pick__val" id="pvStart">—</span></div>
              <div class="pick__box" id="pbEnd"><span class="pick__lbl">Ngày trả</span><span class="pick__val" id="pvEnd">—</span></div>
            </div>
            <div class="fields2">
              <div class="field"><label for="fName">Tên của bạn</label><input id="fName" autocomplete="name" placeholder="VD: Minh Anh"></div>
              <div class="field"><label for="fPhone">Số điện thoại</label><input id="fPhone" type="tel" inputmode="tel" autocomplete="tel" placeholder="VD: 09xx xxx xxx"></div>
            </div>
            <div class="field"><label for="fNote">Ghi chú cho shop (không bắt buộc)</label><textarea id="fNote" rows="2" placeholder="VD: nhận đồ tại shop buổi chiều, cần thêm lens…"></textarea></div>
            <div class="summary" id="summary" hidden></div>
            <p class="hint" id="hint"></p>
            <button class="btn btn--primary btn--block" type="button" id="bookBtn" disabled>Chốt thuê</button>
          </section>
        </div>
      </article>

      <div class="dock" id="dock">
        <div class="dock__txt" id="dockTxt"></div>
        <button class="btn btn--primary" type="button" id="dockBtn">Chốt thuê</button>
      </div>
    `;

    app.querySelectorAll("[data-img]").forEach((b) => b.addEventListener("click", () => openLightbox(photos, +b.dataset.img)));
    app.querySelectorAll("[data-jump]").forEach((b) => b.addEventListener("click", () => {
      const t = document.getElementById(b.dataset.jump); t && t.scrollIntoView({ behavior: "smooth", block: "center" });
    }));
    $("#bookBtn").addEventListener("click", openBooking);
    $("#dockBtn").addEventListener("click", () => {
      if (!cur.start) {
        $("#bookPanel").scrollIntoView({ behavior: "smooth", block: "start" });
        toast(cur.win ? "Chọn ngày nhận đồ trên lịch nhé" : "Bộ này chưa có lịch trống — nhắn shop để hỏi nhé");
      } else openBooking();
    });
    drawCal();
    drawPick();
  }

  function drawCal() {
    const { c, month } = cur;
    const t0 = today();
    const minMonth = new Date(t0.getFullYear(), t0.getMonth(), 1);
    const maxMonth = new Date(t0.getFullYear(), t0.getMonth() + 11, 1);
    const title = month.toLocaleDateString("vi-VN", { month: "long", year: "numeric" });
    const lead = (month.getDay() + 6) % 7; // Thứ Hai đầu tuần
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    let cells = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((w) => `<span class="cal__wd">${w}</span>`).join("");
    for (let i = 0; i < lead; i++) cells += "<span></span>";
    for (let n = 1; n <= days; n++) {
      const d = new Date(month.getFullYear(), month.getMonth(), n);
      const st = window.NB.dayState(c, d);
      const past = d < t0;
      const cls = ["day"];
      if (past) cls.push("is-past");
      else cls.push(st === "free" ? "is-free" : st === "booked" ? "is-booked" : st === "held" ? "is-held" : "is-closed");
      if (+d === +t0) cls.push("is-today");
      if (cur.start && cur.end && d >= cur.start && d <= cur.end) {
        cls.push("is-in");
        if (+d === +cur.start) cls.push("is-start");
        if (+d === +cur.end) cls.push("is-end");
      }
      const dis = past || st !== "free";
      const label = `${weekday(d)} ${fmtFull(d)}${past ? "" : st === "free" ? " – còn trống" : st === "booked" ? " – đã có người thuê" : st === "held" ? " – đang có khách giữ chỗ" : " – chưa nhận đặt"}`;
      cells += `<button type="button" class="${cls.join(" ")}" data-d="${iso(d)}" ${dis ? "disabled" : ""} aria-label="${label}">${n}</button>`;
    }
    $("#cal").innerHTML = `
      <div class="cal__head">
        <span class="cal__month">${esc(title)}</span>
        <div class="cal__nav">
          <button class="icon-btn" type="button" id="calPrev" aria-label="Tháng trước" ${+month <= +minMonth ? "disabled" : ""}>${ICON.left}</button>
          <button class="icon-btn" type="button" id="calNext" aria-label="Tháng sau" ${+month >= +maxMonth ? "disabled" : ""}>${ICON.right}</button>
        </div>
      </div>
      <div class="cal__grid">${cells}</div>`;
    $("#calPrev").addEventListener("click", () => { cur.month = new Date(month.getFullYear(), month.getMonth() - 1, 1); drawCal(); });
    $("#calNext").addEventListener("click", () => { cur.month = new Date(month.getFullYear(), month.getMonth() + 1, 1); drawCal(); });
    $("#cal").querySelectorAll(".day:not([disabled])").forEach((b) => b.addEventListener("click", () => pickDay(parse(b.dataset.d))));
  }

  function pickDay(d) {
    const c = cur.c;
    if (cur.picking && cur.start && d > cur.start) {
      const err = window.NB.checkRange(c, cur.start, d);
      if (err) { toast(err); return; }
      cur.end = d; cur.picking = false;
    } else {
      const err = window.NB.checkRange(c, d, d);
      if (err) { toast(err); return; }
      cur.start = d; cur.end = d; cur.picking = true;
    }
    drawCal();
    drawPick();
  }

  function drawPick() {
    const { c, start, end, picking } = cur;
    $("#pbStart").classList.toggle("is-active", !start);
    $("#pbEnd").classList.toggle("is-active", !!start && picking);
    $("#pvStart").innerHTML = start ? `${fmt(start)}<small>${weekday(start)}</small>` : "—";
    $("#pvEnd").innerHTML = end ? `${fmt(end)}<small>${weekday(end)}</small>` : "—";
    const hint = $("#hint");
    const sum = $("#summary");
    if (!start) {
      hint.textContent = cur.win ? "Chưa chọn ngày. Chỉ chọn được các ô màu xanh." : "Hiện chưa đặt được bộ này.";
      sum.hidden = true;
      $("#bookBtn").disabled = true;
      $("#dockTxt").innerHTML = `<b>${moneyShort(c.price)}/ngày</b>${cur.win ? "Chọn ngày để chốt thuê" : "Chưa có lịch trống"}`;
      return;
    }
    const n = diffDays(start, end) + 1;
    const total = n * (Number(c.price) || 0);
    const mh = findMyHold(c.id, iso(start), iso(end));
    hint.textContent = mh ? `Bạn đang giữ chỗ các ngày này đến ${hhmm(mh.expiresAt)} (mã ${mh.code}). Bấm "Chốt thuê" để mở lại tin nhắn.`
      : picking ? (n === 1 ? "Thuê 1 ngày. Muốn thuê thêm thì chạm vào ngày trả đồ." : "Có thể chạm ngày khác để đổi ngày trả.") : "Chạm vào lịch để chọn lại từ đầu.";
    sum.hidden = false;
    sum.innerHTML = `
      <div><span>${money(c.price)} × ${n} ngày</span><b>${money(total)}</b></div>
      <div><span>Tiền cọc (hoàn lại khi trả đồ)</span><b>${money(c.deposit)}</b></div>
      <div class="total"><span>Tạm tính tiền thuê</span><b>${money(total)}</b></div>`;
    $("#bookBtn").disabled = false;
    $("#dockTxt").innerHTML = `<b>${money(total)}</b>${fmt(start)}${n > 1 ? " → " + fmt(end) : ""} · ${n} ngày`;
  }

  function buildMessage(hold) {
    const { c, start, end } = cur;
    const n = diffDays(start, end) + 1;
    const name = $("#fName").value.trim();
    const phone = $("#fPhone").value.trim();
    const note = $("#fNote").value.trim();
    const lines = [
      `Chào ${SHOP.name || "shop"}! Mình muốn thuê đồ ạ:`,
      `• Bộ đồ: ${c.name} (${c.series})`,
      `• Mã: ${c.id} · Size ${c.size || "-"}`,
      `• Nhận đồ: ${weekday(start)}, ${fmtFull(start)}`,
      `• Trả đồ: ${weekday(end)}, ${fmtFull(end)}`,
      `• Số ngày: ${n} ngày`,
      `• Tạm tính: ${money(n * (Number(c.price) || 0))} (cọc ${money(c.deposit)})`
    ];
    if (hold) lines.push(`• Mã giữ chỗ: ${hold.code} (giữ đến ${hhmm(hold.expiresAt)})`);
    if (name) lines.push(`• Tên: ${name}`);
    if (phone) lines.push(`• SĐT: ${phone}`);
    if (note) lines.push(`• Ghi chú: ${note}`);
    lines.push("Shop kiểm tra lịch và xác nhận giúp mình nhé. Cảm ơn shop!");
    return lines.join("\n");
  }

  /* ---------- Hộp chốt thuê ---------- */
  const sheet = $("#bookSheet");
  const copyBtn = $("#copyBtn");
  const msgBtn = $("#messengerBtn");

  function setBookBusy(on) {
    ["#bookBtn", "#dockBtn"].forEach((id) => { const b = $(id); if (!b) return; b.disabled = on; b.textContent = on ? "Đang giữ chỗ…" : "Chốt thuê"; });
  }
  let holdTimer = null;
  function showHoldInfo(hold) {
    const box = $("#holdInfo");
    clearInterval(holdTimer);
    if (!hold) { box.hidden = true; return; }
    const draw = () => {
      const left = Math.ceil((hold.expiresAt - Date.now()) / 60000);
      if (left <= 0) {
        box.className = "hold-info is-over";
        box.innerHTML = `<b>Hết thời gian giữ chỗ.</b> Lịch đã mở lại cho khách khác. Nếu vẫn muốn thuê, hãy đóng hộp này và bấm "Chốt thuê" lại.`;
        clearInterval(holdTimer); return;
      }
      box.className = "hold-info";
      box.innerHTML = `<b>⏳ Đã giữ chỗ cho bạn đến ${hhmm(hold.expiresAt)}</b> (còn ${left} phút) · Mã <b>${esc(hold.code)}</b><br>Gửi tin nhắn cho shop trước giờ này để cọc. Quá giờ, lịch sẽ tự mở lại cho khách khác.`;
    };
    box.hidden = false; draw();
    holdTimer = setInterval(draw, 20000);
  }

  async function openBooking() {
    if (!cur || !cur.start) return;
    const c = cur.c, from = iso(cur.start), to = iso(cur.end);
    let hold = null;
    if (isLive()) {
      hold = findMyHold(c.id, from, to) || null;
      if (!hold) {
        setBookBusy(true);
        pendingHold = { costumeId: c.id, from, to };
        try {
          const minutes = Number(SHOP.holdMinutes) || 30;
          const r = await window.NBData.api.createHold(c.id, from, to, minutes);
          hold = { code: r.code, expiresAt: r.expiresAt, costumeId: c.id, from, to };
          saveMyHold(hold);
          pendingHold = null;
          applyData(window.NBData);
        } catch (e) {
          pendingHold = null;
          setBookBusy(false);
          const msg = e && e.message && !/^(FirebaseError|\[|Missing|PERMISSION)/i.test(e.message) && !e.code ? e.message : "Không giữ chỗ được (mạng yếu hoặc lịch vừa thay đổi). Thử lại nhé.";
          toast(msg);
          return;
        }
        setBookBusy(false);
        drawCal(); drawPick();
      }
    }
    if (!cur.start) return;
    cur.hold = hold;
    showHoldInfo(hold);
    $("#bookText").value = buildMessage(hold);
    copyBtn.classList.remove("is-done");
    copyBtn.querySelector("span").textContent = "Sao chép";
    msgBtn.href = SHOP.messenger || SHOP.facebook || "#";
    msgBtn.hidden = !(SHOP.messenger || SHOP.facebook);
    sheet.showModal();
  }

  async function copyText() {
    const text = $("#bookText").value;
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch (e) {
      const ta = $("#bookText");
      ta.removeAttribute("readonly"); ta.select(); ta.setSelectionRange(0, text.length);
      try { ok = document.execCommand("copy"); } catch (e2) {}
      ta.setAttribute("readonly", "");
    }
    if (ok) {
      copyBtn.classList.add("is-done");
      copyBtn.querySelector("span").textContent = "Đã sao chép ✓";
      toast("Đã sao chép! Dán vào Messenger để gửi shop.");
    } else {
      toast("Không tự sao chép được — hãy nhấn giữ vào đoạn tin nhắn và chọn Sao chép.");
      $("#bookText").select();
    }
    return ok;
  }
  copyBtn.addEventListener("click", copyText);
  msgBtn.addEventListener("click", () => { copyText(); });

  /* ---------- Xem ảnh lớn ---------- */
  const lb = $("#lightbox");
  let lbList = [], lbIdx = 0;
  function openLightbox(list, i) { lbList = list; lbIdx = i; showLb(); lb.showModal(); }
  function showLb() {
    const im = $("#lbImg");
    im.src = lbList[lbIdx] || PLACEHOLDER;
    im.style.animation = "none"; void im.offsetWidth; im.style.animation = "";
    $("#lbCount").textContent = (lbIdx + 1) + " / " + lbList.length;
    lb.querySelector(".lb-prev").hidden = lb.querySelector(".lb-next").hidden = lbList.length < 2;
  }
  lb.querySelector(".lb-prev").addEventListener("click", (e) => { e.stopPropagation(); lbIdx = (lbIdx - 1 + lbList.length) % lbList.length; showLb(); });
  lb.querySelector(".lb-next").addEventListener("click", (e) => { e.stopPropagation(); lbIdx = (lbIdx + 1) % lbList.length; showLb(); });
  lb.addEventListener("click", (e) => { if (e.target === lb) lb.close(); });
  let tx = null;
  lb.addEventListener("touchstart", (e) => { tx = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener("touchend", (e) => {
    if (tx == null || lbList.length < 2) return;
    const dx = e.changedTouches[0].clientX - tx; tx = null;
    if (Math.abs(dx) > 50) { lbIdx = (lbIdx + (dx < 0 ? 1 : -1) + lbList.length) % lbList.length; showLb(); }
  });
  addEventListener("keydown", (e) => {
    if (!lb.open || lbList.length < 2) return;
    if (e.key === "ArrowLeft") lb.querySelector(".lb-prev").click();
    if (e.key === "ArrowRight") lb.querySelector(".lb-next").click();
  });

  // Nút đóng + bấm ra ngoài để đóng
  document.querySelectorAll("dialog [data-close]").forEach((b) => b.addEventListener("click", () => b.closest("dialog").close()));
  sheet.addEventListener("close", () => clearInterval(holdTimer));
  sheet.addEventListener("click", (e) => {
    const r = sheet.getBoundingClientRect();
    if (e.clientY < r.top || e.clientY > r.bottom || e.clientX < r.left || e.clientX > r.right) sheet.close();
  });

  /* =========================================================
     ĐIỀU HƯỚNG (#/ và #/do/MÃ)
     ========================================================= */
  let lastRoute = "";
  function route() {
    const h = location.hash || "#/";
    const m = h.match(/^#\/do\/(.+)$/);
    if (lastRoute === "home") home.scroll = scrollY;
    if (m) {
      renderDetail(decodeURIComponent(m[1]));
      lastRoute = "detail";
      scrollTo({ top: 0, behavior: "instant" });
    } else {
      renderHome();
      const back = lastRoute === "detail";
      lastRoute = "home";
      scrollTo({ top: back ? home.scroll : 0, behavior: "instant" });
    }
  }
  addEventListener("hashchange", route);

  // Cập nhật khi dữ liệu thay đổi (shop sửa lịch, có khách giữ chỗ) mà không làm mất lựa chọn của khách
  function refreshLive() {
    if (lastRoute === "home") { if ($("#grid")) drawGrid(); return; }
    if (lastRoute !== "detail" || !cur) return;
    const c = ALL.find((x) => x.id === cur.c.id);
    if (!c) { route(); return; }
    cur.c = c; cur.win = window.NB.freeWindow(c);
    if (cur.start && !findMyHold(c.id, iso(cur.start), iso(cur.end)) && window.NB.checkRange(c, cur.start, cur.end)) {
      cur.start = cur.end = null; cur.picking = false;
      toast("Lịch vừa thay đổi — ngày bạn chọn không còn trống, chọn lại nhé.");
    }
    const s = statusOf(c), box = $("#availBox");
    if (box) { box.className = "avail avail--" + s.cls; box.innerHTML = `<span class="avail__big">${esc(s.label)}</span><span class="avail__small">${esc(s.note)}</span>`; }
    drawCal(); drawPick();
  }

  let booted = false;
  window.NBData.on((D) => {
    applyData(D);
    renderChrome();
    if (!booted) { booted = true; route(); return; }
    refreshLive();
  });
  // Mỗi phút: giữ chỗ hết hạn thì mở lại ngày
  setInterval(() => { if (booted) { applyData(window.NBData); refreshLive(); } }, 60000);
})();
