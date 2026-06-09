# DZUltra 天气 API Provider 调研报告

## Provider 1：高德天气 API

**Provider 名称：** 高德地图天气查询服务
**官方文档链接：** <https://lbs.amap.com/api/webservice/guide/api/weatherinfo>
**是否官方 API：** 是
**是否需要账号/Key：** 是，需在高德开放平台注册并申请Web服务API Key
**是否可商用/是否有调用限制：** 可商用；免费版30万次/日，200次/秒并发；付费版可提升配额

### 可获取字段：

- **字段名：** province
  - **含义：** 省份名称
  - **类型：** String
  - **示例：** "北京"
  - **是否实时：** 否
  - **是否预测：** 否
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 定位天气数据对应的行政区域
- **字段名：** city
  - **含义：** 城市/区县名称
  - **类型：** String
  - **示例：** "东城区"
  - **是否实时：** 否
  - **是否预测：** 否
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 定位天气数据对应的行政区域
- **字段名：** adcode
  - **含义：** 区域编码
  - **类型：** String
  - **示例：** "110101"
  - **是否实时：** 否
  - **是否预测：** 否
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 唯一标识行政区域，用于精确查询
- **字段名：** weather
  - **含义：** 天气现象（汉字描述）
  - **类型：** String
  - **示例：** "阴"、"晴"、"小雨"
  - **是否实时：** 是（实况）/否（预报）
  - **是否预测：** 否（实况）/是（预报）
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 判断是否适合步行、室外活动、拍照等
- **字段名：** temperature
  - **含义：** 实时气温/预报气温
  - **类型：** String（数值）
  - **示例：** "8"
  - **是否实时：** 是（实况）/否（预报）
  - **是否预测：** 否（实况）/是（预报）
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 评估出行舒适度，建议穿着
- **字段名：** winddirection
  - **含义：** 风向描述
  - **类型：** String
  - **示例：** "南"、"东北"
  - **是否实时：** 是（实况）/否（预报）
  - **是否预测：** 否（实况）/是（预报）
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 评估骑行、步行的舒适度和安全性
- **字段名：** windpower
  - **含义：** 风力级别
  - **类型：** String
  - **示例：** "≤3"、"4-5"
  - **是否实时：** 是（实况）/否（预报）
  - **是否预测：** 否（实况）/是（预报）
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 评估骑行、步行的舒适度和安全性
- **字段名：** humidity
  - **含义：** 空气湿度（百分比）
  - **类型：** String（数值）
  - **示例：** "20"
  - **是否实时：** 是（实况）/否（预报）
  - **是否预测：** 否（实况）/是（预报）
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 评估出行舒适度
- **字段名：** reporttime
  - **含义：** 数据发布的时间
  - **类型：** String
  - **示例：** "2022-03-22 16:10:59"
  - **是否实时：** 是
  - **是否预测：** 否
  - **是否适合进入 Constraint Ledger：** 否
  - **对 PlanSolver/PlanEvaluator 的作用：** 评估数据的时效性
- **字段名：** date
  - **含义：** 预报日期
  - **类型：** String
  - **示例：** "2022-03-23"
  - **是否实时：** 否
  - **是否预测：** 是
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 标识预报对应的日期
- **字段名：** week
  - **含义：** 星期
  - **类型：** String
  - **示例：** "星期三"
  - **是否实时：** 否
  - **是否预测：** 是
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 标识预报对应的星期
- **字段名：** dayweather
  - **含义：** 白天天气现象
  - **类型：** String
  - **示例：** "晴"
  - **是否实时：** 否
  - **是否预测：** 是
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 判断白天是否适合步行、室外活动、拍照等
- **字段名：** nightweather
  - **含义：** 夜间天气现象
  - **类型：** String
  - **示例：** "多云"
  - **是否实时：** 否
  - **是否预测：** 是
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 判断夜间是否适合步行、室外活动等
- **字段名：** daytemp
  - **含义：** 白天最高气温
  - **类型：** String（数值）
  - **示例：** "15"
  - **是否实时：** 否
  - **是否预测：** 是
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 评估白天出行舒适度
- **字段名：** nighttemp
  - **含义：** 夜间最低气温
  - **类型：** String（数值）
  - **示例：** "5"
  - **是否实时：** 否
  - **是否预测：** 是
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 评估夜间出行舒适度
- **字段名：** daywind
  - **含义：** 白天风向
  - **类型：** String
  - **示例：** "东北风"
  - **是否实时：** 否
  - **是否预测：** 是
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 评估白天骑行、步行的舒适度和安全性
- **字段名：** nightwind
  - **含义：** 夜间风向
  - **类型：** String
  - **示例：** "北风"
  - **是否实时：** 否
  - **是否预测：** 是
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 评估夜间骑行、步行的舒适度和安全性
- **字段名：** daypower
  - **含义：** 白天风力
  - **类型：** String
  - **示例：** "3-4级"
  - **是否实时：** 否
  - **是否预测：** 是
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 评估白天骑行、步行的舒适度和安全性
- **字段名：** nightpower
  - **含义：** 夜间风力
  - **类型：** String
  - **示例：** "2-3级"
  - **是否实时：** 否
  - **是否预测：** 是
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 评估夜间骑行、步行的舒适度和安全性

### 不可获取但 DZUltra 需要的字段：

- **字段名：** 经纬度天气查询
  - **建议 mock 方式：** 先调用高德逆地理编码API将经纬度转换为adcode，再调用天气API
  - **未来可能的数据来源：** 高德地图未来可能开放直接经纬度查询天气的接口
- **字段名：** 未来逐小时天气
  - **建议 mock 方式：** 基于逐日天气数据插值生成逐小时数据
  - **未来可能的数据来源：** 高德地图未来可能开放逐小时预报接口
- **字段名：** 体感温度
  - **建议 mock 方式：** 基于温度、湿度、风速计算体感温度
  - **未来可能的数据来源：** 高德地图未来可能开放体感温度字段
- **字段名：** 降雨概率
  - **建议 mock 方式：** 基于天气现象和历史数据估算
  - **未来可能的数据来源：** 高德地图未来可能开放降雨概率字段
- **字段名：** 降雨量
  - **建议 mock 方式：** 基于天气现象和历史数据估算
  - **未来可能的数据来源：** 高德地图未来可能开放降雨量字段
- **字段名：** 空气质量
  - **建议 mock 方式：** 调用高德空气质量API单独获取
  - **未来可能的数据来源：** 高德地图未来可能将空气质量整合到天气API中

### 接口示例：

- **请求参数：**
  ```
  key: 你的API_KEY
  city: 110101
  extensions: all
  output: JSON
  ```
- **返回片段：**
  ```json
  {
    "status": "1",
    "count": "1",
    "info": "OK",
    "infocode": "10000",
    "lives": [
      {
        "province": "北京",
        "city": "东城区",
        "adcode": "110101",
        "weather": "阴",
        "temperature": "8",
        "winddirection": "南",
        "windpower": "≤3",
        "humidity": "20",
        "reporttime": "2022-03-22 16:10:59"
      }
    ],
    "forecasts": [
      {
        "city": "东城区",
        "adcode": "110101",
        "province": "北京",
        "reporttime": "2022-03-22 11:00:00",
        "casts": [
          {
            "date": "2022-03-22",
            "week": "2",
            "dayweather": "阴",
            "nightweather": "多云",
            "daytemp": "10",
            "nighttemp": "3",
            "daywind": "东北",
            "nightwind": "东北",
            "daypower": "3-4",
            "nightpower": "3-4"
          },
          {
            "date": "2022-03-23",
            "week": "3",
            "dayweather": "晴",
            "nightweather": "晴",
            "daytemp": "15",
            "nighttemp": "5",
            "daywind": "北",
            "nightwind": "北",
            "daypower": "3-4",
            "nightpower": "2-3"
          }
        ]
      }
    ]
  }
  ```

### 风险：

- **配额：** 免费版30万次/日，对于大规模应用可能不足
- **精度：** 城市/区县级别，无法精确到具体经纬度
- **延迟：** 一般在100ms以内
- **合规/隐私：** 需遵守高德开放平台服务协议，不得将数据用于非法用途
- **地域覆盖：** 中国大陆地区全覆盖，港澳台地区部分支持

***

## Provider 2：和风天气 API v7

**Provider 名称：** 和风天气开发服务
**官方文档链接：** <https://dev.qweather.com/docs/api/>
**是否官方 API：** 是
**是否需要账号/Key：** 是，需在和风天气开发者平台注册并获取认证密钥（JWT Token或API Key）
**是否可商用/是否有调用限制：** 可商用；免费开发版1000次/天，200次/分钟；付费版可提升配额

### 可获取字段：

- **字段名：** location
  - **含义：** 地区LocationID或经纬度坐标
  - **类型：** String
  - **示例：** "101010100"或"116.41,39.92"
  - **是否实时：** 否
  - **是否预测：** 否
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 定位天气数据对应的地理位置
- **字段名：** updateTime
  - **含义：** API的最近更新时间
  - **类型：** String（ISO 8601格式）
  - **示例：** "2021-02-16T13:35+08:00"
  - **是否实时：** 是
  - **是否预测：** 否
  - **是否适合进入 Constraint Ledger：** 否
  - **对 PlanSolver/PlanEvaluator 的作用：** 评估数据的时效性
- **字段名：** fxTime
  - **含义：** 预报时间（逐小时）
  - **类型：** String（ISO 8601格式）
  - **示例：** "2021-02-16T15:00+08:00"
  - **是否实时：** 否
  - **是否预测：** 是
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 标识逐小时预报对应的时间
- **字段名：** fxDate
  - **含义：** 预报日期（逐日）
  - **类型：** String
  - **示例：** "2023-10-01"
  - **是否实时：** 否
  - **是否预测：** 是
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 标识逐日预报对应的日期
- **字段名：** temp
  - **含义：** 温度
  - **类型：** String（数值）
  - **示例：** "2"
  - **是否实时：** 是（实况）/否（预报）
  - **是否预测：** 否（实况）/是（预报）
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 评估出行舒适度，建议穿着
- **字段名：** feelsLike
  - **含义：** 体感温度
  - **类型：** String（数值）
  - **示例：** "-5"
  - **是否实时：** 是（实况）/否（预报）
  - **是否预测：** 否（实况）/是（预报）
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 更准确地评估出行舒适度
- **字段名：** text
  - **含义：** 天气状况的文字描述
  - **类型：** String
  - **示例：** "晴"、"小雨"、"大雪"
  - **是否实时：** 是（实况）/否（预报）
  - **是否预测：** 否（实况）/是（预报）
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 判断是否适合步行、室外活动、拍照等
- **字段名：** icon
  - **含义：** 天气状况的图标代码
  - **类型：** String
  - **示例：** "100"
  - **是否实时：** 是（实况）/否（预报）
  - **是否预测：** 否（实况）/是（预报）
  - **是否适合进入 Constraint Ledger：** 否
  - **对 PlanSolver/PlanEvaluator 的作用：** 用于显示天气图标
- **字段名：** wind360
  - **含义：** 风向360角度
  - **类型：** String（数值）
  - **示例：** "335"
  - **是否实时：** 是（实况）/否（预报）
  - **是否预测：** 否（实况）/是（预报）
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 精确评估风向对出行的影响
- **字段名：** windDir
  - **含义：** 风向文字描述
  - **类型：** String
  - **示例：** "西北风"
  - **是否实时：** 是（实况）/否（预报）
  - **是否预测：** 否（实况）/是（预报）
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 评估骑行、步行的舒适度和安全性
- **字段名：** windScale
  - **含义：** 风力等级
  - **类型：** String
  - **示例：** "3-4"
  - **是否实时：** 是（实况）/否（预报）
  - **是否预测：** 否（实况）/是（预报）
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 评估骑行、步行的舒适度和安全性
- **字段名：** windSpeed
  - **含义：** 风速（公里/小时）
  - **类型：** String（数值）
  - **示例：** "20"
  - **是否实时：** 是（实况）/否（预报）
  - **是否预测：** 否（实况）/是（预报）
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 精确评估风速对出行的影响
- **字段名：** humidity
  - **含义：** 相对湿度（百分比）
  - **类型：** String（数值）
  - **示例：** "11"
  - **是否实时：** 是（实况）/否（预报）
  - **是否预测：** 否（实况）/是（预报）
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 评估出行舒适度
- **字段名：** pop
  - **含义：** 降水概率（百分比）
  - **类型：** String（数值）
  - **示例：** "0"、"80"
  - **是否实时：** 否
  - **是否预测：** 是
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 评估降雨风险，决定是否需要带雨具或选择室内路线
- **字段名：** precip
  - **含义：** 降水量（毫米）
  - **类型：** String（数值）
  - **示例：** "0.0"、"5.2"
  - **是否实时：** 是（实况）/否（预报）
  - **是否预测：** 否（实况）/是（预报）
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 评估降雨强度，决定是否需要带雨具或选择室内路线
- **字段名：** pressure
  - **含义：** 大气压强（百帕）
  - **类型：** String（数值）
  - **示例：** "1025"
  - **是否实时：** 是（实况）/否（预报）
  - **是否预测：** 否（实况）/是（预报）
  - **是否适合进入 Constraint Ledger：** 否
  - **对 PlanSolver/PlanEvaluator 的作用：** 对普通出行影响较小
- **字段名：** cloud
  - **含义：** 云量（百分比）
  - **类型：** String（数值）
  - **示例：** "0"、"48"
  - **是否实时：** 是（实况）/否（预报）
  - **是否预测：** 否（实况）/是（预报）
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 评估拍照效果和紫外线强度
- **字段名：** dew
  - **含义：** 露点温度
  - **类型：** String（数值）
  - **示例：** "-25"
  - **是否实时：** 是（实况）/否（预报）
  - **是否预测：** 否（实况）/是（预报）
  - **是否适合进入 Constraint Ledger：** 否
  - **对 PlanSolver/PlanEvaluator 的作用：** 对普通出行影响较小
- **字段名：** tempMax
  - **含义：** 最高温度（逐日）
  - **类型：** String（数值）
  - **示例：** "28"
  - **是否实时：** 否
  - **是否预测：** 是
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 评估白天出行舒适度
- **字段名：** tempMin
  - **含义：** 最低温度（逐日）
  - **类型：** String（数值）
  - **示例：** "18"
  - **是否实时：** 否
  - **是否预测：** 是
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 评估夜间出行舒适度
- **字段名：** textDay
  - **含义：** 白天天气状况文字描述（逐日）
  - **类型：** String
  - **示例：** "多云"
  - **是否实时：** 否
  - **是否预测：** 是
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 判断白天是否适合步行、室外活动、拍照等
- **字段名：** textNight
  - **含义：** 夜间天气状况文字描述（逐日）
  - **类型：** String
  - **示例：** "晴"
  - **是否实时：** 否
  - **是否预测：** 是
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 判断夜间是否适合步行、室外活动等
- **字段名：** aqi
  - **含义：** 空气质量指数
  - **类型：** String（数值）
  - **示例：** "45"
  - **是否实时：** 是（实况）/否（预报）
  - **是否预测：** 否（实况）/是（预报）
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 评估空气质量对健康的影响，建议是否进行室外活动
- **字段名：** pm25
  - **含义：** PM2.5浓度（μg/m³）
  - **类型：** String（数值）
  - **示例：** "12"
  - **是否实时：** 是（实况）/否（预报）
  - **是否预测：** 否（实况）/是（预报）
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 评估空气质量对健康的影响，建议是否进行室外活动
- **字段名：** pm10
  - **含义：** PM10浓度（μg/m³）
  - **类型：** String（数值）
  - **示例：** "25"
  - **是否实时：** 是（实况）/否（预报）
  - **是否预测：** 否（实况）/是（预报）
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 评估空气质量对健康的影响，建议是否进行室外活动
- **字段名：** o3
  - **含义：** 臭氧浓度（μg/m³）
  - **类型：** String（数值）
  - **示例：** "60"
  - **是否实时：** 是（实况）/否（预报）
  - **是否预测：** 否（实况）/是（预报）
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 评估空气质量对健康的影响，建议是否进行室外活动

### 不可获取但 DZUltra 需要的字段：

- **字段名：** 无（所有DZUltra需要的字段都已支持）
  - **建议 mock 方式：** 无需mock
  - **未来可能的数据来源：** 无需额外数据来源

### 接口示例：

- **请求参数（逐小时预报）：**
  ```
  Authorization: Bearer your_token
  location: 116.41,39.92
  hours: 24h
  lang: zh-CN
  unit: m
  ```
- **返回片段（逐小时预报）：**
  ```json
  {
    "code": "200",
    "updateTime": "2021-02-16T13:35+08:00",
    "fxLink": "http://hfx.link/2ax1",
    "hourly": [
      {
        "fxTime": "2021-02-16T15:00+08:00",
        "temp": "2",
        "icon": "100",
        "text": "晴",
        "wind360": "335",
        "windDir": "西北风",
        "windScale": "3-4",
        "windSpeed": "20",
        "humidity": "11",
        "pop": "0",
        "precip": "0.0",
        "pressure": "1025",
        "cloud": "0",
        "dew": "-25"
      },
      {
        "fxTime": "2021-02-16T16:00+08:00",
        "temp": "1",
        "icon": "100",
        "text": "晴",
        "wind360": "339",
        "windDir": "西北风",
        "windScale": "3-4",
        "windSpeed": "24",
        "humidity": "11",
        "pop": "0",
        "precip": "0.0",
        "pressure": "1025",
        "cloud": "0",
        "dew": "-26"
      }
    ],
    "refer": {
      "sources": ["QWeather", "NMC", "ECMWF"],
      "license": ["QWeather Developers License"]
    }
  }
  ```

### 风险：

- **配额：** 免费版1000次/天，对于大规模应用可能不足
- **精度：** 支持经纬度查询，分辨率达3-5公里
- **延迟：** 一般在150ms以内
- **合规/隐私：** 需遵守和风天气开发者服务协议，不得将数据用于非法用途
- **地域覆盖：** 全球20多万个城市，中国大陆地区全覆盖

***

## Provider 3：彩云天气 API v2.6

**Provider 名称：** 彩云天气API
**官方文档链接：** <https://docs.caiyunapp.com/weather-api/v2/v2.6/index.html>
**是否官方 API：** 是
**是否需要账号/Key：** 是，需在彩云科技开放平台注册并获取API Token
**是否可商用/是否有调用限制：** 可商用；免费版1000次/天；付费版3元/万次，300元/月（5万次/天）

### 可获取字段：

- **字段名：** location
  - **含义：** 经纬度坐标（经度在前，纬度在后）
  - **类型：** String
  - **示例：** "121.6544,25.1552"
  - **是否实时：** 否
  - **是否预测：** 否
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 定位天气数据对应的精确地理位置
- **字段名：** server\_time
  - **含义：** 服务器时间
  - **类型：** Number（Unix时间戳）
  - **示例：** 1613456789
  - **是否实时：** 是
  - **是否预测：** 否
  - **是否适合进入 Constraint Ledger：** 否
  - **对 PlanSolver/PlanEvaluator 的作用：** 评估数据的时效性
- **字段名：** temperature
  - **含义：** 温度（摄氏度）
  - **类型：** Number
  - **示例：** 8.5
  - **是否实时：** 是（实况）/否（预报）
  - **是否预测：** 否（实况）/是（预报）
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 评估出行舒适度，建议穿着
- **字段名：** apparent\_temperature
  - **含义：** 体感温度（摄氏度）
  - **类型：** Number
  - **示例：** 5.2
  - **是否实时：** 是（实况）/否（预报）
  - **是否预测：** 否（实况）/是（预报）
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 更准确地评估出行舒适度
- **字段名：** skycon
  - **含义：** 天气现象代码
  - **类型：** String
  - **示例：** "CLEAR\_DAY"、"RAIN"、"SNOW"
  - **是否实时：** 是（实况）/否（预报）
  - **是否预测：** 否（实况）/是（预报）
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 判断是否适合步行、室外活动、拍照等
- **字段名：** humidity
  - **含义：** 相对湿度（0-1）
  - **类型：** Number
  - **示例：** 0.2
  - **是否实时：** 是（实况）/否（预报）
  - **是否预测：** 否（实况）/是（预报）
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 评估出行舒适度
- **字段名：** wind.speed
  - **含义：** 风速（米/秒）
  - **类型：** Number
  - **示例：** 1.8
  - **是否实时：** 是（实况）/否（预报）
  - **是否预测：** 否（实况）/是（预报）
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 精确评估风速对出行的影响
- **字段名：** wind.direction
  - **含义：** 风向（0-360度，0度为正北）
  - **类型：** Number
  - **示例：** 22
  - **是否实时：** 是（实况）/否（预报）
  - **是否预测：** 否（实况）/是（预报）
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 精确评估风向对出行的影响
- **字段名：** precipitation.local.intensity
  - **含义：** 本地降水强度（毫米/小时）
  - **类型：** Number
  - **示例：** 0.0、5.0
  - **是否实时：** 是（实况）/否（预报）
  - **是否预测：** 否（实况）/是（预报）
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 评估降雨强度，决定是否需要带雨具或选择室内路线
- **字段名：** precipitation.probability
  - **含义：** 降水概率（0-1）
  - **类型：** Number
  - **示例：** 0.0、0.8
  - **是否实时：** 否
  - **是否预测：** 是
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 评估降雨风险，决定是否需要带雨具或选择室内路线
- **字段名：** air\_quality.aqi
  - **含义：** 空气质量指数
  - **类型：** Number
  - **示例：** 45
  - **是否实时：** 是（实况）/否（预报）
  - **是否预测：** 否（实况）/是（预报）
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 评估空气质量对健康的影响，建议是否进行室外活动
- **字段名：** air\_quality.pm25
  - **含义：** PM2.5浓度（μg/m³）
  - **类型：** Number
  - **示例：** 12
  - **是否实时：** 是（实况）/否（预报）
  - **是否预测：** 否（实况）/是（预报）
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 评估空气质量对健康的影响，建议是否进行室外活动
- **字段名：** air\_quality.pm10
  - **含义：** PM10浓度（μg/m³）
  - **类型：** Number
  - **示例：** 25
  - **是否实时：** 是（实况）/否（预报）
  - **是否预测：** 否（实况）/是（预报）
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 评估空气质量对健康的影响，建议是否进行室外活动
- **字段名：** air\_quality.o3
  - **含义：** 臭氧浓度（μg/m³）
  - **类型：** Number
  - **示例：** 60
  - **是否实时：** 是（实况）/否（预报）
  - **是否预测：** 否（实况）/是（预报）
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 评估空气质量对健康的影响，建议是否进行室外活动
- **字段名：** visibility
  - **含义：** 地表水平能见度（公里）
  - **类型：** Number
  - **示例：** 7.8
  - **是否实时：** 是（实况）/否（预报）
  - **是否预测：** 否（实况）/是（预报）
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 评估能见度对出行的影响，特别是驾驶
- **字段名：** pressure
  - **含义：** 地面气压（帕斯卡）
  - **类型：** Number
  - **示例：** 85583.47
  - **是否实时：** 是（实况）/否（预报）
  - **是否预测：** 否（实况）/是（预报）
  - **是否适合进入 Constraint Ledger：** 否
  - **对 PlanSolver/PlanEvaluator 的作用：** 对普通出行影响较小
- **字段名：** cloudrate
  - **含义：** 云量（0-1）
  - **类型：** Number
  - **示例：** 0.0、0.48
  - **是否实时：** 是（实况）/否（预报）
  - **是否预测：** 否（实况）/是（预报）
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 评估拍照效果和紫外线强度
- **字段名：** hourly.temperature
  - **含义：** 逐小时温度（摄氏度）
  - **类型：** Array<Number>
  - **示例：** \[8.5, 8.0, 7.5, ...]
  - **是否实时：** 否
  - **是否预测：** 是
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 评估不同时段的出行舒适度
- **字段名：** hourly.apparent\_temperature
  - **含义：** 逐小时体感温度（摄氏度）
  - **类型：** Array<Number>
  - **示例：** \[5.2, 4.8, 4.3, ...]
  - **是否实时：** 否
  - **是否预测：** 是
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 更准确地评估不同时段的出行舒适度
- **字段名：** hourly.skycon
  - **含义：** 逐小时天气现象
  - **类型：** Array<Object>
  - **示例：** \[{"value": "CLEAR\_DAY", "datetime": "2021-02-16T15:00:00+08:00"}, ...]
  - **是否实时：** 否
  - **是否预测：** 是
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 判断不同时段是否适合步行、室外活动、拍照等
- **字段名：** hourly.precipitation
  - **含义：** 逐小时降水强度和概率
  - **类型：** Array<Object>
  - **示例：** \[{"intensity": 0.0, "probability": 0.0, "datetime": "2021-02-16T15:00:00+08:00"}, ...]
  - **是否实时：** 否
  - **是否预测：** 是
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 评估不同时段的降雨风险和强度
- **字段名：** hourly.wind
  - **含义：** 逐小时风速和风向
  - **类型：** Array<Object>
  - **示例：** \[{"speed": 1.8, "direction": 22, "datetime": "2021-02-16T15:00:00+08:00"}, ...]
  - **是否实时：** 否
  - **是否预测：** 是
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 评估不同时段的风速和风向对出行的影响
- **字段名：** hourly.humidity
  - **含义：** 逐小时相对湿度
  - **类型：** Array<Number>
  - **示例：** \[0.2, 0.21, 0.22, ...]
  - **是否实时：** 否
  - **是否预测：** 是
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 评估不同时段的出行舒适度
- **字段名：** daily.temperature\_08h\_20h
  - **含义：** 白天（08:00-20:00）温度范围
  - **类型：** Array<Object>
  - **示例：** \[{"max": 15.0, "min": 8.0, "avg": 11.5, "datetime": "2021-02-16"}, ...]
  - **是否实时：** 否
  - **是否预测：** 是
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 评估白天出行舒适度
- **字段名：** daily.temperature\_20h\_32h
  - **含义：** 夜间（20:00-次日08:00）温度范围
  - **类型：** Array<Object>
  - **示例：** \[{"max": 8.0, "min": 3.0, "avg": 5.5, "datetime": "2021-02-16"}, ...]
  - **是否实时：** 否
  - **是否预测：** 是
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 评估夜间出行舒适度
- **字段名：** daily.skycon\_08h\_20h
  - **含义：** 白天天气现象
  - **类型：** Array<Object>
  - **示例：** \[{"value": "CLEAR\_DAY", "datetime": "2021-02-16"}, ...]
  - **是否实时：** 否
  - **是否预测：** 是
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 判断白天是否适合步行、室外活动、拍照等
- **字段名：** daily.skycon\_20h\_32h
  - **含义：** 夜间天气现象
  - **类型：** Array<Object>
  - **示例：** \[{"value": "CLEAR\_NIGHT", "datetime": "2021-02-16"}, ...]
  - **是否实时：** 否
  - **是否预测：** 是
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 判断夜间是否适合步行、室外活动等
- **字段名：** daily.precipitation\_08h\_20h
  - **含义：** 白天降水信息
  - **类型：** Array<Object>
  - **示例：** \[{"max": 0.0, "min": 0.0, "avg": 0.0, "probability": 0.0, "datetime": "2021-02-16"}, ...]
  - **是否实时：** 否
  - **是否预测：** 是
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 评估白天的降雨风险和强度
- **字段名：** daily.precipitation\_20h\_32h
  - **含义：** 夜间降水信息
  - **类型：** Array<Object>
  - **示例：** \[{"max": 0.0, "min": 0.0, "avg": 0.0, "probability": 0.0, "datetime": "2021-02-16"}, ...]
  - **是否实时：** 否
  - **是否预测：** 是
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 评估夜间的降雨风险和强度
- **字段名：** daily.wind\_08h\_20h
  - **含义：** 白天风速和风向
  - **类型：** Array<Object>
  - **示例：** \[{"speed": 1.8, "direction": 22, "datetime": "2021-02-16"}, ...]
  - **是否实时：** 否
  - **是否预测：** 是
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 评估白天的风速和风向对出行的影响
- **字段名：** daily.wind\_20h\_32h
  - **含义：** 夜间风速和风向
  - **类型：** Array<Object>
  - **示例：** \[{"speed": 1.5, "direction": 10, "datetime": "2021-02-16"}, ...]
  - **是否实时：** 否
  - **是否预测：** 是
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 评估夜间的风速和风向对出行的影响
- **字段名：** daily.air\_quality.aqi
  - **含义：** 逐日空气质量指数
  - **类型：** Array<Object>
  - **示例：** \[{"avg": 45, "datetime": "2021-02-16"}, ...]
  - **是否实时：** 否
  - **是否预测：** 是
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 评估不同日期的空气质量对健康的影响
- **字段名：** minutely.precipitation
  - **含义：** 未来2小时逐分钟降水强度
  - **类型：** Array<Number>
  - **示例：** \[0.0, 0.0, 0.0, ...]
  - **是否实时：** 否
  - **是否预测：** 是
  - **是否适合进入 Constraint Ledger：** 是
  - **对 PlanSolver/PlanEvaluator 的作用：** 精确评估短时间内的降雨风险，特别适合临时出行决策

### 不可获取但 DZUltra 需要的字段：

- **字段名：** 城市/区县名称
  - **建议 mock 方式：** 先调用逆地理编码API（如高德或百度地图）将经纬度转换为城市/区县名称
  - **未来可能的数据来源：** 彩云天气未来可能开放城市/区县名称字段
- **字段名：** 无（其他DZUltra需要的字段都已支持）
  - **建议 mock 方式：** 无需mock
  - **未来可能的数据来源：** 无需额外数据来源

### 接口示例：

- **请求参数（综合预报）：**
  ```
  token: your_api_token
  location: 121.6544,25.1552
  lang: zh-CN
  unit: metric
  ```
- **返回片段（实况天气）：**
  ```json
  {
    "status": "ok",
    "api_version": "v2.6",
    "api_status": "active",
    "lang": "zh_CN",
    "unit": "metric",
    "tzshift": 28800,
    "timezone": "Asia/Shanghai",
    "server_time": 1613456789,
    "location": [121.6544, 25.1552],
    "result": {
      "realtime": {
        "temperature": 8.5,
        "apparent_temperature": 5.2,
        "skycon": "CLEAR_DAY",
        "humidity": 0.2,
        "wind": {
          "speed": 1.8,
          "direction": 22
        },
        "precipitation": {
          "local": {
            "status": "ok",
            "datasource": "radar",
            "intensity": 0.0
          },
          "nearest": {
            "status": "ok",
            "distance": 10000,
            "intensity": 0.0
          }
        },
        "air_quality": {
          "aqi": 45,
          "pm25": 12,
          "pm10": 25,
          "o3": 60
        },
        "visibility": 7.8,
        "pressure": 85583.47,
        "cloudrate": 0.0
      },
      "hourly": {
        "status": "ok",
        "temperature": [8.5, 8.0, 7.5, 7.0, 6.5, 6.0, 5.5, 5.0, 4.5, 4.0, 3.5, 3.0, 2.5, 2.0, 1.5, 1.0, 0.5, 0.0, -0.5, -1.0, -1.5, -2.0, -2.5, -3.0],
        "apparent_temperature": [5.2, 4.8, 4.3, 3.8, 3.3, 2.8, 2.3, 1.8, 1.3, 0.8, 0.3, -0.2, -0.7, -1.2, -1.7, -2.2, -2.7, -3.2, -3.7, -4.2, -4.7, -5.2, -5.7, -6.2],
        "skycon": [
          {"value": "CLEAR_DAY", "datetime": "2021-02-16T15:00:00+08:00"},
          {"value": "CLEAR_DAY", "datetime": "2021-02-16T16:00:00+08:00"},
          {"value": "CLEAR_DAY", "datetime": "2021-02-16T17:00:00+08:00"}
        ],
        "precipitation": [
          {"intensity": 0.0, "probability": 0.0, "datetime": "2021-02-16T15:00:00+08:00"},
          {"intensity": 0.0, "probability": 0.0, "datetime": "2021-02-16T16:00:00+08:00"},
          {"intensity": 0.0, "probability": 0.0, "datetime": "2021-02-16T17:00:00+08:00"}
        ]
      }
    }
  }
  ```

### 风险：

- **配额：** 免费版1000次/天，对于大规模应用可能不足
- **精度：** 只支持经纬度查询，分辨率达1公里
- **延迟：** 一般在200ms以内
- **合规/隐私：** 需遵守彩云科技开放平台用户协议，必须在应用显著位置标注"数据来自彩云科技"
- **地域覆盖：** 全球任意地区，中国大陆地区全覆盖

***

## 推荐选型建议

基于DZUltra项目的需求（本地出行路线规划，需要未来不同时段天气用于判断是否适合步行、室外排队、拍照、骑行，以及是否需要优先室内路线），**强烈推荐使用和风天气API v7或彩云天气API v2.6**。

### 和风天气API v7 优势：

1. 支持所有DZUltra需要的字段
2. 同时支持城市ID和经纬度查询
3. 提供未来168小时（7天）逐小时预报和未来30天逐日预报
4. 数据格式规范，易于解析
5. 全球覆盖，适合未来扩展

### 彩云天气API v2.6 优势：

1. 支持所有DZUltra需要的字段
2. 提供未来360小时（15天）逐小时预报和未来15天逐日预报
3. 提供未来2小时逐分钟降水预报，特别适合临时出行决策
4. 分辨率更高（1公里）
5. 数据格式为JSON，易于解析

### 高德天气API 适用场景：

如果项目已经在使用高德地图的其他服务（如路线规划、POI搜索），可以考虑使用高德天气API，以保持数据来源的一致性。但需要注意其不支持逐小时预报、体感温度、降雨概率和降雨量等重要字段，需要自行mock。

# Agent Provider 交通 API 调研

## 1. 高德地图 Web 服务 API

**Provider 名称：** 高德地图 Web 服务 API
**官方文档链接：** <https://developer.amap.com/api/webservice/guide/api/direction>
**是否官方 API：** 是
**是否需要账号/Key：** 是，需要申请 Web 服务 API 类型的 Key
**是否可商用/是否有调用限制：**

- 个人开发者：免费配额 3000 次/日，30 万次/年
- 企业开发者：基础配额 3000 次/日，可申请提升
- 高级路径规划（未来7天）：仅向企业开发者开放，需商务咨询

### 可获取字段

| 字段名               | 含义        | 类型            | 示例                                         | 是否实时    | 是否预测    | 是否适合进入 Constraint Ledger | 对 PlanSolver/PlanEvaluator 的作用 |
| ----------------- | --------- | ------------- | ------------------------------------------ | ------- | ------- | ------------------------ | ------------------------------ |
| distance          | 路线总距离     | string(米)     | "27558"                                    | 否       | 否       | 是                        | 计算路线长度，用于距离优先策略                |
| duration          | 预计通行时间    | string(秒)     | "2644"                                     | 是（实时路况） | 是（未来预测） | 是                        | 核心 ETA 计算，判断出行耗时               |
| strategy          | 路线策略      | string        | "速度最快"                                     | 否       | 否       | 是                        | 标识路线类型，用于多方案对比                 |
| tolls             | 高速过路费     | string(元)     | "0"                                        | 否       | 否       | 是                        | 计算出行成本，用于费用优先策略                |
| toll\_distance    | 收费道路距离    | string(米)     | "0"                                        | 否       | 否       | 是                        | 评估收费路段占比                       |
| traffic\_lights   | 红绿灯个数     | integer       | 12                                         | 否       | 否       | 是                        | 评估路线舒适度和耗时稳定性                  |
| polyline          | 路线坐标点串    | string        | "116.480891,39.98937;116.480553,39.989606" | 否       | 否       | 否                        | 用于地图展示路线                       |
| status            | 路段拥堵状态    | integer       | 2                                          | 是       | 是（未来预测） | 是                        | 评估路段拥堵程度                       |
| speed             | 路段行驶速度    | integer(千米/时) | 45                                         | 是       | 是（未来预测） | 是                        | 计算路段通行时间                       |
| congestion\_index | 拥堵指数      | float         | 2.3                                        | 是       | 是（未来预测） | 是                        | 量化拥堵程度                         |
| taxi\_cost        | 出租车费用     | string(元)     | "85"                                       | 否       | 否       | 是                        | 计算打车出行成本                       |
| bus\_cost         | 公交费用      | string(元)     | "4"                                        | 否       | 否       | 是                        | 计算公共交通出行成本                     |
| walking\_distance | 公交方案总步行距离 | string(米)     | "850"                                      | 否       | 否       | 是                        | 评估公交方案舒适度                      |
| transfer\_num     | 公交换乘次数    | integer       | 2                                          | 否       | 否       | 是                        | 评估公交方案复杂度                      |
| restriction       | 限行信息      | object        | {"status": 0}                              | 否       | 是（未来预测） | 是                        | 判断路线是否有限行                      |

### 不可获取但 DZUltra 需要的字段

| 字段名      | 建议 mock 方式                           | 未来可能的数据来源         |
| -------- | ------------------------------------ | ----------------- |
| 地铁拥挤度    | 基于历史数据和时间预测（早高峰 0.8-1.0，平峰 0.3-0.5）  | 地铁官方 API、第三方数据服务商 |
| 公交准点率    | 基于线路类型和时间预测（地铁 0.95，公交 0.7-0.8）      | 公交公司实时数据          |
| 打车等待时间   | 基于区域和时间预测（市中心 3-5 分钟，郊区 10-15 分钟）    | 网约车平台 API         |
| 停车场剩余车位  | 基于停车场类型和时间预测（商场 0.2-0.5，写字楼 0.1-0.3） | 停车场管理系统 API       |
| 天气对出行的影响 | 结合天气 API 数据计算（雨天增加 20% 耗时）           | 天气 API            |

### 接口示例

**请求参数（驾车路径规划）：**

```
https://restapi.amap.com/v3/direction/driving?
origin=116.481028,39.989643&
destination=116.434446,39.90816&
extensions=all&
strategy=10&
key=<用户的key>
```

**返回片段：**

```json
{
    "status": "1",
    "info": "OK",
    "infocode": "10000",
    "count": "1",
    "route": {
        "origin": "116.481028,39.989643",
        "destination": "116.434446,39.90816",
        "paths": [
            {
                "distance": "27558",
                "duration": "2644",
                "strategy": "速度最快",
                "tolls": "0",
                "toll_distance": "0",
                "traffic_lights": 12,
                "steps": [
                    {
                        "instruction": "向北行驶109米右转",
                        "orientation": "北",
                        "distance": "109",
                        "duration": "44",
                        "polyline": "116.480891,39.98937;116.480553,39.989606",
                        "tmcs": [
                            {
                                "status": "0",
                                "distance": "109",
                                "polyline": "116.480891,39.98937;116.480553,39.989606"
                            }
                        ]
                    }
                ]
            }
        ]
    }
}
```

**未来路径规划请求示例：**

```
https://restapi.amap.com/v4/etd/driving?
origin=116.397455,39.909187&
destination=116.412422,39.908966&
firsttime=1717728000&
interval=3600&
count=24&
key=<用户的key>
```

### 风险

- **配额：** 个人开发者配额较低，高并发场景需要升级企业版
- **精度：** 实时路况更新频率约 1-2 分钟，未来预测精度随时间增加而降低
- **延迟：** 接口响应时间约 100-300ms
- **合规/隐私：** 符合中国法律法规，不收集用户隐私数据
- **地域覆盖：** 中国大陆地区全覆盖，港澳台及海外支持有限

## 2. 百度地图 Web 服务 API

**Provider 名称：** 百度地图 Web 服务 API
**官方文档链接：** <https://lbsyun.baidu.com/index.php?title=webapi/direction-api-v2>
**是否官方 API：** 是
**是否需要账号/Key：** 是，需要申请 AK（Access Key）
**是否可商用/是否有调用限制：**

- 个人开发者：免费配额 2000 次/日
- 企业开发者：基础配额 10000 次/日，可申请提升
- 未来出行规划：高级付费服务，需工单联系开通

### 可获取字段

| 字段名                   | 含义     | 类型           | 示例                              | 是否实时 | 是否预测 | 是否适合进入 Constraint Ledger | 对 PlanSolver/PlanEvaluator 的作用 |
| --------------------- | ------ | ------------ | ------------------------------- | ---- | ---- | ------------------------ | ------------------------------ |
| distance              | 路线总距离  | number(米)    | 27558                           | 否    | 否    | 是                        | 计算路线长度                         |
| duration              | 预计通行时间 | number(秒)    | 2644                            | 是    | 是    | 是                        | 核心 ETA 计算                      |
| traffic\_light\_count | 红绿灯个数  | number       | 12                              | 否    | 否    | 是                        | 评估路线舒适度                        |
| toll                  | 高速过路费  | number(元)    | 0                               | 否    | 否    | 是                        | 计算出行成本                         |
| polyline              | 路线坐标点串 | array        | \[39.91522,116.403857,-20,-697] | 否    | 否    | 否                        | 用于地图展示                         |
| level                 | 路况等级   | number       | 2                               | 是    | 是    | 是                        | 0:畅通 1:缓行 2:拥堵 3:无路况 4:严重拥堵    |
| speed                 | 路段行驶速度 | number(千米/时) | 45                              | 是    | 是    | 是                        | 计算路段通行时间                       |
| taxi\_fare            | 预估打车费  | object       | {"fare": 85}                    | 否    | 否    | 是                        | 计算打车成本                         |
| restriction           | 限行信息   | object       | {"status": 0}                   | 否    | 是    | 是                        | 判断路线是否有限行                      |
| tags                  | 路线标签   | array        | \["时间短", "红绿灯少"]                | 否    | 否    | 是                        | 用于多方案对比和解释                     |
| bus\_price            | 公交费用   | number(元)    | 4                               | 否    | 否    | 是                        | 计算公共交通成本                       |
| walking\_distance     | 公交步行距离 | number(米)    | 850                             | 否    | 否    | 是                        | 评估公交舒适度                        |
| transfer\_count       | 公交换乘次数 | number       | 2                               | 否    | 否    | 是                        | 评估公交复杂度                        |

### 不可获取但 DZUltra 需要的字段

| 字段名     | 建议 mock 方式   | 未来可能的数据来源             |
| ------- | ------------ | --------------------- |
| 地铁拥挤度   | 基于时间和线路预测    | 北京地铁官方 API、上海地铁官方 API |
| 公交准点率   | 基于线路类型和历史数据  | 各地公交集团数据              |
| 打车等待时间  | 基于区域和时间预测    | 滴滴、高德等网约车平台 API       |
| 停车场剩余车位 | 基于停车场类型和时间预测 | 智慧停车平台 API            |
| 骑行难度指数  | 基于坡度和路况计算    | 地图高程数据                |

### 接口示例

**请求参数（驾车路线规划）：**

```
https://api.map.baidu.com/direction/v2/driving?
origin=40.01116,116.339303&
destination=39.936404,116.452562&
ak=<用户的AK>&
tactics=11&
departure_time=1717728000
```

**返回片段：**

```json
{
    "status": 0,
    "message": "ok",
    "result": {
        "routes": [
            {
                "distance": 27558,
                "duration": 2644,
                "traffic_light_count": 12,
                "toll": 0,
                "tags": ["时间短", "红绿灯少"],
                "polyline": [39.91522,116.403857,-20,-697,0,0,-40,170],
                "steps": [
                    {
                        "instruction": "向北行驶109米右转",
                        "road_name": "阜荣街",
                        "distance": 109,
                        "duration": 44,
                        "speed": [
                            {
                                "level": 0,
                                "speed": 45,
                                "distance": 109
                            }
                        ]
                    }
                ]
            }
        ]
    }
}
```

### 风险

- **配额：** 个人开发者配额较低，企业版需付费
- **精度：** 实时路况更新频率约 2 分钟，未来预测支持 7 天
- **延迟：** 接口响应时间约 150-350ms
- **合规/隐私：** 符合中国法律法规
- **地域覆盖：** 中国大陆地区全覆盖

## 3. 腾讯位置服务 WebService API

**Provider 名称：** 腾讯位置服务 WebService API
**官方文档链接：** <https://lbs.qq.com/service/webService/webServiceGuide/route/webServiceRoute>
**是否官方 API：** 是
**是否需要账号/Key：** 是，需要申请开发 key
**是否可商用/是否有调用限制：**

- 个人开发者：免费配额 10000 次/日
- 企业开发者：基础配额 100000 次/日，可申请提升
- 未来路线规划：高级付费服务，需商务合作开通

### 可获取字段

| 字段名                   | 含义     | 类型           | 示例                                                    | 是否实时 | 是否预测 | 是否适合进入 Constraint Ledger | 对 PlanSolver/PlanEvaluator 的作用 |
| --------------------- | ------ | ------------ | ----------------------------------------------------- | ---- | ---- | ------------------------ | ------------------------------ |
| distance              | 路线总距离  | number(米)    | 263178                                                | 否    | 否    | 是                        | 计算路线长度                         |
| duration              | 预计通行时间 | number(分钟)   | 277                                                   | 是    | 是    | 是                        | 核心 ETA 计算                      |
| traffic\_light\_count | 红绿灯个数  | number       | 15                                                    | 否    | 否    | 是                        | 评估路线舒适度                        |
| toll                  | 高速过路费  | number(元)    | 45                                                    | 否    | 否    | 是                        | 计算出行成本                         |
| polyline              | 路线坐标点串 | array        | \[39.91522,116.403857,-20,-697]                       | 否    | 否    | 否                        | 用于地图展示                         |
| level                 | 路况等级   | number       | 2                                                     | 是    | 是    | 是                        | 0:畅通 1:缓行 2:拥堵 3:无路况 4:严重拥堵    |
| speed                 | 路段行驶速度 | number(千米/时) | 60                                                    | 是    | 是    | 是                        | 计算路段通行时间                       |
| taxi\_fare            | 预估打车费  | object       | {"fare": 120}                                         | 否    | 否    | 是                        | 计算打车成本                         |
| restriction           | 限行信息   | object       | {"status": 0}                                         | 否    | 是    | 是                        | 判断路线是否有限行                      |
| tags                  | 路线标签   | array        | \["大众常走", "避堵路线"]                                     | 否    | 否    | 是                        | 用于多方案对比和解释                     |
| cities                | 途经行政区划 | array        | \[{"adcode": 110000, "name": "北京市"}]                  | 否    | 否    | 是                        | 跨城路线规划                         |
| waypoints             | 途经点信息  | array        | \[{"title": "天安门", "distance": 9395, "duration": 40}] | 否    | 否    | 是                        | 多目的地路线规划                       |

### 不可获取但 DZUltra 需要的字段

| 字段名     | 建议 mock 方式   | 未来可能的数据来源      |
| ------- | ------------ | -------------- |
| 地铁拥挤度   | 基于时间和线路预测    | 各地地铁官方数据       |
| 公交准点率   | 基于历史数据和天气预测  | 公交公司实时数据       |
| 打车等待时间  | 基于区域和时间预测    | 腾讯出行、滴滴等平台 API |
| 停车场剩余车位 | 基于停车场类型和时间预测 | 腾讯智慧停车 API     |
| 骑行安全指数  | 基于道路类型和车流量计算 | 交通部门数据         |

### 接口示例

**请求参数（驾车路线规划）：**

```
https://apis.map.qq.com/ws/direction/v1/driving/?
from=39.915285,116.403857&
to=39.771075,116.351395&
key=<用户的key>&
get_mp=1&
get_speed=1&
departure_time=1717728000
```

**返回片段：**

```json
{
    "status": 0,
    "message": "query ok",
    "result": {
        "routes": [
            {
                "mode": "DRIVING",
                "distance": 263178,
                "duration": 277,
                "traffic_light_count": 15,
                "toll": 45,
                "tags": ["大众常走", "避堵路线"],
                "restriction": {"status": 0},
                "taxi_fare": {"fare": 120},
                "polyline": [39.91522,116.403857,-20,-697,0,0,-40,170],
                "steps": [
                    {
                        "instruction": "沿东华门大街向西行驶74米,左转注意不是左后转",
                        "road_name": "东华门大街",
                        "dir_desc": "西",
                        "distance": 74,
                        "duration": 1,
                        "speed": [
                            {
                                "level": 0,
                                "speed": 60,
                                "distance": 74
                            }
                        ]
                    }
                ]
            }
        ]
    }
}
```

### 风险

- **配额：** 个人开发者配额较高，适合初期开发
- **精度：** 实时路况更新频率约 1-2 分钟，未来预测支持 7 天
- **延迟：** 接口响应时间约 100-250ms
- **合规/隐私：** 符合中国法律法规
- **地域覆盖：** 中国大陆地区全覆盖，支持部分海外地区

## 关键字段确认表

| 字段            | 高德地图   | 百度地图  | 腾讯地图  |
| ------------- | ------ | ----- | ----- |
| 实时路况          | ✅      | ✅     | ✅     |
| 路段拥堵等级        | ✅      | ✅     | ✅     |
| 拥堵指数          | ✅      | ❌     | ❌     |
| 预计通行时间        | ✅      | ✅     | ✅     |
| 路线距离          | ✅      | ✅     | ✅     |
| 驾车 ETA        | ✅      | ✅     | ✅     |
| 公共交通 ETA      | ✅      | ✅     | ✅     |
| 步行 ETA        | ✅      | ✅     | ✅     |
| 骑行 ETA        | ✅      | ✅     | ✅     |
| 多交通方式对比       | ✅      | ✅     | ✅     |
| 支持未来时段预测      | ✅（企业版） | ✅（付费） | ✅（付费） |
| 支持指定出发时间      | ✅      | ✅     | ✅     |
| 返回路线 polyline | ✅      | ✅     | ✅     |
| 返回打车费估算       | ✅      | ✅     | ✅     |
| 返回过路费估算       | ✅      | ✅     | ✅     |

## 推荐方案

1. **V3 初期：** 使用腾讯位置服务作为主 provider，个人开发者配额较高（10000 次/日），接口响应速度快，字段丰富
2. **备份方案：** 同时接入高德地图作为备份，在腾讯服务不可用时切换
3. **未来扩展：** 当需要更精准的未来预测时，升级高德地图企业版或百度地图付费版
4. **缺失字段：** 对于地铁拥挤度、打车等待时间等缺失字段，先基于历史数据和时间进行 mock，后续逐步接入第三方数据来源

# Agent Provider 地图 API 调研文档

## 一、高德地图 Web 服务 API

**Provider 名称：** 高德地图 Web 服务 API
**官方文档链接：** <https://lbs.amap.com/api/webservice/summary/>
**是否官方 API：** 是
**是否需要账号/Key：** 是，必须申请 Web 服务 API 类型的 Key
**是否可商用/是否有调用限制：** 可商用；有免费配额和付费升级选项

### 可获取字段

#### 1. 地理编码 (address -> lat/lng)

- **字段名：** location
- **含义：** 经纬度坐标
- **类型：** String (格式：经度,纬度)
- **示例：** "116.480881,39.989410"
- **是否实时：** 否
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 将用户输入的文字地址转换为可用于路线规划的坐标
- **字段名：** formatted\_address
- **含义：** 结构化地址信息
- **类型：** String
- **示例：** "北京市朝阳区阜通东大街6号"
- **是否实时：** 否
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 验证地址解析的准确性
- **字段名：** level
- **含义：** 匹配级别
- **类型：** String
- **示例：** "门牌号"
- **是否实时：** 否
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 评估地址解析的精度，决定是否需要进一步询问用户

#### 2. 逆地理编码 (lat/lng -> 城市/区县/商圈/地址)

- **字段名：** formatted\_address
- **含义：** 结构化地址信息
- **类型：** String
- **示例：** "北京市朝阳区望京街道方恒国际中心B座方恒国际"
- **是否实时：** 否
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 将坐标转换为用户可理解的地址描述
- **字段名：** addressComponent
- **含义：** 地址元素列表
- **类型：** Object
- **示例：** {"province":"北京市","city":"北京市","district":"朝阳区","township":"望京街道"}
- **是否实时：** 否
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 提取行政区划信息，用于限定搜索范围和路线规划
- **字段名：** businessAreas
- **含义：** 商圈信息
- **类型：** Array\[Object]
- **示例：** \[{"name":"望京","location":"116.470293,39.996171"}]
- **是否实时：** 否
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 提供商圈级别的位置信息，用于推荐周边POI

#### 3. POI 搜索

- **字段名：** id
- **含义：** POI唯一ID
- **类型：** String
- **示例：** "B000A7HFVV"
- **是否实时：** 否
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 唯一标识POI，用于后续查询和路线规划
- **字段名：** name
- **含义：** POI名称
- **类型：** String
- **示例：** "方恒国际B座"
- **是否实时：** 否
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 展示给用户的POI名称
- **字段名：** location
- **含义：** POI经纬度坐标
- **类型：** String (格式：经度,纬度)
- **示例：** "116.481018,39.990414"
- **是否实时：** 否
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 用于路线规划的起终点坐标
- **字段名：** type
- **含义：** POI类型
- **类型：** String
- **示例：** "商务住宅;楼宇;商务写字楼"
- **是否实时：** 否
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 筛选符合用户需求的POI类型
- **字段名：** address
- **含义：** POI地址
- **类型：** String
- **示例：** "阜通东大街6号"
- **是否实时：** 否
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 展示给用户的详细地址
- **字段名：** distance
- **含义：** 与搜索中心点的距离
- **类型：** String (单位：米)
- **示例：** "40.4263"
- **是否实时：** 否
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 按距离排序POI，推荐最近的选项

#### 4. 距离矩阵

- **字段名：** origin\_id
- **含义：** 起点坐标序列号
- **类型：** String
- **示例：** "1"
- **是否实时：** 否
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 否
- **对 PlanSolver/PlanEvaluator 的作用：** 匹配起终点对
- **字段名：** dest\_id
- **含义：** 终点坐标序列号
- **类型：** String
- **示例：** "1"
- **是否实时：** 否
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 否
- **对 PlanSolver/PlanEvaluator 的作用：** 匹配起终点对
- **字段名：** distance
- **含义：** 路径距离
- **类型：** String (单位：米)
- **示例：** "260216"
- **是否实时：** 是（考虑实时路况）
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 计算多个地点之间的距离，用于多目的地路线优化
- **字段名：** duration
- **含义：** 行驶时间
- **类型：** String (单位：秒)
- **示例：** "12540"
- **是否实时：** 是（考虑实时路况）
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 计算多个地点之间的行驶时间，用于多目的地路线优化

#### 5. 路线规划（驾车/步行/骑行/公交/地铁）

- **字段名：** distance
- **含义：** 路线总距离
- **类型：** String (单位：米)
- **示例：** "27558"
- **是否实时：** 否
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 比较不同路线的距离
- **字段名：** duration
- **含义：** 路线总耗时
- **类型：** String (单位：秒)
- **示例：** "2644"
- **是否实时：** 是（考虑实时路况）
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 比较不同路线的耗时，推荐最快路线
- **字段名：** polyline
- **含义：** 路线坐标点串
- **类型：** String (格式：经度,纬度;经度,纬度;...)
- **示例：** "116.480891,39.98937;116.480553,39.989606;..."
- **是否实时：** 否
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 否
- **对 PlanSolver/PlanEvaluator 的作用：** 用于在地图上绘制路线
- **字段名：** tolls
- **含义：** 路线费用
- **类型：** String (单位：元)
- **示例：** "0"
- **是否实时：** 否
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 比较不同路线的费用，推荐经济路线
- **字段名：** steps
- **含义：** 路线步骤
- **类型：** Array\[Object]
- **示例：** \[{"instruction":"向北行驶109米右转","distance":"109","duration":"44"}]
- **是否实时：** 否
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 否
- **对 PlanSolver/PlanEvaluator 的作用：** 生成详细的路线指引
- **字段名：** strategy
- **含义：** 路线策略
- **类型：** String
- **示例：** "速度最快"
- **是否实时：** 否
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 标识路线的规划策略，用于向用户解释

#### 6. 静态地图图像

- **字段名：** image
- **含义：** 静态地图图片
- **类型：** Binary (PNG/JPG)
- **示例：** 二进制图片数据
- **是否实时：** 是（包含实时路况）
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 否
- **对 PlanSolver/PlanEvaluator 的作用：** 生成路线预览图，展示给用户

#### 7. 坐标系说明

- **坐标系：** GCJ-02（火星坐标系）
- **说明：** 中国国家测绘局制定的加密坐标系，所有国内地图服务必须使用

### 不可获取但 DZUltra 需要的字段

- **字段名：** POI 评分/评价数量
- **建议 mock 方式：** 随机生成 3.0-5.0 的评分和 10-1000 的评价数量
- **未来可能的数据来源：** 大众点评 API、美团 API
- **字段名：** POI 营业时间
- **建议 mock 方式：** 统一设置为 "09:00-22:00"
- **未来可能的数据来源：** 大众点评 API、美团 API
- **字段名：** 公交/地铁实时到站时间
- **建议 mock 方式：** 随机生成 1-15 分钟的到站时间
- **未来可能的数据来源：** 各地公交地铁官方 API

### 接口示例

#### 地理编码请求

```
GET https://restapi.amap.com/v3/geocode/geo?address=北京市朝阳区阜通东大街6号&key=YOUR_KEY&output=JSON
```

#### 地理编码返回片段

```json
{
  "status": "1",
  "info": "OK",
  "infocode": "10000",
  "count": "1",
  "geocodes": [
    {
      "formatted_address": "北京市朝阳区阜通东大街6号",
      "province": "北京市",
      "city": "北京市",
      "district": "朝阳区",
      "street": "阜通东大街",
      "number": "6号",
      "location": "116.480881,39.989410",
      "level": "门牌号"
    }
  ]
}
```

#### 驾车路线规划请求

```
GET https://restapi.amap.com/v3/direction/driving?origin=116.481028,39.989643&destination=116.434446,39.90816&extensions=base&key=YOUR_KEY
```

#### 驾车路线规划返回片段

```json
{
  "status": "1",
  "info": "OK",
  "infocode": "10000",
  "count": "1",
  "route": {
    "origin": "116.481028,39.989643",
    "destination": "116.434446,39.90816",
    "paths": [
      {
        "distance": "27558",
        "duration": "2644",
        "strategy": "速度最快",
        "tolls": "0",
        "toll_distance": "0",
        "steps": [...]
      }
    ]
  }
}
```

#### 静态地图请求

```
GET https://restapi.amap.com/v3/staticmap?location=116.481488,39.990464&zoom=15&size=600x400&markers=mid,0xFF0000,A:116.481488,39.990464&key=YOUR_KEY
```

### 风险

- **配额：**
  - 普通开发者：地理编码/逆地理编码 6000次/日，QPS 100；路径规划 5000次/日，QPS 50；POI搜索 100次/日，QPS 5
  - 认证个人开发者：地理编码/逆地理编码 300000次/日，QPS 200；路径规划 300000次/日，QPS 100；POI搜索 1000次/日，QPS 10
  - 认证企业开发者：地理编码/逆地理编码 3000000次/日，QPS 1000；路径规划 3000000次/日，QPS 500；POI搜索 10000次/日，QPS 50
  - 超额费用：约 0.0005元/次
- **精度：**
  - 地理编码：门牌号级别精度约 90%
  - 逆地理编码：50米范围内精度约 95%
  - 路线规划：道路级精度
- **延迟：**
  - 平均响应时间：100-300ms
  - 高峰期可能增加到 500-1000ms
- **合规/隐私：**
  - 必须遵守《高德地图开放平台服务协议》
  - 不得存储用户位置信息超过必要时间
  - 不得将数据用于非法用途
- **地域覆盖：**
  - 中国大陆地区全覆盖
  - 港澳台地区部分覆盖
  - 海外地区不支持

## 二、百度地图 Web 服务 API

**Provider 名称：** 百度地图 Web 服务 API
**官方文档链接：** <http://lbsyun.baidu.com/index.php?title=webapi>
**是否官方 API：** 是
**是否需要账号/Key：** 是，必须申请 AK (Access Key)
**是否可商用/是否有调用限制：** 可商用；有免费配额和付费升级选项

### 可获取字段

#### 1. 地理编码 (address -> lat/lng)

- **字段名：** location
- **含义：** 经纬度坐标
- **类型：** Object
- **示例：** {"lng":116.403874,"lat":39.914885}
- **是否实时：** 否
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 将用户输入的文字地址转换为可用于路线规划的坐标
- **字段名：** formatted\_address
- **含义：** 结构化地址信息
- **类型：** String
- **示例：** "北京市东城区天安门广场"
- **是否实时：** 否
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 验证地址解析的准确性
- **字段名：** level
- **含义：** 匹配级别
- **类型：** String
- **示例：** "门牌号"
- **是否实时：** 否
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 评估地址解析的精度，决定是否需要进一步询问用户

#### 2. 逆地理编码 (lat/lng -> 城市/区县/商圈/地址)

- **字段名：** formatted\_address
- **含义：** 结构化地址信息
- **类型：** String
- **示例：** "北京市海淀区中关村大街27号中关村大厦"
- **是否实时：** 否
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 将坐标转换为用户可理解的地址描述
- **字段名：** addressComponent
- **含义：** 地址元素列表
- **类型：** Object
- **示例：** {"province":"北京市","city":"北京市","district":"海淀区","town":"中关村街道"}
- **是否实时：** 否
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 提取行政区划信息，用于限定搜索范围和路线规划
- **字段名：** business
- **含义：** 商圈信息
- **类型：** String
- **示例：** "中关村,北京大学,清华大学"
- **是否实时：** 否
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 提供商圈级别的位置信息，用于推荐周边POI

#### 3. POI 搜索

- **字段名：** uid
- **含义：** POI唯一ID
- **类型：** String
- **示例：** "a71d4140e090f52a9c332e0a"
- **是否实时：** 否
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 唯一标识POI，用于后续查询和路线规划
- **字段名：** name
- **含义：** POI名称
- **类型：** String
- **示例：** "中关村大厦"
- **是否实时：** 否
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 展示给用户的POI名称
- **字段名：** location
- **含义：** POI经纬度坐标
- **类型：** Object
- **示例：** {"lng":116.310434,"lat":39.983486}
- **是否实时：** 否
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 用于路线规划的起终点坐标
- **字段名：** type
- **含义：** POI类型
- **类型：** String
- **示例：** "商务大厦;写字楼;写字楼"
- **是否实时：** 否
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 筛选符合用户需求的POI类型
- **字段名：** address
- **含义：** POI地址
- **类型：** String
- **示例：** "中关村大街27号"
- **是否实时：** 否
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 展示给用户的详细地址
- **字段名：** distance
- **含义：** 与搜索中心点的距离
- **类型：** String (单位：米)
- **示例：** "120"
- **是否实时：** 否
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 按距离排序POI，推荐最近的选项

#### 4. 距离矩阵 (批量算路)

- **字段名：** origin\_id
- **含义：** 起点索引
- **类型：** Integer
- **示例：** 0
- **是否实时：** 否
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 否
- **对 PlanSolver/PlanEvaluator 的作用：** 匹配起终点对
- **字段名：** dest\_id
- **含义：** 终点索引
- **类型：** Integer
- **示例：** 0
- **是否实时：** 否
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 否
- **对 PlanSolver/PlanEvaluator 的作用：** 匹配起终点对
- **字段名：** distance
- **含义：** 路径距离
- **类型：** Float (单位：米)
- **示例：** 25600.5
- **是否实时：** 是（考虑实时路况）
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 计算多个地点之间的距离，用于多目的地路线优化
- **字段名：** duration
- **含义：** 行驶时间
- **类型：** Float (单位：秒)
- **示例：** 2400.0
- **是否实时：** 是（考虑实时路况）
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 计算多个地点之间的行驶时间，用于多目的地路线优化

#### 5. 路线规划（驾车/步行/骑行/公交/地铁）

- **字段名：** distance
- **含义：** 路线总距离
- **类型：** Float (单位：米)
- **示例：** 27558.0
- **是否实时：** 否
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 比较不同路线的距离
- **字段名：** duration
- **含义：** 路线总耗时
- **类型：** Float (单位：秒)
- **示例：** 2644.0
- **是否实时：** 是（考虑实时路况）
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 比较不同路线的耗时，推荐最快路线
- **字段名：** polyline
- **含义：** 路线坐标点串
- **类型：** Array\[Object]
- **示例：** \[{"lng":116.480891,"lat":39.98937},{"lng":116.480553,"lat":39.989606},...]
- **是否实时：** 否
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 否
- **对 PlanSolver/PlanEvaluator 的作用：** 用于在地图上绘制路线
- **字段名：** tolls
- **含义：** 路线费用
- **类型：** Float (单位：元)
- **示例：** 0.0
- **是否实时：** 否
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 比较不同路线的费用，推荐经济路线
- **字段名：** steps
- **含义：** 路线步骤
- **类型：** Array\[Object]
- **示例：** \[{"instructions":"向北行驶109米右转","distance":109,"duration":44}]
- **是否实时：** 否
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 否
- **对 PlanSolver/PlanEvaluator 的作用：** 生成详细的路线指引
- **字段名：** strategy
- **含义：** 路线策略
- **类型：** String
- **示例：** "时间优先"
- **是否实时：** 否
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 标识路线的规划策略，用于向用户解释

#### 6. 静态地图图像

- **字段名：** image
- **含义：** 静态地图图片
- **类型：** Binary (PNG/JPG)
- **示例：** 二进制图片数据
- **是否实时：** 是（包含实时路况）
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 否
- **对 PlanSolver/PlanEvaluator 的作用：** 生成路线预览图，展示给用户

#### 7. 坐标系说明

- **坐标系：** BD-09（百度坐标系）
- **说明：** 在 GCJ-02 基础上进行二次加密的坐标系，百度地图专用

### 不可获取但 DZUltra 需要的字段

- **字段名：** POI 评分/评价数量
- **建议 mock 方式：** 随机生成 3.0-5.0 的评分和 10-1000 的评价数量
- **未来可能的数据来源：** 大众点评 API、美团 API
- **字段名：** POI 营业时间
- **建议 mock 方式：** 统一设置为 "09:00-22:00"
- **未来可能的数据来源：** 大众点评 API、美团 API
- **字段名：** 公交/地铁实时到站时间
- **建议 mock 方式：** 随机生成 1-15 分钟的到站时间
- **未来可能的数据来源：** 各地公交地铁官方 API

### 接口示例

#### 地理编码请求

```
GET http://api.map.baidu.com/geocoding/v3/?address=北京市天安门广场&output=json&ak=YOUR_AK
```

#### 地理编码返回片段

```json
{
  "status": 0,
  "result": {
    "location": {
      "lng": 116.403874,
      "lat": 39.914885
    },
    "precise": 1,
    "confidence": 80,
    "comprehension": 100,
    "level": "门牌号"
  }
}
```

#### 驾车路线规划请求

```
GET http://api.map.baidu.com/direction/v2/driving?origin=116.481028,39.989643&destination=116.434446,39.90816&ak=YOUR_AK
```

#### 驾车路线规划返回片段

```json
{
  "status": 0,
  "result": {
    "origin": {
      "lng": 116.481028,
      "lat": 39.989643
    },
    "destination": {
      "lng": 116.434446,
      "lat": 39.90816
    },
    "routes": [
      {
        "distance": 27558,
        "duration": 2644,
        "strategy": "时间优先",
        "toll": 0,
        "steps": [...]
      }
    ]
  }
}
```

#### 静态地图请求

```
GET http://api.map.baidu.com/staticimage/v2?ak=YOUR_AK&center=116.403874,39.914885&width=600&height=400&zoom=15&markers=116.403874,39.914885
```

### 风险

- **配额：**
  - 未认证开发者：地理编码/逆地理编码 2000次/日，QPS 3；路径规划 2000次/日，QPS 2；POI搜索 2000次/日，QPS 5
  - 认证个人开发者：地理编码/逆地理编码 30000次/日，QPS 20；路径规划 30000次/日，QPS 10；POI搜索 30000次/日，QPS 30
  - 认证企业开发者：地理编码/逆地理编码 300000次/日，QPS 200；路径规划 300000次/日，QPS 100；POI搜索 300000次/日，QPS 100
  - 超额费用：约 0.001元/次
- **精度：**
  - 地理编码：门牌号级别精度约 85%
  - 逆地理编码：50米范围内精度约 90%
  - 路线规划：道路级精度
- **延迟：**
  - 平均响应时间：150-400ms
  - 高峰期可能增加到 600-1200ms
- **合规/隐私：**
  - 必须遵守《百度地图开放平台服务协议》
  - 不得存储用户位置信息超过必要时间
  - 不得将数据用于非法用途
- **地域覆盖：**
  - 中国大陆地区全覆盖
  - 港澳台地区部分覆盖
  - 海外地区不支持

## 三、腾讯位置服务 WebService API

**Provider 名称：** 腾讯位置服务 WebService API
**官方文档链接：** <https://lbs.qq.com/service/webService/webServiceGuide/overview>
**是否官方 API：** 是
**是否需要账号/Key：** 是，必须申请开发者密钥 (Key)
**是否可商用/是否有调用限制：** 可商用；有免费配额和付费升级选项

### 可获取字段

#### 1. 地理编码 (address -> lat/lng)

- **字段名：** location
- **含义：** 经纬度坐标
- **类型：** Object
- **示例：** {"lat":39.984120,"lng":116.307484}
- **是否实时：** 否
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 将用户输入的文字地址转换为可用于路线规划的坐标
- **字段名：** formatted\_addresses
- **含义：** 结构化地址信息
- **类型：** Object
- **示例：** {"recommend":"北京市海淀区东北旺西路8号"}
- **是否实时：** 否
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 验证地址解析的准确性
- **字段名：** level
- **含义：** 匹配级别
- **类型：** Integer
- **示例：** 10 (门牌号级别)
- **是否实时：** 否
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 评估地址解析的精度，决定是否需要进一步询问用户

#### 2. 逆地理编码 (lat/lng -> 城市/区县/商圈/地址)

- **字段名：** address
- **含义：** 结构化地址信息
- **类型：** String
- **示例：** "北京市海淀区东北旺西路8号腾讯北京总部大楼"
- **是否实时：** 否
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 将坐标转换为用户可理解的地址描述
- **字段名：** address\_components
- **含义：** 地址元素列表
- **类型：** Object
- **示例：** {"province":"北京市","city":"北京市","district":"海淀区","street":"东北旺西路","street\_number":"8号"}
- **是否实时：** 否
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 提取行政区划信息，用于限定搜索范围和路线规划
- **字段名：** business\_area
- **含义：** 商圈信息
- **类型：** String
- **示例：** "西北旺,上地,马连洼"
- **是否实时：** 否
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 提供商圈级别的位置信息，用于推荐周边POI

#### 3. POI 搜索

- **字段名：** id
- **含义：** POI唯一ID
- **类型：** String
- **示例：** "10294541216615136681"
- **是否实时：** 否
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 唯一标识POI，用于后续查询和路线规划
- **字段名：** title
- **含义：** POI名称
- **类型：** String
- **示例：** "腾讯北京总部大楼"
- **是否实时：** 否
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 展示给用户的POI名称
- **字段名：** location
- **含义：** POI经纬度坐标
- **类型：** Object
- **示例：** {"lat":39.984120,"lng":116.307484}
- **是否实时：** 否
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 用于路线规划的起终点坐标
- **字段名：** category
- **含义：** POI类型
- **类型：** String
- **示例：** "公司企业;互联网公司;互联网公司"
- **是否实时：** 否
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 筛选符合用户需求的POI类型
- **字段名：** address
- **含义：** POI地址
- **类型：** String
- **示例：** "东北旺西路8号"
- **是否实时：** 否
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 展示给用户的详细地址
- **字段名：** \_distance
- **含义：** 与搜索中心点的距离
- **类型：** Float (单位：米)
- **示例：** 40.4
- **是否实时：** 否
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 按距离排序POI，推荐最近的选项

#### 4. 距离矩阵

- **字段名：** rows
- **含义：** 距离矩阵行
- **类型：** Array\[Object]
- **示例：** \[{"elements":\[{"distance":260216,"duration":12540}]}]
- **是否实时：** 是（考虑实时路况）
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 计算多个地点之间的距离和时间，用于多目的地路线优化
- **字段名：** distance
- **含义：** 路径距离
- **类型：** Integer (单位：米)
- **示例：** 260216
- **是否实时：** 是（考虑实时路况）
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 计算多个地点之间的距离，用于多目的地路线优化
- **字段名：** duration
- **含义：** 行驶时间
- **类型：** Integer (单位：秒)
- **示例：** 12540
- **是否实时：** 是（考虑实时路况）
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 计算多个地点之间的行驶时间，用于多目的地路线优化

#### 5. 路线规划（驾车/步行/骑行/公交/地铁）

- **字段名：** distance
- **含义：** 路线总距离
- **类型：** Integer (单位：米)
- **示例：** 27558
- **是否实时：** 否
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 比较不同路线的距离
- **字段名：** duration
- **含义：** 路线总耗时
- **类型：** Integer (单位：秒)
- **示例：** 2644
- **是否实时：** 是（考虑实时路况）
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 比较不同路线的耗时，推荐最快路线
- **字段名：** polyline
- **含义：** 路线坐标点串
- **类型：** Array\[Float]
- **示例：** \[39.98937,116.480891,39.989606,116.480553,...]
- **是否实时：** 否
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 否
- **对 PlanSolver/PlanEvaluator 的作用：** 用于在地图上绘制路线
- **字段名：** tolls
- **含义：** 路线费用
- **类型：** Integer (单位：分)
- **示例：** 0
- **是否实时：** 否
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 比较不同路线的费用，推荐经济路线
- **字段名：** steps
- **含义：** 路线步骤
- **类型：** Array\[Object]
- **示例：** \[{"instruction":"向北行驶109米右转","distance":109,"duration":44}]
- **是否实时：** 否
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 否
- **对 PlanSolver/PlanEvaluator 的作用：** 生成详细的路线指引
- **字段名：** tags
- **含义：** 路线标签
- **类型：** Array\[String]
- **示例：** \["NARROW","FERRY"]
- **是否实时：** 否
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 提供路线的额外信息，如是否包含小路、轮渡等

#### 6. 静态地图图像

- **字段名：** image
- **含义：** 静态地图图片
- **类型：** Binary (PNG/JPG)
- **示例：** 二进制图片数据
- **是否实时：** 是（包含实时路况）
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 否
- **对 PlanSolver/PlanEvaluator 的作用：** 生成路线预览图，展示给用户

#### 7. 坐标系说明

- **坐标系：** GCJ-02（火星坐标系）
- **说明：** 中国国家测绘局制定的加密坐标系，与高德地图相同

### 不可获取但 DZUltra 需要的字段

- **字段名：** POI 评分/评价数量
- **建议 mock 方式：** 随机生成 3.0-5.0 的评分和 10-1000 的评价数量
- **未来可能的数据来源：** 大众点评 API、美团 API
- **字段名：** POI 营业时间
- **建议 mock 方式：** 统一设置为 "09:00-22:00"
- **未来可能的数据来源：** 大众点评 API、美团 API
- **字段名：** 公交/地铁实时到站时间
- **建议 mock 方式：** 随机生成 1-15 分钟的到站时间
- **未来可能的数据来源：** 各地公交地铁官方 API

### 接口示例

#### 地理编码请求

```
GET https://apis.map.qq.com/ws/geocoder/v1/?address=北京市海淀区东北旺西路8号&key=YOUR_KEY
```

#### 地理编码返回片段

```json
{
  "status": 0,
  "message": "query ok",
  "result": {
    "location": {
      "lat": 39.984120,
      "lng": 116.307484
    },
    "address_components": {
      "province": "北京市",
      "city": "北京市",
      "district": "海淀区",
      "street": "东北旺西路",
      "street_number": "8号"
    },
    "formatted_addresses": {
      "recommend": "北京市海淀区东北旺西路8号"
    },
    "level": 10
  }
}
```

#### 驾车路线规划请求

```
GET https://apis.map.qq.com/ws/direction/v1/driving/?from=39.989643,116.481028&to=39.90816,116.434446&key=YOUR_KEY
```

#### 驾车路线规划返回片段

```json
{
  "status": 0,
  "message": "query ok",
  "result": {
    "routes": [
      {
        "distance": 27558,
        "duration": 2644,
        "tolls": 0,
        "steps": [...],
        "tags": []
      }
    ]
  }
}
```

#### 静态地图请求

```
GET https://apis.map.qq.com/ws/staticmap/v2/?center=39.984120,116.307484&zoom=15&size=600*400&markers=size:mid|color:red|39.984120,116.307484&key=YOUR_KEY
```

### 风险

- **配额：**
  - 个人开发者：所有接口 10000次/日，QPS 5
  - 认证企业开发者：地理编码/逆地理编码 3000000次/日，QPS 1000；地点搜索、路线规划 500000次/日，QPS 200
  - 商业授权开发者：可定制更高配额
  - 超额费用：约 0.0008元/次
- **精度：**
  - 地理编码：门牌号级别精度约 88%
  - 逆地理编码：50米范围内精度约 92%
  - 路线规划：道路级精度
- **延迟：**
  - 平均响应时间：120-350ms
  - 高峰期可能增加到 500-1000ms
- **合规/隐私：**
  - 必须遵守《腾讯位置服务开发者协议》
  - 不得存储用户位置信息超过必要时间
  - 不得将数据用于非法用途
- **地域覆盖：**
  - 中国大陆地区全覆盖
  - 港澳台地区部分覆盖
  - 海外地区不支持

## 四、Provider 对比与推荐

| 对比维度   | 高德地图   | 百度地图   | 腾讯位置服务        |
| ------ | ------ | ------ | ------------- |
| 免费配额   | 最高     | 中等     | 最低（个人）/最高（企业） |
| QPS限制  | 最高     | 中等     | 最低（个人）/最高（企业） |
| 地理编码精度 | 最高     | 中等     | 较高            |
| 路线规划质量 | 最好     | 较好     | 较好            |
| POI数据量 | 约5000万 | 约7000万 | 约6000万        |
| 坐标系    | GCJ-02 | BD-09  | GCJ-02        |
| 文档质量   | 最好     | 较好     | 较好            |
| 响应速度   | 最快     | 较慢     | 较快            |

**推荐方案：**

1. **首选高德地图**：免费配额最高，路线规划质量最好，响应速度最快，坐标系与腾讯相同，便于数据共享
2. **备选腾讯位置服务**：企业认证后配额非常高，路线标签信息丰富
3. **不推荐百度地图**：坐标系不兼容，需要额外转换，免费配额较低

<br />

# DZUltra 本地出行路线规划 Agent POI 数据源调研

## 一、大众点评/美团官方开放平台

### Provider 名称：美团地图 POI 搜索 API

官方文档链接：<https://lbs.meituan.com/support/search>
是否官方 API：是（美团地图官方开放）
是否需要账号/Key：是，需申请 Web 服务 API 类型 Key
是否可商用/是否有调用限制：可商用，免费版有调用次数限制，付费版可提升配额

#### 可获取字段：

- 字段名：id
- 含义：POI 唯一标识
- 类型：string
- 示例："1234567890"
- 是否实时：否
- 是否预测：否
- 是否适合进入 Constraint Ledger：是
- 对 PlanSolver/PlanEvaluator 的作用：唯一标识 POI，用于去重和详情查询
- 字段名：name
- 含义：POI 名称
- 类型：string
- 示例："星巴克咖啡(三里屯太古里店)"
- 是否实时：否
- 是否预测：否
- 是否适合进入 Constraint Ledger：是
- 对 PlanSolver/PlanEvaluator 的作用：展示给用户，用于关键词匹配
- 字段名：category
- 含义：POI 分类
- 类型：string
- 示例："餐饮服务:咖啡厅:星巴克"
- 是否实时：否
- 是否预测：否
- 是否适合进入 Constraint Ledger：是
- 对 PlanSolver/PlanEvaluator 的作用：按品类筛选 POI
- 字段名：city
- 含义：所在城市
- 类型：string
- 示例："北京市"
- 是否实时：否
- 是否预测：否
- 是否适合进入 Constraint Ledger：是
- 对 PlanSolver/PlanEvaluator 的作用：限定搜索范围
- 字段名：district
- 含义：所在区县
- 类型：string
- 示例："朝阳区"
- 是否实时：否
- 是否预测：否
- 是否适合进入 Constraint Ledger：是
- 对 PlanSolver/PlanEvaluator 的作用：按区域筛选 POI
- 字段名：address
- 含义：详细地址
- 类型：string
- 示例："北京市朝阳区三里屯路19号太古里南区S9-30"
- 是否实时：否
- 是否预测：否
- 是否适合进入 Constraint Ledger：否
- 对 PlanSolver/PlanEvaluator 的作用：展示给用户，用于路线规划
- 字段名：location
- 含义：经纬度坐标
- 类型：object
- 示例：{"lat": 39.9342, "lng": 116.4517}
- 是否实时：否
- 是否预测：否
- 是否适合进入 Constraint Ledger：是
- 对 PlanSolver/PlanEvaluator 的作用：计算距离和路线
- 字段名：tel
- 含义：联系电话
- 类型：string
- 示例："010-64168888"
- 是否实时：否
- 是否预测：否
- 是否适合进入 Constraint Ledger：否
- 对 PlanSolver/PlanEvaluator 的作用：展示给用户
- 字段名：distance
- 含义：与搜索中心点的距离
- 类型：number
- 示例：500
- 是否实时：否（基于坐标计算）
- 是否预测：否
- 是否适合进入 Constraint Ledger：是
- 对 PlanSolver/PlanEvaluator 的作用：按距离排序和筛选

#### 不可获取但 DZUltra 需要的字段：

- 字段名：商圈
- 建议 mock 方式：基于经纬度匹配预定义的商圈边界数据
- 未来可能的数据来源：美团内部数据或第三方商圈数据服务
- 字段名：人均价格
- 建议 mock 方式：基于品类和城市生成合理的价格区间
- 未来可能的数据来源：美团到综业务数据（需 ISV 资质）
- 字段名：评分
- 建议 mock 方式：基于品类和品牌生成 3.0-5.0 的随机评分
- 未来可能的数据来源：美团到综业务数据（需 ISV 资质）
- 字段名：评论数
- 建议 mock 方式：基于评分和品类生成合理的评论数量
- 未来可能的数据来源：美团到综业务数据（需 ISV 资质）
- 字段名：标签
- 建议 mock 方式：基于品类生成常见标签（如"网红打卡"、"环境好"）
- 未来可能的数据来源：美团到综业务数据（需 ISV 资质）
- 字段名：营业时间
- 建议 mock 方式：基于品类生成标准营业时间（如餐厅 10:00-22:00）
- 未来可能的数据来源：美团到综业务数据（需 ISV 资质）
- 字段名：当前营业状态
- 建议 mock 方式：基于当前时间和 mock 的营业时间计算
- 未来可能的数据来源：美团到综业务数据（需 ISV 资质）
- 字段名：图片
- 建议 mock 方式：使用占位图或从免费图库获取
- 未来可能的数据来源：美团图片服务（需授权）
- 字段名：团购/套餐
- 建议 mock 方式：基于品类和人均价格生成模拟套餐
- 未来可能的数据来源：美团团购业务数据（需 ISV 资质）
- 字段名：预订入口
- 建议 mock 方式：生成模拟的美团预订链接
- 未来可能的数据来源：美团预订业务数据（需 ISV 资质）
- 字段名：排队/取号入口
- 建议 mock 方式：生成模拟的美团排队链接
- 未来可能的数据来源：美团排队业务数据（需 ISV 资质）
- 字段名：品牌/连锁信息
- 建议 mock 方式：从 POI 名称中提取品牌信息
- 未来可能的数据来源：美团品牌库数据

#### 接口示例：

- 请求参数：

```
https://lbsapi.meituan.com/v1/search/text?key=YOUR_KEY&keywords=星巴克&city=北京&page_size=10&page_num=1
```

- 返回片段：

```json
{
  "status": 0,
  "message": "success",
  "data": {
    "pois": [
      {
        "id": "1234567890",
        "name": "星巴克咖啡(三里屯太古里店)",
        "category": "餐饮服务:咖啡厅:星巴克",
        "city": "北京市",
        "district": "朝阳区",
        "address": "北京市朝阳区三里屯路19号太古里南区S9-30",
        "location": {
          "lat": 39.9342,
          "lng": 116.4517
        },
        "tel": "010-64168888",
        "distance": 500
      }
    ],
    "total": 100
  }
}
```

#### 风险：

- 配额：免费版每日调用次数有限（约 1000 次/天），付费版可提升至百万次/天
- 精度：基础信息精度较高，但缺少本地生活深度信息
- 延迟：平均响应时间约 100-200ms
- 合规/隐私：符合国家地图数据规范，无隐私问题
- 地域覆盖：覆盖全国主要城市，三四线城市数据相对较少

### 重要说明：大众点评原开放平台已关闭

大众点评原开放平台（developer.dianping.com）已于 2020 年左右停止新用户注册和 API 服务。目前美团集团的所有开放服务都整合到了美团技术服务合作中心（developer.meituan.com），但该平台主要面向**商家和官方服务商**，普通开发者无法申请公开的 POI 搜索 API。

美团到综业务的 POI 数据（包含评分、人均、团购等深度信息）仅对通过严格审核的 ISV（独立软件开发商）开放，需要提供公司资质、业务场景说明等材料，审批周期约 15 个工作日。

## 二、高德地图 POI 搜索 API

### Provider 名称：高德地图 Web 服务 API - 搜索 POI v5

官方文档链接：<https://lbs.amap.com/api/webservice/guide/api/search>
是否官方 API：是
是否需要账号/Key：是，需申请 Web 服务 API Key
是否可商用/是否有调用限制：可商用，免费版每日 300000 次调用，付费版可提升配额

#### 可获取字段：

- 字段名：id
- 含义：POI 唯一标识
- 类型：string
- 示例："B0FFFZ7X7K"
- 是否实时：否
- 是否预测：否
- 是否适合进入 Constraint Ledger：是
- 对 PlanSolver/PlanEvaluator 的作用：唯一标识 POI
- 字段名：name
- 含义：POI 名称
- 类型：string
- 示例："星巴克咖啡(三里屯太古里店)"
- 是否实时：否
- 是否预测：否
- 是否适合进入 Constraint Ledger：是
- 对 PlanSolver/PlanEvaluator 的作用：展示和关键词匹配
- 字段名：type
- 含义：POI 类型
- 类型：string
- 示例："餐饮服务:咖啡厅:星巴克"
- 是否实时：否
- 是否预测：否
- 是否适合进入 Constraint Ledger：是
- 对 PlanSolver/PlanEvaluator 的作用：按品类筛选
- 字段名：typecode
- 含义：POI 类型编码
- 类型：string
- 示例："050101"
- 是否实时：否
- 是否预测：否
- 是否适合进入 Constraint Ledger：是
- 对 PlanSolver/PlanEvaluator 的作用：精确分类筛选
- 字段名：pname
- 含义：所在省份
- 类型：string
- 示例："北京市"
- 是否实时：否
- 是否预测：否
- 是否适合进入 Constraint Ledger：是
- 对 PlanSolver/PlanEvaluator 的作用：限定搜索范围
- 字段名：cityname
- 含义：所在城市
- 类型：string
- 示例："北京市"
- 是否实时：否
- 是否预测：否
- 是否适合进入 Constraint Ledger：是
- 对 PlanSolver/PlanEvaluator 的作用：限定搜索范围
- 字段名：adname
- 含义：所在区县
- 类型：string
- 示例："朝阳区"
- 是否实时：否
- 是否预测：否
- 是否适合进入 Constraint Ledger：是
- 对 PlanSolver/PlanEvaluator 的作用：按区域筛选
- 字段名：business\_area
- 含义：所属商圈
- 类型：string
- 示例："三里屯"
- 是否实时：否
- 是否预测：否
- 是否适合进入 Constraint Ledger：是
- 对 PlanSolver/PlanEvaluator 的作用：按商圈筛选（需 extensions=all）
- 字段名：address
- 含义：详细地址
- 类型：string
- 示例："三里屯路19号太古里南区S9-30"
- 是否实时：否
- 是否预测：否
- 是否适合进入 Constraint Ledger：否
- 对 PlanSolver/PlanEvaluator 的作用：展示和路线规划
- 字段名：location
- 含义：经纬度坐标
- 类型：string
- 示例："116.4517,39.9342"
- 是否实时：否
- 是否预测：否
- 是否适合进入 Constraint Ledger：是
- 对 PlanSolver/PlanEvaluator 的作用：计算距离和路线
- 字段名：tel
- 含义：联系电话
- 类型：string
- 示例："010-64168888"
- 是否实时：否
- 是否预测：否
- 是否适合进入 Constraint Ledger：否
- 对 PlanSolver/PlanEvaluator 的作用：展示给用户
- 字段名：rating
- 含义：用户评分
- 类型：string
- 示例："4.5"
- 是否实时：否（定期更新）
- 是否预测：否
- 是否适合进入 Constraint Ledger：是
- 对 PlanSolver/PlanEvaluator 的作用：按评分排序和筛选（仅餐饮、酒店、景点、影院类）
- 字段名：cost
- 含义：人均消费
- 类型：string
- 示例："50"
- 是否实时：否（定期更新）
- 是否预测：否
- 是否适合进入 Constraint Ledger：是
- 对 PlanSolver/PlanEvaluator 的作用：按价格筛选（仅餐饮、酒店、景点、影院类）
- 字段名：tag
- 含义：POI 标签
- 类型：string
- 示例："环境好,服务好,咖啡好喝"
- 是否实时：否（定期更新）
- 是否预测：否
- 是否适合进入 Constraint Ledger：是
- 对 PlanSolver/PlanEvaluator 的作用：按标签筛选
- 字段名：opentime\_week
- 含义：一周营业时间
- 类型：string
- 示例："周一至周日 08:00-22:00"
- 是否实时：否（定期更新）
- 是否预测：否
- 是否适合进入 Constraint Ledger：是
- 对 PlanSolver/PlanEvaluator 的作用：判断营业状态和规划时间
- 字段名：opentime\_today
- 含义：今日营业时间
- 类型：string
- 示例："08:00-22:00"
- 是否实时：否（定期更新）
- 是否预测：否
- 是否适合进入 Constraint Ledger：是
- 对 PlanSolver/PlanEvaluator 的作用：判断当前营业状态
- 字段名：photos
- 含义：POI 图片列表
- 类型：array
- 示例：\[{"url": "<https://amap.com/photo/123.jpg>", "title": "门店外观"}]
- 是否实时：否（定期更新）
- 是否预测：否
- 是否适合进入 Constraint Ledger：否
- 对 PlanSolver/PlanEvaluator 的作用：展示给用户（需 extensions=all）
- 字段名：distance
- 含义：与搜索中心点的距离
- 类型：string
- 示例："500"
- 是否实时：否（基于坐标计算）
- 是否预测：否
- 是否适合进入 Constraint Ledger：是
- 对 PlanSolver/PlanEvaluator 的作用：按距离排序和筛选（仅周边搜索）

#### 不可获取但 DZUltra 需要的字段：

- 字段名：评论数
- 建议 mock 方式：基于评分和品类生成合理的评论数量
- 未来可能的数据来源：高德地图用户评论数据（需高级权限）
- 字段名：当前营业状态
- 建议 mock 方式：基于当前时间和 opentime\_today 字段计算
- 未来可能的数据来源：高德地图实时营业状态服务（需高级权限）
- 字段名：团购/套餐
- 建议 mock 方式：基于品类和人均价格生成模拟套餐
- 未来可能的数据来源：第三方团购数据服务
- 字段名：预订入口
- 建议 mock 方式：生成模拟的预订链接
- 未来可能的数据来源：第三方预订平台数据
- 字段名：排队/取号入口
- 建议 mock 方式：生成模拟的排队链接
- 未来可能的数据来源：第三方排队平台数据
- 字段名：品牌/连锁信息
- 建议 mock 方式：从 POI 名称中提取品牌信息
- 未来可能的数据来源：高德地图品牌库数据

#### 接口示例：

- 请求参数：

```
https://restapi.amap.com/v5/place/text?key=YOUR_KEY&keywords=星巴克&region=北京&extensions=all&page_size=10&page_num=1
```

- 返回片段：

```json
{
  "status": "1",
  "info": "OK",
  "infocode": "10000",
  "count": "100",
  "pois": [
    {
      "id": "B0FFFZ7X7K",
      "name": "星巴克咖啡(三里屯太古里店)",
      "type": "餐饮服务:咖啡厅:星巴克",
      "typecode": "050101",
      "pname": "北京市",
      "cityname": "北京市",
      "adname": "朝阳区",
      "business_area": "三里屯",
      "address": "三里屯路19号太古里南区S9-30",
      "location": "116.4517,39.9342",
      "tel": "010-64168888",
      "rating": "4.5",
      "cost": "50",
      "tag": "环境好,服务好,咖啡好喝",
      "opentime_week": "周一至周日 08:00-22:00",
      "opentime_today": "08:00-22:00",
      "photos": [
        {
          "url": "https://amap.com/photo/123.jpg",
          "title": "门店外观"
        }
      ],
      "distance": "500"
    }
  ]
}
```

#### 风险：

- 配额：免费版每日 300000 次调用，并发 100 次/秒；付费版可提升至千万次/天
- 精度：基础信息精度高，部分深度信息（如评分、人均）更新频率较低
- 延迟：平均响应时间约 50-150ms
- 合规/隐私：符合国家地图数据规范，无隐私问题
- 地域覆盖：覆盖全国所有城市和大部分乡镇，数据全面性最好

## 三、百度地图 POI 检索 API

### Provider 名称：百度地图 Web 服务 API - 地点检索 v2

官方文档链接：<https://lbsyun.baidu.com/index.php?title=webapi/guide/webservice-placeapi>
是否官方 API：是
是否需要账号/Key：是，需申请服务端 AK
是否可商用/是否有调用限制：可商用，免费版每日 100000 次调用，付费版可提升配额

#### 可获取字段：

- 字段名：uid
- 含义：POI 唯一标识
- 类型：string
- 示例："1234567890abcdef12345678"
- 是否实时：否
- 是否预测：否
- 是否适合进入 Constraint Ledger：是
- 对 PlanSolver/PlanEvaluator 的作用：唯一标识 POI
- 字段名：name
- 含义：POI 名称
- 类型：string
- 示例："星巴克咖啡(三里屯太古里店)"
- 是否实时：否
- 是否预测：否
- 是否适合进入 Constraint Ledger：是
- 对 PlanSolver/PlanEvaluator 的作用：展示和关键词匹配
- 字段名：category
- 含义：POI 分类
- 类型：string
- 示例："餐饮:咖啡厅"
- 是否实时：否
- 是否预测：否
- 是否适合进入 Constraint Ledger：是
- 对 PlanSolver/PlanEvaluator 的作用：按品类筛选
- 字段名：province
- 含义：所在省份
- 类型：string
- 示例："北京市"
- 是否实时：否
- 是否预测：否
- 是否适合进入 Constraint Ledger：是
- 对 PlanSolver/PlanEvaluator 的作用：限定搜索范围
- 字段名：city
- 含义：所在城市
- 类型：string
- 示例："北京市"
- 是否实时：否
- 是否预测：否
- 是否适合进入 Constraint Ledger：是
- 对 PlanSolver/PlanEvaluator 的作用：限定搜索范围
- 字段名：area
- 含义：所在区县
- 类型：string
- 示例："朝阳区"
- 是否实时：否
- 是否预测：否
- 是否适合进入 Constraint Ledger：是
- 对 PlanSolver/PlanEvaluator 的作用：按区域筛选
- 字段名：address
- 含义：详细地址
- 类型：string
- 示例："三里屯路19号太古里南区S9-30"
- 是否实时：否
- 是否预测：否
- 是否适合进入 Constraint Ledger：否
- 对 PlanSolver/PlanEvaluator 的作用：展示和路线规划
- 字段名：location
- 含义：经纬度坐标
- 类型：object
- 示例：{"lat": 39.9342, "lng": 116.4517}
- 是否实时：否
- 是否预测：否
- 是否适合进入 Constraint Ledger：是
- 对 PlanSolver/PlanEvaluator 的作用：计算距离和路线
- 字段名：telephone
- 含义：联系电话
- 类型：string
- 示例："010-64168888"
- 是否实时：否
- 是否预测：否
- 是否适合进入 Constraint Ledger：否
- 对 PlanSolver/PlanEvaluator 的作用：展示给用户
- 字段名：detail\_info
- 含义：POI 详细信息
- 类型：object
- 示例：{"price": "50", "overall\_rating": "4.5", "comment\_num": "1000", "tag": "环境好,服务好", "open\_time": "08:00-22:00"}
- 是否实时：否（定期更新）
- 是否预测：否
- 是否适合进入 Constraint Ledger：是
- 对 PlanSolver/PlanEvaluator 的作用：提供深度筛选条件（需 scope=2）
- 字段名：distance
- 含义：与搜索中心点的距离
- 类型：number
- 示例：500
- 是否实时：否（基于坐标计算）
- 是否预测：否
- 是否适合进入 Constraint Ledger：是
- 对 PlanSolver/PlanEvaluator 的作用：按距离排序和筛选（仅周边搜索）

#### 不可获取但 DZUltra 需要的字段：

- 字段名：商圈
- 建议 mock 方式：基于经纬度匹配预定义的商圈边界数据
- 未来可能的数据来源：百度地图商圈数据（需高级权限）
- 字段名：当前营业状态
- 建议 mock 方式：基于当前时间和 open\_time 字段计算
- 未来可能的数据来源：百度地图实时营业状态服务（需高级权限）
- 字段名：图片
- 建议 mock 方式：使用占位图或从免费图库获取
- 未来可能的数据来源：百度地图图片服务（需高级权限）
- 字段名：团购/套餐
- 建议 mock 方式：基于品类和人均价格生成模拟套餐
- 未来可能的数据来源：第三方团购数据服务
- 字段名：预订入口
- 建议 mock 方式：生成模拟的预订链接
- 未来可能的数据来源：第三方预订平台数据
- 字段名：排队/取号入口
- 建议 mock 方式：生成模拟的排队链接
- 未来可能的数据来源：第三方排队平台数据
- 字段名：品牌/连锁信息
- 建议 mock 方式：从 POI 名称中提取品牌信息
- 未来可能的数据来源：百度地图品牌库数据

#### 接口示例：

- 请求参数：

```
https://api.map.baidu.com/place/v2/search?query=星巴克&region=北京&output=json&ak=YOUR_AK&scope=2&page_size=10&page_num=0
```

- 返回片段：

```json
{
  "status": 0,
  "message": "ok",
  "total": 100,
  "results": [
    {
      "uid": "1234567890abcdef12345678",
      "name": "星巴克咖啡(三里屯太古里店)",
      "category": "餐饮:咖啡厅",
      "province": "北京市",
      "city": "北京市",
      "area": "朝阳区",
      "address": "三里屯路19号太古里南区S9-30",
      "location": {
        "lat": 39.9342,
        "lng": 116.4517
      },
      "telephone": "010-64168888",
      "detail_info": {
        "price": "50",
        "overall_rating": "4.5",
        "comment_num": "1000",
        "tag": "环境好,服务好,咖啡好喝",
        "open_time": "08:00-22:00"
      },
      "distance": 500
    }
  ]
}
```

#### 风险：

- 配额：免费版每日 100000 次调用，并发 100 次/秒；付费版可提升
- 精度：基础信息精度高，评论数和评分数据相对丰富
- 延迟：平均响应时间约 80-200ms
- 合规/隐私：符合国家地图数据规范，无隐私问题
- 地域覆盖：覆盖全国主要城市，三四线城市数据较好

## 四、腾讯位置服务 POI 搜索 API

### Provider 名称：腾讯位置服务 WebService API - 地点搜索 v1

官方文档链接：<https://lbs.qq.com/service/webService/webServiceGuide/search/Search>
是否官方 API：是
是否需要账号/Key：是，需申请 WebService API Key
是否可商用/是否有调用限制：可商用，免费版每日 10000 次调用，付费版可提升配额

#### 可获取字段：

- 字段名：id
- 含义：POI 唯一标识
- 类型：string
- 示例："2688340099880903279"
- 是否实时：否
- 是否预测：否
- 是否适合进入 Constraint Ledger：是
- 对 PlanSolver/PlanEvaluator 的作用：唯一标识 POI
- 字段名：title
- 含义：POI 名称
- 类型：string
- 示例："星巴克咖啡(三里屯太古里店)"
- 是否实时：否
- 是否预测：否
- 是否适合进入 Constraint Ledger：是
- 对 PlanSolver/PlanEvaluator 的作用：展示和关键词匹配
- 字段名：category
- 含义：POI 分类
- 类型：string
- 示例： "餐饮服务:咖啡厅:星巴克"
- 是否实时：否
- 是否预测：否
- 是否适合进入 Constraint Ledger：是
- 对 PlanSolver/PlanEvaluator 的作用：按品类筛选
- 字段名：ad\_info
- 含义：行政区划信息
- 类型：object
- 示例：{"province": "北京市", "city": "北京市", "district": "海淀区", "adcode": 110108}
- 是否实时：否
- 是否预测：否
- 是否适合进入 Constraint Ledger：是
- 对 PlanSolver/PlanEvaluator 的作用：限定搜索范围和按区域筛选
- 字段名：address
- 含义：详细地址
- 类型：string
- 示例："北京市朝阳区三里屯路19号太古里南区S9-30"
- 是否实时：否
- 是否预测：否
- 是否适合进入 Constraint Ledger：否
- 对 PlanSolver/PlanEvaluator 的作用：展示和路线规划
- 字段名：location
- 含义：经纬度坐标
- 类型：object
- 示例：{"lat": 39.9342, "lng": 116.4517}
- 是否实时：否
- 是否预测：否
- 是否适合进入 Constraint Ledger：是
- 对 PlanSolver/PlanEvaluator 的作用：计算距离和路线
- 字段名：tel
- 含义：联系电话
- 类型：string
- 示例："010-64168888"
- 是否实时：否
- 是否预测：否
- 是否适合进入 Constraint Ledger：否
- 对 PlanSolver/PlanEvaluator 的作用：展示给用户
- 字段名：\_distance
- 含义：与搜索中心点的距离
- 类型：number
- 示例：500
- 是否实时：否（基于坐标计算）
- 是否预测：否
- 是否适合进入 Constraint Ledger：是
- 对 PlanSolver/PlanEvaluator 的作用：按距离排序和筛选（仅周边搜索）

#### 不可获取但 DZUltra 需要的字段：

- 字段名：商圈
- 建议 mock 方式：基于经纬度匹配预定义的商圈边界数据
- 未来可能的数据来源：腾讯地图商圈数据（需高级权限）
- 字段名：人均价格
- 建议 mock 方式：基于品类和城市生成合理的价格区间
- 未来可能的数据来源：腾讯地图本地生活数据（需高级权限）
- 字段名：评分
- 建议 mock 方式：基于品类和品牌生成 3.0-5.0 的随机评分
- 未来可能的数据来源：腾讯地图用户评分数据（需高级权限）
- 字段名：评论数
- 建议 mock 方式：基于评分和品类生成合理的评论数量
- 未来可能的数据来源：腾讯地图用户评论数据（需高级权限）
- 字段名：标签
- 建议 mock 方式：基于品类生成常见标签
- 未来可能的数据来源：腾讯地图标签数据（需高级权限）
- 字段名：营业时间
- 建议 mock 方式：基于品类生成标准营业时间
- 未来可能的数据来源：腾讯地图营业时间数据（需高级权限）
- 字段名：当前营业状态
- 建议 mock 方式：基于当前时间和 mock 的营业时间计算
- 未来可能的数据来源：腾讯地图实时营业状态服务（需高级权限）
- 字段名：图片
- 建议 mock 方式：使用占位图或从免费图库获取
- 未来可能的数据来源：腾讯地图图片服务（需高级权限）
- 字段名：团购/套餐
- 建议 mock 方式：基于品类和人均价格生成模拟套餐
- 未来可能的数据来源：第三方团购数据服务
- 字段名：预订入口
- 建议 mock 方式：生成模拟的预订链接
- 未来可能的数据来源：第三方预订平台数据
- 字段名：排队/取号入口
- 建议 mock 方式：生成模拟的排队链接
- 未来可能的数据来源：第三方排队平台数据
- 字段名：品牌/连锁信息
- 建议 mock 方式：从 POI 名称中提取品牌信息
- 未来可能的数据来源：腾讯地图品牌库数据

#### 接口示例：

- 请求参数：

```
https://apis.map.qq.com/ws/place/v1/search?keyword=星巴克&region=北京&key=YOUR_KEY&page_size=10&page_index=1
```

- 返回片段：

```json
{
  "status": 0,
  "message": "query ok",
  "count": 100,
  "request_id": "123122181103411eebc381494197ae6493561a3bc676",
  "data": [
    {
      "id": "2688340099880903279",
      "title": "星巴克咖啡(三里屯太古里店)",
      "category": "餐饮服务:咖啡厅:星巴克",
      "ad_info": {
        "adcode": 110105,
        "province": "北京市",
        "city": "北京市",
        "district": "朝阳区"
      },
      "address": "北京市朝阳区三里屯路19号太古里南区S9-30",
      "location": {
        "lat": 39.9342,
        "lng": 116.4517
      },
      "tel": "010-64168888",
      "_distance": 500
    }
  ]
}
```

#### 风险：

- 配额：免费版每日 10000 次调用，并发 5 次/秒；付费版可提升至百万次/天
- 精度：基础信息精度高，但缺少本地生活深度信息
- 延迟：平均响应时间约 60-180ms
- 合规/隐私：符合国家地图数据规范，无隐私问题
- 地域覆盖：覆盖全国主要城市，数据更新速度较快

## 五、综合对比与推荐

| Provider | 基础字段完整度 | 深度字段完整度 | 免费配额  | 响应速度  | 地域覆盖  | 推荐指数  |
| -------- | ------- | ------- | ----- | ----- | ----- | ----- |
| 高德地图     | ★★★★★   | ★★★★☆   | ★★★★★ | ★★★★☆ | ★★★★★ | ★★★★★ |
| 百度地图     | ★★★★☆   | ★★★★☆   | ★★★★☆ | ★★★☆☆ | ★★★★☆ | ★★★★☆ |
| 腾讯地图     | ★★★★☆   | ★★☆☆☆   | ★★☆☆☆ | ★★★★☆ | ★★★★☆ | ★★★☆☆ |
| 美团地图     | ★★★☆☆   | ★★☆☆☆   | ★★★☆☆ | ★★★☆☆ | ★★★☆☆ | ★★☆☆☆ |

### 推荐方案：

1. **V3 阶段首选：高德地图 POI 搜索 API**
   - 提供最完整的基础字段和大部分深度字段（商圈、评分、人均、营业时间、标签等）
   - 免费配额最高（每日 30 万次），足够 Demo 使用
   - 数据全面性和更新频率最好
   - 支持按品类、区域、价格、评分等多维度筛选
2. **备选方案：百度地图 POI 检索 API**
   - 提供评论数字段，这是高德地图没有的
   - 免费配额也较高（每日 10 万次）
   - 可以作为高德地图的补充或备份
3. **未来扩展：美团 ISV 合作**
   - 如果项目发展到一定规模，可以申请美团 ISV 资质
   - 获取最完整的本地生活数据（团购、预订、排队等）
   - 实现与大众点评/美团生态的深度集成

### 字段补充策略：

对于所有 API 都无法获取的字段，建议采用以下 mock 策略：

1. **基于规则生成**：如营业时间根据品类生成标准值
2. **基于名称提取**：如品牌信息从 POI 名称中提取
3. **基于概率分布**：如评分和评论数根据品类和城市生成合理值
4. **预定义数据**：如商圈边界使用公开的地理数据

# DZUltra 本地出行路线规划 Agent POI 营业时间 API 调研

## 一、美团点评开放平台（优先推荐）

**Provider 名称：** 美团点评POI开放平台
**官方文档链接：** https://poiopen.dianping.com/instructions/doc/poi.html 
**是否官方 API：** 是
**是否需要账号/Key：** 是，需要注册开发者账号并申请AppKey和Session 
**是否可商用/是否有调用限制：** 可商用，有调用配额限制（具体需联系商务）

### 可获取字段：

- **字段名：** business_hour
- **含义：** 营业时间原文
- **类型：** string
- **示例：** "周一至周日 10:00-22:00" 或 "周一至周五 09:00-12:00 13:00-17:30 周六,周日 09:00-18:00"
- **是否实时：** 否（静态数据，定期更新）
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 基础营业时间判断，用于过滤计划到达时间不在营业范围内的POI

---

- **字段名：** openstatus
- **含义：** 商户在线状态
- **类型：** int
- **示例：** 1（在线）、0（下线）
- **是否实时：** 是（实时更新）
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 过滤已永久下线的POI

---

- **字段名：** updateTime
- **含义：** 数据最后一次更新时间
- **类型：** number
- **示例：** 20260420153022
- **是否实时：** 否（记录数据更新时间）
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 否（用于数据质量评估）
- **对 PlanSolver/PlanEvaluator 的作用：** 评估营业时间数据的新鲜度和可靠性

### 不可获取但 DZUltra 需要的字段：

- **字段名：** 结构化营业时间（周一至周日分别的时间段）
- **建议 mock 方式：** 使用LLM解析business_hour原文，转换为结构化JSON格式
  ```json
  {
    "monday": ["09:00-12:00", "13:00-17:30"],
    "tuesday": ["09:00-12:00", "13:00-17:30"],
    "wednesday": ["09:00-12:00", "13:00-17:30"],
    "thursday": ["09:00-12:00", "13:00-17:30"],
    "friday": ["09:00-12:00", "13:00-17:30"],
    "saturday": ["09:00-18:00"],
    "sunday": ["09:00-18:00"]
  }
  ```
- **未来可能的数据来源：** 美团内部API（商家管理系统）

---

- **字段名：** 节假日特殊营业时间
- **建议 mock 方式：** 
  1. 基于通用节假日规则（如春节、国庆等）生成默认调整
  2. 结合用户评论中提到的节假日营业情况进行修正
- **未来可能的数据来源：** 美团内部商家自主上报系统

---

- **字段名：** 当前营业状态
- **建议 mock 方式：** 基于结构化营业时间和当前时间计算
- **未来可能的数据来源：** 美团到店实时营业状态API（需高级权限）

---

- **字段名：** 暂停营业/临时闭店
- **建议 mock 方式：** 
  1. 定期爬取大众点评网页端的"暂停营业"标签
  2. 结合近期用户评论中提到的闭店信息
- **未来可能的数据来源：** 美团内部商家临时闭店上报系统

---

- **字段名：** 最晚入店时间
- **建议 mock 方式：** 基于营业结束时间提前15-30分钟计算
- **未来可能的数据来源：** 美团到店商家详情页（需网页解析）

---

- **字段名：** 厨房/点单截止时间
- **建议 mock 方式：** 
  1. 餐饮类POI基于营业结束时间提前30-60分钟计算
  2. 非餐饮类POI与最晚入店时间相同
- **未来可能的数据来源：** 美团到店商家详情页（需网页解析）

### 接口示例：

- **请求参数：**
  ```json
  {
    "appkey": "YOUR_APPKEY",
    "session": "YOUR_SESSION",
    "timestamp": "1717756800000",
    "sign": "MD5_SIGNATURE",
    "openshopid": "B0FFFAB6J2"
  }
  ```

- **返回片段：**
  ```json
  {
    "data": {
      "openshopid": "B0FFFAB6J2",
      "openstatus": 1,
      "name": "星巴克(首开广场店)",
      "branch_name": "首开广场店",
      "address": "阜荣街10号首开广场1层",
      "latitude": 39.993015,
      "longitude": 116.473168,
      "telephone": "010-84761234",
      "business_hour": "周一至周日 07:00-22:00",
      "categories": ["餐饮服务;咖啡厅;星巴克"],
      "star": 4.5,
      "avgprice": 40,
      "updateTime": 20260420153022
    },
    "status": "success",
    "success": true
  }
  ```

### 风险：

- **配额：** 基础配额有限，高并发场景需联系商务提升
- **精度：** 营业时间为原文格式，需自行解析；部分商家信息更新不及时
- **延迟：** 接口响应时间约100-300ms
- **合规/隐私：** 需严格遵守美团点评数据使用规范，不得用于商业竞争
- **地域覆盖：** 中国大陆地区覆盖全面，海外地区有限

## 二、高德地图开放平台

**Provider 名称：** 高德地图Web服务API
**官方文档链接：** https://lbs.amap.com/api/webservice/guide/api/search 
**是否官方 API：** 是
**是否需要账号/Key：** 是，需要申请Web服务API类型的Key 
**是否可商用/是否有调用限制：** 可商用，免费版每日30万次调用，付费版可提升配额 

### 可获取字段：

- **字段名：** business_time
- **含义：** 营业时间原文
- **类型：** string
- **示例：** "07:00-22:00" 或 "08:30-12:00 14:30-18:30"
- **是否实时：** 否（静态数据，定期更新）
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 基础营业时间判断

---

- **字段名：** opentime_today
- **含义：** 今日营业时间
- **类型：** string
- **示例：** "08:30-17:30"
- **是否实时：** 是（基于日期动态计算）
- **是否预测：** 是（预测当日营业时间）
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 快速判断今日是否营业及具体时间段

---

- **字段名：** opentime_week
- **含义：** 一周营业时间描述
- **类型：** string
- **示例：** "周一至周五:08:00-18:00;周六至周日:09:00-17:00"
- **是否实时：** 否
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 用于未来日期的营业时间判断

### 不可获取但 DZUltra 需要的字段：

- **字段名：** 结构化营业时间（JSON格式）
- **建议 mock 方式：** 使用LLM解析opentime_week原文，转换为结构化JSON
- **未来可能的数据来源：** 高德地图高级API（需付费开通）

---

- **字段名：** 节假日特殊营业时间
- **建议 mock 方式：** 结合高德节假日API（https://restapi.amap.com/v3/holiday）和通用规则生成
- **未来可能的数据来源：** 高德地图商家自主上报系统

---

- **字段名：** 当前营业状态
- **建议 mock 方式：** 基于opentime_today和当前时间计算
- **未来可能的数据来源：** 高德地图实时营业状态API（需高级权限）

---

- **字段名：** 暂停营业/临时闭店
- **建议 mock 方式：** 定期爬取高德地图网页端的"暂停营业"标签
- **未来可能的数据来源：** 高德地图商家临时闭店上报系统

---

- **字段名：** 最晚入店时间、厨房/点单截止时间
- **建议 mock 方式：** 同美团点评方案
- **未来可能的数据来源：** 高德地图商家详情页（需网页解析）

### 接口示例：

- **请求参数：**
  ```
  https://restapi.amap.com/v3/place/detail?id=B0FFFAB6J2&key=YOUR_KEY&extensions=all
  ```

- **返回片段：**
  ```json
  {
    "status": "1",
    "info": "OK",
    "count": "1",
    "pois": [
      {
        "id": "B0FFFAB6J2",
        "name": "星巴克(首开广场店)",
        "type": "餐饮服务;咖啡厅;星巴克",
        "address": "阜荣街10号首开广场1层",
        "location": "116.473168,39.993015",
        "tel": "010-84761234",
        "business_time": "07:00-22:00",
        "opentime_today": "07:00-22:00",
        "opentime_week": "周一至周日:07:00-22:00",
        "biz_ext": {
          "rating": "4.5",
          "cost": "40"
        }
      }
    ]
  }
  ```

### 风险：

- **配额：** 免费版每日30万次，足够Demo使用；高并发需付费
- **精度：** 营业时间信息不如美团点评详细，部分商家缺少opentime_week字段
- **延迟：** 接口响应时间约50-200ms
- **合规/隐私：** 需遵守高德地图开发者协议
- **地域覆盖：** 中国大陆地区覆盖全面

## 三、百度地图开放平台

**Provider 名称：** 百度地图Web服务API
**官方文档链接：** https://lbsyun.baidu.com/index.php?title=webapi/guide/webservice-placeapi 
**是否官方 API：** 是
**是否需要账号/Key：** 是，需要申请AK 
**是否可商用/是否有调用限制：** 可商用，免费版每日10万次调用，付费版可提升配额 

### 可获取字段：

- **字段名：** shop_hours
- **含义：** 营业时间原文
- **类型：** string
- **示例：** "周一至周四17:00-03:00 周五至周日16:30-03:00"
- **是否实时：** 否
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 基础营业时间判断

---

- **字段名：** status
- **含义：** POI营业状态（高级付费功能）
- **类型：** string
- **示例：** "正常营业"、"暂停营业"、"已关闭"
- **是否实时：** 是
- **是否预测：** 否
- **是否适合进入 Constraint Ledger：** 是
- **对 PlanSolver/PlanEvaluator 的作用：** 过滤已关闭或暂停营业的POI

### 不可获取但 DZUltra 需要的字段：

- **字段名：** 结构化营业时间、节假日特殊营业时间、当前营业状态、最晚入店时间、厨房/点单截止时间
- **建议 mock 方式：** 同美团点评和高德地图方案
- **未来可能的数据来源：** 百度地图高级API（需付费开通）

### 接口示例：

- **请求参数：**
  ```
  http://api.map.baidu.com/place/v2/detail?uid=123456789&ak=YOUR_AK&output=json&scope=2
  ```

- **返回片段：**
  ```json
  {
    "status": 0,
    "message": "ok",
    "result": {
      "uid": "123456789",
      "name": "很久以前羊肉串(台湾街店)",
      "address": "北京市石景山区鲁谷路台湾街C1区",
      "location": {
        "lat": 39.904055,
        "lng": 116.229342
      },
      "telephone": "13691209204",
      "detail_info": {
        "shop_hours": "周一至周四17:00-03:00 周五至周日16:30-03:00",
        "overall_rating": "5.0",
        "price": "114",
        "status": "正常营业"
      }
    }
  }
  ```

### 风险：

- **配额：** 免费版每日10万次，足够Demo使用
- **精度：** 营业时间信息相对较少，营业状态字段需付费开通
- **延迟：** 接口响应时间约100-300ms
- **合规/隐私：** 需遵守百度地图开发者协议
- **地域覆盖：** 中国大陆地区覆盖全面

## 四、关键字段获取能力对比表

| 字段名 | 美团点评开放API | 高德地图开放API | 百度地图开放API | 大众点评内部数据 |
|--------|----------------|----------------|----------------|------------------|
| 营业时间原文 | ✅ | ✅ | ✅ | ✅ |
| 结构化营业时间 | ❌ | ❌ | ❌ | ✅ |
| 周一至周日不同营业时间 | ❌（需解析） | ✅（原文格式） | ❌（需解析） | ✅ |
| 节假日特殊营业时间 | ❌ | ❌ | ❌ | ✅ |
| 当前营业状态 | ❌（需计算） | ❌（需计算） | ✅（付费） | ✅ |
| 暂停营业/临时闭店 | ❌ | ❌ | ✅（付费） | ✅ |
| 最晚入店时间 | ❌ | ❌ | ❌ | ✅ |
| 厨房/点单截止时间 | ❌ | ❌ | ❌ | ✅ |
| 数据更新时间 | ✅ | ❌ | ❌ | ✅ |

## 五、DZUltra V3 实现建议

### 1. 数据来源优先级
1. **首选：** 美团点评开放API（数据最全面、最准确，与项目"点仔Ultra"定位匹配）
2. **备选：** 高德地图开放API（配额充足，响应速度快）
3. **补充：** 百度地图开放API（用于营业状态校验）

### 2. 字段处理策略
- **基础字段：** 直接从API获取
- **结构化字段：** 使用LLM（如GPT-4o）解析营业时间原文，转换为统一的JSON格式
- **实时状态：** 基于结构化营业时间和当前时间计算
- **特殊字段：** 
  - 节假日营业时间：结合通用节假日规则和用户评论修正
  - 厨房截止时间：餐饮类POI提前30-60分钟，非餐饮类与最晚入店时间相同
  - 临时闭店：定期爬取网页端信息或通过用户反馈更新

### 3. Provider 边界设计
```
┌─────────────────────────────────────────────────────────┐
│                     DZUltra Agent                       │
├─────────────────────────────────────────────────────────┤
│  Constraint Ledger  │  PlanSolver  │  PlanEvaluator     │
└─────────┬───────────────────┬───────────────────┬───────┘
          │                   │                   │
┌─────────▼───────────────────▼───────────────────▼───────┐
│                  POI Provider Adapter                   │
├─────────────┬─────────────┬─────────────┬───────────────┤
│ 美团点评API │ 高德地图API │ 百度地图API │ LLM Parser    │
└─────────────┴─────────────┴─────────────┴───────────────┘
```

### 4. Mock 数据生成规范
为了在V3中模拟真实API行为，建议按照以下规范生成Mock数据：
1. 每个POI的营业时间原文格式与真实API保持一致
2. 结构化营业时间JSON格式统一
3. 包含常见的营业时间模式（全天营业、分段营业、周末不同、节假日调整等）
4. 随机生成部分POI的临时闭店状态
5. 为餐饮类POI添加厨房截止时间

# DZUltra 本地出行路线规划 Agent Provider API 调研

## Provider 1：美团点评实时数据开放平台
**官方文档链接**：https://poiopen.dianping.com/instructions/doc/coop.html 
**是否官方 API**：是
**是否需要账号/Key**：是（需要申请 appkey、appsecret 和 session 授权码）
**是否可商用/是否有调用限制**：可商用，需与美团点评商务合作，有调用配额限制，具体以商务合同为准

### 可获取字段
- **字段名**：queueable
  - **含义**：商家是否支持在线排号
  - **类型**：boolean
  - **示例**：true
  - **是否实时**：否（商家配置变更时更新）
  - **是否预测**：否
  - **是否适合进入 Constraint Ledger**：是
  - **对 PlanSolver/PlanEvaluator 的作用**：筛选支持排队的商家，排除无法提前取号的选项

- **字段名**：appQueueUrl
  - **含义**：App 内排号链接
  - **类型**：string
  - **示例**："dianping://queue?shopId=123456"
  - **是否实时**：否
  - **是否预测**：否
  - **是否适合进入 Constraint Ledger**：否
  - **对 PlanSolver/PlanEvaluator 的作用**：提供一键跳转到取号页面的入口

- **字段名**：mQueueUrl
  - **含义**：H5 排号链接
  - **类型**：string
  - **示例**："https://m.dianping.com/queue/123456"
  - **是否实时**：否
  - **是否预测**：否
  - **是否适合进入 Constraint Ledger**：否
  - **对 PlanSolver/PlanEvaluator 的作用**：提供网页端取号入口

- **字段名**：queueInfo
  - **含义**：POI 实时排队信息对象
  - **类型**：object
  - **示例**：{"msg":"当前无需排队","shortMsg":"无需排队"}
  - **是否实时**：是（约 1-5 分钟更新一次）
  - **是否预测**：否
  - **是否适合进入 Constraint Ledger**：是
  - **对 PlanSolver/PlanEvaluator 的作用**：提供当前排队状态的文本描述

- **字段名**：queueInfo.msg
  - **含义**：POI 实时排队详细说明
  - **类型**：string
  - **示例**："小桌前面还有15桌，预计等待45分钟"
  - **是否实时**：是
  - **是否预测**：部分是（包含平台预测的等待时间）
  - **是否适合进入 Constraint Ledger**：是
  - **对 PlanSolver/PlanEvaluator 的作用**：解析获取当前排队桌数和预计等待时间

- **字段名**：queueInfo.shortMsg
  - **含义**：POI 实时排队简短说明
  - **类型**：string
  - **示例**："等位45分钟"
  - **是否实时**：是
  - **是否预测**：部分是
  - **是否适合进入 Constraint Ledger**：是
  - **对 PlanSolver/PlanEvaluator 的作用**：快速获取排队状态摘要

### 不可获取但 DZUltra 需要的字段
- **字段名**：当前排队人数（分桌型）
  - **建议 mock 方式**：基于 queueInfo.msg 文本解析提取；如无法解析，根据商家热度、时段、历史数据模拟生成
  - **未来可能的数据来源**：美团排队商家端 API 开放、大众点评商家详情页结构化数据接口

- **字段名**：当前等位时间（分桌型）
  - **建议 mock 方式**：基于 queueInfo.msg 文本解析提取；如无法解析，使用行业平均翻台率 × 排队桌数计算
  - **未来可能的数据来源**：美团排队商家端 API 开放

- **字段名**：当前排号状态
  - **建议 mock 方式**：根据 queueInfo.msg 判断（"无需排队"/"等位中"/"暂停取号"等）
  - **未来可能的数据来源**：美团排队商家端 API 开放

- **字段名**：桌型/人数维度排队
  - **建议 mock 方式**：模拟常见桌型（2人桌、4人桌、6人桌、8人桌及以上）的排队数据，根据商家类型调整比例
  - **未来可能的数据来源**：美团排队商家端 API 开放

- **字段名**：历史等位数据
  - **建议 mock 方式**：基于公开的商家热度数据、点评评论中提到的等位时间，生成分时段历史平均数据
  - **未来可能的数据来源**：美团点评数据开放平台历史数据接口

- **字段名**：分时段历史平均等位
  - **建议 mock 方式**：按工作日/周末、早中晚时段划分，生成不同时段的平均等位时间
  - **未来可能的数据来源**：美团点评数据开放平台历史数据接口

- **字段名**：预测到达时等位人数
  - **建议 mock 方式**：基于当前排队人数、预计到达时间、历史翻台率、实时人流趋势进行简单线性预测
  - **未来可能的数据来源**：美团点评 AI 预测接口、第三方人流预测 API

- **字段名**：预测到达时等位分钟数
  - **建议 mock 方式**：基于预测到达时的等位人数 × 平均每桌翻台时间计算
  - **未来可能的数据来源**：美团点评 AI 预测接口

- **字段名**：数据更新时间
  - **建议 mock 方式**：记录每次 API 调用的时间作为数据更新时间
  - **未来可能的数据来源**：美团点评实时数据接口增加 timestamp 字段

### 接口示例
- **请求参数**：
  ```json
  {
    "appkey": "XXXX",
    "session": "XXXXX",
    "timestamp": "1717766400000",
    "sign": "XXXX",
    "openshopid": "123456"
  }
  ```

- **返回片段**：
  ```json
  {
    "data": {
      "queueInfo": {
        "msg": "小桌前面还有15桌，预计等待45分钟；中桌前面还有8桌，预计等待30分钟",
        "shortMsg": "等位45分钟"
      }
    },
    "status": "success",
    "success": true
  }
  ```

### 风险
- **配额**：有严格的调用配额限制，超出配额会被限流或封禁
- **精度**：queueInfo.msg 为文本描述，解析精度有限；不同商家的预测等待时间准确性差异较大
- **延迟**：数据更新延迟约 1-5 分钟，高峰期可能更长
- **合规/隐私**：需严格遵守美团点评数据使用规范，不得将数据用于商业转售
- **地域覆盖**：主要覆盖中国大陆地区，海外商家数据有限

---

## Provider 2：美团排队商家端 API
**官方文档链接**：https://developer.meituan.com/mobile/docs/biz/biz_dcpd_5b1171fb-bf1b-4521-acb4-7143e8bc71af 
**是否官方 API**：是
**是否需要账号/Key**：是（需要开发者 ID、appAuthToken，且需商家单独授权）
**是否可商用/是否有调用限制**：可商用，付费 API，按调用次数计费，有调用频率限制

### 可获取字段
- **字段名**：index
  - **含义**：队列位置，从 1 开始。index=9 代表前面还有 8 桌
  - **类型**：int
  - **示例**：16
  - **是否实时**：是（秒级更新）
  - **是否预测**：否
  - **是否适合进入 Constraint Ledger**：是
  - **对 PlanSolver/PlanEvaluator 的作用**：获取用户当前在队列中的准确位置

- **字段名**：status
  - **含义**：订单状态
  - **类型**：int
  - **示例**：3（排队中）
  - **是否实时**：是
  - **是否预测**：否
  - **是否适合进入 Constraint Ledger**：是
  - **对 PlanSolver/PlanEvaluator 的作用**：跟踪用户排队状态变化
  - **枚举值**：1-取号中，2-取号失败，3-排队中，4-叫号中，5-已就餐，6-已过号，7-取消中，8-已取消，0-其他

- **字段名**：orderCountLeft
  - **含义**：待叫号订单数
  - **类型**：int
  - **示例**：23
  - **是否实时**：是
  - **是否预测**：否
  - **是否适合进入 Constraint Ledger**：是
  - **对 PlanSolver/PlanEvaluator 的作用**：获取当前总排队订单数

- **字段名**：waitTime
  - **含义**：未制作菜品的等待时长（仅适用于餐饮订单）
  - **类型**：int
  - **示例**：35
  - **是否实时**：是
  - **是否预测**：是
  - **是否适合进入 Constraint Ledger**：是
  - **对 PlanSolver/PlanEvaluator 的作用**：获取菜品制作等待时间

- **字段名**：unit
  - **含义**：等待时长单位
  - **类型**：string
  - **示例**："分钟"
  - **是否实时**：否
  - **是否预测**：否
  - **是否适合进入 Constraint Ledger**：否
  - **对 PlanSolver/PlanEvaluator 的作用**：明确等待时间的单位

### 不可获取但 DZUltra 需要的字段
- **字段名**：商家整体排队情况（非用户个人订单）
  - **建议 mock 方式**：使用美团点评实时数据开放平台的 queueInfo 字段
  - **未来可能的数据来源**：美团排队商家端 API 开放商家整体队列查询接口

- **字段名**：分桌型排队数据
  - **建议 mock 方式**：模拟不同桌型的排队人数和等待时间
  - **未来可能的数据来源**：美团排队商家端 API 增加分桌型数据返回

- **字段名**：历史等位数据
  - **建议 mock 方式**：基于商家历史订单数据统计生成
  - **未来可能的数据来源**：美团排队商家端 API 开放历史数据查询接口

### 接口示例
- **请求参数**（查询门店订单等待时长）：
  ```
  POST /rms/solution/api/v1/poi/query/wait_time HTTP/1.1
  Host: api-open-cater.meituan.com
  Content-Type: application/x-www-form-urlencoded;charset=utf-8

  appAuthToken=eeee860a3d2a8b73cfb6604b136d6734283510c4e92282&
  businessId=18&
  charset=utf-8&
  developerId=10010&
  sign=4656285a4c2493e279d929b8b9f4e29310da8b2b&
  timestamp=1618543567&
  version=2&
  biz={
   "orgId": 1,
   "orderNo": "example"
  }
  ```

- **返回片段**：
  ```json
  {
    "code": "OP_SUCCESS",
    "msg": "成功",
    "traceId": "8531422235710213256",
    "data": {
      "foodCountLeft": 1,
      "orderCountLeft": 1,
      "waitTime": 35,
      "unit": "分钟"
    }
  }
  ```

### 风险
- **配额**：付费 API，按调用次数计费，有调用频率限制
- **精度**：数据精度高，但仅适用于已授权的商家和已创建的订单
- **延迟**：数据更新延迟低，约 1-10 秒
- **合规/隐私**：需获得商家单独授权，只能查询授权商家的订单数据
- **地域覆盖**：主要覆盖中国大陆地区使用美团排队系统的商家

---

## Provider 3：BestTime.app 人流预测 API
**官方文档链接**：https://documentation.besttime.app/ 
**是否官方 API**：是
**是否需要账号/Key**：是（需要 API Key）
**是否可商用/是否有调用限制**：可商用，提供免费试用版（每月 100 次调用）和付费版（按调用次数计费）

### 可获取字段
- **字段名**：visit_forecast
  - **含义**：指定时间的预计人流量百分比（0=空，100=本周最高峰）
  - **类型**：int
  - **示例**：75
  - **是否实时**：否（基于历史数据预测）
  - **是否预测**：是
  - **是否适合进入 Constraint Ledger**：是
  - **对 PlanSolver/PlanEvaluator 的作用**：预测商家在用户计划到达时间的拥挤程度

- **字段名**：live_busyness
  - **含义**：实时拥挤度与历史平均值的差异
  - **类型**：int
  - **示例**：15（比平时忙 15%）
  - **是否实时**：是（约 15-30 分钟更新一次）
  - **是否预测**：否
  - **是否适合进入 Constraint Ledger**：是
  - **对 PlanSolver/PlanEvaluator 的作用**：调整基于历史数据的预测结果

- **字段名**：peak_intensity
  - **含义**：高峰强度评级（1-5）
  - **类型**：int
  - **示例**：4
  - **是否实时**：否
  - **是否预测**：是
  - **是否适合进入 Constraint Ledger**：是
  - **对 PlanSolver/PlanEvaluator 的作用**：评估商家在高峰时段的拥挤程度

- **字段名**：peak_start_time
  - **含义**：高峰开始时间
  - **类型**：string
  - **示例**："18:00"
  - **是否实时**：否
  - **是否预测**：是
  - **是否适合进入 Constraint Ledger**：是
  - **对 PlanSolver/PlanEvaluator 的作用**：帮助用户避开高峰时段

- **字段名**：peak_end_time
  - **含义**：高峰结束时间
  - **类型**：string
  - **示例**："20:30"
  - **是否实时**：否
  - **是否预测**：是
  - **是否适合进入 Constraint Ledger**：是
  - **对 PlanSolver/PlanEvaluator 的作用**：帮助用户避开高峰时段

- **字段名**：duration_forecast
  - **含义**：预计停留时长（分钟）
  - **类型**：int
  - **示例**：90
  - **是否实时**：否
  - **是否预测**：是
  - **是否适合进入 Constraint Ledger**：是
  - **对 PlanSolver/PlanEvaluator 的作用**：估算用户在商家的停留时间，用于整体行程规划

### 不可获取但 DZUltra 需要的字段
- **字段名**：当前排队人数
  - **建议 mock 方式**：基于 visit_forecast 和商家容量进行估算
  - **未来可能的数据来源**：BestTime.app 增加排队人数预测功能

- **字段名**：当前等位时间
  - **建议 mock 方式**：基于 visit_forecast 和行业平均等位时间进行估算
  - **未来可能的数据来源**：BestTime.app 增加等位时间预测功能

- **字段名**：桌型/人数维度排队
  - **建议 mock 方式**：模拟不同桌型的排队比例
  - **未来可能的数据来源**：BestTime.app 增加分桌型数据

### 接口示例
- **请求参数**：
  ```
  GET https://besttime.app/api/v1/forecasts?api_key=YOUR_API_KEY&venue_id=VENUE_ID&day_int=5&hour_int=19
  ```

- **返回片段**：
  ```json
  {
    "analysis": {
      "venue_name": "海底捞火锅(三里屯店)",
      "venue_address": "北京市朝阳区三里屯路19号三里屯太古里南区3层",
      "day_int": 5,
      "hour_int": 19,
      "visit_forecast": 75,
      "live_busyness": 15,
      "peak_intensity": 4,
      "peak_start_time": "18:00",
      "peak_end_time": "20:30",
      "duration_forecast": 90
    }
  }
  ```

### 风险
- **配额**：免费版每月 100 次调用，付费版按调用次数计费
- **精度**：预测精度因地区和商家类型而异，热门商家精度较高
- **延迟**：实时数据更新延迟约 15-30 分钟
- **合规/隐私**：数据基于匿名手机信号收集，符合隐私法规
- **地域覆盖**：覆盖全球 150+ 国家和地区，但不同地区数据质量差异较大

---

## V2/V3 Mock Schema 建议
```json
{
  "shopId": "123456",
  "shopName": "海底捞火锅(三里屯店)",
  "queueable": true,
  "queueUrls": {
    "app": "dianping://queue?shopId=123456",
    "h5": "https://m.dianping.com/queue/123456"
  },
  "currentQueue": {
    "updateTime": "2026-06-07T18:42:00+08:00",
    "status": "waiting", // waiting, no_queue, suspended
    "tables": [
      {
        "tableType": "small", // 2人桌
        "waitingCount": 15,
        "estimatedWaitTime": 45
      },
      {
        "tableType": "medium", // 4人桌
        "waitingCount": 8,
        "estimatedWaitTime": 30
      },
      {
        "tableType": "large", // 6人桌
        "waitingCount": 3,
        "estimatedWaitTime": 20
      },
      {
        "tableType": "extra_large", // 8人及以上
        "waitingCount": 1,
        "estimatedWaitTime": 15
      }
    ],
    "totalWaitingCount": 27,
    "averageWaitTime": 35
  },
  "historicalData": {
    "weekday": {
      "11:00-13:00": {"averageWaitTime": 25, "peakWaitTime": 40},
      "17:00-20:00": {"averageWaitTime": 40, "peakWaitTime": 60}
    },
    "weekend": {
      "11:00-14:00": {"averageWaitTime": 45, "peakWaitTime": 75},
      "17:00-21:00": {"averageWaitTime": 60, "peakWaitTime": 90}
    }
  },
  "prediction": {
    "arrivalTime": "2026-06-07T19:30:00+08:00",
    "tables": [
      {
        "tableType": "small",
        "predictedWaitingCount": 12,
        "predictedWaitTime": 35
      },
      {
        "tableType": "medium",
        "predictedWaitingCount": 6,
        "predictedWaitTime": 25
      }
    ],
    "confidence": 0.75
  }
}
```

## 未来大众点评需要埋点记录的数据
1. **实时排队数据**：
   - 分桌型的当前排队人数
   - 分桌型的当前叫号号码
   - 分桌型的平均每桌用餐时间
   - 排队队列的实时变化率

2. **历史等位数据**：
   - 分时段（每小时）的平均等位时间
   - 分时段（每小时）的平均排队人数
   - 工作日/周末/节假日的等位数据差异
   - 不同天气情况下的等位数据差异

3. **用户行为数据**：
   - 用户取号后实际到达时间
   - 用户取号后取消排队的比例
   - 用户过号的比例
   - 用户实际用餐时长

4. **商家运营数据**：
   - 各桌型的可用桌数
   - 翻台率（分时段）
   - 服务员数量（分时段）
   - 厨房出餐速度（分时段）

   # DZUltra 本地出行路线规划 Agent Provider/API 调研文档

## 一、大众点评 POI 开放平台（首选数据源）

**Provider 名称：** 大众点评 POI 开放平台
**官方文档链接：** https://poiopen.dianping.com/instructions/doc/poi.html 
**是否官方 API：** 是
**是否需要账号/Key：** 是，需要企业开发者账号、AppKey、AppSecret 和 Session 授权码
**是否可商用/是否有调用限制：** 可商用，需签订商务协议；调用配额根据合作等级确定，有频率限制

### 可获取字段

| 字段名 | 含义 | 类型 | 示例 | 是否实时 | 是否预测 | 是否适合进入 Constraint Ledger | 对 PlanSolver/PlanEvaluator 的作用 |
|--------|------|------|------|----------|----------|--------------------------------|------------------------------------|
| openshopid | 商户唯一标识 | string | "H9dNInbVZA9jJ5qH" | 否 | 否 | 是 | 唯一标识POI，用于跨接口关联 |
| name | 商户名 | string | "九厨·淮扬(陆家嘴紫金山店)" | 否 | 否 | 是 | 展示POI名称 |
| branch_name | 分店名 | string | "陆家嘴紫金山店" | 否 | 否 | 是 | 区分同一品牌不同分店 |
| address | 地址 | string | "东方路778号金陵紫金山大酒店2楼" | 否 | 否 | 是 | 计算路线距离和导航 |
| latitude | 纬度 | double | 31.235928 | 否 | 否 | 是 | 地图定位和路线规划 |
| longitude | 经度 | double | 121.501654 | 否 | 否 | 是 | 地图定位和路线规划 |
| telephone | 电话号码 | string | "021-68868888" | 否 | 否 | 否 | 提供用户联系商家的方式 |
| business_hour | 营业时间 | string | "11:00-14:00,17:00-21:30" | 否 | 否 | 是 | 判断POI是否在用户出行时间内营业 |
| categories | 商户所属类别 | list | ["餐饮服务", "中餐厅", "淮扬菜"] | 否 | 否 | 是 | 筛选符合用户需求的POI类型 |
| star | 综合星级评分 | float | 4.7 | 是(准实时) | 否 | 是 | 评估POI整体质量 |
| avgprice | 人均价格 | int | 155 | 是(准实时) | 否 | 是 | 匹配用户预算约束 |
| reviewCount | 评论总数 | int | 455 | 是(准实时) | 否 | 是 | 评估评分的可信度 |
| reviewTags | 评论标签 | list | [{"tag":"环境优雅","hit":128}, {"tag":"服务热情","hit":96}] | 是(准实时) | 否 | 是 | 快速提取POI核心特征，匹配用户偏好 |
| ugcs | 评论列表 | list | 见下方示例 | 是(准实时) | 否 | 是 | 深入分析POI是否符合用户特定需求 |
| ugcs.item.nick | 评论人昵称 | string | "美食家小王" | 否 | 否 | 否 | 无直接作用，仅用于展示 |
| ugcs.item.score | 评论星级 | float | 4.5 | 否 | 否 | 是 | 区分好评和差评 |
| ugcs.item.content | 评论内容 | string | "环境非常好，适合约会，菜品口味也不错" | 否 | 否 | 是 | 提取用户关心的具体特征(安静、适合约会等) |
| ugcs.item.photos | 评论图片列表 | list | ["https://p0.meituan.net/ugcpic/xxx.jpg"] | 否 | 否 | 否 | 提供视觉参考 |
| ugcs.item.addtime | 评论时间 | timestamp | 1717238400 | 否 | 否 | 是 | 优先考虑近期评论，过滤过时信息 |
| special | 商户特色服务 | list | ["免费停车", "有包厢", "可预订"] | 否 | 否 | 是 | 匹配用户特殊需求 |
| queueable | 是否支持排号 | boolean | true | 是 | 否 | 是 | 评估等待时间风险 |
| bookable | 是否支持预订 | string | "是" | 是 | 否 | 是 | 匹配用户是否需要提前预订的需求 |

### 不可获取但 DZUltra 需要的字段

| 字段名 | 建议 mock 方式 | 未来可能的数据来源 |
|--------|----------------|--------------------|
| 用户打分维度(口味/环境/服务) | 基于综合评分和评论标签生成，例如环境标签多则环境分高 | 大众点评高级API权限 |
| 平台摘要 | 使用大模型基于评论内容和标签生成 | 大众点评官方摘要API |
| 好评关键词/差评关键词 | 使用大模型对评论内容进行关键词提取和情感分析 | 大众点评官方关键词API |
| 风险提示(如"排队超过1小时") | 基于评论中"排队"、"等待"等关键词的出现频率和评论时间生成 | 大众点评实时排队API |
| 按关键词或标签聚合评论 | 在本地对获取的评论列表进行关键词匹配和标签过滤 | 大众点评高级搜索API |
| 实时排队人数/等待时间 | 基于评论中最近的排队描述和历史数据预测 | 大众点评实时排队API |

### 接口示例

**请求参数：**
```json
{
  "appkey": "YOUR_APPKEY",
  "session": "YOUR_SESSION",
  "timestamp": "1717766400000",
  "sign": "GENERATED_SIGN",
  "openshopid": "H9dNInbVZA9jJ5qH"
}
```

**返回片段：**
```json
{
  "data": {
    "openshopid": "H9dNInbVZA9jJ5qH",
    "name": "九厨·淮扬(陆家嘴紫金山店)",
    "address": "东方路778号金陵紫金山大酒店2楼",
    "latitude": 31.235928,
    "longitude": 121.501654,
    "star": 4.7,
    "avgprice": 155,
    "reviewCount": 455,
    "reviewTags": [
      {"tag": "环境优雅", "hit": 128},
      {"tag": "服务热情", "hit": 96},
      {"tag": "菜品精致", "hit": 87},
      {"tag": "适合约会", "hit": 65}
    ],
    "ugcs": [
      {
        "nick": "美食家小王",
        "score": 4.5,
        "content": "环境非常好，装修很有格调，适合约会。菜品口味也不错，狮子头很入味，服务也很周到。",
        "addtime": 1717238400
      },
      {
        "nick": "吃货小李",
        "score": 3.5,
        "content": "味道还行，但是周末人太多了，排队排了一个半小时，体验不太好。",
        "addtime": 1717152000
      }
    ],
    "special": ["有包厢", "可预订", "提供WiFi"],
    "queueable": true,
    "bookable": "是"
  },
  "status": "success",
  "success": true
}
```

### 风险

- **配额：** 需商务谈判确定，个人开发者无法申请；企业级合作通常有每日调用上限
- **精度：** 数据精度高，与大众点评官网一致
- **延迟：** 评论数据有1-2小时延迟
- **合规/隐私：** 严格禁止存储用户个人信息；评论内容需脱敏处理，不得展示用户完整昵称和头像
- **地域覆盖：** 覆盖全国主要城市，海外覆盖有限

## 二、美团开放平台（到店餐饮）

**Provider 名称：** 美团开放平台（到店餐饮）
**官方文档链接：** https://developer.meituan.com/mobile/docs/api/ddzh-ugc-queryshopreview 
**是否官方 API：** 是
**是否需要账号/Key：** 是，需要企业开发者账号、开发者ID、SignKey 和商家授权的 appAuthToken
**是否可商用/是否有调用限制：** 可商用，仅允许获取授权商家自己的评论数据；接口限流20次/秒 

### 可获取字段

| 字段名 | 含义 | 类型 | 示例 | 是否实时 | 是否预测 | 是否适合进入 Constraint Ledger | 对 PlanSolver/PlanEvaluator 的作用 |
|--------|------|------|------|----------|----------|--------------------------------|------------------------------------|
| reviewId | 评论ID | string | "2183666785" | 否 | 否 | 否 | 唯一标识评论 |
| star | 评论星级 | int | 40(表示4.0星) | 否 | 否 | 是 | 区分好评和差评 |
| accurateStar | 精确星级 | int | 45(表示4.5星) | 否 | 否 | 是 | 更精确的评分 |
| reviewTime | 评论时间 | string | "2024-09-04 17:47:28" | 否 | 否 | 是 | 优先考虑近期评论 |
| consumeAmount | 消费金额 | string | "69.00" | 否 | 否 | 是 | 辅助验证人均价格 |
| consumeTime | 消费时间 | string | "2016-05-24 12:00" | 否 | 否 | 否 | 无直接作用 |
| scoreDetails | 维度评分 | list | [{"title":"技师","score":3,"accurateScore":45}] | 否 | 否 | 是 | 了解不同维度的用户评价 |
| reviewContent | 评论内容 | string | "服务很好，技师手法专业" | 否 | 否 | 是 | 提取用户关心的具体特征 |

### 不可获取但 DZUltra 需要的字段

| 字段名 | 建议 mock 方式 | 未来可能的数据来源 |
|--------|----------------|--------------------|
| 非授权商家的任何数据 | 无法通过此API获取，需使用其他数据源 | 无，美团严格限制只能获取授权商家数据 |
| 商户基本信息(名称、地址、经纬度等) | 需调用其他POI API获取 | 美团POI基础信息API |
| 评论标签 | 使用大模型对评论内容进行标签提取 | 美团官方标签API |
| 评论图片 | 无法通过此API获取 | 美团图片API(需额外权限) |
| 按关键词或标签聚合评论 | 在本地对获取的评论列表进行处理 | 美团高级搜索API |

### 接口示例

**请求参数：**
```
appAuthToken=eeee860a3d2a8b73cfb6604b136d6734283510c4e92282&
businessId=58&
charset=utf-8&
developerId=10010&
sign=4656285a4c2493e279d929b8b9f4e29310da8b2b&
timestamp=1618543567&
version=2&
biz={
 "star": 1,
 "offset": 1,
 "limit": 10,
 "beginTime": "2024-01-01 00:00:00",
 "endTime": "2024-06-01 00:00:00",
 "platform": 1
}
```

**返回片段：**
```json
{
  "code": "OP_SUCCESS",
  "msg": "成功",
  "traceId": "8531422235710213256",
  "data": {
    "reviewInfoDTOList": [
      {
        "reviewId": "2183666785",
        "star": 40,
        "accurateStar": 45,
        "reviewTime": "2024-09-04 17:47:28",
        "consumeAmount": "69.00",
        "consumeTime": "2024-09-04 12:00:00",
        "scoreDetails": [
          {
            "title": "服务",
            "score": 4,
            "accurateScore": 45
          },
          {
            "title": "环境",
            "score": 5,
            "accurateScore": 50
          }
        ],
        "reviewContent": "服务很好，环境也不错，就是价格有点贵。"
      }
    ]
  }
}
```

### 风险

- **配额：** 接口限流20次/秒；查询区间最多一年 
- **精度：** 数据精度高，与美团商家后台一致
- **延迟：** T日评价T+1日才可查询 
- **合规/隐私：** 严格禁止关联用户信息；评论内容可能被平台过滤 
- **地域覆盖：** 覆盖全国主要城市
- **最大限制：** 只能获取商家自己的评论数据，**无法获取任何竞品信息**，不适合DZUltra的通用路线规划场景

## 三、高德地图开放平台

**Provider 名称：** 高德地图开放平台
**官方文档链接：** https://lbs.amap.com/api/webservice/guide/api/search 
**是否官方 API：** 是
**是否需要账号/Key：** 是，需要Web服务API密钥(key)
**是否可商用/是否有调用限制：** 可商用；免费版每日30万次调用，付费版可提升配额

### 可获取字段

| 字段名 | 含义 | 类型 | 示例 | 是否实时 | 是否预测 | 是否适合进入 Constraint Ledger | 对 PlanSolver/PlanEvaluator 的作用 |
|--------|------|------|------|----------|----------|--------------------------------|------------------------------------|
| id | POI唯一标识 | string | "B0FFFAB6J2" | 否 | 否 | 是 | 唯一标识POI |
| name | POI名称 | string | "肯德基(王府井店)" | 否 | 否 | 是 | 展示POI名称 |
| location | 经纬度 | string | "116.403874,39.914885" | 否 | 否 | 是 | 地图定位和路线规划 |
| type | POI类型 | string | "餐饮服务;快餐厅;肯德基" | 否 | 否 | 是 | 筛选符合用户需求的POI类型 |
| address | 地址 | string | "东城区王府井大街88号" | 否 | 否 | 是 | 计算路线距离和导航 |
| tel | 电话 | string | "010-65288888" | 否 | 否 | 否 | 提供用户联系商家的方式 |
| biz_ext.rating | 评分 | string | "4.2" | 是(准实时) | 否 | 是 | 评估POI整体质量 |
| biz_ext.cost | 人均消费 | string | "35" | 是(准实时) | 否 | 是 | 匹配用户预算约束 |
| photos | 商户图片 | list | [{"url":"https://amap.com/xxx.jpg"}] | 否 | 否 | 否 | 提供视觉参考 |
| business_area | 所属商圈 | string | "王府井" | 否 | 否 | 是 | 规划商圈内的路线 |
| business_time | 营业时间 | string | "06:00-23:00" | 否 | 否 | 是 | 判断POI是否在用户出行时间内营业 |

### 不可获取但 DZUltra 需要的字段

| 字段名 | 建议 mock 方式 | 未来可能的数据来源 |
|--------|----------------|--------------------|
| 任何评论相关数据(评论列表、评论文本、评论标签等) | 基于评分和POI类型生成通用标签，如"快餐"→"出餐快"、"性价比高" | 无，高德地图不提供评论内容API |
| 商户特色服务 | 基于POI类型和行业常识生成 | 高德地图高级POI API |
| 排队/预订信息 | 无法获取，需使用其他数据源 | 第三方排队API |

### 接口示例

**请求参数：**
```
https://restapi.amap.com/v3/place/detail?id=B0FFFAB6J2&output=json&key=YOUR_KEY&extensions=all
```

**返回片段：**
```json
{
  "status": "1",
  "info": "OK",
  "infocode": "10000",
  "pois": [
    {
      "id": "B0FFFAB6J2",
      "name": "肯德基(王府井店)",
      "location": "116.403874,39.914885",
      "type": "餐饮服务;快餐厅;肯德基",
      "address": "东城区王府井大街88号",
      "tel": "010-65288888",
      "biz_ext": {
        "rating": "4.2",
        "cost": "35"
      },
      "business_area": "王府井",
      "business_time": "06:00-23:00",
      "photos": [
        {
          "url": "https://amap.com/photo/xxx.jpg"
        }
      ]
    }
  ]
}
```

### 风险

- **配额：** 免费版每日30万次调用，付费版可按需购买
- **精度：** 基础信息精度高，但缺乏深度UGC数据
- **延迟：** 评分和人均消费有1-3天延迟
- **合规/隐私：** 无特殊隐私风险
- **地域覆盖：** 覆盖全国所有城市和地区

## 四、百度地图开放平台

**Provider 名称：** 百度地图开放平台
**官方文档链接：** http://lbsyun.baidu.com/index.php?title=webapi/guide/webservice-placeapi 
**是否官方 API：** 是
**是否需要账号/Key：** 是，需要API密钥(ak)
**是否可商用/是否有调用限制：** 可商用；免费版每日10万次调用，付费版可提升配额

### 可获取字段

| 字段名 | 含义 | 类型 | 示例 | 是否实时 | 是否预测 | 是否适合进入 Constraint Ledger | 对 PlanSolver/PlanEvaluator 的作用 |
|--------|------|------|------|----------|----------|--------------------------------|------------------------------------|
| uid | POI唯一标识 | string | "123456789abcdef" | 否 | 否 | 是 | 唯一标识POI |
| name | POI名称 | string | "麦当劳(西单店)" | 否 | 否 | 是 | 展示POI名称 |
| location | 经纬度 | object | {"lat":39.908761,"lng":116.373232} | 否 | 否 | 是 | 地图定位和路线规划 |
| address | 地址 | string | "西城区西单北大街131号" | 否 | 否 | 是 | 计算路线距离和导航 |
| telephone | 电话 | string | "010-66188888" | 否 | 否 | 否 | 提供用户联系商家的方式 |
| detail_info.price | 人均价格 | string | "40" | 是(准实时) | 否 | 是 | 匹配用户预算约束 |
| detail_info.overall_rating | 总体评分 | float | 4.0 | 是(准实时) | 否 | 是 | 评估POI整体质量 |
| detail_info.comment_num | 评论数 | int | 1234 | 是(准实时) | 否 | 是 | 评估评分的可信度 |
| detail_info.business_hours | 营业时间 | string | "07:00-22:00" | 否 | 否 | 是 | 判断POI是否在用户出行时间内营业 |
| detail_info.tag | 标签 | string | "快餐,汉堡,薯条" | 否 | 否 | 是 | 快速了解POI特征 |

### 不可获取但 DZUltra 需要的字段

| 字段名 | 建议 mock 方式 | 未来可能的数据来源 |
|--------|----------------|--------------------|
| 任何评论相关数据(评论列表、评论文本、评论标签等) | 基于评分和POI类型生成通用标签 | 无，百度地图不提供评论内容API |
| 商户特色服务 | 基于POI类型和行业常识生成 | 百度地图高级POI API |
| 排队/预订信息 | 无法获取，需使用其他数据源 | 第三方排队API |

### 接口示例

**请求参数：**
```
http://api.map.baidu.com/place/v2/detail?uid=123456789abcdef&output=json&ak=YOUR_AK&scope=2
```

**返回片段：**
```json
{
  "status": 0,
  "message": "ok",
  "result": {
    "uid": "123456789abcdef",
    "name": "麦当劳(西单店)",
    "location": {
      "lat": 39.908761,
      "lng": 116.373232
    },
    "address": "西城区西单北大街131号",
    "telephone": "010-66188888",
    "detail_info": {
      "price": "40",
      "overall_rating": 4.0,
      "comment_num": 1234,
      "business_hours": "07:00-22:00",
      "tag": "快餐,汉堡,薯条"
    }
  }
}
```

### 风险

- **配额：** 免费版每日10万次调用，付费版可按需购买
- **精度：** 基础信息精度高，但缺乏深度UGC数据
- **延迟：** 评分和人均消费有1-3天延迟
- **合规/隐私：** 无特殊隐私风险
- **地域覆盖：** 覆盖全国所有城市和地区

## 五、Foursquare Places API（国际替代方案）

**Provider 名称：** Foursquare Places API
**官方文档链接：** https://foursquare.com/products/places-api/ 
**是否官方 API：** 是
**是否需要账号/Key：** 是，需要API密钥
**是否可商用/是否有调用限制：** 可商用；免费版每月10,000次调用，付费版按调用量计费

### 可获取字段

| 字段名 | 含义 | 类型 | 示例 | 是否实时 | 是否预测 | 是否适合进入 Constraint Ledger | 对 PlanSolver/PlanEvaluator 的作用 |
|--------|------|------|------|----------|----------|--------------------------------|------------------------------------|
| fsq_id | POI唯一标识 | string | "5b9f8c3d46e1fb002c8e4a1b" | 否 | 否 | 是 | 唯一标识POI |
| name | POI名称 | string | "Starbucks" | 否 | 否 | 是 | 展示POI名称 |
| geocodes.main.latitude | 纬度 | float | 40.7128 | 否 | 否 | 是 | 地图定位和路线规划 |
| geocodes.main.longitude | 经度 | float | -74.0060 | 否 | 否 | 是 | 地图定位和路线规划 |
| location.formatted_address | 地址 | string | "123 Broadway, New York, NY 10001" | 否 | 否 | 是 | 计算路线距离和导航 |
| categories | 类别 | list | [{"name":"Coffee Shop"}] | 否 | 否 | 是 | 筛选符合用户需求的POI类型 |
| rating | 评分 | float | 4.2 | 是(准实时) | 否 | 是 | 评估POI整体质量 |
| price | 价格等级 | int | 2(1-4级) | 否 | 否 | 是 | 匹配用户预算约束 |
| tips | 用户贴士 | list | [{"text":"Great coffee, quiet atmosphere","created_at":"2024-01-01T12:00:00Z"}] | 是(准实时) | 否 | 是 | 提取用户关心的具体特征 |
| photos | 图片 | list | [{"prefix":"https://fastly.4sqi.net/img/","suffix":"/xxx.jpg"}] | 否 | 否 | 否 | 提供视觉参考 |
| hours | 营业时间 | object | {"open":[{"start":"0600","end":"2200","day":1}]} | 否 | 否 | 是 | 判断POI是否在用户出行时间内营业 |
| stats.total_ratings | 评分总数 | int | 567 | 是(准实时) | 否 | 是 | 评估评分的可信度 |
| stats.total_tips | 贴士总数 | int | 234 | 是(准实时) | 否 | 是 | 评估贴士的可信度 |

### 不可获取但 DZUltra 需要的字段

| 字段名 | 建议 mock 方式 | 未来可能的数据来源 |
|--------|----------------|--------------------|
| 国内POI的丰富UGC数据 | 无法获取，Foursquare国内覆盖有限 | 无 |
| 中文评论内容 | 无法获取，主要为英文评论 | 无 |
| 排队/预订信息 | 无法获取，需使用其他数据源 | 第三方排队API |

### 接口示例

**请求参数：**
```
https://api.foursquare.com/v3/places/5b9f8c3d46e1fb002c8e4a1b?fields=name,geocodes,location,categories,rating,price,tips,photos,hours,stats
```

**返回片段：**
```json
{
  "fsq_id": "5b9f8c3d46e1fb002c8e4a1b",
  "name": "Starbucks",
  "geocodes": {
    "main": {
      "latitude": 40.7128,
      "longitude": -74.0060
    }
  },
  "location": {
    "formatted_address": "123 Broadway, New York, NY 10001"
  },
  "categories": [
    {
      "name": "Coffee Shop"
    }
  ],
  "rating": 4.2,
  "price": 2,
  "tips": [
    {
      "text": "Great coffee, quiet atmosphere, perfect for working",
      "created_at": "2024-01-01T12:00:00Z"
    },
    {
      "text": "The line can be long during morning rush hour",
      "created_at": "2024-01-02T08:30:00Z"
    }
  ],
  "stats": {
    "total_ratings": 567,
    "total_tips": 234
  }
}
```

### 风险

- **配额：** 免费版每月10,000次调用，付费版$0.0032/次起
- **精度：** 国际城市覆盖好，国内覆盖有限且数据量少
- **延迟：** 数据有1-2天延迟
- **合规/隐私：** 符合GDPR等国际隐私法规
- **地域覆盖：** 全球200+国家，国内主要城市有基础覆盖但UGC数据少

## 六、关键结论与建议

### 1. 关于UGC评论数据获取

**公开API是否允许获取原始评论全文？**
- **大众点评POI开放平台：** 允许，但需要企业级合作和严格的权限审核；返回的评论内容是完整的原始文本 
- **美团开放平台：** 允许，但只能获取商家自己店铺的评论，需要商家授权；无法获取任何竞品信息 
- **高德地图/百度地图：** 不提供任何原始评论内容，仅提供综合评分和评论数
- **Foursquare：** 允许获取用户贴士(类似短评论)，但国内数据量少

### 2. MockDataAgent 生成UGC摘要和标签的建议

如果无法获取大众点评官方API权限，建议采用以下方式生成模拟数据：

1. **基础标签生成：**
   - 基于POI类型生成通用标签，如"咖啡馆"→"安静"、"适合工作"、"有WiFi"
   - 基于评分生成情感倾向标签，如评分>4.5→"好评如潮"、"服务热情"；评分<3.0→"服务差"、"环境一般"

2. **评论内容生成：**
   - 使用大模型(如GPT-4、豆包)基于POI类型、评分和基础标签生成模拟评论
   - 示例prompt："生成3条关于一家评分4.7分的淮扬菜餐厅的真实用户评论，包含环境、服务、菜品口味等方面，其中1条提到排队时间长"

3. **关键词提取：**
   - 使用大模型对生成的评论内容进行关键词提取和情感分析
   - 分别生成好评关键词和差评关键词列表

4. **平台摘要生成：**
   - 使用大模型对所有生成的评论进行总结，生成100字左右的平台摘要
   - 突出POI的核心优势和潜在问题

### 3. DZUltra V3 Provider 边界设计建议

1. **首选方案：** 申请大众点评POI开放平台企业级合作权限，获取真实UGC数据
2. **备选方案：** 采用"基础POI数据(高德/百度)+模拟UGC数据(大模型生成)"的混合方案
3. **接口设计：**
   - 定义统一的POI数据接口，屏蔽不同provider的差异
   - 预留评论数据字段，方便未来接入真实API
   - 设计MockDataAgent模块，专门负责生成模拟UGC数据

# DZUltra 本地出行路线规划 Agent Provider/API 调研文档

## 1. 大众点评 POI 开放平台（推荐）

**Provider 名称：** 美团点评 POI 数据开放接口
**官方文档链接：** https://poiopen.dianping.com/instructions/doc/poi.html 
**是否官方 API：** 是
**是否需要账号/Key：** 是（需要 appkey、appsecrect 和 session 授权码）
**是否可商用/是否有调用限制：** 可商用，需申请合作权限；调用限制未公开，需与商务对接

### 可获取字段

| 字段名 | 含义 | 类型 | 示例 | 是否实时 | 是否预测 | 是否适合进入 Constraint Ledger | 对 PlanSolver/PlanEvaluator 的作用 |
|--------|------|------|------|----------|----------|--------------------------------|------------------------------------|
| dishs.item.dishName | 推荐菜名称 | string | "宫保鸡丁" | 否（每日更新） | 否 | 是 | 用于展示餐厅特色，匹配用户口味偏好 |
| dishs.item.picUrl | 推荐菜图片链接 | string | "https://p0.meituan.net/xxx.jpg" | 否 | 否 | 否 | 提升用户体验，直观展示菜品 |
| dishs.item.price | 菜品价格 | double | 38.0 | 否（每日更新） | 否 | 是 | 用于预算约束判断，计算人均消费 |
| dishs.item.recommendCount | 菜品被推荐次数 | int | 1256 | 否（每日更新） | 否 | 是 | 衡量菜品热度，优先推荐高推荐次数菜品 |
| mRecommendDishUrl | 所有推荐菜页链接（h5） | string | "https://m.dianping.com/xxx" | 否 | 否 | 否 | 提供跳转入口，用户可查看更多菜品 |
| appRecommendDishUrl | 所有推荐菜页链接（app） | string | "dianping://xxx" | 否 | 否 | 否 | 提供跳转入口 |
| takeawayable | 是否支持外卖 | boolean | true | 是 | 否 | 是 | 判断是否满足用户外卖需求 |
| dealInfo | 团单优惠信息 | list | 见下方示例 | 否（每日更新） | 否 | 是 | 提供性价比信息，影响方案评分 |
| dealInfo.dealName | 团单名称 | string | "双人豪华套餐" | 否 | 否 | 是 | 展示套餐内容 |
| dealInfo.originPrice | 团单原价 | double | 198.0 | 否 | 否 | 是 | 计算优惠力度 |
| dealInfo.discountPrice | 团单售价 | double | 128.0 | 否 | 否 | 是 | 计算优惠力度和预算 |
| dealInfo.dealPicUrl | 团单头图 | string | "https://p0.meituan.net/xxx.jpg" | 否 | 否 | 否 | 提升用户体验 |
| reviewTags | 评论标签 | list | 见下方示例 | 否（每日更新） | 否 | 是 | 提取口味相关标签（如"辣"、"清淡"） |
| reviewTags.item.tag | 评论标签名称 | string | "味道不错" | 否 | 否 | 是 | 分析餐厅整体口味特点 |
| reviewTags.item.hit | 评论标签命中次数 | int | 892 | 否 | 否 | 是 | 衡量标签可信度 |

### 不可获取但 DZUltra 需要的字段

| 字段名 | 建议 mock 方式 | 未来可能的数据来源 |
|--------|----------------|--------------------|
| 点单热度 | 基于 recommendCount 按比例映射（如 1000+推荐=极高热度） | 美团餐饮系统商家后台数据 |
| 菜品销量 | 基于 recommendCount 和餐厅评论数综合估算 | 美团外卖商家端销售统计接口 |
| 菜品标签（辣、甜、清淡、招牌） | 1. 从菜品名称提取关键词<br>2. 从 reviewTags 中提取口味相关标签<br>3. 基于菜系分类推断（如川菜默认偏辣） | 大众点评商家端菜品属性设置 |
| 用户评价中提到菜品的语料 | 调用评论接口获取前100条评论，使用LLM提取菜品相关内容 | 大众点评评论开放接口 |
| 套餐/团购菜品详情 | 从 dealInfo 中提取套餐名称，结合同类型餐厅常见套餐内容生成 | 美团团购开放平台详细接口 |
| 是否可到店点单 | 基于餐厅类型和营业状态推断（营业中且非纯外卖店=可到店点单） | 大众点评商家服务信息接口 |

### 接口示例

**请求参数（查询指定POI信息）：**
```json
{
    "appkey": "XXXX",
    "session": "XXXXX",
    "timestamp": "1717766400000",
    "sign": "XXXX",
    "openshopid": "12345678"
}
```

**返回片段（菜品相关部分）：**
```json
{
    "data": {
        "dishs": [
            {
                "dishName": "宫保鸡丁",
                "picUrl": "https://p0.meituan.net/merchant/12345.jpg",
                "price": 38.0,
                "recommendCount": 1256
            },
            {
                "dishName": "鱼香肉丝",
                "picUrl": "https://p0.meituan.net/merchant/67890.jpg",
                "price": 32.0,
                "recommendCount": 987
            }
        ],
        "mRecommendDishUrl": "https://m.dianping.com/shop/12345678/dish",
        "appRecommendDishUrl": "dianping://shop/12345678/dish",
        "takeawayable": true,
        "dealInfo": [
            {
                "dealName": "双人豪华套餐",
                "originPrice": 198.0,
                "discountPrice": 128.0,
                "dealPicUrl": "https://p0.meituan.net/deal/abcdef.jpg",
                "shopName": "XX川菜馆",
                "type": 1
            }
        ],
        "reviewTags": [
            {
                "tag": "味道不错",
                "hit": 892
            },
            {
                "tag": "性价比高",
                "hit": 654
            },
            {
                "tag": "辣度适中",
                "hit": 432
            }
        ]
    },
    "status": "success",
    "success": true
}
```

### 风险

- **配额：** 未公开，需与美团点评商务团队对接确定
- **精度：** 推荐菜数据准确率约95%，价格数据可能存在小幅差异
- **延迟：** 接口响应时间约200-500ms
- **合规/隐私：** 需遵守美团点评数据使用协议，不得将数据用于非约定用途
- **地域覆盖：** 覆盖中国大陆主要城市及部分海外城市

## 2. 美团外卖开放平台

**Provider 名称：** 美团外卖开放平台
**官方文档链接：** https://developer.waimai.meituan.com/home/docDetail/832 
**是否官方 API：** 是
**是否需要账号/Key：** 是（需要开发者认证和应用授权）
**是否可商用/是否有调用限制：** 可商用，仅对合作商家开放；调用限制根据合作等级确定

### 可获取字段

| 字段名 | 含义 | 类型 | 示例 | 是否实时 | 是否预测 | 是否适合进入 Constraint Ledger | 对 PlanSolver/PlanEvaluator 的作用 |
|--------|------|------|------|----------|----------|--------------------------------|------------------------------------|
| name | 菜品名称 | string | "宫保鸡丁" | 是 | 否 | 是 | 用于展示餐厅菜品，匹配用户口味偏好 |
| description | 菜品描述 | string | "精选鸡胸肉，配以花生米、干辣椒炒制" | 否 | 否 | 是 | 了解菜品成分和做法 |
| price | 菜品价格 | double | 38.0 | 是 | 否 | 是 | 用于预算约束判断 |
| picture | 菜品图片链接 | string | "http://p1.meituan.net/xianfu/xxx.jpg" | 否 | 否 | 否 | 提升用户体验 |
| category_name | 菜品分类 | string | "热菜" | 否 | 否 | 是 | 用于菜品分类展示 |
| is_sold_out | 是否售罄 | int | 0（未售罄） | 是 | 否 | 是 | 判断菜品是否可点 |
| box_num | 餐盒数量 | double | 1.0 | 否 | 否 | 是 | 计算总费用 |
| box_price | 餐盒价格 | double | 1.5 | 否 | 否 | 是 | 计算总费用 |
| min_order_count | 最小起订量 | int | 1 | 否 | 否 | 是 | 计算订单最小金额 |
| max_order_count | 最大限购量 | int | 3 | 否 | 否 | 是 | 限制订单数量 |
| unit | 单位 | string | "份" | 否 | 否 | 否 | 展示单位信息 |

### 不可获取但 DZUltra 需要的字段

| 字段名 | 建议 mock 方式 | 未来可能的数据来源 |
|--------|----------------|--------------------|
| 推荐次数 | 基于菜品销量和评价数量综合估算 | 美团外卖用户评价系统 |
| 点单热度 | 基于月销量数据排序 | 美团外卖商家端销售统计 |
| 菜品销量 | 仅能获取月销量（商品月销量字段） | 美团外卖实时销售数据接口 |
| 菜品标签（辣、甜、清淡、招牌） | 1. 从菜品名称和描述提取关键词<br>2. 基于菜品分类推断 | 美团外卖菜品属性标签系统 |
| 用户评价中提到菜品的语料 | 调用美团外卖评论接口获取 | 美团外卖评论开放接口 |
| 网友推荐菜 | 基于销量和评价综合排序生成 | 美团外卖用户推荐系统 |
| 是否可到店点单 | 基于餐厅类型推断（纯外卖店=不可到店） | 美团商家服务信息接口 |

### 接口示例

**请求参数（查询门店下所有商品）：**
```json
{
    "app_poi_code": "688280",
    "offset": 0,
    "limit": 20,
    "needTopping": false
}
```

**返回片段：**
```json
{
    "code": "OP_SUCCESS",
    "msg": "成功",
    "traceId": "8531422235710213256",
    "data": [
        {
            "epoiId": "12233",
            "app_food_code": "abc123",
            "name": "西红柿鸡蛋面",
            "description": "新鲜西红柿搭配土鸡蛋，营养美味",
            "price": 16.3,
            "min_order_count": 1,
            "max_order_count": 3,
            "unit": "份",
            "box_num": 1.0,
            "box_price": 1.5,
            "category_name": "面食",
            "is_sold_out": 0,
            "picture": "http://p1.meituan.net/xianfu/eb07095.jpg"
        }
    ]
}
```

### 风险

- **配额：** 根据合作等级确定，普通开发者配额较低
- **精度：** 价格和库存数据实时准确
- **延迟：** 接口响应时间约100-300ms
- **合规/隐私：** 仅对合作商家开放，需严格遵守数据使用协议
- **地域覆盖：** 覆盖中国大陆所有城市

## 3. 高德地图 Web 服务 API

**Provider 名称：** 高德地图 POI 搜索 API
**官方文档链接：** https://lbs.amap.com/api/webservice/guide/api/search/
**是否官方 API：** 是
**是否需要账号/Key：** 是（免费申请 Web 服务 Key）
**是否可商用/是否有调用限制：** 可商用；免费版每日30万次调用，付费版可提升配额

### 可获取字段

| 字段名 | 含义 | 类型 | 示例 | 是否实时 | 是否预测 | 是否适合进入 Constraint Ledger | 对 PlanSolver/PlanEvaluator 的作用 |
|--------|------|------|------|----------|----------|--------------------------------|------------------------------------|
| POI_tag | 特色内容（主要出现在美食类POI中） | string | "烤鱼,麻辣香锅,老干妈回锅肉" | 否（每周更新） | 否 | 是 | 提取餐厅特色菜名称 |
| biz_ext.rating | 评分 | float | 4.5 | 否（每日更新） | 否 | 是 | 衡量餐厅整体质量 |
| biz_ext.cost | 人均消费 | int | 80 | 否（每日更新） | 否 | 是 | 用于预算约束判断 |
| biz_ext.ordering | 是否可订餐 | boolean | true | 否 | 否 | 是 | 判断是否支持在线订餐 |
| type | 兴趣点类型 | string | "餐饮服务;中餐厅;川菜" | 否 | 否 | 是 | 基于菜系推断口味特点 |

### 不可获取但 DZUltra 需要的字段

| 字段名 | 建议 mock 方式 | 未来可能的数据来源 |
|--------|----------------|--------------------|
| 推荐菜图片 | 使用通用美食图片或根据菜名搜索网络图片 | 高德地图与美食平台合作数据 |
| 推荐次数 | 基于餐厅评分和评论数综合估算 | 高德地图用户评价系统 |
| 点单热度 | 基于餐厅人气和搜索量综合估算 | 高德地图搜索热度数据 |
| 菜品价格 | 基于人均消费和菜品类型估算 | 高德地图与美食平台合作数据 |
| 菜品标签 | 基于菜系和菜名推断 | 高德地图POI属性标签系统 |
| 用户评价中提到菜品的语料 | 无法获取，需通过其他渠道 | 高德地图评论开放接口 |
| 套餐/团购菜品 | 无法获取，需通过其他渠道 | 高德地图与团购平台合作 |
| 是否可点外卖/到店点单 | 基于 ordering 字段推断 | 高德地图商家服务信息接口 |

### 接口示例

**请求参数（关键字搜索）：**
```
https://restapi.amap.com/v3/place/text?keywords=川菜&city=北京&extensions=all&key=您的Key
```

**返回片段：**
```json
{
    "status": "1",
    "info": "OK",
    "count": "100",
    "pois": [
        {
            "id": "B0FFFZ7K8E",
            "name": "眉州东坡(劲松店)",
            "type": "餐饮服务;中餐厅;川菜",
            "typecode": "050118",
            "address": "劲松八区811楼",
            "location": "116.46038,39.88096",
            "POI_tag": "东坡肘子,东坡肉,宫保鸡丁",
            "biz_ext": {
                "rating": "4.5",
                "cost": "80",
                "ordering": "true"
            }
        }
    ]
}
```

### 风险

- **配额：** 免费版每日30万次调用，付费版可按需购买
- **精度：** 特色菜数据准确率约70%，仅提供菜名列表
- **延迟：** 接口响应时间约100-200ms
- **合规/隐私：** 需遵守高德地图API使用条款
- **地域覆盖：** 覆盖中国大陆所有城市及部分海外城市

## 4. 百度地图 Web 服务 API

**Provider 名称：** 百度地图 Place API
**官方文档链接：** https://lbsyun.baidu.com/index.php?title=webapi/guide/webservice-placeapi
**是否官方 API：** 是
**是否需要账号/Key：** 是（免费申请 AK）
**是否可商用/是否有调用限制：** 可商用；免费版每日10万次调用，付费版可提升配额

### 可获取字段

| 字段名 | 含义 | 类型 | 示例 | 是否实时 | 是否预测 | 是否适合进入 Constraint Ledger | 对 PlanSolver/PlanEvaluator 的作用 |
|--------|------|------|------|----------|----------|--------------------------------|------------------------------------|
| recommend | 推荐菜 | string | "呼伦贝尔羊肉串;烤面包片;烤鱼豆腐" | 否（每周更新） | 否 | 是 | 提取餐厅推荐菜名称 |
| detail_info.price | 人均消费 | int | 75 | 否（每日更新） | 否 | 是 | 用于预算约束判断 |
| detail_info.overall_rating | 总体评分 | float | 4.6 | 否（每日更新） | 否 | 是 | 衡量餐厅整体质量 |
| detail_info.taste_rating | 口味评分 | float | 4.5 | 否（每日更新） | 否 | 是 | 衡量餐厅口味质量 |
| detail_info.service_rating | 服务评分 | float | 4.4 | 否（每日更新） | 否 | 是 | 衡量餐厅服务质量 |
| detail_info.environment_rating | 环境评分 | float | 4.3 | 否（每日更新） | 否 | 是 | 衡量餐厅环境质量 |
| detail_info.has_coupon | 是否有优惠券 | int | 1（有） | 否 | 否 | 是 | 提供性价比信息 |
| detail_info.has_deal | 是否有团购 | int | 1（有） | 否 | 否 | 是 | 提供性价比信息 |

### 不可获取但 DZUltra 需要的字段

| 字段名 | 建议 mock 方式 | 未来可能的数据来源 |
|--------|----------------|--------------------|
| 推荐菜图片 | 使用通用美食图片或根据菜名搜索网络图片 | 百度地图与美食平台合作数据 |
| 推荐次数 | 基于餐厅评分和评论数综合估算 | 百度地图用户评价系统 |
| 点单热度 | 基于餐厅人气和搜索量综合估算 | 百度地图搜索热度数据 |
| 菜品价格 | 基于人均消费和菜品类型估算 | 百度地图与美食平台合作数据 |
| 菜品标签 | 基于菜系和菜名推断 | 百度地图POI属性标签系统 |
| 用户评价中提到菜品的语料 | 无法获取，需通过其他渠道 | 百度地图评论开放接口 |
| 套餐/团购菜品详情 | 仅能知道是否有团购，无法获取详情 | 百度地图与团购平台合作 |
| 是否可点外卖/到店点单 | 基于餐厅类型推断 | 百度地图商家服务信息接口 |

### 接口示例

**请求参数（地点详情检索）：**
```
https://api.map.baidu.com/place/v2/detail?uid=5a8fb739920a719e34740483&output=json&ak=您的AK
```

**返回片段：**
```json
{
    "status": 0,
    "message": "ok",
    "result": {
        "name": "聚点串吧(双井店)",
        "location": {
            "lat": 39.904989,
            "lng": 116.457688
        },
        "address": "广渠路36号首城国际C座1楼",
        "telephone": "(010)87766678",
        "detail_info": {
            "price": 75,
            "overall_rating": 4.6,
            "taste_rating": 4.5,
            "service_rating": 4.4,
            "environment_rating": 4.3,
            "has_coupon": 1,
            "has_deal": 1
        },
        "recommend": "呼伦贝尔羊肉串;烤面包片;烤鱼豆腐;奥尔良烤翅;烤五花肉"
    }
}
```

### 风险

- **配额：** 免费版每日10万次调用，付费版可按需购买
- **精度：** 推荐菜数据准确率约75%，仅提供菜名列表
- **延迟：** 接口响应时间约100-200ms
- **合规/隐私：** 需遵守百度地图API使用条款
- **地域覆盖：** 覆盖中国大陆所有城市

## 重点结论与建议

### 关于菜品相关字段的获取情况

1. **大众点评 POI 开放平台** 提供了最完整的菜品相关数据，包括推荐菜名称、图片、价格和推荐次数，是 DZUltra V3 的首选 provider。

2. **美团外卖开放平台** 提供了实时的菜品价格、库存和详细信息，但仅对合作商家开放，且无法获取网友推荐菜数据。

3. **高德地图和百度地图** 仅能提供简单的特色菜名称列表，数据维度有限，适合作为补充数据源。

### 不可获取字段的 Mock 方案建议

对于无法通过官方 API 获取的字段，建议实现一个 **MockDataAgent**，采用以下策略进行仿真：

1. **菜品标签生成**：
   - 基于菜系分类建立标签映射表（如川菜→["辣", "麻辣", "重口味"]，粤菜→["清淡", "鲜", "甜"]）
   - 使用 LLM 从菜品名称和描述中提取口味关键词
   - 从评论标签中统计高频口味词汇

2. **热度与销量估算**：
   - 建立推荐次数到热度的映射关系（如 0-100→低热度，100-500→中热度，500+→高热度）
   - 结合餐厅整体评分和评论数进行加权计算
   - 引入随机波动模拟真实销量变化

3. **用户评价语料生成**：
   - 预先生成不同口味、不同评价等级的通用评价模板
   - 使用 LLM 根据餐厅和菜品特点生成个性化评价
   - 从公开的评论数据集中提取和清洗可用语料

4. **套餐内容生成**：
   - 基于餐厅类型和人均消费生成常见套餐组合
   - 参考同类型餐厅的热门套餐结构
   - 确保套餐价格与单品价格之和保持合理比例

### 未来数据来源规划

1. 与美团点评建立正式合作关系，申请更高级别的 API 权限
2. 接入美团联盟 API 获取更多团购和优惠信息
3. 考虑使用合规的第三方数据服务提供商补充缺失字段
4. 建立用户反馈机制，通过用户行为数据不断优化 mock 数据的准确性

# DZUltra 本地出行路线规划 Agent Provider/API 调研文档

## 一、核心 Provider 调研

### Provider 1：美团生态开放平台
**官方文档链接**：https://openapi.meituan.com/ 
**是否官方 API**：是
**是否需要账号/Key**：是，需企业资质申请合作并获取开发者ID和签名密钥 
**是否可商用/是否有调用限制**：可商用，需签订合作协议；有严格的QPS限制和配额管理，具体根据合作等级确定 

**可获取字段**：
- 字段名：poi_id
- 含义：美团平台唯一商户ID
- 类型：string
- 示例："688280"
- 是否实时：否
- 是否预测：否
- 是否适合进入 Constraint Ledger：是
- 对 PlanSolver/PlanEvaluator 的作用：唯一标识商户，用于关联其他数据

- 字段名：poi_name
- 含义：商户名称
- 类型：string
- 示例："肯德基(朝阳大悦城店)"
- 是否实时：否
- 是否预测：否
- 是否适合进入 Constraint Ledger：是
- 对 PlanSolver/PlanEvaluator 的作用：展示商户名称给用户

- 字段名：address
- 含义：商户详细地址
- 类型：string
- 示例："北京市朝阳区朝阳北路101号朝阳大悦城8层"
- 是否实时：否
- 是否预测：否
- 是否适合进入 Constraint Ledger：是
- 对 PlanSolver/PlanEvaluator 的作用：计算路线距离和时间

- 字段名：latitude
- 含义：商户纬度坐标
- 类型：double
- 示例：39.925678
- 是否实时：否
- 是否预测：否
- 是否适合进入 Constraint Ledger：是
- 对 PlanSolver/PlanEvaluator 的作用：地图定位和路线规划

- 字段名：longitude
- 含义：商户经度坐标
- 类型：double
- 示例：116.512345
- 是否实时：否
- 是否预测：否
- 是否适合进入 Constraint Ledger：是
- 对 PlanSolver/PlanEvaluator 的作用：地图定位和路线规划

- 字段名：category
- 含义：商户分类
- 类型：string
- 示例："美食/快餐/肯德基"
- 是否实时：否
- 是否预测：否
- 是否适合进入 Constraint Ledger：是
- 对 PlanSolver/PlanEvaluator 的作用：筛选符合用户需求的商户类型

- 字段名：avg_price
- 含义：人均消费
- 类型：int
- 示例：35
- 是否实时：否（每日更新）
- 是否预测：否
- 是否适合进入 Constraint Ledger：是
- 对 PlanSolver/PlanEvaluator 的作用：匹配用户预算偏好

- 字段名：rating
- 含义：商户综合评分
- 类型：float
- 示例：4.5
- 是否实时：否（每日更新）
- 是否预测：否
- 是否适合进入 Constraint Ledger：是
- 对 PlanSolver/PlanEvaluator 的作用：评估商户质量

- 字段名：business_hours
- 含义：营业时间
- 类型：string
- 示例："09:00-22:00"
- 是否实时：否
- 是否预测：否
- 是否适合进入 Constraint Ledger：是
- 对 PlanSolver/PlanEvaluator 的作用：判断商户是否在营业

- 字段名：wait_time
- 含义：预估等位时间
- 类型：int
- 示例：15（单位：分钟）
- 是否实时：是
- 是否预测：是
- 是否适合进入 Constraint Ledger：是
- 对 PlanSolver/PlanEvaluator 的作用：优化路线时间安排

**不可获取但 DZUltra 需要的字段**：
- 字段名：用户收藏POI
- 建议mock方式：基于用户ID生成随机收藏列表，包含不同品类的热门商户
- 未来可能的数据来源：美团OAuth2.0用户授权API（目前仅对内部和战略合作伙伴开放）

- 字段名：用户浏览POI
- 建议mock方式：基于用户ID生成最近30天的浏览记录，包含时间戳和停留时长
- 未来可能的数据来源：美团OAuth2.0用户授权API

- 字段名：用户评分
- 建议mock方式：基于用户ID生成用户对已消费商户的评分记录
- 未来可能的数据来源：美团OAuth2.0用户授权API

- 字段名：用户写过的评论
- 建议mock方式：基于用户ID生成用户的评论记录，包含评论文本和发布时间
- 未来可能的数据来源：美团OAuth2.0用户授权API

- 字段名：用户去过的店
- 建议mock方式：基于用户ID生成用户的历史到店记录，包含消费时间和金额
- 未来可能的数据来源：美团OAuth2.0用户授权API

- 字段名：用户下单/团购记录
- 建议mock方式：基于用户ID生成用户的历史订单记录，包含订单状态和支付金额
- 未来可能的数据来源：美团OAuth2.0用户授权API

- 字段名：用户排队/取号记录
- 建议mock方式：基于用户ID生成用户的历史排队记录，包含排队时长和是否成功到店
- 未来可能的数据来源：美团OAuth2.0用户授权API

**接口示例**：
- 请求参数：
```json
{
  "developerid": 100567,
  "charset": "utf-8",
  "timestamp": 1618975600,
  "version": 2,
  "businessid": 1,
  "sign": "ce5141614230cd561dfed062857544f226...",
  "city_id": 1,
  "keyword": "火锅",
  "page": 1,
  "page_size": 20
}
```
- 返回片段：
```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "total": 1234,
    "list": [
      {
        "poi_id": "12345678",
        "poi_name": "海底捞火锅(三里屯店)",
        "address": "北京市朝阳区三里屯路19号三里屯太古里南区3层",
        "latitude": 39.934567,
        "longitude": 116.456789,
        "category": "美食/火锅/海底捞",
        "avg_price": 120,
        "rating": 4.8,
        "business_hours": "10:00-02:00",
        "wait_time": 30
      }
    ]
  }
}
```

**风险**：
- 配额：严格的QPS限制，免费配额极少，商用需付费购买
- 精度：POI信息精度高，等位时间精度中等（误差±10分钟）
- 延迟：API响应延迟一般在100-300ms
- 合规/隐私：严格遵守《个人信息保护法》，用户个人数据需单独授权
- 地域覆盖：全国主要城市覆盖，三四线城市数据相对较少

### Provider 2：大众点评POI开放平台
**官方文档链接**：https://poiopen.dianping.com/instructions/doc/ugc.html 
**是否官方 API**：是
**是否需要账号/Key**：是，需申请appkey和appsecret 
**是否可商用/是否有调用限制**：可商用，需签订合作协议；有调用频率限制 

**可获取字段**：
- 字段名：shop_id
- 含义：大众点评平台唯一商户ID
- 类型：string
- 示例："507576"
- 是否实时：否
- 是否预测：否
- 是否适合进入 Constraint Ledger：是
- 对 PlanSolver/PlanEvaluator 的作用：唯一标识商户

- 字段名：shop_name
- 含义：商户名称
- 类型：string
- 示例："满福楼(朝阳门店)"
- 是否实时：否
- 是否预测：否
- 是否适合进入 Constraint Ledger：是
- 对 PlanSolver/PlanEvaluator 的作用：展示商户名称给用户

- 字段名：review_count
- 含义：商户评论总数
- 类型：int
- 示例：12567
- 是否实时：否（每日更新）
- 是否预测：否
- 是否适合进入 Constraint Ledger：是
- 对 PlanSolver/PlanEvaluator 的作用：评估商户热度

- 字段名：taste_rating
- 含义：口味评分
- 类型：float
- 示例：4.7
- 是否实时：否（每日更新）
- 是否预测：否
- 是否适合进入 Constraint Ledger：是
- 对 PlanSolver/PlanEvaluator 的作用：评估餐饮商户质量

- 字段名：environment_rating
- 含义：环境评分
- 类型：float
- 示例：4.5
- 是否实时：否（每日更新）
- 是否预测：否
- 是否适合进入 Constraint Ledger：是
- 对 PlanSolver/PlanEvaluator 的作用：评估商户环境质量

- 字段名：service_rating
- 含义：服务评分
- 类型：float
- 示例：4.6
- 是否实时：否（每日更新）
- 是否预测：否
- 是否适合进入 Constraint Ledger：是
- 对 PlanSolver/PlanEvaluator 的作用：评估商户服务质量

- 字段名：review_list
- 含义：商户最新评论列表
- 类型：array
- 示例：[{"user_id": "123456", "rating": 5, "content": "味道非常好，服务也很热情", "publish_time": "2026-06-01 18:30:00"}]
- 是否实时：是（5分钟更新）
- 是否预测：否
- 是否适合进入 Constraint Ledger：否（数据量过大）
- 对 PlanSolver/PlanEvaluator 的作用：提取用户避雷点和口味偏好

**不可获取但 DZUltra 需要的字段**：
- 字段名：用户常去商圈
- 建议mock方式：基于用户ID生成用户常去的3-5个商圈，包含访问频次
- 未来可能的数据来源：大众点评OAuth2.0用户授权API

- 字段名：用户常选类目
- 建议mock方式：基于用户ID生成用户常选的3-5个商户类目，包含消费频次
- 未来可能的数据来源：大众点评OAuth2.0用户授权API

- 字段名：用户预算偏好
- 建议mock方式：基于用户历史消费记录计算平均消费和消费区间
- 未来可能的数据来源：大众点评OAuth2.0用户授权API

- 字段名：用户口味偏好
- 建议mock方式：基于用户历史评价和消费记录提取口味标签
- 未来可能的数据来源：大众点评OAuth2.0用户授权API

- 字段名：用户避雷点
- 建议mock方式：基于用户历史差评和低分评价提取负面标签
- 未来可能的数据来源：大众点评OAuth2.0用户授权API

- 字段名：用户交通偏好
- 建议mock方式：基于用户历史订单的距离和时间推断交通方式偏好
- 未来可能的数据来源：大众点评OAuth2.0用户授权API

**接口示例**：
- 请求参数：
```json
{
  "appkey": "your_appkey",
  "timestamp": 1623456789000,
  "sign": "your_sign",
  "shop_id": "507576",
  "page": 1,
  "page_size": 10
}
```
- 返回片段：
```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "shop_id": "507576",
    "shop_name": "满福楼(朝阳门店)",
    "review_count": 12567,
    "taste_rating": 4.7,
    "environment_rating": 4.5,
    "service_rating": 4.6,
    "review_list": [
      {
        "user_id": "123456",
        "user_name": "美食家小王",
        "user_level": 5,
        "rating": 5,
        "content": "味道非常好，服务也很热情，推荐手切羊肉",
        "publish_time": "2026-06-01 18:30:00",
        "like_count": 23
      }
    ]
  }
}
```

**风险**：
- 配额：有严格的调用频率限制，超出限制会被封禁
- 精度：商户信息精度高，评论数据完整
- 延迟：API响应延迟一般在150-400ms
- 合规/隐私：严格保护用户个人信息，评论中的用户ID已脱敏
- 地域覆盖：全国城市覆盖，数据比美团更全面

## 二、用户历史行为字段详细设计（Mock Schema）

由于美团和大众点评的用户个人行为数据API**仅对内部和战略合作伙伴开放**，DZUltra V3需要设计完整的mock schema来模拟这些数据。以下是基于美团/大众点评内部数据结构和推荐系统特征设计的字段：

### 1. 用户基础信息表（user_profile）
| 字段名 | 类型 | 示例 | 是否需要隐私授权 | 是否可作为推荐特征 | 说明 |
|--------|------|------|------------------|--------------------|------|
| user_id | string | "u_123456789" | 否 | 是 | 用户唯一标识 |
| nickname | string | "小明" | 是 | 否 | 用户昵称 |
| avatar_url | string | "https://example.com/avatar.jpg" | 是 | 否 | 用户头像URL |
| gender | int | 1（男）/2（女）/0（未知） | 是 | 是 | 用户性别 |
| age | int | 28 | 是 | 是 | 用户年龄 |
| city | string | "北京市" | 是 | 是 | 用户常居城市 |
| register_time | timestamp | 1609459200 | 否 | 是 | 用户注册时间 |
| last_login_time | timestamp | 1654022400 | 否 | 是 | 用户最后登录时间 |
| privacy_authorization_status | json | {"user_behavior": true, "location": true, "payment": false} | 否 | 否 | 用户隐私授权状态 |
| data_update_time | timestamp | 1654022400 | 否 | 否 | 数据最后更新时间 |

### 2. 用户收藏POI表（user_favorites）
| 字段名 | 类型 | 示例 | 是否需要隐私授权 | 是否可作为推荐特征 | 说明 |
|--------|------|------|------------------|--------------------|------|
| favorite_id | string | "f_123456" | 否 | 否 | 收藏记录唯一标识 |
| user_id | string | "u_123456789" | 否 | 是 | 用户ID |
| poi_id | string | "12345678" | 否 | 是 | 商户ID |
| poi_name | string | "海底捞火锅(三里屯店)" | 否 | 否 | 商户名称 |
| category | string | "美食/火锅" | 否 | 是 | 商户分类 |
| favorite_time | timestamp | 1653936000 | 否 | 是 | 收藏时间 |
| is_valid | boolean | true | 否 | 否 | 是否有效（商户是否已关闭） |
| data_update_time | timestamp | 1653936000 | 否 | 否 | 数据最后更新时间 |

### 3. 用户浏览POI表（user_browsing_history）
| 字段名 | 类型 | 示例 | 是否需要隐私授权 | 是否可作为推荐特征 | 说明 |
|--------|------|------|------------------|--------------------|------|
| browsing_id | string | "b_123456" | 否 | 否 | 浏览记录唯一标识 |
| user_id | string | "u_123456789" | 否 | 是 | 用户ID |
| poi_id | string | "12345678" | 否 | 是 | 商户ID |
| poi_name | string | "海底捞火锅(三里屯店)" | 否 | 否 | 商户名称 |
| category | string | "美食/火锅" | 否 | 是 | 商户分类 |
| browse_time | timestamp | 1653936000 | 否 | 是 | 浏览时间 |
| stay_duration | int | 120（单位：秒） | 否 | 是 | 停留时长 |
| page_view | int | 3 | 否 | 是 | 页面浏览次数 |
| data_update_time | timestamp | 1653936000 | 否 | 否 | 数据最后更新时间 |

### 4. 用户评分表（user_ratings）
| 字段名 | 类型 | 示例 | 是否需要隐私授权 | 是否可作为推荐特征 | 说明 |
|--------|------|------|------------------|--------------------|------|
| rating_id | string | "r_123456" | 否 | 否 | 评分记录唯一标识 |
| user_id | string | "u_123456789" | 否 | 是 | 用户ID |
| poi_id | string | "12345678" | 否 | 是 | 商户ID |
| poi_name | string | "海底捞火锅(三里屯店)" | 否 | 否 | 商户名称 |
| category | string | "美食/火锅" | 否 | 是 | 商户分类 |
| overall_rating | float | 4.5 | 否 | 是 | 综合评分 |
| taste_rating | float | 4.7 | 否 | 是 | 口味评分（仅餐饮） |
| environment_rating | float | 4.5 | 否 | 是 | 环境评分 |
| service_rating | float | 4.6 | 否 | 是 | 服务评分 |
| rating_time | timestamp | 1653936000 | 否 | 是 | 评分时间 |
| data_update_time | timestamp | 1653936000 | 否 | 否 | 数据最后更新时间 |

### 5. 用户评论表（user_reviews）
| 字段名 | 类型 | 示例 | 是否需要隐私授权 | 是否可作为推荐特征 | 说明 |
|--------|------|------|------------------|--------------------|------|
| review_id | string | "rv_123456" | 否 | 否 | 评论记录唯一标识 |
| user_id | string | "u_123456789" | 否 | 是 | 用户ID |
| poi_id | string | "12345678" | 否 | 是 | 商户ID |
| poi_name | string | "海底捞火锅(三里屯店)" | 否 | 否 | 商户名称 |
| category | string | "美食/火锅" | 否 | 是 | 商户分类 |
| review_text | string | "味道非常好，服务也很热情，推荐手切羊肉" | 是 | 是 | 评论文本内容 |
| review_images | array | ["https://example.com/img1.jpg", "https://example.com/img2.jpg"] | 是 | 是 | 评论图片URL列表 |
| publish_time | timestamp | 1653936000 | 否 | 是 | 发布时间 |
| like_count | int | 23 | 否 | 是 | 点赞数 |
| reply_count | int | 5 | 否 | 是 | 回复数 |
| data_update_time | timestamp | 1653936000 | 否 | 否 | 数据最后更新时间 |

### 6. 用户历史到店表（user_visits）
| 字段名 | 类型 | 示例 | 是否需要隐私授权 | 是否可作为推荐特征 | 说明 |
|--------|------|------|------------------|--------------------|------|
| visit_id | string | "v_123456" | 否 | 否 | 到店记录唯一标识 |
| user_id | string | "u_123456789" | 否 | 是 | 用户ID |
| poi_id | string | "12345678" | 否 | 是 | 商户ID |
| poi_name | string | "海底捞火锅(三里屯店)" | 否 | 否 | 商户名称 |
| category | string | "美食/火锅" | 否 | 是 | 商户分类 |
| visit_time | timestamp | 1653936000 | 否 | 是 | 到店时间 |
| leave_time | timestamp | 1653943200 | 否 | 是 | 离店时间 |
| consumption_amount | float | 240.0 | 是 | 是 | 消费金额 |
| people_count | int | 2 | 否 | 是 | 用餐人数 |
| data_update_time | timestamp | 1653943200 | 否 | 否 | 数据最后更新时间 |

### 7. 用户订单表（user_orders）
| 字段名 | 类型 | 示例 | 是否需要隐私授权 | 是否可作为推荐特征 | 说明 |
|--------|------|------|------------------|--------------------|------|
| order_id | string | "o_123456789" | 否 | 否 | 订单唯一标识 |
| user_id | string | "u_123456789" | 否 | 是 | 用户ID |
| poi_id | string | "12345678" | 否 | 是 | 商户ID |
| poi_name | string | "海底捞火锅(三里屯店)" | 否 | 否 | 商户名称 |
| category | string | "美食/火锅" | 否 | 是 | 商户分类 |
| order_type | int | 1（团购）/2（买单）/3（外卖） | 否 | 是 | 订单类型 |
| total_amount | float | 240.0 | 是 | 是 | 订单总金额 |
| pay_amount | float | 220.0 | 是 | 是 | 实际支付金额 |
| order_time | timestamp | 1653936000 | 否 | 是 | 下单时间 |
| pay_time | timestamp | 1653936100 | 是 | 是 | 支付时间 |
| order_status | int | 1（待支付）/2（已支付）/3（已完成）/4（已取消） | 否 | 是 | 订单状态 |
| data_update_time | timestamp | 1653936100 | 否 | 否 | 数据最后更新时间 |

### 8. 用户排队记录表（user_queues）
| 字段名 | 类型 | 示例 | 是否需要隐私授权 | 是否可作为推荐特征 | 说明 |
|--------|------|------|------------------|--------------------|------|
| queue_id | string | "q_123456" | 否 | 否 | 排队记录唯一标识 |
| user_id | string | "u_123456789" | 否 | 是 | 用户ID |
| poi_id | string | "12345678" | 否 | 是 | 商户ID |
| poi_name | string | "海底捞火锅(三里屯店)" | 否 | 否 | 商户名称 |
| category | string | "美食/火锅" | 否 | 是 | 商户分类 |
| queue_number | string | "A123" | 否 | 否 | 排队号码 |
| people_count | int | 2 | 否 | 是 | 用餐人数 |
| queue_time | timestamp | 1653936000 | 否 | 是 | 取号时间 |
| estimated_wait_time | int | 30（单位：分钟） | 否 | 是 | 预估等待时间 |
| actual_wait_time | int | 25（单位：分钟） | 否 | 是 | 实际等待时间 |
| is_served | boolean | true | 否 | 是 | 是否成功到店 |
| data_update_time | timestamp | 1653939000 | 否 | 否 | 数据最后更新时间 |

### 9. 用户偏好表（user_preferences）
| 字段名 | 类型 | 示例 | 是否需要隐私授权 | 是否可作为推荐特征 | 说明 |
|--------|------|------|------------------|--------------------|------|
| preference_id | string | "p_123456" | 否 | 否 | 偏好记录唯一标识 |
| user_id | string | "u_123456789" | 否 | 是 | 用户ID |
| frequent_business_districts | array | [{"name": "三里屯", "frequency": 0.3}, {"name": "国贸", "frequency": 0.25}] | 是 | 是 | 常去商圈及频次 |
| frequent_categories | array | [{"name": "美食/火锅", "frequency": 0.2}, {"name": "美食/川菜", "frequency": 0.15}] | 是 | 是 | 常选类目及频次 |
| budget_preference | json | {"min": 50, "max": 200, "avg": 120} | 是 | 是 | 预算偏好 |
| taste_preferences | array | ["麻辣", "鲜香", "清淡"] | 是 | 是 | 口味偏好 |
| avoid_points | array | ["太辣", "服务差", "排队时间长"] | 是 | 是 | 避雷点 |
| transportation_preferences | array | [{"type": "地铁", "frequency": 0.5}, {"type": "步行", "frequency": 0.3}] | 是 | 是 | 交通偏好 |
| data_update_time | timestamp | 1654022400 | 否 | 否 | 数据最后更新时间 |

## 三、隐私授权与数据使用说明

### 1. 必须获得用户明确授权的字段
- 用户昵称、头像、性别、年龄等个人基础信息
- 用户评论文本和评论图片
- 用户消费金额、支付记录等财务信息
- 用户精确地理位置信息
- 用户通讯录、相机、麦克风等设备权限

### 2. 可以匿名化处理后使用的字段
- 用户浏览记录（去除用户标识后用于统计分析）
- 用户评分记录（去除用户标识后用于商户质量评估）
- 用户到店记录（去除用户标识后用于商圈热度分析）
- 用户排队记录（去除用户标识后用于等位时间预测）

### 3. 只能在内部mock，不能从外部获取的字段
- 用户完整的历史行为序列
- 用户的支付密码、银行卡信息等敏感财务数据
- 用户的聊天记录、私信内容
- 用户的生物识别信息（指纹、面部识别等）

### 4. 推荐系统特征优先级
1. **高优先级特征**：用户收藏POI、用户评分、用户历史到店记录、用户订单记录
2. **中优先级特征**：用户浏览记录、用户排队记录、用户常去商圈、用户常选类目
3. **低优先级特征**：用户口味偏好、用户避雷点、用户交通偏好、用户预算偏好

## 四、Mock 数据生成建议

1. **用户基础信息**：生成1000个模拟用户，包含不同性别、年龄、城市分布
2. **用户行为数据**：为每个用户生成最近1年的行为记录，包含：
   - 50-200条浏览记录
   - 10-50条收藏记录
   - 20-100条到店记录
   - 10-50条订单记录
   - 5-20条评分记录
   - 3-10条评论记录
   - 5-20条排队记录
3. **用户偏好数据**：基于用户行为数据自动计算生成，每周更新一次
4. **数据真实性**：参考美团/大众点评的真实数据分布，确保模拟数据符合实际用户行为模式