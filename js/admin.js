/* NanabibooShop — trang quản lý (chạy trên máy của chủ shop) */
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const { esc, fmt, fmtFull, weekday, parse, iso, addDays, today, money, media, thumbHtml, vnToIso, isoToVn } = window.NB;
  const DRAFT_KEY = "nb-admin-draft";

  const clone = (x) => JSON.parse(JSON.stringify(x));
  const ORIGINAL = JSON.stringify({ shop: window.SHOP || {}, costumes: window.COSTUMES || [] });
  let shop = clone(window.SHOP || {});
  let items = clone(window.COSTUMES || []);
  let sel = items.length ? 0 : -1;
  let dirty = false;
  const pending = new Map(); // "images/ten-file.jpg" -> File (ảnh mới chưa chép vào thư mục)
  const blobUrl = new Map();
  let dirHandle = null;

  const adm = $("#adm");

  /* ---------- Tiện ích ---------- */
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 2800);
  }
  function slug(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d")
      .replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "");
  }
  function srcOf(p) { return blobUrl.get(p) || p; }
  function markDirty() {
    dirty = true;
    $("#dirty").hidden = false;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ at: Date.now(), shop, costumes: items })); } catch (e) {}
  }
  function markClean() {
    dirty = false;
    $("#dirty").hidden = true;
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
  }
  addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });

  // Giao diện sáng/tối theo lựa chọn ở trang khách
  try { const t = localStorage.getItem("nb-theme"); if (t) document.documentElement.dataset.theme = t; } catch (e) {}

  /* ---------- Bản nháp ---------- */
  (function checkDraft() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); } catch (e) {}
    if (!d || JSON.stringify({ shop: d.shop, costumes: d.costumes }) === ORIGINAL) return;
    const when = new Date(d.at);
    $("#draftText").textContent = `Có bản nháp chưa lưu lúc ${when.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} ${fmt(when)}. Ảnh mới thêm trong bản nháp cần chọn lại.`;
    $("#draftBanner").hidden = false;
    $("#useDraft").onclick = () => {
      shop = d.shop; items = d.costumes; sel = items.length ? 0 : -1;
      $("#draftBanner").hidden = true; dirty = true; $("#dirty").hidden = false;
      fillShop(); renderList(); renderEditor();
    };
    $("#dropDraft").onclick = () => { try { localStorage.removeItem(DRAFT_KEY); } catch (e) {} $("#draftBanner").hidden = true; };
  })();

  /* ---------- Tabs ---------- */
  function showTab(which) {
    $("#tabItems").setAttribute("aria-selected", which === "items");
    $("#tabShop").setAttribute("aria-selected", which === "shop");
    $("#paneItems").hidden = which !== "items";
    $("#paneShop").hidden = which !== "shop";
  }
  $("#tabItems").onclick = () => showTab("items");
  $("#tabShop").onclick = () => showTab("shop");

  /* ---------- Thông tin shop ---------- */
  function fillShop() {
    $$("[data-shop]").forEach((el) => {
      const k = el.dataset.shop;
      const v = shop[k];
      el.value = Array.isArray(v) ? v.join("\n") : (v == null ? "" : v);
    });
  }
  $$("[data-shop]").forEach((el) => el.addEventListener("input", () => {
    const k = el.dataset.shop;
    if (k === "howTo") shop[k] = el.value.split("\n").map((s) => s.trim()).filter(Boolean);
    else if (k === "cleaningDays") shop[k] = Math.max(0, Math.min(7, parseInt(el.value, 10) || 0));
    else shop[k] = el.value.trim();
    markDirty();
  }));

  /* ---------- Danh sách ---------- */
  function statusBadge(c) {
    const a = window.NB.availability(c);
    if (c.hidden) return `<span class="row__badge">Đang ẩn</span>`;
    if (a.state === "free") return `<span class="row__badge is-free">Trống</span>`;
    if (a.state === "soon") return `<span class="row__badge is-soon">Từ ${fmt(a.from)}</span>`;
    return `<span class="row__badge is-busy">Chưa có lịch</span>`;
  }
  function renderList() {
    const q = slug($("#listQ").value);
    const body = $("#list");
    const rows = items.map((c, i) => ({ c, i })).filter(({ c }) => !q || slug([c.name, c.series, c.id].join(" ")).includes(q));
    body.innerHTML = rows.length ? rows.map(({ c, i }) => `
      <button class="row ${i === sel ? "is-active" : ""}" type="button" data-i="${i}">
        <span class="row__th">${(c.images || [])[0] ? thumbHtml(c.images[0], "", { url: srcOf(c.images[0]) }) : ""}</span>
        <span><span class="row__name">${esc(c.name || "(chưa đặt tên)")}</span><span class="row__sub">${esc(c.id)} · ${esc(c.series || "")}</span></span>
        ${statusBadge(c)}
      </button>`).join("") : `<p class="hint" style="padding:16px">Chưa có bộ đồ nào. Bấm “+ Thêm đồ”.</p>`;
    $$(".row", body).forEach((b) => b.onclick = () => { sel = +b.dataset.i; adm.dataset.view = "edit"; renderList(); renderEditor(); scrollTo({ top: 0 }); });
  }
  $("#listQ").addEventListener("input", renderList);

  function newId() {
    let n = items.length + 1, id;
    do { id = "DO" + String(n++).padStart(2, "0"); } while (items.some((c) => c.id === id));
    return id;
  }
  $("#addBtn").onclick = () => {
    items.unshift({ id: newId(), name: "", series: "", category: "Anime", size: "M", fit: "", price: 150000, deposit: 300000, includes: [], description: "", images: [], freeFrom: iso(today()), freeTo: "", booked: [], hidden: false });
    sel = 0; adm.dataset.view = "edit"; markDirty(); renderList(); renderEditor();
    setTimeout(() => $("#eName") && $("#eName").focus(), 50);
  };

  /* ---------- Form sửa ---------- */
  const TEXT_FIELDS = [
    ["id", "Mã bộ đồ", "eId", "VD: NZK01 — không trùng, không dấu"],
    ["name", "Tên nhân vật / bộ đồ", "eName", "VD: Kamado Nezuko"],
    ["series", "Anime / game", "eSeries", "VD: Kimetsu no Yaiba"]
  ];

  function renderEditor() {
    const ed = $("#editor");
    const c = items[sel];
    if (!c) { ed.innerHTML = `<div class="panel"><p class="hint">Chọn một bộ đồ bên trái để sửa, hoặc bấm “+ Thêm đồ”.</p></div>`; return; }
    const cats = [...new Set(["Anime", "Game", "Khác", ...items.map((x) => x.category).filter(Boolean)])];

    ed.innerHTML = `
      <div class="edit-head">
        <button class="btn btn--ghost btn--sm only-mobile" type="button" id="toList">‹ Danh sách</button>
        <h2 id="edTitle">${esc(c.name || "Bộ đồ mới")}</h2>
        <div class="edit-head__act">
          <a class="btn btn--ghost btn--sm" href="index.html#/do/${encodeURIComponent(c.id)}" target="_blank" rel="noopener">Xem trên web</a>
          <button class="btn btn--ghost btn--sm" type="button" id="dupBtn">Nhân bản</button>
          <button class="btn btn--danger btn--sm" type="button" id="delBtn">Xoá</button>
        </div>
      </div>

      <section class="panel">
        <h2>Thông tin</h2>
        ${TEXT_FIELDS.map(([k, lbl, id, ph]) => `<div class="field" id="f_${k}"><label for="${id}">${lbl}</label><input id="${id}" data-k="${k}" value="${esc(c[k])}" placeholder="${esc(ph)}"></div>`).join("")}
        <div class="fields3">
          <div class="field"><label for="eCat">Loại</label><input id="eCat" data-k="category" list="catList" value="${esc(c.category)}"><datalist id="catList">${cats.map((x) => `<option value="${esc(x)}">`).join("")}</datalist></div>
          <div class="field"><label for="eSize">Size</label><input id="eSize" data-k="size" value="${esc(c.size)}" placeholder="S / M / L"></div>
          <div class="field"><label for="eFit">Vừa với</label><input id="eFit" data-k="fit" value="${esc(c.fit)}" placeholder="Cao 150–162cm"></div>
          <div class="field"><label for="ePrice">Giá thuê / ngày (đ)</label><input id="ePrice" data-k="price" data-num type="number" min="0" step="1000" inputmode="numeric" value="${esc(c.price)}"></div>
          <div class="field"><label for="eDep">Tiền cọc (đ)</label><input id="eDep" data-k="deposit" data-num type="number" min="0" step="1000" inputmode="numeric" value="${esc(c.deposit)}"></div>
        </div>
        <p class="hint" id="priceHint">${money(c.price)}/ngày · cọc ${money(c.deposit)}</p>
        <div class="field"><label for="eInc">Bộ đồ gồm có (mỗi dòng một món)</label><textarea id="eInc" data-k="includes" data-lines rows="4">${esc((c.includes || []).join("\n"))}</textarea></div>
        <div class="field"><label for="eDesc">Mô tả / ghi chú</label><textarea id="eDesc" data-k="description" rows="3">${esc(c.description)}</textarea></div>
        <label class="check"><input type="checkbox" id="eHidden" ${c.hidden ? "checked" : ""}> Ẩn bộ đồ này khỏi trang khách (tạm ngưng cho thuê)</label>
      </section>

      <section class="panel">
        <h2>Ảnh & clip</h2>
        <p class="panel__sub">Mục đầu tiên là ảnh bìa (ảnh hoặc clip đều được). Ảnh nên dọc 4:5, dưới 500KB. Clip nên dưới 20MB (720p, 10–30 giây); clip dài thì đăng TikTok/YouTube rồi dán link.</p>
        <div class="imgs" id="imgs"></div>
        <label class="drop" id="drop">
          <input type="file" id="fileIn" accept="image/*,video/mp4,video/webm,video/quicktime" multiple>
          <b>Chọn ảnh / clip từ máy</b> hoặc kéo thả vào đây
        </label>
        <div class="img-add">
          <div class="field"><label for="imgUrl">Hoặc dán link YouTube / TikTok / ảnh</label><input id="imgUrl" placeholder="https://www.tiktok.com/@shop/video/… hoặc https://youtu.be/…"></div>
          <button class="btn btn--ghost btn--sm" type="button" id="imgUrlAdd" style="align-self:end">Thêm</button>
        </div>
      </section>

      <section class="panel" id="schedPanel">
        <h2>Lịch thuê</h2>
        <p class="panel__sub">Khách chỉ chọn được ngày <b>nằm trong khoảng nhận đặt</b> và <b>không trùng lượt đã khoá</b>. Ngày viết theo kiểu Việt Nam: ngày/tháng/năm.</p>
        <div class="fields2">
          <div class="field"><label for="eFreeFrom">Nhận đặt từ ngày</label>${vnDateHtml("eFreeFrom", c.freeFrom)}</div>
          <div class="field"><label for="eFreeTo">Đến ngày (để trống = không giới hạn)</label>${vnDateHtml("eFreeTo", c.freeTo)}</div>
        </div>
        <p class="hint" id="freeHint"></p>
        <div class="edit-head__act">
          <button class="btn btn--ghost btn--sm" type="button" id="freeToday">Nhận đặt từ hôm nay</button>
          <button class="btn btn--ghost btn--sm" type="button" id="freeNoEnd">Bỏ ngày kết thúc</button>
          <button class="btn btn--ghost btn--sm" type="button" id="freeClose">Tạm ngưng nhận đặt</button>
        </div>

        <div class="lock-box">
          <div class="lock-head">
            <h3>Khoá lịch đã có khách thuê</h3>
            <div class="cal__nav">
              <button class="icon-btn" type="button" id="admPrev" aria-label="Tháng trước"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
              <button class="icon-btn" type="button" id="admNext" aria-label="Tháng sau"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
            </div>
          </div>
          <p class="hint" id="lockHint">Bấm vào <b>ngày nhận</b> rồi <b>ngày trả</b> trên lịch để khoá một lượt thuê. Khoá 1 ngày thì bấm 2 lần vào cùng một ngày.</p>
          <div class="mini-wrap" id="mini"></div>
          <div class="legend">
            <span><i class="lg-free"></i>Khách chọn được</span>
            <span><i class="lg-lock"></i>Đã khoá (có khách thuê)</span>
            <span><i class="lg-clean"></i>Ngày giặt ủi (ghi chú)</span>
            <span><i class="lg-closed"></i>Ngoài lịch nhận đặt</span>
          </div>
        </div>

        <h3 class="sub-h">Các lượt đã khoá</h3>
        <div class="ranges" id="ranges"></div>
        <div class="edit-head__act">
          <button class="btn btn--ghost btn--sm" type="button" id="addRange">+ Thêm lượt khoá bằng tay</button>
          <button class="btn btn--ghost btn--sm" type="button" id="clearPast">Xoá các lượt đã qua</button>
        </div>
      </section>
    `;

    // Trường văn bản
    $$("[data-k]", ed).forEach((el) => el.addEventListener("input", () => {
      const k = el.dataset.k;
      if (el.hasAttribute("data-num")) c[k] = Math.max(0, parseInt(el.value, 10) || 0);
      else if (el.hasAttribute("data-lines")) c[k] = el.value.split("\n").map((s) => s.trim()).filter(Boolean);
      else if (k === "id") c[k] = el.value.trim().toUpperCase().replace(/\s+/g, "");
      else c[k] = el.value;
      if (k === "name") $("#edTitle").textContent = c.name || "Bộ đồ mới";
      if (k === "price" || k === "deposit") $("#priceHint").textContent = `${money(c.price)}/ngày · cọc ${money(c.deposit)}`;
      if (k === "id") validateId(c);
      markDirty(); renderList();
    }));
    $("#eHidden").onchange = (e) => { c.hidden = e.target.checked; markDirty(); renderList(); };
    $("#toList").onclick = () => { adm.dataset.view = "list"; };
    $("#dupBtn").onclick = () => {
      const copy = clone(c); copy.id = newId(); copy.name = c.name + " (bản sao)"; copy.booked = [];
      items.splice(sel + 1, 0, copy); sel++; markDirty(); renderList(); renderEditor(); toast("Đã nhân bản — nhớ đổi mã và tên.");
    };
    const del = $("#delBtn");
    del.onclick = () => {
      if (del.dataset.armed) {
        items.splice(sel, 1); sel = Math.min(sel, items.length - 1); adm.dataset.view = "list";
        markDirty(); renderList(); renderEditor(); toast("Đã xoá bộ đồ.");
      } else {
        del.dataset.armed = "1"; del.textContent = "Bấm lần nữa để xoá";
        setTimeout(() => { if (del.isConnected) { delete del.dataset.armed; del.textContent = "Xoá"; } }, 3000);
      }
    };

    // Ảnh
    renderImgs(c);
    const fileIn = $("#fileIn");
    fileIn.onchange = () => { addFiles(c, fileIn.files); fileIn.value = ""; };
    const drop = $("#drop");
    drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("is-over"); });
    drop.addEventListener("dragleave", () => drop.classList.remove("is-over"));
    drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("is-over"); addFiles(c, e.dataTransfer.files); });
    $("#imgUrlAdd").onclick = () => {
      const v = $("#imgUrl").value.trim(); if (!v) return;
      if (media(v).type === "tiktok-short") { toast("Link TikTok rút gọn không nhúng được. Mở link trên trình duyệt rồi copy link đầy đủ dạng tiktok.com/@…/video/…"); return; }
      (c.images = c.images || []).push(v); $("#imgUrl").value = ""; markDirty(); renderImgs(c); renderList();
    };

    // Khoảng nhận đặt
    const afterFree = () => { freeHint(c); renderMini(c); renderList(); };
    bindVnDate($("#schedPanel"), (txt, v, final) => {
      if (txt.id === "eFreeFrom") { c.freeFrom = v; if (final && c.freeTo && v && c.freeTo < v) { c.freeTo = ""; $("#eFreeTo").value = ""; $("#eFreeTo").dataset.v = ""; } }
      else if (txt.id === "eFreeTo") c.freeTo = v;
      else return;
      markDirty(); afterFree();
    });
    const setFree = (from, to) => {
      c.freeFrom = from; c.freeTo = to;
      [["#eFreeFrom", from], ["#eFreeTo", to]].forEach(([id, v]) => { const el = $(id); el.value = isoToVn(v); el.dataset.v = v; el.classList.remove("is-bad"); });
      markDirty(); afterFree();
    };
    $("#freeToday").onclick = () => setFree(iso(today()), c.freeTo && c.freeTo >= iso(today()) ? c.freeTo : "");
    $("#freeNoEnd").onclick = () => setFree(c.freeFrom || "", "");
    $("#freeClose").onclick = () => setFree("", "");
    freeHint(c);

    // Khoá lịch
    lockPick = null; calOffset = 0;
    $("#admPrev").onclick = () => { calOffset = Math.max(0, calOffset - 1); renderMini(c); };
    $("#admNext").onclick = () => { calOffset = Math.min(10, calOffset + 1); renderMini(c); };
    renderRanges(c);
    $("#addRange").onclick = () => {
      const t = today();
      (c.booked = c.booked || []).push({ from: iso(t), to: iso(t), note: "" });
      markDirty(); renderRanges(c); renderList();
      const rows = $$(".range", $("#ranges")); const last = rows[rows.length - 1]; last && last.querySelector(".vdate__txt").focus();
    };
    $("#clearPast").onclick = () => {
      const t = today(); const before = (c.booked || []).length;
      c.booked = (c.booked || []).filter((b) => parse(b.to || b.from) >= t);
      const n = before - c.booked.length;
      if (n) { markDirty(); renderRanges(c); renderList(); }
      toast(n ? `Đã xoá ${n} lượt đã qua.` : "Không có lượt nào đã qua.");
    };
    validateId(c);
  }

  function validateId(c) {
    const f = $("#f_id"); if (!f) return;
    const dup = c.id && items.filter((x) => x.id === c.id).length > 1;
    const bad = !c.id;
    f.classList.toggle("is-err", dup || bad);
    let m = $(".err", f); if (!m) { m = document.createElement("span"); m.className = "err"; f.appendChild(m); }
    m.textContent = bad ? "Cần có mã bộ đồ." : dup ? "Mã này đã có bộ đồ khác dùng." : "";
  }

  function addFiles(c, files) {
    const MB = 1024 * 1024;
    const list = Array.from(files || []).filter((f) => {
      if (f.type.startsWith("image/")) return true;
      if (!f.type.startsWith("video/") && !/\.(mp4|webm|mov|m4v)$/i.test(f.name)) return false;
      if (f.size > 95 * MB) { toast(`Clip “${f.name}” nặng ${Math.round(f.size / MB)}MB — GitHub chỉ nhận file dưới 100MB. Hãy nén lại hoặc đăng TikTok/YouTube rồi dán link.`); return false; }
      return true;
    });
    if (!list.length) return;
    c.images = c.images || [];
    for (const f of list) {
      const dot = f.name.lastIndexOf(".");
      const base = slug(dot > 0 ? f.name.slice(0, dot) : f.name) || "anh";
      const ext = (dot > 0 ? f.name.slice(dot + 1) : "jpg").toLowerCase();
      let path = `images/${slug(c.id)}-${base}.${ext}`, n = 2;
      while (pending.has(path) || c.images.includes(path)) path = `images/${slug(c.id)}-${base}-${n++}.${ext}`;
      pending.set(path, f);
      blobUrl.set(path, URL.createObjectURL(f));
      c.images.push(path);
      const isVid = f.type.startsWith("video/") || /\.(mp4|webm|mov|m4v)$/i.test(f.name);
      if (isVid && f.size > 20 * MB) toast(`Clip “${f.name}” nặng ${Math.round(f.size / MB)}MB — khách dùng 4G sẽ load chậm, nên nén xuống dưới 20MB.`);
      else if (!isVid && f.size > 800 * 1024) toast(`Ảnh “${f.name}” khá nặng (${Math.round(f.size / 1024)}KB) — nên nén bớt để web load nhanh.`);
    }
    markDirty(); renderImgs(c); renderList();
  }

  function renderImgs(c) {
    const box = $("#imgs");
    const imgs = c.images || [];
    box.innerHTML = imgs.length ? imgs.map((p, i) => `
      <div class="imgc">
        <div class="imgc__th">${thumbHtml(p, "", { url: srcOf(p) })}</div>
        ${i === 0 ? `<span class="imgc__tag">ẢNH BÌA</span>` : ""}
        ${pending.has(p) ? `<span class="imgc__new">MỚI</span>` : ""}
        <span class="imgc__path">${esc(p)}</span>
        <div class="imgc__bar">
          <button type="button" data-mv="-1" data-i="${i}" ${i === 0 ? "disabled" : ""} aria-label="Lên trước">←</button>
          <button type="button" data-mv="1" data-i="${i}" ${i === imgs.length - 1 ? "disabled" : ""} aria-label="Ra sau">→</button>
          <button type="button" data-rm="${i}" aria-label="Bỏ ảnh">✕</button>
        </div>
      </div>`).join("") : `<p class="hint">Chưa có ảnh.</p>`;
    $$("[data-mv]", box).forEach((b) => b.onclick = () => {
      const i = +b.dataset.i, j = i + +b.dataset.mv;
      [imgs[i], imgs[j]] = [imgs[j], imgs[i]]; markDirty(); renderImgs(c); renderList();
    });
    $$("[data-rm]", box).forEach((b) => b.onclick = () => {
      const [p] = imgs.splice(+b.dataset.rm, 1); pending.delete(p); markDirty(); renderImgs(c); renderList();
    });
  }

  /* ---------- Ô ngày kiểu Việt Nam (dd/mm/yyyy) ---------- */
  const CAL_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3.5 10h17M8 3v4m8-4v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  function vnDateHtml(id, isoVal, extra) {
    return `<div class="vdate"><input id="${id}" class="vdate__txt" type="text" inputmode="numeric" autocomplete="off" placeholder="dd/mm/yyyy" maxlength="10" value="${esc(isoToVn(isoVal))}" ${extra || ""}><button type="button" class="vdate__btn" aria-label="Chọn trên lịch">${CAL_SVG}</button><input type="date" class="vdate__native" tabindex="-1" aria-hidden="true"></div>`;
  }
  // onCommit(txtInput, isoValue, final) — final = true khi chọn trên lịch hoặc rời ô
  function bindVnDate(root, onCommit) {
    $$(".vdate", root).forEach((w) => {
      const txt = $(".vdate__txt", w), nat = $(".vdate__native", w), btn = $(".vdate__btn", w);
      txt.dataset.v = vnToIso(txt.value);
      const commit = (v, final) => {
        if (v === txt.dataset.v) return;          // không đổi thì thôi
        txt.dataset.v = v;
        onCommit(txt, v, final);
      };
      txt.addEventListener("input", (e) => {
        const raw = txt.value;
        const deleting = e.inputType && e.inputType.startsWith("delete");
        if (!deleting) {
          const parts = raw.split("/");
          if (parts.length > 1 && parts[0].length === 1) parts[0] = "0" + parts[0];
          if (parts.length > 2 && parts[1].length === 1) parts[1] = "0" + parts[1];
          const d = parts.join("").replace(/\D/g, "").slice(0, 8);
          let out = d.length > 4 ? `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}` : d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
          if (/\/$/.test(raw) && (d.length === 2 || d.length === 4)) out += "/";
          txt.value = out;
        }
        const v = vnToIso(txt.value);
        txt.classList.toggle("is-bad", txt.value.length >= 10 && !v);
        if (v || !txt.value) commit(v, false);
      });
      txt.addEventListener("blur", () => {
        const v = vnToIso(txt.value);
        if (v) txt.value = isoToVn(v);
        txt.classList.toggle("is-bad", !!txt.value && !v);
        if (v || !txt.value) commit(v, true);
      });
      btn.addEventListener("click", () => {
        nat.value = vnToIso(txt.value) || iso(today());
        try { nat.showPicker(); } catch (e) { nat.focus(); }
      });
      nat.addEventListener("change", () => {
        if (!nat.value) return;
        txt.value = isoToVn(nat.value); txt.classList.remove("is-bad");
        commit(nat.value, true);
      });
    });
  }

  /* ---------- Các lượt đã khoá ---------- */
  let lockPick = null;   // ngày bắt đầu đang chọn trên lịch admin
  let calOffset = 0;     // lịch admin đang lùi/tiến bao nhiêu tháng
  let flashIdx = -1;

  function overlapWith(c, from, to, skip) {
    return (c.booked || []).findIndex((b, i) => i !== skip && b.from <= to && (b.to || b.from) >= from);
  }

  function renderRanges(c) {
    const box = $("#ranges");
    const t = today();
    c.booked = c.booked || [];
    box.innerHTML = c.booked.length ? c.booked.map((b, i) => {
      const f = parse(b.from), e = parse(b.to || b.from);
      const past = e && e < t;
      const bad = f && e && e < f;
      const clash = !bad && overlapWith(c, b.from, b.to || b.from, i) >= 0;
      const days = f && e && !bad ? Math.round((e - f) / 86400000) + 1 : 0;
      return `
      <div class="range ${past ? "is-past" : ""} ${i === flashIdx ? "is-flash" : ""}" data-row="${i}">
        <span class="range__lbl"><span>Lượt ${i + 1}${f && e && !bad ? ` · ${weekday(f)} ${fmt(f)} → ${weekday(e)} ${fmt(e)}` : ""}${days ? ` · ${days} ngày` : ""}${past ? " · đã qua" : ""}</span>${bad ? "<b>Ngày trả đang trước ngày nhận</b>" : clash ? "<b>Trùng với lượt khác</b>" : ""}</span>
        <div class="field"><label for="rf${i}">Ngày nhận</label>${vnDateHtml("rf" + i, b.from, `data-r="${i}" data-f="from"`)}</div>
        <div class="field"><label for="rt${i}">Ngày trả</label>${vnDateHtml("rt" + i, b.to || b.from, `data-r="${i}" data-f="to"`)}</div>
        <button class="icon-btn" type="button" data-rr="${i}" aria-label="Mở khoá lượt ${i + 1}" title="Mở khoá lượt này"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button>
        <div class="field range__note"><label for="rn${i}">Ghi chú (công khai — đừng ghi SĐT)</label><input id="rn${i}" data-note="${i}" value="${esc(b.note || "")}" placeholder="VD: khách A, gửi đi Đà Nẵng"></div>
      </div>`;
    }).join("") : `<p class="hint">Chưa khoá lượt nào — khách chọn được mọi ngày trong khoảng nhận đặt.</p>`;
    bindVnDate(box, (txt, v, final) => {
      const i = +txt.dataset.r, b = c.booked[i]; if (!b || !v) return;
      b[txt.dataset.f] = v;
      if (txt.dataset.f === "from" && (!b.to || b.to < b.from)) b.to = b.from;
      markDirty(); renderMini(c); renderList(); freeHint(c);
      if (final) { c.booked.sort((x, y) => String(x.from).localeCompare(String(y.from))); renderRanges(c); }
    });
    $$("[data-note]", box).forEach((el) => el.addEventListener("input", () => { c.booked[+el.dataset.note].note = el.value; markDirty(); }));
    $$("[data-rr]", box).forEach((btn) => btn.onclick = () => {
      const [b] = c.booked.splice(+btn.dataset.rr, 1);
      markDirty(); renderRanges(c); renderList(); freeHint(c);
      if (b) toast(`Đã mở khoá ${fmt(parse(b.from))} → ${fmt(parse(b.to || b.from))}.`);
    });
    flashIdx = -1;
    renderMini(c);
  }

  function freeHint(c) {
    const el = $("#freeHint"); if (!el) return;
    const a = window.NB.availability(c);
    const f = parse(c.freeFrom), e = parse(c.freeTo);
    el.classList.toggle("hint--warn", a.state === "none");
    const seen = a.state === "free" ? "“Trống hôm nay”" : a.state === "busy" ? "“Đang có người thuê, trống lại từ " + (a.from ? fmt(a.from) : "") + "”" : a.state === "soon" ? "“Trống từ " + fmt(a.from) + "”" : "";
    if (!f) el.textContent = "Đang tạm ngưng nhận đặt — khách sẽ thấy “Chưa có lịch trống, nhắn shop để hỏi”.";
    else if (e && e < f) el.textContent = "Ngày kết thúc đang trước ngày bắt đầu.";
    else if (a.state === "none") el.textContent = "Không còn ngày nào khách chọn được — hãy cập nhật khoảng nhận đặt hoặc mở khoá bớt.";
    else el.textContent = `Nhận đặt từ ${weekday(f)} ${fmtFull(f)}${e ? " đến " + weekday(e) + " " + fmtFull(e) : ", không giới hạn"}. Khách đang thấy: ${seen}.`;
  }

  function renderMini(c) {
    const t = today();
    const clean = Number(shop.cleaningDays) || 0;
    let html = "";
    for (let m = 0; m < 3; m++) {
      const first = new Date(t.getFullYear(), t.getMonth() + calOffset + m, 1);
      const nDays = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
      let cells = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((w) => `<span class="w">${w}</span>`).join("");
      for (let i = 0; i < (first.getDay() + 6) % 7; i++) cells += "<span></span>";
      for (let d = 1; d <= nDays; d++) {
        const day = new Date(first.getFullYear(), first.getMonth(), d);
        const past = day < t;
        const booked = window.NB.bookingOn(c, day);
        const st = window.NB.dayState(c, day);
        const cls = [
          booked ? "b" : window.NB.cleaningOn(c, day, clean) ? "c" : st === "free" ? "f" : "x",
          +day === +t ? "t" : "", past ? "p" : "",
          lockPick && +day === +lockPick ? "s" : ""
        ].join(" ");
        cells += past ? `<span class="${cls}">${d}</span>` : `<button type="button" class="${cls}" data-day="${iso(day)}" title="${weekday(day)} ${fmtFull(day)}${booked && booked.note ? " – " + esc(booked.note) : ""}">${d}</button>`;
      }
      html += `<div><h4>${first.toLocaleDateString("vi-VN", { month: "long", year: "numeric" })}</h4><div class="mini-cal">${cells}</div></div>`;
    }
    $("#mini").innerHTML = html;
    $$("#mini [data-day]").forEach((b) => b.onclick = () => lockClick(c, parse(b.dataset.day)));
    $("#admPrev").disabled = calOffset <= 0;
    const hint = $("#lockHint");
    if (hint) hint.innerHTML = lockPick
      ? `Đã chọn ngày nhận <b>${weekday(lockPick)} ${fmtFull(lockPick)}</b>. Bấm tiếp <b>ngày trả</b> (bấm lại ngày này nếu chỉ khoá 1 ngày). <a href="#" id="lockCancel">Huỷ</a>`
      : `Bấm vào <b>ngày nhận</b> rồi <b>ngày trả</b> trên lịch để khoá một lượt thuê. Khoá 1 ngày thì bấm 2 lần vào cùng một ngày.`;
    const cancel = $("#lockCancel"); if (cancel) cancel.onclick = (e) => { e.preventDefault(); lockPick = null; renderMini(c); };
  }

  function lockClick(c, day) {
    const hit = (c.booked || []).findIndex((b) => b.from <= iso(day) && (b.to || b.from) >= iso(day));
    if (hit >= 0 && !lockPick) {
      const b = c.booked[hit];
      flashIdx = hit; renderRanges(c);
      const row = $(`[data-row="${hit}"]`); row && row.scrollIntoView({ behavior: "smooth", block: "center" });
      toast(`Ngày này thuộc lượt ${fmt(parse(b.from))} → ${fmt(parse(b.to || b.from))}. Bấm ✕ ở lượt đó để mở khoá.`);
      return;
    }
    if (!lockPick) { lockPick = day; renderMini(c); return; }
    const from = lockPick < day ? lockPick : day, to = lockPick < day ? day : lockPick;
    lockPick = null;
    if (overlapWith(c, iso(from), iso(to), -1) >= 0) { renderMini(c); toast("Khoảng này trùng với một lượt đã khoá. Chọn lại nhé."); return; }
    (c.booked = c.booked || []).push({ from: iso(from), to: iso(to), note: "" });
    c.booked.sort((x, y) => String(x.from).localeCompare(String(y.from)));
    flashIdx = c.booked.findIndex((b) => b.from === iso(from));
    markDirty(); renderRanges(c); renderList(); freeHint(c);
    toast(`Đã khoá ${fmt(from)} → ${fmt(to)}. Khách sẽ không chọn được những ngày này.`);
  }

  /* ---------- Lưu ---------- */
  function validateAll() {
    const errs = [];
    const ids = new Set();
    items.forEach((c, i) => {
      const label = c.name || c.id || "Bộ đồ #" + (i + 1);
      if (!c.id) errs.push(`${label}: chưa có mã.`);
      else if (ids.has(c.id)) errs.push(`${label}: mã ${c.id} bị trùng.`);
      ids.add(c.id);
      if (!c.name) errs.push(`${label}: chưa có tên.`);
      if (c.freeFrom && c.freeTo && c.freeTo < c.freeFrom) errs.push(`${label}: lịch trống có ngày kết thúc trước ngày bắt đầu.`);
      (c.booked || []).forEach((b, j) => {
        if (!parse(b.from) || !parse(b.to || b.from)) errs.push(`${label}: lượt thuê ${j + 1} thiếu ngày.`);
        else if (parse(b.to) < parse(b.from)) errs.push(`${label}: lượt thuê ${j + 1} có ngày trả trước ngày nhận.`);
      });
    });
    return errs;
  }

  function buildDataJs() {
    const cleanItems = items.map((c) => ({
      id: c.id, name: c.name, series: c.series || "", category: c.category || "", size: c.size || "", fit: c.fit || "",
      price: Number(c.price) || 0, deposit: Number(c.deposit) || 0,
      includes: c.includes || [], description: c.description || "", images: c.images || [],
      freeFrom: c.freeFrom || "", freeTo: c.freeTo || "",
      booked: (c.booked || []).filter((b) => b.from).map((b) => (b.note ? { from: b.from, to: b.to || b.from, note: b.note } : { from: b.from, to: b.to || b.from })).sort((x, y) => x.from.localeCompare(y.from)),
      hidden: !!c.hidden
    }));
    const stamp = new Date().toLocaleString("vi-VN");
    return `/* =========================================================
   DỮ LIỆU CỦA SHOP — ${shop.name || "NanabibooShop"}
   Cập nhật bằng admin.html lúc ${stamp}.
   Cách dễ nhất để sửa: mở admin.html → sửa bằng form → bấm "Lưu".
   ========================================================= */

window.SHOP = ${JSON.stringify(shop, null, 2)};

window.COSTUMES = ${JSON.stringify(cleanItems, null, 2)};
`;
  }

  const saveSheet = $("#saveSheet");
  $$("dialog [data-close]").forEach((b) => b.onclick = () => b.closest("dialog").close());

  $("#saveBtn").onclick = () => {
    const errs = validateAll();
    const body = $("#saveBody");
    if (errs.length) {
      body.innerHTML = `<p class="hint hint--warn">Sửa mấy chỗ này trước khi lưu:</p><ul class="save-list">${errs.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>`;
      saveSheet.showModal(); return;
    }
    const canFs = "showDirectoryPicker" in window;
    const imgs = [...pending.keys()];
    body.innerHTML = `
      <div class="save-opts">
        ${canFs ? `
        <div class="save-opt">
          <h3>Lưu thẳng vào thư mục shop</h3>
          <p>Chọn thư mục <b>NanabibooShop</b> (thư mục có file index.html). Trang sẽ ghi đè <code>data.js</code>${imgs.length ? ` và chép ${imgs.length} ảnh/clip mới vào <code>images/</code>` : ""}.</p>
          <button class="btn btn--primary btn--sm" type="button" id="saveFs">${dirHandle ? "Lưu vào " + esc(dirHandle.name) : "Chọn thư mục & lưu"}</button>
        </div>` : ""}
        <div class="save-opt">
          <h3>${canFs ? "Hoặc tải file data.js" : "Tải file data.js"}</h3>
          <p>Tải về rồi chép đè vào thư mục shop.${imgs.length ? " Nhớ chép cả ảnh/clip mới vào thư mục <code>images/</code> với đúng tên:" : ""}</p>
          ${imgs.length ? `<ul class="save-list">${imgs.map((p) => `<li><code>${esc(p)}</code> ← ${esc(pending.get(p).name)}</li>`).join("")}</ul>` : ""}
          <button class="btn btn--ghost btn--sm" type="button" id="saveDl">Tải data.js</button>
        </div>
        <p class="hint">Sau khi lưu: đưa thay đổi lên GitHub (GitHub Desktop → Commit → Push) là trang khách cập nhật sau khoảng 1 phút.</p>
      </div>`;
    saveSheet.showModal();
    if (canFs) $("#saveFs").onclick = saveToFolder;
    $("#saveDl").onclick = () => {
      const blob = new Blob([buildDataJs()], { type: "text/javascript" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = "data.js";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      if (!pending.size) markClean();
      toast("Đã tải data.js — chép đè vào thư mục shop nhé.");
    };
  };

  async function saveToFolder() {
    try {
      if (!dirHandle) dirHandle = await window.showDirectoryPicker({ id: "nanabiboo", mode: "readwrite" });
      if ((await dirHandle.queryPermission({ mode: "readwrite" })) !== "granted" &&
          (await dirHandle.requestPermission({ mode: "readwrite" })) !== "granted") throw new Error("Chưa cho phép ghi vào thư mục.");
      try { await dirHandle.getFileHandle("index.html"); } catch (e) {
        dirHandle = null;
        toast("Thư mục này không có index.html — hãy chọn đúng thư mục NanabibooShop.");
        return;
      }
      const writeFile = async (dir, name, data) => {
        const fh = await dir.getFileHandle(name, { create: true });
        const w = await fh.createWritable(); await w.write(data); await w.close();
      };
      await writeFile(dirHandle, "data.js", buildDataJs());
      if (pending.size) {
        const imgDir = await dirHandle.getDirectoryHandle("images", { create: true });
        for (const [path, file] of pending) await writeFile(imgDir, path.replace(/^images\//, ""), file);
        pending.clear();
      }
      markClean(); saveSheet.close(); renderEditor();
      toast("Đã lưu vào thư mục " + dirHandle.name + " ✓");
    } catch (e) {
      if (e && e.name === "AbortError") return;
      toast("Không lưu được: " + (e && e.message ? e.message : e));
    }
  }

  // Ctrl/Cmd + S
  addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); $("#saveBtn").click(); } });

  /* ---------- Khởi động ---------- */
  fillShop();
  renderList();
  renderEditor();
  if (matchMedia("(min-width: 900px)").matches || items.length) adm.dataset.view = matchMedia("(min-width: 900px)").matches ? "edit" : "list";
})();
