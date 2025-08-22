import { requireRole, getAuth, clearAuth } from '../../utils/auth';
import { loadQuests, saveQuests, today } from '../../utils/store';

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
    // 환자 홈 기본 상태
    patientId: '',
    today: '',
    growing: 10,

    // TODO 표시용 (간호사가 저장한 항목을 로컬에서 읽어옴)
    quests: [],

    // 센서/날씨 (클라우드 사용 시)
    weather: { temp: '37', pm10: '2.5' },
    temperature: '--',
    humidity: '--',
    soilMoisture: '--',
    light: '--',//add
    statusText: '',

    tempStatus: '--',
    moistureStatus: '--'
  },

  onLoad(q) {
    if (!requireRole('patient')) return;

    // 환자 ID 결정
    const a = getAuth();
    const pid = (q && q.patientId) || (a && a.patientId) || 'patient_001';

    // 오늘 날짜
    const d = today();

    // 로컬에 저장된 환자 TODO 불러오기
    const quests = loadQuests(pid, d);

    this.setData({ patientId: pid, today: d, quests });

    // 클라우드/원격 호출은 토글에 따라 실행
      this.fetchData();
      this._timer = setInterval(() => this.fetchData(), 10000);
      this.fetchWeather();
  },

  onUnload() {
    if (this._timer) clearInterval(this._timer);
  },

  onQuestChange(e) {
    const checkedValues = e.detail.value; // 선택된 key 값 배열
    const quests = this.data.quests.map(q => ({
      ...q,
      checked: checkedValues.includes(q.key)
    }));
    this.setData({ quests });
  },  

  async fetchWeather() {
    try {
      const { result } = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: {
          type: 'weather.get',
          lat: 32.2044,
          lon: 119.4522
        }
      });
      const current = result?.current || {};
      const temp = current.temperature_2m ?? '--';
      const pm10 = (result?.hourly?.pm10?.[0]) ?? '--';
  
      this.setData({ weather: { temp, pm10 } });
    } catch (e) {
      console.error('weather error:', e);
    }
  },

//----------------------------------------------------------
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
          this.processDeviceData(res.data.data); // 处理传感器数据
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

  // 处理设备数据（从原有OneNet代码整合，适配数据绑定）
  processDeviceData(data) {
    const newData = {};
    data.forEach(item => {
      switch (item.identifier) {
        case 'GZ': newData.light = item.value; break; // 光照
        case 'HUM': newData.humidity = item.value; break; // 湿度
        case 'TEN': newData.temperature = item.value; break; // 温度
        case 'TRSD': newData.soilMoisture = item.value; break; // 土壤湿度
      }
    });

  // 🌡️ Temperature status
  let tempStatus = '--';
  const temp = newData.temperature;
  if (temp !== undefined) {
    if (temp < 15) tempStatus = "It's cold";
    else if (temp > 28) tempStatus = "It's hot";
    else tempStatus = "It's warm";
  }

  // 💧 수분 상태 분기 (저항값: 낮음=축축, 높음=건조)
  // Moisture Status (Low Value == So much water, High Value == So much dry)
  let moistureStatus = '--';
  const soil = newData.soilMoisture;
  if (soil !== undefined) {
    if (soil < 300) moistureStatus = "So much";   // 물 많음
    else if (soil > 700) moistureStatus = "Dry";  // 건조
    else moistureStatus = "Enough";               // 적당
  }

  // 데이터 반영
  this.setData({
    ...newData,
    tempStatus,
    moistureStatus
  });
  },

  // 错误处理
  setErrorStatus(title, detail) {
    let msg = title;
    if (detail) msg += ': ' + detail;
    this.setData({ statusText: msg });
    wx.showToast({ title: msg, icon: 'none' });
  },

//-------------------------------------------------------------
  // 네비게이션(기존 그대로)
  goCare()  { wx.navigateTo({ url: '/pages/care/care' }); },
  goAlbum() { wx.navigateTo({ url: '/pages/album/album' }); 
  },

  onSave() {
    saveQuests(this.data.patientId, this.data.quests, this.data.today);
    wx.showToast({ title: 'Saved', icon: 'success' });
  },
  
  onLogout() {
    clearAuth();
    wx.reLaunch({ url: '/pages/login/index' });
  }
}
);

// ===== 유틸 =====
function codeToText(code){
  const m = { 0:'Sunny', 1:'Mainly clear', 2:'Partly cloudy', 3:'Overcast',
              45:'Fog', 51:'Drizzle', 61:'Rain', 71:'Snow', 95:'Thunder' };
  return m[code] || '—';
}

/**
 * OneNET 응답 정규화
 *  - result.data.data = { temperature, humidity, soilMoisture }
 *  - result.data.properties = [{ id/name, value }, ...]
 *  - result.properties = [{...}]
 */
function normalizeTelemetry(result) {
  let t = '--', h = '--', s = '--';

  // case 1: 객체 형태
  if (result?.data?.data) {
    const d = result.data.data;
    t = pick(d, ['temperature', 'temp', 'Temperature']);
    h = pick(d, ['humidity', 'hum', 'Humidity']);
    s = pick(d, ['soilMoisture', 'soil_moisture', 'soil', 'SoilMoisture']);
  }

  // case 2: 배열 형태
  const propsArr = result?.data?.properties ?? result?.properties ?? null;
  if (propsArr?.length) {
    const map = {};
    propsArr.forEach(p => {
      const k = (p.id || p.name || '').toString();
      map[k] = (p.value !== undefined ? p.value : p.val);
    });
    if (t === '--') t = pick(map, ['temperature', 'temp', 'Temperature']);
    if (h === '--') h = pick(map, ['humidity', 'hum', 'Humidity']);
    if (s === '--') s = pick(map, ['soilMoisture', 'soil_moisture', 'soil', 'SoilMoisture']);
  }

  t = toPrettyNum(t);
  h = toPrettyNum(h);
  s = toPrettyNum(s);
  return { temperature: t, humidity: h, soilMoisture: s };
}

function pick(obj, keys) {
  if (!obj) return '--';
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    if (obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return '--';
}

function toPrettyNum(v) {
  if (v === '--') return v;
  const num = Number(v);
  if (Number.isNaN(num)) return v;
  return Math.round(num * 10) / 10;
}