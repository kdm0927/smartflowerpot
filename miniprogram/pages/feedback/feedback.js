Page({
  data: {
    feedbacks: []
  },

  onLoad() {
    // 로컬 저장소에서 불러오기
    const list = wx.getStorageSync('feedbacks') || [];
    this.setData({ feedbacks: list });
  }
});
