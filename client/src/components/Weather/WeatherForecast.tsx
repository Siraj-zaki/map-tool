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
      className="weather-forecast-widget"
      style={{
        background: 'rgba(8, 14, 17, 0.9)',
        backdropFilter: 'blur(1.25rem)',
        WebkitBackdropFilter: 'blur(1.25rem)',
        borderRadius: isMobile ? '0.5rem' : '0.75rem',
        border: '0.0625rem solid #1e2a33',
        padding: isMobile ? '0.375rem' : isTablet ? '0.5rem' : '0.75rem',
        boxShadow: '0 0.5rem 2rem rgba(0, 0, 0, 0.4)',
        minWidth: isMobile ? '6.25rem' : isTablet ? '6.875rem' : '8.125rem',
      }}
    >
      {/* Header with toggle */}
      <div
        style={{
          fontSize: isMobile ? '0.5rem' : isTablet ? '0.5625rem' : '0.625rem',
          fontWeight: '700',
          color: 'var(--brand-primary, #088d95)',
          textTransform: 'uppercase',
          letterSpacing: isMobile ? '0.0313rem' : '0.0625rem',
          marginBottom: isCollapsed
            ? 0
            : isMobile
              ? '0.25rem'
              : isTablet
                ? '0.375rem'
                : '0.625rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: isMobile ? '0.1875rem' : '0.375rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? '0.1875rem' : '0.375rem',
          }}
        >
          <span
            style={{ fontSize: isMobile ? '0.5625rem' : isTablet ? '0.625rem' : '0.75rem' }}
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
            padding: '0.125rem',
            fontSize: isMobile ? '0.5rem' : '0.625rem',
            transition: 'color 0.2s ease',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--brand-primary, #088d95)')}
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
            gap: isMobile ? '0.125rem' : '0.25rem',
          }}
        >
          {displayForecast.map((day, index) => (
            <div
              key={day.date}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: isMobile ? '0.25rem' : isTablet ? '0.375rem' : '0.625rem',
                padding: isMobile
                  ? '0.25rem 0.3125rem'
                  : isTablet
                    ? '0.3125rem 0.4375rem'
                    : '0.5rem 0.625rem',
                borderRadius: isMobile ? '0.25rem' : '0.5rem',
                background:
                  index === 0
                    ? 'rgba(8, 141, 149, 0.2)'
                    : 'rgba(30, 42, 51, 0.5)',
                border:
                  index === 0 ? '0.0625rem solid var(--brand-primary, #088d95)' : '0.0625rem solid transparent',
                transition: 'all 0.2s ease',
              }}
            >
              {/* Weather Icon */}
              <div
                style={{
                  fontSize: isMobile ? '0.75rem' : isTablet ? '0.875rem' : '1.25rem',
                  width: isMobile ? '1rem' : isTablet ? '1.25rem' : '1.75rem',
                  height: isMobile ? '1rem' : isTablet ? '1.25rem' : '1.75rem',
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
                  fontSize: isMobile ? '0.5625rem' : isTablet ? '0.625rem' : '0.75rem',
                  fontWeight: '600',
                  color: index === 0 ? 'var(--brand-primary, #088d95)' : 'rgba(255, 255, 255, 0.7)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.0313rem',
                  flex: 1,
                  textAlign: 'left',
                }}
              >
                {day.dayName}
              </div>

              {/* Temperature */}
              <div
                style={{
                  fontSize: isMobile ? '0.625rem' : isTablet ? '0.6875rem' : '0.875rem',
                  fontWeight: '700',
                  color: '#fff',
                  minWidth: isMobile ? '1.5rem' : isTablet ? '1.875rem' : '2.5rem',
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
  const isGerman = lang.startsWith('de');
  if (index === 0) return isGerman ? 'HEUTE' : 'TODAY';
  if (index === 1) return isGerman ? 'MORGEN' : 'TOMORROW';

  const date = new Date(dateString);
  const daysDE = [
    'SON', // Sonntag
    'MON', // Montag
    'DIE', // Dienstag
    'MIT', // Mittwoch
    'DON', // Donnerstag
    'FRE', // Freitag
    'SAM', // Samstag
  ];
  const daysEN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  const dayIndex = date.getDay();
  return isGerman ? daysDE[dayIndex] : daysEN[dayIndex];
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
