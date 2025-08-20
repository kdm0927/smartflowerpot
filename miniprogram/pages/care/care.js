// 실제 값으로 교체
const productId = '你的ProductId';
const deviceName = '你的DeviceName';

Page({
  data: {
    today: '',
    growing: 10,     // 필요하면 실제로 계산해서 반영
    autoMode: true,
    watering: false
  },

  onLoad() {
    this.setData({ today: new Date().toISOString().slice(0, 10) });
    this.getAutoMode();  // 초기 자동급수 상태 동기화(가능하면)
  },

  // 현재 장치의 autoMode 조회 (가능하면)
  async getAutoMode() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: { type: 'iot.query', productId, deviceName }
      });
      const d = res?.result?.data?.data || {};
      if (typeof d.autoMode === 'boolean') this.setData({ autoMode: d.autoMode });
    } catch (_) { /* 조회 실패시 무시 */ }
  },

  // 즉시 급수
  async waterNow() {
    if (this.data.watering) return;
    this.setData({ watering: true });
    try {
      await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: { type: 'iot.control', productId, deviceName, params: { pump: true } }
      });
      wx.showToast({ title: 'Watering...' });

      // 장치에 자동 종료 타이머가 없다면 3초 후 수동 종료
      setTimeout(() => this.stopWater(), 3000);
    } catch (e) {
      const msg = e?.errMsg || e?.message || 'Failed';
      wx.showToast({ title: msg.slice(0, 40), icon: 'none' });
      this.setData({ watering: false });
    }
  },

  async stopWater() {
    try {
      await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: { type: 'iot.control', productId, deviceName, params: { pump: false } }
      });
    } finally {
      this.setData({ watering: false });
    }
  },

  // 자동급수 토글
  async toggleAuto(e) {
    const auto = e.detail.value;
    try {
      await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: { type: 'iot.control', productId, deviceName, params: { autoMode: auto } }
      });
      this.setData({ autoMode: auto });
    } catch (err) {
      // 실패 시 UI 롤백
      this.setData({ autoMode: !auto });
      const msg = err?.errMsg || err?.message || 'Failed';
      wx.showToast({ title: msg.slice(0, 40), icon: 'none' });
    }
  }
});
