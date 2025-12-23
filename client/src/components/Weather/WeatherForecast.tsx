import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface WeatherForecastProps {
  lat: number;
  lng: number;
  locationName?: string;
}

interface DailyForecast {
  date: string;
  dayName: string;
  weatherCode: number;
  tempMax: number;
  tempMin: number;
  icon: string;
}

export default function WeatherForecast({
  lat,
  lng,
  locationName: _locationName = 'Wernigerode',
}: WeatherForecastProps) {
  const { i18n } = useTranslation();
  const [forecast, setForecast] = useState<DailyForecast[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchForecast = async () => {
      try {
        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Europe/Berlin`
        );
        const data = await response.json();

        if (data.daily) {
          const days: DailyForecast[] = data.daily.time
            .slice(0, 7)
            .map((date: string, index: number) => ({
              date,
              dayName: getDayName(date, index, i18n.language),
              weatherCode: data.daily.weather_code[index],
              tempMax: Math.round(data.daily.temperature_2m_max[index]),
              tempMin: Math.round(data.daily.temperature_2m_min[index]),
              icon: getWeatherIcon(data.daily.weather_code[index]),
            }));
          setForecast(days);
        }
      } catch (error) {
        console.error('Failed to fetch weather forecast:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchForecast();
    const interval = setInterval(fetchForecast, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [lat, lng, i18n.language]);

  if (loading) {
    return (
      <div className="weather-forecast-compact">
        <div className="flex items-center justify-center py-3 text-gray-400">
          <i className="fas fa-spinner fa-spin text-lg text-[#088d95]"></i>
        </div>
      </div>
    );
  }

  if (forecast.length === 0) return null;

  return (
    <div
      style={{
        background: 'rgba(132, 192, 137, 0.85)',
        backdropFilter: 'blur(10px)',
        borderRadius: '10px',
        border: '1px solid rgba(0,0,0,0.2)',
        padding: '12px 16px',
        boxShadow: '0 2px 12px rgba(0, 0, 0, 0.15)',
      }}
    >
      {/* 7-Day Forecast Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          gap: '8px',
          textAlign: 'center',
        }}
      >
        {forecast.map(day => (
          <div key={day.date} style={{ minWidth: '50px' }}>
            {/* Day Name - Full */}
            <div
              style={{
                fontSize: '10px',
                fontWeight: '600',
                color: '#000',
                textTransform: 'uppercase',
                letterSpacing: '0.3px',
                marginBottom: '6px',
                whiteSpace: 'nowrap',
              }}
            >
              {day.dayName}
            </div>

            {/* Weather Icon */}
            <div
              style={{
                fontSize: '24px',
                marginBottom: '4px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {day.icon}
            </div>

            {/* Temperature */}
            <div
              style={{
                fontSize: '12px',
                fontWeight: '600',
                color: '#333',
              }}
            >
              {day.tempMax}°C
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function getDayName(dateString: string, index: number, lang: string): string {
  if (index === 0) return lang === 'de' ? 'HEUTE' : 'TODAY';
  if (index === 1) return lang === 'de' ? 'MORGEN' : 'TOMORROW';

  const date = new Date(dateString);
  const daysDE = [
    'SONNTAG',
    'MONTAG',
    'DIENSTAG',
    'MITTWOCH',
    'DONNERSTAG',
    'FREITAG',
    'SAMSTAG',
  ];
  const daysEN = [
    'SUNDAY',
    'MONDAY',
    'TUESDAY',
    'WEDNESDAY',
    'THURSDAY',
    'FRIDAY',
    'SATURDAY',
  ];

  return lang === 'de' ? daysDE[date.getDay()] : daysEN[date.getDay()];
}

function getWeatherIcon(code: number): string {
  if (code === 0) return '☀️';
  if (code <= 3) return '⛅';
  if (code <= 48) return '🌫️';
  if (code <= 55) return '🌧️';
  if (code <= 65) return '🌧️';
  if (code <= 75) return '❄️';
  if (code <= 82) return '🌧️';
  if (code <= 96) return '⛈️';
  return '☁️';
}
