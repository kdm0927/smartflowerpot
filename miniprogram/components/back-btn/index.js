Component({
  properties: {
    text: { type: String, value: 'Back' },
    home: { type: String, value: '/pages/index/index' }, // 기본 fallback
    target: { type: String, value: '' },                 // ✅ 지정된 위치
    type: { type: String, value: '' },
    customStyle: { type: String, value: '' }
  },
  methods: {
    onBack() {
      // target이 지정되어 있다면 무조건 그리로 이동
      if (this.properties.target) {
        wx.reLaunch({ url: this.properties.target });
        return;
      }

      const pages = getCurrentPages();
      if (pages && pages.length > 1) {
        wx.navigateBack({ delta: 1 });
      } else {
        const url = this.properties.home || '/pages/index/index';
        wx.reLaunch({ url });
      }
    }
  }
});
