Page({
  data: {
    content: ''
  },

  onInput(e) {
    this.setData({ content: e.detail.value });
  },

  onSave() {
    if (!this.data.content.trim()) {
      wx.showToast({ title: '내용을 입력하세요', icon: 'none' });
      return;
    }

    // 기존 저장된 피드백 불러오기
    let feedbacks = wx.getStorageSync('feedbacks') || [];

    // 새 데이터 추가 (시간 포함)
    feedbacks.push({
      id: Date.now(),
      content: this.data.content,
      time: new Date().toLocaleString()
    });

    // 저장
    wx.setStorageSync('feedbacks', feedbacks);

    wx.showToast({ title: 'Submitted!', icon: 'success' });

    // 입력창 초기화 + 뒤로가기
    this.setData({ content: '' });
    wx.navigateBack();
  }
});
