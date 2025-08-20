// 실제 값으로 바꾸세요
const productId = '你的ProductId';
const deviceName = '你的DeviceName';

Page({
  data: {
    weather: { temp: '--', text: '--', pm10: '--' },
    temperature: '--',
    humidity: '--',
    soilMoisture: '--',
    statusText: '',
    today: '',
    growing: 10
  },

  onLoad() {
    this.setData({ today: new Date().toISOString().slice(0, 10) });
    this.fetchTelemetry();
    // 타이머는 인스턴스 프로퍼티에 보관
    this._timer = setInterval(() => this.fetchTelemetry(), 10000);
    this.fetchWeather();
  },

  onUnload() {
    if (this._timer) clearInterval(this._timer);
  },

  async fetchWeather() {
    try {
      const loc = await wx.getLocation({ type: 'wgs84' });
      const { result } = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: { type: 'weather.get', lat: loc.latitude, lon: loc.longitude }
      });
      const current = result?.current || {};
      const temp = current.temperature_2m ?? '--';
      const pm10 = (result?.hourly?.pm10?.[0]) ?? '--';
      const text = codeToText(current.weather_code);
      this.setData({ weather: { temp, pm10, text } });
    } catch (e) {
      // 위치 권한 없으면 조용히 패스
    }
  },

  async fetchTelemetry() {
    try {
      const res = await wx.cloud.callFunction({
        name: 'quickstartFunctions',
        data: { type: 'iot.query', productId, deviceName }
      });
      const result = res?.result ?? null;
      // console.log('iot.query result ===>', JSON.stringify(result));

      const readings = normalizeTelemetry(result);
      this.setData({
        temperature: readings.temperature,
        humidity: readings.humidity,
        soilMoisture: readings.soilMoisture,
        statusText: 'Updated'
      });
    } catch (e) {
      console.error('fetchTelemetry error:', e);
      this.setData({ statusText: 'Failed to fetch' });
    }
  },

  goCare() { wx.navigateTo({ url: '/pages/care/care' }); },
  goAlbum() { wx.navigateTo({ url: '/pages/album/album' }); }
});

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
