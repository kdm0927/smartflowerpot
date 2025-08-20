// app.js
App({
  onLaunch(){
    if (!wx.cloud) { console.error('no cloud'); return; }
    wx.cloud.init({ env: this.globalData.envId, traceUser: true });
  },
  globalData: { envId: "你的环境ID" }
});
