// pages/nurse/index.js
import { requireRole, clearAuth } from '../../utils/auth';
import { loadQuests, saveQuests, today } from '../../utils/store';

// 여긴 절대 Page()를 두 번 선언하지 마세요.
Page({
  data: {
    patientId: 'patient_001',
    date: today(),
    items: [
      { key: 'namePlant',  title: 'Naming my Plant',      checked: true  },
      { key: 'writeDiary', title: 'Writing a Grow Diary', checked: false },
      { key: 'talkPlant',  title: 'Talking with Plant',   checked: false }
    ]
  },

  onLoad() {
    if (!requireRole('nurse')) return;
    this._load();
  },

  // ----- 데이터 -----
  _load() {
    const cur = loadQuests(this.data.patientId, this.data.date);
    if (cur.length) this.setData({ items: cur });
  },
  onPidInput(e) {
    this.setData({ patientId: e.detail.value });
    this._load();
  },

  // ----- 편집 (수정만, 체크로 완료 처리 X) -----
  onTitleInput(e) {
    const i = Number(e.currentTarget.dataset.index);
    const v = e.detail.value;
    const items = this.data.items.slice();
    items[i] = { ...items[i], title: v };
    this.setData({ items });
  },
  onSwitchChange(e) {
    const i = Number(e.currentTarget.dataset.index);
    const v = !!e.detail.value;
    const items = this.data.items.slice();
    items[i] = { ...items[i], checked: v };
    this.setData({ items });
  },
  onAddItem() {
    const items = this.data.items.slice();
    items.push({ key: 'q_' + Math.random().toString(36).slice(2, 8), title: '', checked: false });
    this.setData({ items });
  },
  onRemoveItem(e) {
    const i = Number(e.currentTarget.dataset.index);
    const items = this.data.items.slice();
    items.splice(i, 1);
    this.setData({ items });
  },

  // ----- 저장/로그아웃 -----
  onSave() {
    saveQuests(this.data.patientId, this.data.items, this.data.date);
    wx.showToast({ title: 'Saved', icon: 'success' });
  },
  onLogout() {
    clearAuth();
    wx.reLaunch({ url: '/pages/login/index' });
  }
});
