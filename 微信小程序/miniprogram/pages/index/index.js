// 配置信息
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
    temperature: '--',
    humidity: '--',
    soilMoisture: '--',
    light: '--',
    currentMode: 'loading', // loading/auto/manual
    pumpStatusText: '未知',
    statusText: '正在初始化...',
    lastPumpCommand: null
  },

  onLoad() {
    this.fetchData();
    // 设置定时刷新，每5秒刷新一次数据
    this.timer = setInterval(() => this.fetchData(), 5000);
  },

  onUnload() {
    clearInterval(this.timer);
  },

  // 获取设备数据
  fetchData() {
    wx.request({
      url: config.apiUrls.query,
      method: 'GET',
      header: {
        'Accept': 'application/json, text/plain, */*',
        'authorization': config.apiKey
      },
      data: {
        product_id: config.productId,
        device_name: config.deviceName
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data.code === 0) {
          this.processDeviceData(res.data.data);
          this.setData({
            statusText: '最后更新: ' + new Date().toLocaleTimeString()
          });
        } else {
          this.setErrorStatus('获取数据失败', res.data?.msg);
        }
      },
      fail: (err) => {
        this.setErrorStatus('请求失败', err.errMsg);
      }
    });
  },

  // 处理设备数据
  processDeviceData(data) {
    const newData = {};
    data.forEach(item => {
      switch(item.identifier) {
        case 'GZ': newData.light = item.value; break;
        case 'HUM': newData.humidity = item.value; break;
        case 'TEN': newData.temperature = item.value; break;
        case 'TRSD': newData.soilMoisture = item.value; break;
        case 'SB': 
          newData.pumpStatusText = item.value === 'true' ? '运行中' : '已关闭';
          break;
        case 'ZD':
          newData.currentMode = item.value === 'true' ? 'manual' : 'auto';
          break;
      }
    });
    this.setData(newData);
  },

  // 控制水泵
  controlPump(e) {
    if (this.data.currentMode !== 'manual') {
      wx.showToast({
        title: '当前不是手动模式',
        icon: 'none'
      });
      return;
    }

    const value = e.currentTarget.dataset.value === 'true';
    this.setData({
      lastPumpCommand: value,
      pumpStatusText: '指令发送中...'
    });

    wx.request({
      url: config.apiUrls.control,
      method: 'POST',
      header: {
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
        'authorization': config.apiKey
      },
      data: JSON.stringify({
        product_id: config.productId,
        device_name: config.deviceName,
        params: { SB: value }
      }),
      success: (res) => {
        if (res.statusCode === 200) {
          if (res.data.code === 0) {
            this.setData({
              pumpStatusText: value ? '已开启' : '已关闭',
              statusText: `水泵${value ? '开启' : '关闭'}成功`
            });
            wx.showToast({
              title: `水泵${value ? '开启' : '关闭'}成功`,
              icon: 'success'
            });
            // 立即刷新状态
            this.fetchData();
          } else {
            this.handleControlError(res.data.code, res.data.msg);
          }
        } else {
          this.handleControlError(res.statusCode, '服务器错误');
        }
      },
      fail: (err) => {
        this.handleControlError(null, err.errMsg);
      }
    });
  },

  // 设置错误状态
  setErrorStatus(title, detail) {
    let msg = title;
    if (detail) msg += ': ' + detail;
    this.setData({ statusText: msg });
    wx.showToast({ title: msg, icon: 'none' });
  }
});