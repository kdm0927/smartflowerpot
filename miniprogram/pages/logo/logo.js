Page({
  onLoad() {
    // 2초 후 로그인 페이지로 이동
    setTimeout(() => {
      wx.reLaunch({
        url: '/pages/login/index'
      });
    }, 2000);
  }
});