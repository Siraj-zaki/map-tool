/// <reference types="vite/client" />

const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes
const OWM_API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY || '';

// User Agent for Met.no (Required by their TOS)
const MET_NO_USER_AGENT = 'MapTool/1.0 github.com/yourusername/map-tool';

interface WeatherCache<T> {
  timestamp: number;
  data: T;
}

export interface CurrentWeather {
  temperature: number;
  humidity: number;
  windSpeed: number;
  weatherCode: number;
  provider?: string;
}

export interface DayForecast {
  date: string; // YYYY-MM-DD
  tempMax: number;
  tempMin: number;
  weatherCode: number;
  provider?: string;
}

// --- Mappers ---

// Map OpenWeatherMap condition codes to WMO
function mapOpenWeatherMapToWmo(owmId: number): number {
  if (owmId === 800) return 0; // Clear
  if (owmId === 801) return 1; // Mostly Clear
  if (owmId === 802) return 2; // Partly Cloudy
  if (owmId >= 803) return 3; // Overcast
  if (owmId >= 200 && owmId < 300) return 95; // Thunderstorm
  if (owmId >= 300 && owmId < 400) return 51; // Drizzle
  if (owmId >= 500 && owmId < 600) return 61; // Rain
  if (owmId >= 600 && owmId < 700) return 71; // Snow
  if (owmId >= 700 && owmId < 800) return 45; // Fog
  return 3;
}

// Map Met.no symbol codes to WMO
// https://api.met.no/weatherapi/weathericon/2.0/documentation
function mapMetNoToWmo(symbolCode: string): number {
  const code = symbolCode.split('_')[0]; // remote 'day'/'night' suffix

  const map: Record<string, number> = {
    clearsky: 0,
    fair: 1,
    partlycloudy: 2,
    cloudy: 3,
    lightrain: 61,
    rain: 63,
    heavyrain: 65,
    lightrainshowers: 80,
    rainshowers: 81,
    heavyrainshowers: 82,
    lightsnow: 71,
    snow: 73,
    heavysnow: 75,
    lightsnowshowers: 85,
    snowshowers: 86,
    heavysnowshowers: 86, // Approximately
    sleet: 66, // Freezing rain approx
    lightsleet: 66,
    heavysleet: 67,
    fog: 45,
    thunder: 95,
    lightrainandthunder: 95,
    rainandthunder: 96,
    heavyrainandthunder: 99,
  };

  return map[code] || 3;
}

// Map 7Timer! weather types to WMO
function mapSevenTimerToWmo(type: string): number {
  const map: Record<string, number> = {
    clear: 0,
    pcloudy: 2,
    mcloudy: 3,
    cloudy: 3,
    humid: 45, // Foggy/Humid
    lightrain: 61,
    oshower: 80, // Occasional shower
    ishower: 81, // Isolated shower
    lightsnow: 71,
    rain: 63,
    snow: 73,
    rainsnow: 66, // Sleet
    ts: 95, // Thunderstorm
    tsrain: 96,
  };
  return map[type] || 3;
}

// --- API Helpers ---

function getCacheKey(type: string, lat: number, lng: number): string {
  return `weather_${type}_${lat.toFixed(2)}_${lng.toFixed(2)}`;
}

// --- Fetchers (Current Weather) ---

// 1. Open-Meteo (Primary)
async function fetchOpenMeteoCurrent(
  lat: number,
  lng: number
): Promise<CurrentWeather> {
  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m`
  );
  if (!response.ok) throw new Error(`OpenMeteo error: ${response.status}`);
  const data = await response.json();
  if (!data.current) throw new Error('Invalid OpenMeteo data');

  return {
    temperature: Math.round(data.current.temperature_2m),
    humidity: data.current.relative_humidity_2m,
    windSpeed: Math.round(data.current.wind_speed_10m),
    weatherCode: data.current.weather_code,
    provider: 'Open-Meteo',
  };
}

// 2. Met.no (Fallback 1 - High Quality, Free)
async function fetchMetNoCurrent(
  lat: number,
  lng: number
): Promise<CurrentWeather> {
  const response = await fetch(
    `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat}&lon=${lng}`,
    { headers: { 'User-Agent': MET_NO_USER_AGENT } }
  );
  if (!response.ok) throw new Error(`Met.no error: ${response.status}`);
  const data = await response.json();

  const current = data.properties.timeseries[0];
  if (!current) throw new Error('Invalid Met.no data');

  const details = current.data.instant.details;
  const next1h = current.data.next_1_hours?.summary?.symbol_code;

  return {
    temperature: Math.round(details.air_temperature),
    humidity: Math.round(details.relative_humidity),
    windSpeed: Math.round(details.wind_speed * 3.6), // m/s to km/h
    weatherCode: next1h ? mapMetNoToWmo(next1h) : 3,
    provider: 'Met.no',
  };
}

// 3. 7Timer! (Fallback 2 - Free, distinct source)
async function fetchSevenTimerCurrent(
  lat: number,
  lng: number
): Promise<CurrentWeather> {
  // Uses 'civil' product for current conditions approximation (taking first timepoint)
  // Note: 7Timer returns a data series. We'll take the first one.
  const response = await fetch(
    `https://www.7timer.info/bin/civillight.php?lon=${lng}&lat=${lat}&ac=0&unit=metric&output=json&tzshift=0`
  );
  if (!response.ok) throw new Error(`7Timer error: ${response.status}`);
  const data = await response.json();

  if (!data.dataseries || data.dataseries.length === 0)
    throw new Error('Invalid 7Timer data');

  const current = data.dataseries[0]; // Today's forecast roughly

  // 7Timer civil light doesn't give current instant temp, it gives max/min.
  // We can try the 'meteo' product for more detail but it's complex to parse without a proper time match.
  // For robustness, we will take the average of max/min as a rough "current" if we are falling back this deep.
  const temp = Math.round((current.temp2m.max + current.temp2m.min) / 2);

  return {
    temperature: temp,
    humidity: 50, // 7Timer civillight doesn't provide humidity
    windSpeed: 10, // 7Timer civillight doesn't provide wind
    weatherCode: mapSevenTimerToWmo(current.weather),
    provider: '7Timer!',
  };
}

// 4. OpenWeatherMap (Fallback 3 - Requires Key)
async function fetchOpenWeatherMapCurrent(
  lat: number,
  lng: number
): Promise<CurrentWeather> {
  if (!OWM_API_KEY) throw new Error('No OpenWeatherMap API key');

  const response = await fetch(
    `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&units=metric&appid=${OWM_API_KEY}`
  );
  if (!response.ok) throw new Error(`OWM error: ${response.status}`);
  const data = await response.json();

  return {
    temperature: Math.round(data.main.temp),
    humidity: data.main.humidity,
    windSpeed: Math.round(data.wind.speed * 3.6),
    weatherCode: mapOpenWeatherMapToWmo(data.weather[0].id),
    provider: 'OpenWeatherMap',
  };
}

// --- Fetchers (Daily Forecast) ---

async function fetchOpenMeteoDaily(
  lat: number,
  lng: number
): Promise<DayForecast[]> {
  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`
  );
  if (!response.ok) throw new Error(`OpenMeteo error: ${response.status}`);
  const data = await response.json();

  if (!data.daily) throw new Error('Invalid OpenMeteo data');

  return data.daily.time.slice(0, 7).map((date: string, index: number) => ({
    date,
    weatherCode: data.daily.weather_code[index],
    tempMax: Math.round(data.daily.temperature_2m_max[index]),
    tempMin: Math.round(data.daily.temperature_2m_min[index]),
    provider: 'Open-Meteo',
  }));
}

async function fetchMetNoDaily(
  lat: number,
  lng: number
): Promise<DayForecast[]> {
  const response = await fetch(
    `https://api.met.no/weatherapi/locationforecast/2.0/complete?lat=${lat}&lon=${lng}`,
    { headers: { 'User-Agent': MET_NO_USER_AGENT } }
  );
  if (!response.ok) throw new Error(`Met.no error: ${response.status}`);
  const data = await response.json();

  const timeseries = data.properties.timeseries;
  const daysMap = new Map<string, { min: number; max: number; code: string }>();

  timeseries.forEach((item: any) => {
    const date = item.time.split('T')[0];
    const details = item.data.instant.details;
    const symbol =
      item.data.next_12_hours?.summary?.symbol_code ||
      item.data.next_6_hours?.summary?.symbol_code ||
      item.data.next_1_hours?.summary?.symbol_code;

    if (!daysMap.has(date)) {
      daysMap.set(date, {
        min: details.air_temperature,
        max: details.air_temperature,
        code: symbol,
      });
    } else {
      const entry = daysMap.get(date)!;
      entry.min = Math.min(entry.min, details.air_temperature);
      entry.max = Math.max(entry.max, details.air_temperature);
      if (!entry.code && symbol) entry.code = symbol; // Prioritize having a symbol
    }
  });

  return Array.from(daysMap.entries())
    .slice(0, 7)
    .map(([date, info]) => ({
      date,
      tempMax: Math.round(info.max),
      tempMin: Math.round(info.min),
      weatherCode: mapMetNoToWmo(info.code || 'cloudy'),
      provider: 'Met.no',
    }));
}

async function fetchSevenTimerDaily(
  lat: number,
  lng: number
): Promise<DayForecast[]> {
  const response = await fetch(
    `https://www.7timer.info/bin/civillight.php?lon=${lng}&lat=${lat}&ac=0&unit=metric&output=json&tzshift=0`
  );
  if (!response.ok) throw new Error(`7Timer error: ${response.status}`);
  const data = await response.json();

  if (!data.dataseries) throw new Error('Invalid 7Timer data');

  // 7Timer returns dates like 20231025. Need to format to YYYY-MM-DD
  return data.dataseries.slice(0, 7).map((day: any) => {
    const dStr = day.date.toString();
    const date = `${dStr.substring(0, 4)}-${dStr.substring(
      4,
      6
    )}-${dStr.substring(6, 8)}`;

    return {
      date,
      tempMax: day.temp2m.max,
      tempMin: day.temp2m.min,
      weatherCode: mapSevenTimerToWmo(day.weather),
      provider: '7Timer!',
    };
  });
}

async function fetchOpenWeatherMapDaily(
  lat: number,
  lng: number
): Promise<DayForecast[]> {
  if (!OWM_API_KEY) throw new Error('No OpenWeatherMap API key');

  const response = await fetch(
    `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lng}&units=metric&appid=${OWM_API_KEY}`
  );
  if (!response.ok) throw new Error(`OWM error: ${response.status}`);
  const data = await response.json();

  const dailyMap = new Map<
    string,
    { min: number; max: number; codes: number[] }
  >();

  data.list.forEach((item: any) => {
    const date = item.dt_txt.split(' ')[0];
    const temp = item.main.temp;
    const code = item.weather[0].id;

    if (!dailyMap.has(date)) {
      dailyMap.set(date, { min: temp, max: temp, codes: [code] });
    } else {
      const entry = dailyMap.get(date)!;
      entry.min = Math.min(entry.min, temp);
      entry.max = Math.max(entry.max, temp);
      entry.codes.push(code);
    }
  });

  return Array.from(dailyMap.entries())
    .slice(0, 5) // OWM free gives 5 days
    .map(([date, info]) => {
      const wmoCode = mapOpenWeatherMapToWmo(
        info.codes[Math.floor(info.codes.length / 2)]
      );
      return {
        date,
        tempMax: Math.round(info.max),
        tempMin: Math.round(info.min),
        weatherCode: wmoCode,
        provider: 'OpenWeatherMap',
      };
    });
}

// --- Orchestrator ---

async function fetchWithFallback<T>(
  key: string,
  fetchers: Array<() => Promise<T>>
): Promise<T> {
  // 1. Check Cache
  const cached = localStorage.getItem(key);
  if (cached) {
    try {
      const { timestamp, data } = JSON.parse(cached) as WeatherCache<T>;
      if (Date.now() - timestamp < CACHE_DURATION) {
        return data; // Return fresh cache
      }
    } catch (e) {
      localStorage.removeItem(key);
    }
  }

  // 2. Try Fetchers in Order
  let lastError: any;

  for (const fetcher of fetchers) {
    try {
      const data = await fetcher();
      // Cache Result
      localStorage.setItem(
        key,
        JSON.stringify({ timestamp: Date.now(), data })
      );
      return data;
    } catch (error) {
      console.warn('Weather provider failed, trying next...', error);
      lastError = error;
      // Continue to next fetcher
    }
  }

  // 3. All Failed
  throw lastError || new Error('All weather providers failed');
}

export async function getCurrentWeather(
  lat: number,
  lng: number
): Promise<CurrentWeather> {
  return fetchWithFallback(getCacheKey('current', lat, lng), [
    () => fetchOpenMeteoCurrent(lat, lng),
    () => fetchMetNoCurrent(lat, lng),
    () => fetchSevenTimerCurrent(lat, lng),
    () => fetchOpenWeatherMapCurrent(lat, lng),
  ]);
}

export async function getDailyForecast(
  lat: number,
  lng: number
): Promise<DayForecast[]> {
  return fetchWithFallback(getCacheKey('daily', lat, lng), [
    () => fetchOpenMeteoDaily(lat, lng),
    () => fetchMetNoDaily(lat, lng),
    () => fetchSevenTimerDaily(lat, lng),
    () => fetchOpenWeatherMapDaily(lat, lng),
  ]);
}
