import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getDailyForecast } from '../../utils/weather';

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
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Detect screen size
  useEffect(() => {
    const checkScreenSize = () => {
      const width = window.innerWidth;
      setIsMobile(width < 600);
      setIsTablet(width >= 600 && width < 1024);
    };
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  useEffect(() => {
    const fetchForecast = async () => {
      try {
        const data = await getDailyForecast(lat, lng);

        if (data && data.length > 0) {
          const days: DailyForecast[] = data.map((day, index) => ({
            date: day.date,
            dayName: getDayName(day.date, index, i18n.language),
            weatherCode: day.weatherCode,
            tempMax: day.tempMax,
            tempMin: day.tempMin,
            icon: getWeatherIcon(day.weatherCode),
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

  // Show fewer days on smaller screens
  const displayDays = isMobile ? 4 : isTablet ? 5 : forecast.length;
  const displayForecast = forecast.slice(0, displayDays);

  return (
    <div
      style={{
        background: 'rgba(8, 14, 17, 0.9)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderRadius: isMobile ? '8px' : '12px',
        border: '1px solid #1e2a33',
        padding: isMobile ? '6px' : isTablet ? '8px' : '12px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        minWidth: isMobile ? '100px' : isTablet ? '110px' : '130px',
      }}
    >
      {/* Header with toggle */}
      <div
        style={{
          fontSize: isMobile ? '8px' : isTablet ? '9px' : '10px',
          fontWeight: '700',
          color: '#088d95',
          textTransform: 'uppercase',
          letterSpacing: isMobile ? '0.5px' : '1px',
          marginBottom: isCollapsed
            ? 0
            : isMobile
            ? '4px'
            : isTablet
            ? '6px'
            : '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: isMobile ? '3px' : '6px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? '3px' : '6px',
          }}
        >
          <span
            style={{ fontSize: isMobile ? '9px' : isTablet ? '10px' : '12px' }}
          >
            ☁️
          </span>
          {displayDays}-Day
        </div>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#6b7280',
            cursor: 'pointer',
            padding: '2px',
            fontSize: isMobile ? '8px' : '10px',
            transition: 'color 0.2s ease',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#088d95')}
          onMouseLeave={e => (e.currentTarget.style.color = '#6b7280')}
          title={isCollapsed ? 'Show' : 'Hide'}
        >
          <i className={`fas fa-chevron-${isCollapsed ? 'down' : 'up'}`}></i>
        </button>
      </div>

      {/* Collapsible Forecast Items */}
      {!isCollapsed && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: isMobile ? '2px' : '4px',
          }}
        >
          {displayForecast.map((day, index) => (
            <div
              key={day.date}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: isMobile ? '4px' : isTablet ? '6px' : '10px',
                padding: isMobile
                  ? '4px 5px'
                  : isTablet
                  ? '5px 7px'
                  : '8px 10px',
                borderRadius: isMobile ? '4px' : '8px',
                background:
                  index === 0
                    ? 'rgba(8, 141, 149, 0.2)'
                    : 'rgba(30, 42, 51, 0.5)',
                border:
                  index === 0 ? '1px solid #088d95' : '1px solid transparent',
                transition: 'all 0.2s ease',
              }}
            >
              {/* Weather Icon */}
              <div
                style={{
                  fontSize: isMobile ? '12px' : isTablet ? '14px' : '20px',
                  width: isMobile ? '16px' : isTablet ? '20px' : '28px',
                  height: isMobile ? '16px' : isTablet ? '20px' : '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {day.icon}
              </div>

              {/* Day Name */}
              <div
                style={{
                  fontSize: isMobile ? '9px' : isTablet ? '10px' : '12px',
                  fontWeight: '600',
                  color: index === 0 ? '#088d95' : 'rgba(255, 255, 255, 0.7)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  flex: 1,
                  textAlign: 'left',
                }}
              >
                {day.dayName.slice(0, 3)}
              </div>

              {/* Temperature */}
              <div
                style={{
                  fontSize: isMobile ? '10px' : isTablet ? '11px' : '14px',
                  fontWeight: '700',
                  color: '#fff',
                  minWidth: isMobile ? '24px' : isTablet ? '30px' : '40px',
                  textAlign: 'right',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                }}
              >
                {day.tempMax}°
              </div>
            </div>
          ))}
        </div>
      )}
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
