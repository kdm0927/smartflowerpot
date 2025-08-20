const cloud = require("wx-server-sdk");
const got = require("got");

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const ONENET_KEY = process.env.ONENET_KEY;

// 获取openid
const getOpenId = async () => {
  // 获取基础信息
  const wxContext = cloud.getWXContext();
  return {
    openid: wxContext.OPENID,
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID,
  };
};

// 获取小程序二维码
const getMiniProgramCode = async () => {
  // 获取小程序二维码的buffer
  const resp = await cloud.openapi.wxacode.get({
    path: "pages/index/index",
  });
  const { buffer } = resp;
  // 将图片上传云存储空间
  const upload = await cloud.uploadFile({
    cloudPath: "code.png",
    fileContent: buffer,
  });
  return upload.fileID;
};

// 创建集合
const createCollection = async () => {
  try {
    // 创建集合
    await db.createCollection("sales");
    await db.collection("sales").add({
      // data 字段表示需新增的 JSON 数据
      data: {
        region: "华东",
        city: "上海",
        sales: 11,
      },
    });
    await db.collection("sales").add({
      // data 字段表示需新增的 JSON 数据
      data: {
        region: "华东",
        city: "南京",
        sales: 11,
      },
    });
    await db.collection("sales").add({
      // data 字段表示需新增的 JSON 数据
      data: {
        region: "华南",
        city: "广州",
        sales: 22,
      },
    });
    await db.collection("sales").add({
      // data 字段表示需新增的 JSON 数据
      data: {
        region: "华南",
        city: "深圳",
        sales: 22,
      },
    });
    return {
      success: true,
    };
  } catch (e) {
    // 这里catch到的是该collection已经存在，从业务逻辑上来说是运行成功的，所以catch返回success给前端，避免工具在前端抛出异常
    return {
      success: true,
      data: "create collection success",
    };
  }
};

// 查询数据
const selectRecord = async () => {
  // 返回数据库查询结果
  return await db.collection("sales").get();
};

// ★★★ OneNET 代理：设备属性查询
const iotQuery = async (event) => {
  const { productId, deviceName } = event;
  const url = "https://iot-api.heclouds.com/thingmodel/query-device-property";
  const resp = await got.post(url, {
    json: { product_id: productId, device_name: deviceName },
    headers: { "X-API-Key": ONENET_KEY },
    timeout: { request: 8000 }
  }).json();
  return resp; // 그대로 돌려주거나 필요한 필드만 뽑아도 됨
};

// ★★★ OneNET 代理：设备属性设置
const iotControl = async (event) => {
  const { productId, deviceName, params } = event; // 예: { pump:true } 또는 { autoMode:false }
  const url = "https://iot-api.heclouds.com/thingmodel/set-device-property";
  const resp = await got.post(url, {
    json: { product_id: productId, device_name: deviceName, params },
    headers: { "X-API-Key": ONENET_KEY },
    timeout: { request: 8000 }
  }).json();
  return resp;
};


// 更新数据
const updateRecord = async (event) => {
  try {
    // 遍历修改数据库信息
    for (let i = 0; i < event.data.length; i++) {
      await db
        .collection("sales")
        .where({
          _id: event.data[i]._id,
        })
        .update({
          data: {
            sales: event.data[i].sales,
          },
        });
    }
    return {
      success: true,
      data: event.data,
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e,
    };
  }
};

// 新增数据
const insertRecord = async (event) => {
  try {
    const insertRecord = event.data;
    // 插入数据
    await db.collection("sales").add({
      data: {
        region: insertRecord.region,
        city: insertRecord.city,
        sales: Number(insertRecord.sales),
      },
    });
    return {
      success: true,
      data: event.data,
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e,
    };
  }
};

// 删除数据
const deleteRecord = async (event) => {
  try {
    await db
      .collection("sales")
      .where({
        _id: event.data._id,
      })
      .remove();
    return {
      success: true,
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e,
    };
  }
};

const AUTO_PUMP_MS = 3000;
const autoWater = async (event) => {
  const { productId, deviceName, threshold = 40 } = event;
  const q = await iotQuery({ productId, deviceName });
  const soil = q?.data?.data?.soilMoisture;
  if (soil == null) return { skipped: true, reason: 'no soil' };
  if (soil < threshold) {
    await iotControl({ productId, deviceName, params: { pump: true } });
    await new Promise(r => setTimeout(r, AUTO_PUMP_MS));
    await iotControl({ productId, deviceName, params: { pump: false } });
    return { watered: true, soil };
  }
  return { watered: false, soil };
};


// const getOpenId = require('./getOpenId/index');
// const getMiniProgramCode = require('./getMiniProgramCode/index');
// const createCollection = require('./createCollection/index');
// const selectRecord = require('./selectRecord/index');
// const updateRecord = require('./updateRecord/index');
// const sumRecord = require('./sumRecord/index');
// const fetchGoodsList = require('./fetchGoodsList/index');
// const genMpQrcode = require('./genMpQrcode/index');
// 云函数入口函数
exports.main = async (event, context) => {
  switch (event.type) {
    case "getOpenId":
      return await getOpenId();
    case "getMiniProgramCode":
      return await getMiniProgramCode();
    case "createCollection":
      return await createCollection();
    case "selectRecord":
      return await selectRecord();
    case "updateRecord":
      return await updateRecord(event);
    case "insertRecord":
      return await insertRecord(event);
    case "deleteRecord":
      return await deleteRecord(event);
      
      case "iot.query":
        return await iotQuery(event);
      case "iot.control":
        return await iotControl(event);
      
      case 'weather.get': return await weatherGet(event);
      
      case 'auto.water':
        return await autoWater(event);
      
  }
};

// --- Weather (Open-Meteo) ---
const weatherGet = async (event) => {
  const { lat, lon } = event;
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}:${Math.floor(Date.now()/3600000)}`; // 1h 버켓
  const cache = await db.collection('weatherCache').doc(key).get().catch(()=>null);
  if (cache && cache.data) return cache.data.payload;

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,pm10&hourly=pm10`;
  const payload = await got(url, { timeout:{request:8000} }).json();

  await db.collection('weatherCache').doc(key).set({ data:{ payload, ts: Date.now() }});
  return payload;
};

