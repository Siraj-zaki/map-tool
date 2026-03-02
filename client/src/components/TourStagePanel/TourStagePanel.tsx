import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Route } from '../../api';
import './TourStagePanel.css';

type TourType = 'gold' | 'silver' | 'bronze';

interface TourStagePanelProps {
  route: Route | null;
  tourType: TourType;
  onTourTypeChange: (type: TourType) => void;
  selectedStage?: number | null;
  onStageSelect?: (stage: number | null) => void;
  selectedCity?: string;
  onCityChange?: (city: string) => void;
}

// Stage count per tour type
const stageConfig: Record<TourType, number> = {
  gold: 1,
  silver: 2,
  bronze: 3,
};

export default function TourStagePanel({
  route,
  tourType,
  onTourTypeChange,
  onStageSelect,
  selectedCity = 'Wernigerode',
  onCityChange,
}: TourStagePanelProps) {
  const { t } = useTranslation();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);

  const citiesList = [
    'Wernigerode',
    'Berlin',
    'Hamburg',
    'Munich',
    'Munich',
    'Cologne',
    'Frankfurt',
  ];

  // Calculate stats for a specific stage
  const getStageStats = (stageIndex: number, totalStages: number) => {
    if (!route) return null;
    const dist = parseFloat(String(route.distance || 179.6)) / totalStages;
    const asc = parseFloat(String(route.totalAscent || 4972)) / totalStages;
    const desc = parseFloat(String(route.totalDescent || 1142)) / totalStages;

    return {
      name: `STAGE ${stageIndex + 1}`,
      start: indexToCity(stageIndex),
      end: indexToCity(stageIndex + 1),
      distance: dist,
      ascent: asc,
      descent: desc,
      minEle: route.lowestPoint || 259,
      maxEle: route.highestPoint || 1142,
    };
  };

  const numStages = stageConfig[tourType];

  const renderTabs = () => (
    <div className="w-full h-9 bg-black rounded-[8px] flex items-center justify-between px-[2px] mb-[-3px] shrink-0">
      {(['gold', 'silver', 'bronze'] as const).map(type => {
        const isActive = tourType === type;

        let activeBg = 'hover:bg-white/5';
        let activeText = 'text-neutral-400 font-medium';

        if (isActive) {
          if (type === 'gold') {
            activeBg = 'bg-yellow-500/10';
            activeText = 'text-[#D9AC36] font-bold';
          } else if (type === 'silver') {
            activeBg = 'bg-white/10';
            activeText = 'text-white font-bold';
          } else if (type === 'bronze') {
            activeBg = 'bg-orange-400/20';
            activeText = 'text-orange-400 font-bold';
          }
        }

        return (
          <button
            key={type}
            className={`flex flex-col items-center justify-center flex-1 h-[30px] rounded-md transition-colors ${activeBg}`}
            onClick={() => onTourTypeChange(type)}
          >
            <span className={`text-[11px] ${activeText} leading-none mb-[2px]`}>
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </span>
            <span
              className="text-white/50 text-[9px] font-normal leading-none"
              style={{ marginTop: '1px' }}
            >
              {stageConfig[type]} {stageConfig[type] === 1 ? 'day' : 'days'}
            </span>
          </button>
        );
      })}
    </div>
  );

  const renderLocationBox = () => (
    <div className="w-full relative mt-3 mb-2 shrink-0 z-10">
      <div
        className="w-full h-6 bg-black rounded-md border border-neutral-500 flex items-center px-[5px] cursor-pointer"
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
      >
        <img
          src="/images/location-pin.svg"
          alt="Location"
          className="w-[11px] h-[11px] ml-1 mr-[6px] opacity-80"
        />
        <span className="text-zinc-500 text-[10px] font-normal pb-px">
          {selectedCity}
        </span>
        <img
          src="/images/arrow-down.svg"
          alt="Dropdown"
          className={`w-[12px] h-[12px] absolute right-[10px] opacity-80 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
        />
      </div>

      {isDropdownOpen && (
        <div className="absolute top-[27px] left-0 w-full bg-black border border-neutral-500 rounded-md overflow-hidden shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
          {citiesList.map(city => (
            <div
              key={city}
              className="px-3 py-[5px] text-zinc-400 text-[10px] font-normal hover:bg-teal-900/50 hover:text-white cursor-pointer transition-colors"
              onClick={e => {
                e.stopPropagation();
                if (onCityChange) onCityChange(city);
                setIsDropdownOpen(false);
              }}
            >
              {city}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderStageCards = () => (
    <div className="flex flex-col gap-[5px] overflow-y-auto scrollbar-hide pb-1 h-full min-h-[90px]">
      {Array.from({ length: numStages }).map((_, idx) => {
        const stats = getStageStats(idx, numStages);
        if (!stats) return null;

        let barColor = 'bg-slate-500';
        if (idx === 0) barColor = 'bg-[#5CA2A4]';
        else if (idx === 1) barColor = 'bg-slate-500';
        else barColor = 'bg-slate-600';

        return (
          <div
            key={idx}
            className="w-full relative bg-[#02181B] rounded-[8px] border border-cyan-900 cursor-pointer transition-colors hover:bg-slate-900 shrink-0"
            style={{ height: '100px' }}
            onClick={() => {
              if (onStageSelect) onStageSelect(idx + 1);
              if (window.innerWidth < 768) setIsMobileExpanded(false);
            }}
          >
            {/* Colored side bar */}
            <div
              className={`absolute left-0 top-0 bottom-0 w-[9px] rounded-l-sm ${barColor}`}
            />

            {/* Stage Name */}
            <div className="absolute left-[21px] top-[8px] text-teal-400 text-[11px] font-bold uppercase tracking-wide">
              {stats.name}
            </div>

            {/* Points row */}
            <div className="absolute left-[21px] top-[24px] text-white text-[10px] font-normal">
              {stats.start}
            </div>
            <svg
              className="absolute left-[62px] top-[27px] w-[9px] h-[9px] text-teal-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2.5"
                d="M14 5l7 7m0 0l-7 7m7-7H3"
              ></path>
            </svg>
            <div className="absolute left-[80px] top-[24px] text-white text-[10px] font-normal">
              {stats.end}
            </div>

            {/* Dividers */}
            <div className="absolute left-[10px] right-[10px] top-[44px] h-px bg-cyan-950" />
            <div className="absolute left-[10px] right-[10px] top-[72px] h-px bg-cyan-950" />
            <div className="absolute left-[118px] top-[44px] w-px h-[50px] bg-cyan-950" />

            {/* Row 1: distance + ascent */}
            <img
              src="/images/header-distance.svg"
              alt="dist"
              className="absolute left-[28px] top-[51px] w-3 h-3"
            />
            <div className="absolute left-[48px] top-[52px] text-slate-400 text-[10px] font-semibold">
              {stats.distance.toFixed(1)} km
            </div>

            <img
              src="/images/header-arrow-up.svg"
              alt="asc"
              className="absolute left-[134px] top-[51px] w-3 h-3"
            />
            <div className="absolute left-[152px] top-[52px] text-slate-400 text-[10px] font-semibold">
              {Math.round(stats.ascent)} m
            </div>

            {/* Row 2: min ele + max ele */}
            <img
              src="/images/header-arrow-down.svg"
              alt="desc"
              className="absolute left-[28px] top-[79px] w-3 h-3"
            />
            <div className="absolute left-[48px] top-[80px] text-slate-400 text-[10px] font-semibold">
              {Math.round(Number(stats.minEle))} m
            </div>

            <img
              src="/images/header-mountain.svg"
              alt="maxEle"
              className="absolute left-[134px] top-[79px] w-3 h-3 opacity-90"
            />
            <div className="absolute left-[152px] top-[80px] text-slate-400 text-[10px] font-semibold">
              {Math.round(Number(stats.maxEle || stats.descent))} m
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      {/* --- DESKTOP VIEW --- */}
      <div className="hidden md:flex w-[236px] bg-teal-950 rounded-xl shadow-lg border border-cyan-950/50 p-[10px] font-['Roboto'] flex-col shrink-0 mb-3 max-h-[520px] relative pointer-events-auto">
        <div className="pl-[2px] mt-[3px] mb-[5px]">
          <div className="text-teal-400 text-[12px] font-bold leading-none mb-1 uppercase flex justify-between items-center pr-1">
            <span>{t('tourStages', 'TOUR STAGES')}</span>
            <img
              src="/images/arrow-down.svg"
              alt="Collapse"
              className="w-[12px] h-[12px] rotate-180 opacity-80"
            />
          </div>
          <div className="text-white text-[10px] font-normal mt-[7px] mb-[4px]">
            {t('difficultyLevel', 'Difficulty Level')}
          </div>
        </div>
        {renderTabs()}
        {renderLocationBox()}
        {renderStageCards()}
      </div>

      {/* --- MOBILE VIEW --- */}
      <div className="md:hidden">
        {/* Unexpanded Bottom Bar */}
        {!isMobileExpanded && (
          <div
            onClick={() => setIsMobileExpanded(true)}
            className="fixed bottom-0 left-0 right-0 h-[88px] pb-4 bg-[#0a1f26] border-t border-[#1d4450] shadow-[0px_-2px_7px_0px_rgba(0,0,0,0.25)] flex items-center justify-between px-5 z-70 cursor-pointer"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-6">
              <span className="text-[#00cccc] text-sm font-bold font-['Roboto']">
                TOUR STAGES
              </span>
            </div>
            <span className="text-white text-xs sm:text-sm font-normal font-['Roboto'] mt-1 sm:mt-0">
              Difficulty Level
            </span>

            <div className="flex items-center gap-3">
              <div
                className={`flex flex-col items-center justify-center w-[68px] h-[38px] rounded-lg ${tourType === 'gold'
                  ? 'bg-[#3b3a2c]'
                  : tourType === 'silver'
                    ? 'bg-[#1e2a30]'
                    : 'bg-[#3b2a22]'
                  }`}
              >
                <span
                  className={`text-sm leading-none font-bold mb-[2px] ${tourType === 'gold' ? 'text-[#eab308]' : tourType === 'silver' ? 'text-white' : 'text-orange-400'}`}
                >
                  {tourType.charAt(0).toUpperCase() + tourType.slice(1)}
                </span>
                <span className="text-[10px] text-gray-400 leading-none">
                  {stageConfig[tourType]}{' '}
                  {stageConfig[tourType] === 1 ? 'day' : 'days'}
                </span>
              </div>
              <img
                src="/images/difficult-arrow.svg"
                className="w-[10px] h-[6px] rotate-180 opacity-80"
                alt="Expand"
              />
            </div>
          </div>
        )}

        {/* Expanded Modal Overlay */}
        {isMobileExpanded && (
          <div className="fixed inset-0 z-100 bg-black/50 flex flex-col justify-end">
            {/* Click outside to close */}
            <div
              className="flex-1 w-full"
              onClick={() => setIsMobileExpanded(false)}
            ></div>

            {/* Modal Content */}
            <div className="w-full bg-teal-950 rounded-t-[20px] shadow-[0px_2px_7px_0px_rgba(0,0,0,0.25)] border-t border-cyan-950 p-[15px] font-['Roboto'] flex flex-col pointer-events-auto min-h-[10vh]">
              {/* Header and Close */}
              <div className="flex justify-between items-start mb-[6px] pl-1 relative">
                <div className="flex flex-col">
                  <div className="text-teal-400 text-base font-bold uppercase mb-1">
                    {t('tourStages', 'TOUR STAGES')}
                  </div>
                  <div className="text-white text-xs font-normal mt-[9px]">
                    {t('difficultyLevel', 'Difficulty Level')}
                  </div>
                </div>
                <button
                  onClick={() => setIsMobileExpanded(false)}
                  className="pr-1 pt-1 opacity-80 hover:opacity-100"
                >
                  <svg
                    className="w-5 h-5 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2.5"
                      d="M6 18L18 6M6 6l12 12"
                    ></path>
                  </svg>
                </button>
              </div>

              {renderTabs()}
              {renderLocationBox()}
              {renderStageCards()}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function indexToCity(index: number) {
  const cities = ['Point A', 'Point B', 'Point C', 'Point D'];
  return cities[index] || `Point ${index + 1}`;
}
