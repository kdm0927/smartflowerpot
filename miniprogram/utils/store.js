// utils/store.js
export const today = () => new Date().toISOString().slice(0,10);
const KEY = (pid, date) => `quests:${pid}:${date}`;

export function loadQuests(patientId, date = today()) {
  const raw = wx.getStorageSync(KEY(patientId, date));
  return raw ? JSON.parse(raw) : [];
}
export function saveQuests(patientId, items, date = today()) {
  wx.setStorageSync(KEY(patientId, date), JSON.stringify(items));
}
