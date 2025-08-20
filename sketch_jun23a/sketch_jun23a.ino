#include "DHT.h"  //包含温湿度传感器库
#include <SoftwareSerial.h>
#include <ArduinoJson.h>


// 网络配置
const char* WIFI_SSID = "esp8266";
const char* WIFI_PWD = "12345678";
const char* MQTT_SERVER = "mqtts.heclouds.com";

#define DHTTYPE DHT11
#define DHTPIN 2           //定义DHT11引脚
DHT dht(DHTPIN, DHTTYPE);  //定义DHT11传感器信息
/*---------------引脚定义------------*/
int J1 = 4;  //继电器
/*-----------------------------------*/
int K_FLAG = 0;  //按钮标志位
int a = 0;       //定时器用

int LUX = 0;  //光强
int TEM = 0;  //温度
int HUM = 0;  //湿度

int TS = 0;
int ZDKZ = 0;
int KEY = 5;  //自动控制切换按钮

// OneNET 物联参数
const int MQTT_PORT = 1883;
#define PRODUCT_ID "969d3BTNO2"
#define DEVICE_NAME "ESP8266"
#define TOKEN "version=2018-10-31&res=products%2F969d3BTNO2%2Fdevices%2FESP8266&et=1767245123&method=md5&sign=P%2FhzlD4QjA9n0T8PJtJH%2Bg%3D%3D"  // 硬件配置
SoftwareSerial espSerial(9, 10);                                                                                                                 // RX=9, TX=10  注意前面的是指arduino的TRX,连线时候ESP8266的TX应接9，RX接10

// 全局变量
const unsigned long readInterval = 3000;  // 数据上报周期(ms)
int postMsgId = 0;                        // 消息序列号
bool TLED_state = true;                   // LED开关状态



//前置函数声明
bool sendATCommand(const char* cmd, const char* ack, unsigned int timeout);

void initESP8266();
void Post_Sensor();
void Post_Switch();

void setup() {
  Serial.begin(115200);     // 调试串口
  espSerial.begin(115200);  // ESP8266通信
  initESP8266();

  dht.begin();            //打开DHT11传感器
  pinMode(J1, OUTPUT);    //设置继电器为输出模式
  digitalWrite(J1, LOW);  //关闭继电器
}

void GQ()  //光强模块
{
  uint16_t lux = analogRead(1);
  LUX = lux;
}

void DHT1()  //温湿度传感器
{
  float h = dht.readHumidity();
  float t = dht.readTemperature();
  float f = dht.readTemperature(true);
  TEM = t;
  HUM = h;
}

void TRSD()  //土壤湿度检测
{
  int SDTS = 400;
  TS = analogRead(0);
  if (ZDKZ == 0) {
    if (TS > SDTS)  //土壤没有水
    {
      digitalWrite(J1, HIGH);  //打开继电器
    } else //没有被按钮按下
    {
      digitalWrite(J1, LOW);  //关闭继电器
    }
  }
}

void loop() {
  if (digitalRead(KEY) == HIGH) {
    delay(100);
    if (digitalRead(KEY) == HIGH) {
      while (digitalRead(KEY) == HIGH)
        ;
      if (ZDKZ == 1) {
        ZDKZ = 0;
      } else {
        ZDKZ = 1;
      }
    }
  }
  handleMQTTMessage();
  DHT1();
  GQ();    //光强模块
  TRSD();  //土壤湿度检测
  // 定时上传数据
  static unsigned long lastPost = 0;
  if (millis() - lastPost >= readInterval) {
    Post_Switch();
    Post_Sensor();
    Post_Sensor1();
    Post_Sensor2();
    Post_Sensor3();
    lastPost = millis();
  }
}

// AT指令发送函数（带超时检测）
bool sendATCommand(const char* cmd, const char* ack, unsigned int timeout) {
  espSerial.println(cmd);
  unsigned long start = millis();
  String response;

  while (millis() - start < timeout) {
    while (espSerial.available()) {
      char c = espSerial.read();
      response += c;
    }
    if (response.indexOf(ack) != -1) {
      Serial.print("[SUCCESS] ");
      Serial.println(cmd);
      return true;
    }
  }
  Serial.print("[ERROR] ");
  Serial.print(cmd);
  Serial.println(" 未收到预期响应");
  return false;
}

void initESP8266() {
  // 初始化ESP8266
  sendATCommand("AT", "OK", 2000);
  //sendATCommand("AT+RST", "ready", 8000);
  sendATCommand("AT+CWMODE=1", "OK", 1000);
  sendATCommand("AT+CWDHCP=1,1", "OK", 1000);

  // 连接WiFi
  String cmd = "AT+CWJAP=\"" + String(WIFI_SSID) + "\",\"" + String(WIFI_PWD) + "\"";
  sendATCommand(cmd.c_str(), "OK", 5000);  // 配置MQTT
  String mqttCfg = "AT+MQTTUSERCFG=0,1,\"" + String(DEVICE_NAME) + "\",\"" + String(PRODUCT_ID) + "\",\"" + String(TOKEN) + "\",0,0,\"\"";
  sendATCommand(mqttCfg.c_str(), "OK", 5000);

  // 连接服务器
  String connCmd = "AT+MQTTCONN=0,\"" + String(MQTT_SERVER) + "\"," + String(MQTT_PORT) + ",1";
  sendATCommand(connCmd.c_str(), "OK", 5000);


  // 添加订阅命令（在MQTT连接成功后）
  String subscribeCmd = "AT+MQTTSUB=0,\"$sys/" + String(PRODUCT_ID) + "/" + String(DEVICE_NAME) + "/thing/property/set\",1";
  sendATCommand(subscribeCmd.c_str(), "OK", 2000);
}


void Post_Sensor() {
  postMsgId++;

  // 手动拼接字符串，双引号 \"，逗号 \,，符合 ESP8266 的 AT 命令转义要求
  String jsonPayload = "\\\"id\\\":\\\"" + String(postMsgId) + "\\\"\\,"
                       + "\\\"version\\\":\\\"1.0\\\"\\,"
                       + "\\\"params\\\":{"
                       + "\\\"HUM\\\":{\\\"value\\\":" + HUM + "}"
                       + "}";

  jsonPayload = "{" + jsonPayload + "}";

  // 构造 MQTT 发布命令
  String pubCmd = "AT+MQTTPUB=0,\"$sys/" + String(PRODUCT_ID) + "/" + String(DEVICE_NAME)
                  + "/thing/property/post\",\"" + jsonPayload + "\",0,0";

  // 发送
  sendATCommand(pubCmd.c_str(), "OK", 3000);
}

void Post_Sensor1() {
  postMsgId++;

  // 手动拼接字符串，双引号 \"，逗号 \,，符合 ESP8266 的 AT 命令转义要求
  String jsonPayload = "\\\"id\\\":\\\"" + String(postMsgId) + "\\\"\\,"
                       + "\\\"version\\\":\\\"1.0\\\"\\,"
                       + "\\\"params\\\":{"
                       + "\\\"GZ\\\":{\\\"value\\\":" + LUX + "}"
                       + "}";

  jsonPayload = "{" + jsonPayload + "}";

  // 构造 MQTT 发布命令
  String pubCmd = "AT+MQTTPUB=0,\"$sys/" + String(PRODUCT_ID) + "/" + String(DEVICE_NAME)
                  + "/thing/property/post\",\"" + jsonPayload + "\",0,0";

  // 发送
  sendATCommand(pubCmd.c_str(), "OK", 3000);
}

void Post_Sensor2() {
  postMsgId++;

  // 手动拼接字符串，双引号 \"，逗号 \,，符合 ESP8266 的 AT 命令转义要求
  String jsonPayload = "\\\"id\\\":\\\"" + String(postMsgId) + "\\\"\\,"
                       + "\\\"version\\\":\\\"1.0\\\"\\,"
                       + "\\\"params\\\":{"
                       + "\\\"TRSD\\\":{\\\"value\\\":" + TS + "}"
                       + "}";

  jsonPayload = "{" + jsonPayload + "}";

  // 构造 MQTT 发布命令
  String pubCmd = "AT+MQTTPUB=0,\"$sys/" + String(PRODUCT_ID) + "/" + String(DEVICE_NAME)
                  + "/thing/property/post\",\"" + jsonPayload + "\",0,0";

  // 发送
  sendATCommand(pubCmd.c_str(), "OK", 3000);
}

void Post_Sensor3() {
  postMsgId++;

      // 手动拼接字符串，双引号 \"，逗号 \,，符合 ESP8266 的 AT 命令转义要求
  String jsonPayload = "\\\"id\\\":\\\"" + String(postMsgId) + "\\\"\\,"
                       + "\\\"version\\\":\\\"1.0\\\"\\,"
                       + "\\\"params\\\":{"
                       + "\\\"ZD\\\":{\\\"value\\\":" + (ZDKZ ? "true" : "false") + "}"
                       + "}";

  jsonPayload = "{" + jsonPayload + "}";

  // 构造 MQTT 发布命令
  String pubCmd = "AT+MQTTPUB=0,\"$sys/" + String(PRODUCT_ID) + "/" + String(DEVICE_NAME)
                  + "/thing/property/post\",\"" + jsonPayload + "\",0,0";

  // 发送
  sendATCommand(pubCmd.c_str(), "OK", 3000);
}

void Post_Switch() {
  postMsgId++;

  // 手动拼接字符串，双引号 \"，逗号 \,，符合 ESP8266 的 AT 命令转义要求
  String jsonPayload = "\\\"id\\\":\\\"" + String(postMsgId) + "\\\"\\,"
                       + "\\\"version\\\":\\\"1.0\\\"\\,"
                       + "\\\"params\\\":{"
                       + "\\\"TEN\\\":{\\\"value\\\":" + TEM + "}"
                       + "}";

  jsonPayload = "{" + jsonPayload + "}";

  // 构造 MQTT 发布命令
  String pubCmd = "AT+MQTTPUB=0,\"$sys/" + String(PRODUCT_ID) + "/" + String(DEVICE_NAME)
                  + "/thing/property/post\",\"" + jsonPayload + "\",0,0";

  // 发送
  sendATCommand(pubCmd.c_str(), "OK", 3000);
}


void handleMQTTMessage() {
  const unsigned long timeout = 2000;  // 设置超时时间为2000毫秒
  unsigned long startTime = millis();
  String message;

  // 读取串口数据，直到超时或遇到'}'字符
  while (millis() - startTime < timeout) {
    if (espSerial.available()) {
      char c = espSerial.read();
      message += c;
      if (c == '}') {
        break;  // 如果遇到'}'字符，停止读取
      }
    }
  }

  Serial.print("收到原始消息：");
  Serial.println(message);  // 调试输出
  if (ZDKZ == 1) {
    if (message.indexOf("49") != -1) {  // 检测到新消息
      digitalWrite(J1, LOW);
    }
    if (message.indexOf("48") != -1) {  // 检测到新消息
      digitalWrite(J1, HIGH);
    }
  }
}