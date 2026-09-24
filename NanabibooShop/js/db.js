/* =========================================================
   Kết nối Firebase (Firestore) — lịch thời gian thực + giữ chỗ tạm

   Toàn bộ dữ liệu công khai nằm trong MỘT bản ghi: public/state
     { shop: {...}, costumes: [...], holds: { MÃ: {costumeId, from, to, exp} }, lastHold, updatedAt }
   → mỗi lượt khách chỉ tốn ~1 lượt đọc (gói miễn phí: 50.000 lượt đọc/ngày).
   ========================================================= */
const cfg = window.NB_FIREBASE || {};
const Data = window.NBData;
const IS_ADMIN = document.body.classList.contains("admin");
const V = "10.14.1";
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

if (!cfg.apiKey || !cfg.projectId) {
  Data.set({ ready: true, mode: "file" });
} else {
  start().catch((e) => {
    console.error("[NB] Firebase lỗi:", e);
    if (!Data.ready) Data.set({ ready: true, mode: "file", offline: true });
  });
}

async function start() {
  const fallback = setTimeout(() => {
    if (!Data.ready) { console.warn("[NB] Firebase chậm — dùng data.js"); Data.set({ ready: true, mode: "file", offline: true }); }
  }, 9000);

  const [appM, F, authM] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`),
    IS_ADMIN ? import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`) : Promise.resolve(null)
  ]);
  const app = appM.initializeApp(cfg);
  const db = F.getFirestore(app);
  if (cfg.emulator) F.connectFirestoreEmulator(db, cfg.emulator.host, cfg.emulator.firestorePort || 8080);
  let auth = null;
  if (authM) {
    auth = authM.getAuth(app);
    if (cfg.emulator) authM.connectAuthEmulator(auth, `http://${cfg.emulator.host}:${cfg.emulator.authPort || 9099}`, { disableWarnings: true });
  }

  const { doc, onSnapshot, getDoc, runTransaction, Timestamp, serverTimestamp, deleteField } = F;
  const STATE = doc(db, "public", "state");
  const now = () => Date.now();
  const holdList = (map) => Object.entries(map || {}).map(([code, h]) => ({
    code, costumeId: h.costumeId, from: h.from, to: h.to, expiresAt: h.exp && h.exp.toMillis ? h.exp.toMillis() : 0
  }));
  const activeMap = (map) => {
    const out = {};
    Object.entries(map || {}).forEach(([k, h]) => { if (h.exp && h.exp.toMillis() > now()) out[k] = h; });
    return out;
  };
  const clean = (c) => ({
    id: c.id, name: c.name || "", series: c.series || "", category: c.category || "", size: c.size || "", fit: c.fit || "",
    price: Number(c.price) || 0, deposit: Number(c.deposit) || 0, includes: c.includes || [], description: c.description || "",
    images: c.images || [], freeFrom: c.freeFrom || "", freeTo: c.freeTo || "",
    booked: (c.booked || []).filter((b) => b.from).map((b) => (b.note ? { from: b.from, to: b.to || b.from, note: b.note } : { from: b.from, to: b.to || b.from }))
      .sort((x, y) => x.from.localeCompare(y.from)),
    hidden: !!c.hidden
  });

  /* ---------- API dùng chung ---------- */
  const api = {
    // Khách bấm "Chốt thuê": giữ chỗ tạm `minutes` phút. Trả về { code, expiresAt }
    async createHold(costumeId, from, to, minutes) {
      let code = "";
      for (let i = 0; i < 6; i++) code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
      const exp = Timestamp.fromMillis(now() + Math.min(Math.max(minutes || 30, 5), 170) * 60000);
      await runTransaction(db, async (tx) => {
        const s = await tx.get(STATE);
        if (!s.exists()) throw new Error("Shop chưa mở giữ chỗ tự động — nhắn shop trực tiếp nhé.");
        const st = s.data();
        const c = (st.costumes || []).find((x) => x.id === costumeId);
        if (!c) throw new Error("Bộ đồ này không còn trên trang.");
        const holds = holdList(st.holds).filter((h) => h.costumeId === costumeId && h.expiresAt > now());
        const err = window.NB.checkRange(Object.assign({}, c, { _holds: holds }), window.NB.parse(from), window.NB.parse(to));
        if (err) throw new Error(err);
        tx.update(STATE, { ["holds." + code]: { costumeId, from, to, exp }, lastHold: code });
      });
      return { code, expiresAt: exp.toMillis() };
    }
  };

  if (!IS_ADMIN) {
    /* ---------- Trang khách: 1 kết nối thời gian thực, tự ngắt khi khách rời tab ---------- */
    const FILE = window.FILE_DATA;
    let unsub = null, idleTimer = null;
    const onState = (s) => {
      clearTimeout(fallback);
      if (!s.exists()) { Data.set({ ready: true, mode: "file", api: null, shop: FILE.shop, costumes: FILE.costumes, holds: [] }); return; }
      const st = s.data();
      Data.set({ ready: true, mode: "firebase", api, shop: st.shop || {}, costumes: st.costumes || [], holds: holdList(st.holds) });
    };
    const onErr = (e) => {
      console.error("[NB]", e);   // hết lượt đọc miễn phí / mất mạng → dùng data.js
      clearTimeout(fallback);
      if (!Data.ready || Data.mode === "firebase") Data.set({ ready: true, mode: "file", api: null, offline: true, shop: FILE.shop, costumes: FILE.costumes, holds: [] });
    };
    const connect = () => { if (!unsub) unsub = onSnapshot(STATE, onState, onErr); };
    const disconnect = () => { if (unsub) { unsub(); unsub = null; } };
    document.addEventListener("visibilitychange", () => {
      clearTimeout(idleTimer);
      if (document.visibilityState === "hidden") idleTimer = setTimeout(disconnect, 60000);
      else connect();
    });
    connect();
    return;
  }

  /* ---------- Trang quản lý ---------- */
  Object.assign(api, {
    onAuth(cb) { authM.onAuthStateChanged(auth, cb); },
    signIn(email, pw) { return authM.signInWithEmailAndPassword(auth, email, pw); },
    signOut() { return authM.signOut(auth); },
    resetPassword(email) { return authM.sendPasswordResetEmail(auth, email); },

    async loadAll() {
      const s = await getDoc(STATE);
      if (!s.exists()) return { exists: false };
      const st = s.data();
      return { exists: true, shop: st.shop || {}, costumes: st.costumes || [] };
    },

    // Lưu thông tin shop + danh sách bộ đồ. Giữ nguyên các lượt giữ chỗ còn hạn, dọn lượt hết hạn.
    async saveAll(shop, items) {
      await runTransaction(db, async (tx) => {
        const s = await tx.get(STATE);
        const holds = s.exists() ? activeMap(s.data().holds) : {};
        tx.set(STATE, {
          shop: Object.assign({}, shop),
          costumes: items.map(clean),
          holds,
          lastHold: s.exists() ? s.data().lastHold || "" : "",
          updatedAt: serverTimestamp()
        });
      });
    },

    watchHolds(cb) {
      return onSnapshot(STATE, (s) => cb(s.exists() ? holdList(s.data().holds) : []), (e) => console.error(e));
    },

    // Xác nhận giữ chỗ → khoá lịch thật + xoá giữ chỗ
    async confirmHold(h, note) {
      await runTransaction(db, async (tx) => {
        const s = await tx.get(STATE);
        if (!s.exists()) throw new Error("Chưa có dữ liệu trên Firebase.");
        const costumes = (s.data().costumes || []).map((c) => {
          if (c.id !== h.costumeId) return c;
          const booked = (c.booked || []).concat([note ? { from: h.from, to: h.to, note } : { from: h.from, to: h.to }])
            .sort((x, y) => x.from.localeCompare(y.from));
          return Object.assign({}, c, { booked });
        });
        tx.update(STATE, { costumes, ["holds." + h.code]: deleteField(), updatedAt: serverTimestamp() });
      });
    },

    // Huỷ giữ chỗ (khách không cọc) → mở lại ngày
    async cancelHold(h) {
      await runTransaction(db, async (tx) => {
        await tx.get(STATE);
        tx.update(STATE, { ["holds." + h.code]: deleteField() });
      });
    },

    // Dọn giữ chỗ đã hết hạn
    async cleanupExpired() {
      let n = 0;
      await runTransaction(db, async (tx) => {
        const s = await tx.get(STATE);
        if (!s.exists()) return;
        const all = s.data().holds || {};
        const act = activeMap(all);
        n = Object.keys(all).length - Object.keys(act).length;
        if (n) tx.update(STATE, { holds: act });
      });
      return n;
    }
  });

  clearTimeout(fallback);
  Data.set({ ready: true, mode: "firebase", api });
}
