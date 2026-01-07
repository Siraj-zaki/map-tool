import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getCurrentWeather } from '../../utils/weather';

interface WeatherWidgetProps {
  lat: number;
  lng: number;
  compact?: boolean;
}

interface WeatherData {
  temperature: number;
  condition: string;
  conditionKey: string;
  icon: string;
  humidity: number;
  wind: number;
}

export default function WeatherWidget({
  lat,
  lng,
  compact = false,
}: WeatherWidgetProps) {
  const { i18n } = useTranslation();
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const data = await getCurrentWeather(lat, lng);

        if (data) {
          const conditionKey = getWeatherConditionKey(data.weatherCode);
          setWeather({
            temperature: data.temperature,
            condition: getWeatherCondition(data.weatherCode, i18n.language),
            conditionKey,
            icon: getWeatherIcon(data.weatherCode),
            humidity: data.humidity,
            wind: data.windSpeed,
          });
        }
      } catch (error) {
        console.error('Failed to fetch weather:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
    const interval = setInterval(fetchWeather, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [lat, lng, i18n.language]);

  if (loading) {
    return (
      <div
        className={`flex items-center justify-center ${
          compact ? 'p-2' : 'p-4'
        } bg-[#080e11] border border-[#1e2a33] rounded-lg text-gray-400`}
      >
        <i className="fas fa-spinner fa-spin text-[#088d95]"></i>
      </div>
    );
  }

  if (!weather) return null;

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 bg-[#080e11] border border-[#1e2a33] rounded-lg text-sm sm:text-base sm:gap-2 sm:px-3 sm:py-1.5">
        <i
          className={`fas fa-${weather.icon} text-[#088d95] text-xs sm:text-sm`}
        ></i>
        <span className="text-white font-semibold text-xs sm:text-sm">
          {weather.temperature}°C
        </span>
        <span className="text-gray-400 text-xs hidden sm:inline">
          {weather.condition}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-[#080e11] border border-[#1e2a33] rounded-lg">
      <div className="text-2xl text-[#088d95]">
        <i className={`fas fa-${weather.icon}`}></i>
      </div>
      <div className="text-2xl font-semibold text-white">
        {weather.temperature}°C
      </div>
      <div className="flex flex-col gap-0.5">
        <div className="text-sm text-gray-400">{weather.condition}</div>
        <div className="flex gap-3 text-xs text-gray-500">
          <span>
            <i className="fas fa-droplet text-[#088d95] mr-1"></i>
            {weather.humidity}%
          </span>
          <span>
            <i className="fas fa-wind text-[#088d95] mr-1"></i>
            {weather.wind} km/h
          </span>
        </div>
      </div>
    </div>
  );
}

function getWeatherConditionKey(code: number): string {
  const keys: Record<number, string> = {
    0: 'weatherClear',
    1: 'weatherMostlyClear',
    2: 'weatherPartlyCloudy',
    3: 'weatherCloudy',
    45: 'weatherFog',
    48: 'weatherFogRime',
    51: 'weatherLightDrizzle',
    53: 'weatherModerateDrizzle',
    55: 'weatherHeavyDrizzle',
    61: 'weatherLightRain',
    63: 'weatherModerateRain',
    65: 'weatherHeavyRain',
    71: 'weatherLightSnow',
    73: 'weatherModerateSnow',
    75: 'weatherHeavySnow',
    80: 'weatherRainShowers',
    81: 'weatherModerateRainShowers',
    82: 'weatherHeavyRainShowers',
    95: 'weatherThunderstorm',
    96: 'weatherThunderstormHail',
  };
  return keys[code] || 'weatherUnknown';
}

function getWeatherCondition(code: number, lang: string): string {
  const conditions: Record<string, Record<number, string>> = {
    de: {
      0: 'Klar',
      1: 'Überwiegend klar',
      2: 'Teilweise bewölkt',
      3: 'Bewölkt',
      45: 'Nebel',
      48: 'Nebel mit Reif',
      51: 'Leichter Niesel',
      53: 'Mäßiger Niesel',
      55: 'Starker Niesel',
      61: 'Leichter Regen',
      63: 'Mäßiger Regen',
      65: 'Starker Regen',
      71: 'Leichter Schnee',
      73: 'Mäßiger Schnee',
      75: 'Starker Schnee',
      80: 'Regenschauer',
      81: 'Mäßige Regenschauer',
      82: 'Starke Regenschauer',
      95: 'Gewitter',
      96: 'Gewitter mit Hagel',
    },
    en: {
      0: 'Clear',
      1: 'Mostly Clear',
      2: 'Partly Cloudy',
      3: 'Cloudy',
      45: 'Fog',
      48: 'Rime Fog',
      51: 'Light Drizzle',
      53: 'Moderate Drizzle',
      55: 'Heavy Drizzle',
      61: 'Light Rain',
      63: 'Moderate Rain',
      65: 'Heavy Rain',
      71: 'Light Snow',
      73: 'Moderate Snow',
      75: 'Heavy Snow',
      80: 'Rain Showers',
      81: 'Moderate Rain Showers',
      82: 'Heavy Rain Showers',
      95: 'Thunderstorm',
      96: 'Thunderstorm with Hail',
    },
  };

  const langConditions = conditions[lang] || conditions.de;
  return langConditions[code] || (lang === 'en' ? 'Unknown' : 'Unbekannt');
}

function getWeatherIcon(code: number): string {
  if (code === 0) return 'sun';
  if (code <= 3) return 'cloud-sun';
  if (code <= 48) return 'smog';
  if (code <= 55) return 'cloud-rain';
  if (code <= 65) return 'cloud-showers-heavy';
  if (code <= 75) return 'snowflake';
  if (code <= 82) return 'cloud-rain';
  return 'cloud-bolt';
}
