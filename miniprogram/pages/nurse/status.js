import { requireRole, getAuth } from '../../utils/auth';
import { today } from '../../utils/store';

const config = {
  productId: 'MB99887102',
  deviceName: 'RaspberryPi',
  apiKey: 'version=2018-10-31&res=products%2FMB99887102%2Fdevices%2FRaspberryPi&et=1756540800&method=sha1&sign=SYdgKBMW4Z2KgRAgwYXbBwCZbA0%3D',
  apiUrls: {
    query: 'https://iot-api.heclouds.com/thingmodel/query-device-property',
    control: 'https://iot-api.heclouds.com/thingmodel/set-device-property'
  }
};

Page({
  data: {
    patientId: 'patient_001',
    today: 'today()',
    growing: 10,
    temperature: '--',
    humidity: '--',
    soilMoisture: '--',
    statusText: '',
    tempStatus: '--',
    moistureStatus: '--',
    advice: '',
    adviceGiven: false,
  },

  onLoad(q) {
    if (!requireRole('nurse')) return;
  
    const a = getAuth();
    const pid = (q && q.patientId) || (a && a.patientId) || 'patient_001';
    const d = today();
  
    this.setData({ patientId: pid, today: d });
  
    this.fetchData();
    this._timer = setInterval(() => this.fetchData(), 10000);
  },  

  onUnload() {
    if (this._timer) clearInterval(this._timer);
  },

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

          if (!this.data.adviceGiven) {
            this.fetchAdvice();
            this.setData({ adviceGiven: true });
          }

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

  // AI Nurse Advice
  this.getAdvice(tempStatus, moistureStatus);
  },

  // Gemini API 호출
getAdvice(tempStatus, moistureStatus) {
  const prompt = `
  Plant's Temperature: ${tempStatus}, Plant's Moisture Status: ${moistureStatus}
  당신은 간호사입니다. 환자가 키우는 식물의 상태인 위 데이터들을 이해하고 짧은 행동을 해야 합니다.
  예를 들어, It's Hot & Dry라면 (짧은 문장,영어) "환자가 돌보는 식물의 상태가 안좋은 것 같아요. 환자의 거동이 불편한지 등의 상태를 확인해야 해요."라는 AI Nurse Advice가 출력되게 됩니다.
  `;

  wx.request({
    url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=AIzaSyDj45Vd67DvwzZu_QeMggB7ZRyX93_g2lI",

    method: "POST",
    header: {
      "Content-Type": "application/json"
    },
    data: {
      contents: [{ parts: [{ text: prompt }] }]
    },
    success: (res) => {
      const advice = res.data?.candidates?.[0]?.content?.parts?.[0]?.text 
                  || "AI 조언을 가져올 수 없습니다.";
      this.setData({ advice });
    },
    fail: (err) => {
      console.error("AI advice error:", err);
      this.setData({ advice: "AI 호출 실패" });
    }
  });
},

  // 错误处理
  setErrorStatus(title, detail) {
    let msg = title;
    if (detail) msg += ': ' + detail;
    this.setData({ statusText: msg });
    wx.showToast({ title: msg, icon: 'none' });
  },
});

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