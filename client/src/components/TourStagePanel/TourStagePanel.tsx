import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { Route, RouteLocation, SplitPoint } from '../../api';
import { splitPointsApi, locationsApi } from '../../api';
import './TourStagePanel.css';

type TourType = 'gold' | 'silver' | 'bronze';

interface TourStagePanelProps {
  route: Route | null;
  tourType: TourType;
  onTourTypeChange: (type: TourType) => void;
  selectedStage?: number | null;
  onStageSelect?: (stage: number | null) => void;
  selectedLocationId?: number | null;
  onLocationChange?: (locationId: number | null) => void;
  // Optional external split points (from parent component like EmbedView/PublicView)
  externalSplitPoints?: {
    gold: SplitPoint[];
    silver: SplitPoint[];
    bronze: SplitPoint[];
  } | null;
}

// Stage count is dynamically derived

export default function TourStagePanel({
  route,
  tourType,
  onTourTypeChange,
  onStageSelect,
  selectedLocationId = null,
  onLocationChange,
  externalSplitPoints,
}: TourStagePanelProps) {
  const { t } = useTranslation();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [locations, setLocations] = useState<RouteLocation[]>([]);
  const [fetchedSplitPoints, setFetchedSplitPoints] = useState<Record<TourType, SplitPoint[]>>({
    gold: [],
    silver: [],
    bronze: [],
  });
  
  // Use external split points if provided, otherwise use fetched ones
  const splitPoints = externalSplitPoints || fetchedSplitPoints;
  
  // Log which source we're using
  useEffect(() => {
    if (externalSplitPoints) {
      console.log('[TourStagePanel] ✅ USING EXTERNAL SPLIT POINTS FROM PARENT:', {
        gold: externalSplitPoints.gold?.length || 0,
        silver: externalSplitPoints.silver?.length || 0,
        bronze: externalSplitPoints.bronze?.length || 0,
        currentTourType: tourType,
        currentTourPoints: externalSplitPoints[tourType]?.map(p => ({
          stage: p.stageNumber,
          name: p.locationName,
          distanceKm: p.distanceKm
        }))
      });
    } else {
      console.log('[TourStagePanel] 🔄 Using self-fetched split points:', {
        gold: fetchedSplitPoints.gold?.length || 0,
        silver: fetchedSplitPoints.silver?.length || 0,
        bronze: fetchedSplitPoints.bronze?.length || 0
      });
    }
  }, [externalSplitPoints, fetchedSplitPoints, tourType]);

  // Fetch locations for this route
  useEffect(() => {
    if (route?.id) {
      locationsApi.getByRoute(route.id).then(res => {
        if (res.success && res.data) {
          setLocations(res.data);
        }
      }).catch(console.error);
    }
  }, [route?.id]);

  // Fetch split points when location changes (only if external split points not provided)
  useEffect(() => {
    if (route?.id && !externalSplitPoints) {
      const startLocation = selectedLocationId ? undefined : 'Route Start';
      const locationId = selectedLocationId || undefined;
      
      console.log('[TourStagePanel] Fetching split points:', { routeId: route.id, startLocation, locationId });
      
      splitPointsApi.getByRoute(route.id, startLocation, locationId).then(res => {
        if (res.success && res.splitPoints) {
          console.log('[TourStagePanel] Received split points:', res.splitPoints);
          setFetchedSplitPoints({
            gold: res.splitPoints.gold || [],
            silver: res.splitPoints.silver || [],
            bronze: res.splitPoints.bronze || [],
          });
        }
      }).catch(console.error);
    }
  }, [route?.id, selectedLocationId, externalSplitPoints]);

  const selectedLocation = locations.find(l => l.id === selectedLocationId);
  const hasLocations = locations.length > 0;

  // Calculate stats for a specific stage based on actual split point distances
  const getStageStats = (stageIndex: number, totalStages: number) => {
    if (!route) return null;
    
    const points = splitPoints[tourType] || [];
    const totalDistance = parseFloat(String(route.distance || 0));
    const totalAscent = parseFloat(String(route.totalAscent || 0));
    const totalDescent = parseFloat(String(route.totalDescent || 0));
    
    // Sort points by distance to ensure correct ordering
    const sortedPoints = [...points].sort((a, b) => a.distanceKm - b.distanceKm);
    
    // Calculate stage start and end distances
    const stageStartDistance = stageIndex === 0 ? 0 : sortedPoints[stageIndex - 1]?.distanceKm || 0;
    const stageEndDistance = stageIndex === totalStages - 1 
      ? totalDistance 
      : sortedPoints[stageIndex]?.distanceKm || totalDistance;
    
    // Calculate actual stage distance
    const dist = Math.max(0, stageEndDistance - stageStartDistance);
    
    // Calculate elevation stats for this stage using elevation data
    let asc = 0;
    let desc = 0;
    let minEle = route.lowestPoint || 0;
    let maxEle = route.highestPoint || 0;
    
    if (route.elevationData && route.elevationData.length > 0) {
      const elevationData = route.elevationData;
      
      // Find indices that fall within this stage's distance range
      const startIdx = elevationData.findIndex((p, i) => {
        const prevDist = i > 0 ? elevationData[i - 1].distance : 0;
        return p.distance >= stageStartDistance || prevDist >= stageStartDistance;
      });
      
      const endIdx = elevationData.findIndex(p => p.distance >= stageEndDistance);
      const effectiveEndIdx = endIdx === -1 ? elevationData.length - 1 : endIdx;
      const effectiveStartIdx = startIdx === -1 ? 0 : startIdx;
      
      // Calculate elevation gain/loss for this stage
      if (effectiveStartIdx < effectiveEndIdx) {
        let stageMin = elevationData[effectiveStartIdx].elevation;
        let stageMax = elevationData[effectiveStartIdx].elevation;
        
        for (let i = effectiveStartIdx + 1; i <= effectiveEndIdx; i++) {
          const prevEle = elevationData[i - 1].elevation;
          const currEle = elevationData[i].elevation;
          const diff = currEle - prevEle;
          
          if (diff > 0) {
            asc += diff;
          } else {
            desc += Math.abs(diff);
          }
          
          if (currEle < stageMin) stageMin = currEle;
          if (currEle > stageMax) stageMax = currEle;
        }
        
        minEle = stageMin;
        maxEle = stageMax;
      }
    } else {
      // Fallback: distribute ascent/descent proportionally by distance
      const distanceRatio = totalDistance > 0 ? dist / totalDistance : 0;
      asc = totalAscent * distanceRatio;
      desc = totalDescent * distanceRatio;
    }

    // Use split point locations if available
    const prevPoint = stageIndex === 0 
      ? (selectedLocation?.name || t('start', 'Start')) 
      : (sortedPoints[stageIndex - 1]?.locationName || `Point ${stageIndex}`);
    const endPoint = stageIndex === totalStages - 1 
      ? t('end', 'End') 
      : (sortedPoints[stageIndex]?.locationName || `Point ${stageIndex + 1}`);

    return {
      name: `${t('stage', 'STAGE')} ${stageIndex + 1}`,
      start: prevPoint,
      end: endPoint,
      distance: dist,
      ascent: asc,
      descent: desc,
      minEle,
      maxEle,
    };
  };

  const numStages = (splitPoints[tourType]?.length || 0) + 1;

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
              {t(type, type)}
            </span>
            <span
              className="text-white/50 text-[9px] font-normal leading-none"
              style={{ marginTop: '1px' }}
            >
              {(splitPoints[type]?.length || 0) + 1} {((splitPoints[type]?.length || 0) + 1) === 1 ? t('day', 'day') : t('days', 'days')}
            </span>
          </button>
        );
      })}
    </div>
  );

  const renderLocationBox = () => {
    if (!hasLocations) return null;

    return (
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
          <span className="text-zinc-500 text-[10px] font-normal pb-px truncate">
            {selectedLocation?.name || t('routeStart', 'Route Start')}
          </span>
          <img
            src="/images/arrow-down.svg"
            alt="Dropdown"
            className={`w-[12px] h-[12px] absolute right-[10px] opacity-80 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
          />
        </div>

        {isDropdownOpen && (
          <div className="absolute top-[27px] left-0 w-full bg-black border border-neutral-500 rounded-md overflow-hidden shadow-[0_4px_12px_rgba(0,0,0,0.5)] max-h-40 overflow-y-auto">
            {/* Default Route Start option */}
            <div
              className="px-3 py-[5px] text-zinc-400 text-[10px] font-normal hover:bg-teal-900/50 hover:text-white cursor-pointer transition-colors"
              onClick={e => {
                e.stopPropagation();
                onLocationChange?.(null);
                setIsDropdownOpen(false);
              }}
            >
              Route Start
            </div>
            {/* Location options */}
            {locations.map(loc => (
              <div
                key={loc.id}
                className="px-3 py-[5px] text-zinc-400 text-[10px] font-normal hover:bg-teal-900/50 hover:text-white cursor-pointer transition-colors"
                onClick={e => {
                  e.stopPropagation();
                  onLocationChange?.(loc.id);
                  setIsDropdownOpen(false);
                }}
              >
                {loc.name}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderStageCards = () => (
    <div className="flex flex-col gap-[5px] overflow-y-auto scrollbar-hide pb-1 h-full min-h-[90px] mt-[10px]">
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
      <div className={`hidden md:flex w-[236px] bg-teal-950 rounded-xl shadow-lg border border-cyan-950/50 p-[10px] font-['Roboto'] flex-col shrink-0 mb-3 relative pointer-events-auto transition-all duration-300 ${isCollapsed ? 'max-h-[50px]' : 'max-h-[calc(100vh-320px)]'}`}>
        <div className="pl-[2px] mt-[3px] mb-[5px]">
          <div className="text-teal-400 text-[12px] font-bold leading-none mb-1 uppercase flex justify-between items-center pr-1">
            <span>{t('tourStages', 'TOUR STAGES')}</span>
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1 hover:bg-white/10 rounded transition-colors"
              title={isCollapsed ? t('expand', 'Expand') : t('collapse', 'Collapse')}
            >
              <img
                src="/images/arrow-down.svg"
                alt={isCollapsed ? t('expand', 'Expand') : t('collapse', 'Collapse')}
                className={`w-[12px] h-[12px] opacity-80 transition-transform duration-300 ${isCollapsed ? 'rotate-0' : 'rotate-180'}`}
              />
            </button>
          </div>
          {!isCollapsed && (
            <div className="text-white text-[10px] font-normal mt-[7px] mb-[4px]">
              {t('difficultyLevel', 'Difficulty Level')}
            </div>
          )}
        </div>
        {!isCollapsed && (
          <>
            {renderTabs()}
            {renderLocationBox()}
            {renderStageCards()}
          </>
        )}
      </div>

      {/* --- MOBILE VIEW --- */}
      <div className="md:hidden">
        {/* Bottom Bar - Pill Style */}
        <div className="fixed bottom-4 left-4 right-4 z-70">
          {!isMobileExpanded ? (
            /* Collapsed - Pill Button */
            <button
              onClick={() => setIsMobileExpanded(true)}
              className="w-full h-[56px] bg-[#088d95] hover:bg-[#0aa6ae] rounded-xl shadow-lg flex items-center justify-between px-4 transition-colors"
            >
              {/* Left: Tour Stages (stacked) */}
              <div className="flex flex-col items-start">
                <span className="text-white text-xs font-medium font-['Roboto'] leading-tight">
                  {t('tourStagesMobileLine1', 'Tour')}
                </span>
                <span className="text-white text-xs font-medium font-['Roboto'] leading-tight">
                  {t('tourStagesMobileLine2', 'Stages')}
                </span>
              </div>
              
              {/* Middle: Tour types with days */}
              <span className="text-white/70 text-[10px] font-normal font-['Roboto'] text-center leading-tight">
                ({t('bronzeSimple', 'Bronze')} ({(splitPoints.bronze?.length || 0) + 1} {t('days', 'Days')}), {t('silverSimple', 'Silver')} ({(splitPoints.silver?.length || 0) + 1} {t('days', 'Days')}), {t('goldSimple', 'Gold')} ({(splitPoints.gold?.length || 0) + 1} {t('day', 'Day')}))
              </span>
              
              {/* Right: Arrow */}
              <svg
                className="w-4 h-4 text-white flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 15l7-7 7 7"
                />
              </svg>
            </button>
          ) : (
            /* Expanded - Full Panel */
            <div className="w-full bg-teal-950 rounded-t-[20px] shadow-[0px_-4px_20px_rgba(0,0,0,0.5)] border-t border-cyan-950 p-[15px] font-['Roboto'] flex flex-col pointer-events-auto max-h-[80vh] overflow-hidden">
              {/* Header with Collapse Button */}
              <div className="flex justify-between items-center mb-4 pb-3 border-b border-cyan-900/50">
                <div className="flex flex-col">
                  <span className="text-teal-400 text-lg font-bold uppercase">
                    {t('tourStages', 'TOUR STAGES')}
                  </span>
                  <span className="text-white/60 text-xs mt-1">
                    {t('difficultyLevel', 'Difficulty Level')}
                  </span>
                </div>
                <button
                  onClick={() => setIsMobileExpanded(false)}
                  className="p-2 bg-[#088d95] hover:bg-[#0aa6ae] rounded-lg transition-colors"
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
                      strokeWidth="2"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
              </div>

              <div className="overflow-y-auto">
                {renderTabs()}
                {renderLocationBox()}
                {renderStageCards()}
              </div>
            </div>
          )}
        </div>

        {/* Backdrop when expanded */}
        {isMobileExpanded && (
          <div
            className="fixed inset-0 bg-black/50 z-60"
            onClick={() => setIsMobileExpanded(false)}
          />
        )}
      </div>
    </>
  );
}
