import { useTranslation } from 'react-i18next';
import type { RouteStats } from '../types';
import { calculateRealisticDuration, formatDuration } from '../utils';

interface RouteStatsPanelProps {
  routeStats: RouteStats;
  setRouteStats: React.Dispatch<React.SetStateAction<RouteStats>>;
}

export default function RouteStatsPanel({
  routeStats,
  setRouteStats,
}: RouteStatsPanelProps) {
  const { t } = useTranslation();
  return (
    <div className="bg-[#0b1215] border border-[#1e2a33] rounded-lg p-3">
      <h4 className="text-[#088d95] text-xs uppercase mb-2 font-semibold flex justify-between items-center">
        {t('routeStatistics')}
        <span className="text-gray-500 text-[0.625rem] normal-case font-normal">
          (click to edit)
        </span>
      </h4>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between items-center">
          <span className="text-gray-400">{t('distance')}</span>
          <div className="flex items-center">
            <input
              type="number"
              step="0.01"
              value={routeStats.distance}
              onChange={e =>
                setRouteStats(prev => ({
                  ...prev,
                  distance: parseFloat(e.target.value) || 0,
                }))
              }
              className="w-20 bg-transparent text-[#088d95] font-semibold text-right border-b border-transparent hover:border-[#088d95] focus:border-[#088d95] focus:outline-none px-1"
            />
            <span className="text-[#088d95] font-semibold ml-1">km</span>
          </div>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-400">{t('duration')}</span>
          <div className="flex items-center">
            <input
              type="text"
              value={formatDuration(
                routeStats.duration || calculateRealisticDuration(routeStats.distance)
              )}
              onChange={e => {
                // Parse HH:MM:SS format to minutes
                const parts = e.target.value.split(':');
                if (parts.length >= 2) {
                  const hours = parseInt(parts[0] || '0');
                  const mins = parseInt(parts[1] || '0');
                  setRouteStats(prev => ({
                    ...prev,
                    duration: hours * 60 + mins,
                  }));
                }
              }}
              className="w-20 bg-transparent text-[#088d95] font-semibold text-right border-b border-transparent hover:border-[#088d95] focus:border-[#088d95] focus:outline-none px-1"
              placeholder="HH:MM"
            />
          </div>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-400">{t('highestPoint')}</span>
          <div className="flex items-center">
            <input
              type="number"
              value={routeStats.highestPoint}
              onChange={e =>
                setRouteStats(prev => ({
                  ...prev,
                  highestPoint: parseInt(e.target.value) || 0,
                }))
              }
              className="w-16 bg-transparent text-[#088d95] font-semibold text-right border-b border-transparent hover:border-[#088d95] focus:border-[#088d95] focus:outline-none px-1"
            />
            <span className="text-[#088d95] font-semibold ml-1">m</span>
          </div>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-400">{t('lowestPoint')}</span>
          <div className="flex items-center">
            <input
              type="number"
              value={routeStats.lowestPoint}
              onChange={e =>
                setRouteStats(prev => ({
                  ...prev,
                  lowestPoint: parseInt(e.target.value) || 0,
                }))
              }
              className="w-16 bg-transparent text-[#088d95] font-semibold text-right border-b border-transparent hover:border-[#088d95] focus:border-[#088d95] focus:outline-none px-1"
            />
            <span className="text-[#088d95] font-semibold ml-1">m</span>
          </div>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-400">{t('totalAscent')}</span>
          <div className="flex items-center">
            <span className="text-green-500">↑</span>
            <input
              type="number"
              value={routeStats.totalAscent}
              onChange={e =>
                setRouteStats(prev => ({
                  ...prev,
                  totalAscent: parseInt(e.target.value) || 0,
                }))
              }
              className="w-16 bg-transparent text-green-500 font-semibold text-right border-b border-transparent hover:border-green-500 focus:border-green-500 focus:outline-none px-1"
            />
            <span className="text-green-500 font-semibold ml-1">m</span>
          </div>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-gray-400">{t('totalDescent')}</span>
          <div className="flex items-center">
            <span className="text-red-400">↓</span>
            <input
              type="number"
              value={routeStats.totalDescent}
              onChange={e =>
                setRouteStats(prev => ({
                  ...prev,
                  totalDescent: parseInt(e.target.value) || 0,
                }))
              }
              className="w-16 bg-transparent text-red-400 font-semibold text-right border-b border-transparent hover:border-red-400 focus:border-red-400 focus:outline-none px-1"
            />
            <span className="text-red-400 font-semibold ml-1">m</span>
          </div>
        </div>
      </div>
    </div>
  );
}
