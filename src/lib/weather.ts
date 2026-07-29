"use client";

/** 天气获取：Open-Meteo 免费公开 API（无需密钥，客户端直连） */

export interface WeatherNow {
  tempC: number;
  humidity: number;
  desc: string;
}

const WMO_DESC: Record<number, string> = {
  0: "晴", 1: "多云间晴", 2: "多云", 3: "阴",
  45: "雾", 48: "雾凇", 51: "毛毛雨", 53: "小雨", 55: "细雨",
  61: "小雨", 63: "中雨", 65: "大雨", 66: "冻雨", 67: "冻雨",
  71: "小雪", 73: "中雪", 75: "大雪", 77: "雪粒",
  80: "阵雨", 81: "阵雨", 82: "强阵雨", 85: "阵雪", 86: "阵雪",
  95: "雷阵雨", 96: "雷阵雨伴冰雹", 99: "雷暴冰雹",
};

const CITY_COORDS: Record<string, [number, number]> = {
  北京: [39.9042, 116.4074],
  上海: [31.2304, 121.4737],
  广州: [23.1291, 113.2644],
  深圳: [22.5431, 114.0579],
  成都: [30.5728, 104.0668],
  杭州: [30.2741, 120.1551],
  天津: [39.3434, 117.3616],
  西安: [34.3416, 108.9398],
};

async function geocode(city: string): Promise<[number, number] | null> {
  if (CITY_COORDS[city]) return CITY_COORDS[city];
  try {
    const res = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=zh`,
      { signal: AbortSignal.timeout(6000) }
    );
    const data = await res.json();
    const hit = data?.results?.[0];
    return hit ? [hit.latitude, hit.longitude] : null;
  } catch {
    return null;
  }
}

export async function fetchWeather(city: string): Promise<WeatherNow | null> {
  try {
    const coords = (await geocode(city)) ?? CITY_COORDS["北京"];
    const [lat, lon] = coords;
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code&timezone=auto`,
      { signal: AbortSignal.timeout(6000) }
    );
    const data = await res.json();
    const cur = data?.current;
    if (!cur) return null;
    return {
      tempC: Number(cur.temperature_2m),
      humidity: Number(cur.relative_humidity_2m),
      desc: WMO_DESC[Number(cur.weather_code)] ?? "多云",
    };
  } catch {
    return null;
  }
}
