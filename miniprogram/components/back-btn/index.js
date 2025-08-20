Component({
  properties: {
    text: { type: String, value: 'Back' },
    home: { type: String, value: '/pages/index/index' }, // 폴백 목적지
    type: { type: String, value: '' },                   // 'dark' 등 스타일 변형
    customStyle: { type: String, value: '' }             // 위치/여백 커스텀
  },
  methods: {
    onBack() {
      const pages = getCurrentPages();
      if (pages && pages.length > 1) {
        wx.navigateBack({ delta: 1 });
      } else {
        // 스택이 없을 때 홈으로
        const url = this.properties.home || '/pages/index/index';
        wx.reLaunch({ url });
      }
    }
  }
});
