// 设备配置（使用OneNet实际参数）
const config = {
  productId: '969d3BTNO2',
  deviceName: 'ESP8266',
  apiKey: 'version=2018-10-31&res=products%2F969d3BTNO2%2Fdevices%2FESP8266&et=1767245123&method=md5&sign=P%2FhzlD4QjA9n0T8PJtJH%2Bg%3D%3D',
  apiUrls: {
    query: 'https://iot-api.heclouds.com/thingmodel/query-device-property',
    control: 'https://iot-api.heclouds.com/thingmodel/set-device-property'
  }
};

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
  getAutoMode() {
    wx.request({
      url: config.apiUrls.query,
      method: 'GET',
      header: { 'authorization': config.apiKey },
      data: {
        product_id: config.productId,
        device_name: config.deviceName
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data.code === 0) {
          // 解析设备返回的模式标识（ZD：true=手动，false=自动）
          const modeData = res.data.data.find(item => item.identifier === 'ZD');
          if (modeData) {
            const isAuto = modeData.value === 'false'; // ZD为false时是自动模式
            this.setData({ autoMode: isAuto });
          }
        }
      },
      fail: (err) => {
        console.error('获取模式失败:', err);
      }
    });
  },

  // 즉시 급수
 waterNow() {
    if (this.data.watering) return; // 防止重复触发
    if (!this.data.autoMode) { // 仅手动模式可操作
      this.setData({ watering: true });
      wx.request({
        url: config.apiUrls.control,
        method: 'POST',
        header: {
          'Content-Type': 'application/json',
          'authorization': config.apiKey
        },
        data: JSON.stringify({
          product_id: config.productId,
          device_name: config.deviceName,
          params: { SB: 'true' } // 水泵开启指令（SB：true=运行）
        }),
        success: (res) => {
          if (res.statusCode === 200 && res.data.code === 0) {
            wx.showToast({ title: 'Watering...' });
            // 3秒后自动停止浇水（若设备无自动关停逻辑）
            setTimeout(() => this.stopWater(), 3000);
          } else {
            wx.showToast({ title: '浇水指令失败', icon: 'none' });
            this.setData({ watering: false });
          }
        },
        fail: (err) => {
          console.error('浇水请求失败:', err);
          wx.showToast({ title: '浇水失败', icon: 'none' });
          this.setData({ watering: false });
        }
      });
    } else {
      wx.showToast({ title: '请先切换到手动模式', icon: 'none' });
    }
  },

  stopWater() {
    wx.request({
      url: config.apiUrls.control,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'authorization': config.apiKey
      },
      data: JSON.stringify({
        product_id: config.productId,
        device_name: config.deviceName,
        params: { SB: 'false' } // 水泵关闭指令（SB：false=停止）
      }),
      success: (res) => {
        if (!(res.statusCode === 200 && res.data.code === 0)) {
          wx.showToast({ title: '停止指令失败', icon: 'none' });
        }
      },
      fail: (err) => {
        console.error('停止请求失败:', err);
        wx.showToast({ title: '停止失败', icon: 'none' });
      },
      complete: () => {
        this.setData({ watering: false });
      }
    });
  },

  // 자동급수 토글
  toggleAuto(e) {
    const targetAuto = e.detail.value; // 开关目标状态（true=自动，false=手动）
    wx.request({
      url: config.apiUrls.control,
      method: 'POST',
      header: {
        'Content-Type': 'application/json',
        'authorization': config.apiKey
      },
      data: JSON.stringify({
        product_id: config.productId,
        device_name: config.deviceName,
        params: { ZD: !targetAuto } // ZD：true=手动，false=自动（与targetAuto反向）
      }),
      success: (res) => {
        if (res.statusCode === 200 && res.data.code === 0) {
          this.setData({ autoMode: targetAuto });
          wx.showToast({ 
            title: targetAuto ? '已切换自动模式' : '已切换手动模式' 
          });
        } else {
          // 失败时回滚UI
          this.setData({ autoMode: !targetAuto });
          wx.showToast({ title: '模式切换失败', icon: 'none' });
        }
      },
      fail: (err) => {
        console.error('模式切换请求失败:', err);
        this.setData({ autoMode: !targetAuto }); // 回滚UI
        wx.showToast({ title: '切换失败', icon: 'none' });
      }
    });
  }
});
