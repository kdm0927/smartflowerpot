const db = wx.cloud.database?.() || null;
let OPENID = '';

// ★ 데모 모드: true 면 클라우드 호출 없이 정적 목록 사용
const DEMO_MODE = true;

Page({
  data: {
    today: '',
    growing: 10,
    list: [],
    compose: { photoTempPath: '', note: '' },
    submitting: false,
    _loadedOpenId: false
  },

  async onLoad() {
    this.setData({ today: new Date().toISOString().slice(0, 10) });

    if (DEMO_MODE) {
      this.useStaticDemo();   // ← 정적 3개 로드
      return;
    }

    await this.ensureOpenId();
    await this.fetch();
  },

  onShow() {
    if (!DEMO_MODE && this.data._loadedOpenId) this.fetch();
  },

  // ---------- 데모: 정적 3개 ----------
  useStaticDemo() {
    const base = [
      { _id: 'demo-1', photoUrl: '/images/plant3.png', note: 'I sowed the seeds', ts: ts('2025/08/18 09:00') },
      { _id: 'demo-2', photoUrl: '/images/plant2.png',    note: 'The sprout grew !', ts: ts('2025/08/17 09:00') }
    ];
    const list = base.map((it, i) => ({
      ...it,
      displayTime: formatDateTime(it.ts).display,
      side: (i % 2) ? 'right' : 'left'
    }));
    this.setData({ list });
  },

  // ---------- 작성 폼 ----------
  async pickImage() {
    try {
      const { tempFilePaths } = await wx.chooseImage({ count: 1, sizeType: ['compressed'] });
      this.setData({ 'compose.photoTempPath': tempFilePaths[0] });
    } catch (_) {}
  },
  removePicked() {
    this.setData({ compose: { photoTempPath: '', note: '' } });
  },
  onNoteInput(e) {
    this.setData({ 'compose.note': e.detail.value });
  },

  async submitEntry() {
    const { photoTempPath, note } = this.data.compose;
    if (!photoTempPath) return wx.showToast({ title: 'Pick a photo', icon: 'none' });
    if (!note || !note.trim()) return wx.showToast({ title: 'Write a caption', icon: 'none' });

    // --- 데모 모드: 로컬에서 즉시 추가 ---
    if (DEMO_MODE) {
      const tsNow = Date.now();
      const item = {
        _id: `demo-${tsNow}`,
        photoUrl: photoTempPath,   // 로컬 경로 바로 사용
        note: note.trim(),
        ts: tsNow,
        displayTime: formatDateTime(tsNow).display,
        side: (this.data.list.length % 2) ? 'right' : 'left'
      };
      this.setData({ list: [item, ...this.data.list], compose: { photoTempPath: '', note: '' } });
      wx.showToast({ title: 'Posted (demo)' });
      return;
    }

    // --- 실제 모드: 클라우드 업로드 + DB 저장 ---
    if (!this.data._loadedOpenId) return wx.showToast({ title: 'Signin first', icon: 'none' });
    this.setData({ submitting: true });

    const tsNow = Date.now();
    const cloudPath = `album/${OPENID || 'anon'}/${tsNow}.jpg`;
    let fileID = '';

    try {
      const up = await wx.cloud.uploadFile({ cloudPath, filePath: photoTempPath });
      fileID = up.fileID;

      const { date, time } = formatDateTime(tsNow);
      await db.collection('entries').add({
        data: { userId: OPENID, photoUrl: fileID, note: note.trim(), ts: tsNow, date, time, createdAt: tsNow }
      });

      wx.showToast({ title: 'Posted' });
      this.setData({ compose: { photoTempPath: '', note: '' } });
      await this.fetch();
    } catch (e) {
      console.error('submit failed:', e);
      wx.showToast({ title: (e?.errMsg || e?.message || 'Failed').slice(0, 40), icon: 'none' });
      if (fileID) { try { await wx.cloud.deleteFile({ fileList: [fileID] }); } catch (_) {} }
    } finally {
      this.setData({ submitting: false });
    }
  },

  // ---------- 목록(실제 모드) ----------
  async fetch() {
    if (DEMO_MODE) return;                // 데모 모드에선 DB 조회 안 함
    if (!this.data._loadedOpenId) return;

    const { data } = await db.collection('entries')
      .where({ userId: OPENID })
      .orderBy('ts', 'desc')
      .limit(50)
      .get();

    const list = (data || []).map((it, i) => ({
      ...it,
      displayTime: formatDateTime(it.ts).display,
      side: (i % 2) ? 'right' : 'left'
    }));
    this.setData({ list });
  },

  async deleteEntry(e) {
    const { id, fileid } = e.currentTarget.dataset;

    // 데모 항목은 로컬에서만 지움
    if (DEMO_MODE && String(id).startsWith('demo')) {
      this.setData({ list: this.data.list.filter(it => it._id !== id) });
      return;
    }

    const res = await wx.showModal({ title: 'Delete', content: 'Delete this entry?', confirmText: 'Delete' });
    if (!res.confirm) return;

    try {
      await db.collection('entries').doc(id).remove();
      if (fileid) await wx.cloud.deleteFile({ fileList: [fileid] });
      wx.showToast({ title: 'Deleted' });
      this.fetch();
    } catch (err) {
      console.error(err);
      wx.showToast({ title: (err?.errMsg || err?.message || 'Failed').slice(0, 40), icon: 'none' });
    }
  },

  // ---------- util ----------
  async ensureOpenId() {
    try {
      const { result } = await wx.cloud.callFunction({ name: 'quickstartFunctions', data: { type: 'getOpenId' } });
      OPENID = result?.openid || '';
      this.setData({ _loadedOpenId: !!OPENID });
    } catch (e) {
      console.error('getOpenId failed:', e);
      this.setData({ _loadedOpenId: false });
    }
  },

  onPullDownRefresh() {
    if (DEMO_MODE) { wx.stopPullDownRefresh(); return; }
    this.fetch().finally(() => wx.stopPullDownRefresh());
  }
});

function pad(n){ return n<10 ? '0'+n : ''+n; }
function formatDateTime(ts){
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth()+1);
  const dd = pad(d.getDate());
  const HH = pad(d.getHours());
  const MM = pad(d.getMinutes());
  const date = `${yyyy}/${mm}/${dd}`;
  const time = `${HH}:${MM}`;
  return { date, time, display: `${date} ${time}` };
}
function ts(s){ return new Date(s.replace(/-/g, '/')).getTime(); }
