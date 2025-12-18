import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { gpxApi, routesApi, type Route } from '../../api';

interface GpxDownloadModalProps {
  routeId: number;
  onClose: () => void;
}

type TourType = 'gold' | 'silver' | 'bronze';

interface StartPoint {
  name: string;
  count: number;
}

// Generate GPX XML content from route coordinates
function generateGpxContent(
  routeName: string,
  coordinates: [number, number][],
  stageNumber: number,
  tourType: string
): string {
  const timestamp = new Date().toISOString();

  const trackPoints = coordinates
    .map(([lng, lat]) => `      <trkpt lat="${lat}" lon="${lng}"></trkpt>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Harterbrocken Map" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${routeName} - ${tourType.toUpperCase()} Stage ${stageNumber}</name>
    <time>${timestamp}</time>
  </metadata>
  <trk>
    <name>${routeName} - Stage ${stageNumber}</name>
    <type>${tourType}</type>
    <trkseg>
${trackPoints}
    </trkseg>
  </trk>
</gpx>`;
}

// Download GPX file
function downloadGpx(content: string, filename: string) {
  const blob = new Blob([content], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function GpxDownloadModal({
  routeId,
  onClose,
}: GpxDownloadModalProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState<1 | 2>(1);
  const [startPoints, setStartPoints] = useState<StartPoint[]>([]);
  const [selectedStartPoint, setSelectedStartPoint] = useState<string | null>(
    null
  );
  const [selectedTourType, setSelectedTourType] = useState<TourType | null>(
    null
  );
  const [gpxFiles, setGpxFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingStartPoints, setLoadingStartPoints] = useState(true);
  const [route, setRoute] = useState<Route | null>(null);
  const [downloading, setDownloading] = useState<number | null>(null);

  // Load route data and start points on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load route data for GPX generation
        const routeResult = await routesApi.getById(routeId);
        if (routeResult.success) {
          setRoute(routeResult.route);
        }

        // Load start points
        const result = await gpxApi.getStartPoints(routeId);
        if (result.success && result.data.length > 0) {
          setStartPoints(result.data);
          if (result.data.length === 1) {
            setSelectedStartPoint(result.data[0].name);
            setStep(2);
          }
        } else {
          setStep(2);
        }
      } catch (error) {
        console.error('Failed to load data:', error);
        setStep(2);
      } finally {
        setLoadingStartPoints(false);
      }
    };
    loadData();
  }, [routeId]);

  const tourTypeInfo: Record<
    TourType,
    { stages: number; color: string; labelKey: string }
  > = {
    gold: { stages: 1, color: '#FFD700', labelKey: 'goldLabel' },
    silver: { stages: 2, color: '#C0C0C0', labelKey: 'silverLabel' },
    bronze: { stages: 3, color: '#CD7F32', labelKey: 'bronzeLabel' },
  };

  const handleStartPointSelect = (name: string) => {
    setSelectedStartPoint(name);
    setStep(2);
  };

  const handleTourTypeSelect = async (type: TourType) => {
    setSelectedTourType(type);
    setLoading(true);

    try {
      const result = await gpxApi.getByRoute(
        routeId,
        type,
        selectedStartPoint || undefined
      );
      if (result.success && result.data[type]) {
        setGpxFiles(result.data[type]);
      } else {
        const stages = tourTypeInfo[type].stages;
        setGpxFiles(
          Array.from({ length: stages }, (_, i) => ({
            stage_number: i + 1,
            tour_type: type,
            id: null,
          }))
        );
      }
    } catch (error) {
      console.error('Failed to load GPX files:', error);
      const stages = tourTypeInfo[type].stages;
      setGpxFiles(
        Array.from({ length: stages }, (_, i) => ({
          stage_number: i + 1,
          tour_type: type,
          id: null,
        }))
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (file: any) => {
    setDownloading(file.stage_number);

    try {
      if (file.id) {
        // Download from server
        gpxApi.download(file.id);
      } else if (route) {
        // Generate GPX from route geometry
        const coordinates =
          route.routeGeometry && route.routeGeometry.length > 0
            ? route.routeGeometry
            : [route.startPoint, ...route.waypoints, route.endPoint];

        const numStages = tourTypeInfo[selectedTourType!].stages;
        const pointsPerStage = Math.ceil(coordinates.length / numStages);
        const startIdx = (file.stage_number - 1) * pointsPerStage;
        const endIdx =
          file.stage_number === numStages
            ? coordinates.length // Last stage gets remaining points
            : file.stage_number * pointsPerStage;
        const stageCoordinates = coordinates.slice(startIdx, endIdx);

        console.log(
          `[GPX] Downloading Stage ${file.stage_number}/${numStages}: points ${startIdx}-${endIdx} of ${coordinates.length}`
        );

        const gpxContent = generateGpxContent(
          route.name || `Route ${routeId}`,
          stageCoordinates as [number, number][],
          file.stage_number,
          file.tour_type
        );

        const filename = `${(route.name || 'route').replace(/\s+/g, '_')}_${
          file.tour_type
        }_stage${file.stage_number}.gpx`;
        downloadGpx(gpxContent, filename);
      }
    } catch (error) {
      console.error('Download failed:', error);
      alert(t('downloadFailed'));
    } finally {
      setDownloading(null);
    }
  };

  const handleBack = () => {
    if (step === 2 && startPoints.length > 1) {
      setStep(1);
      setSelectedTourType(null);
      setGpxFiles([]);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[1000] p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#0b1215] border border-[#1e2a33] rounded-xl w-full max-w-md p-6"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="flex items-center gap-2 text-[#088d95] text-lg font-semibold mb-4">
          <i className="fas fa-download"></i>
          {t('downloadGPX')}
        </h3>

        {/* Loading State */}
        {loadingStartPoints && (
          <div className="text-center py-8 text-gray-400">
            <i className="fas fa-spinner fa-spin text-2xl text-[#088d95]"></i>
          </div>
        )}

        {/* Step 1: Start Point Selection */}
        {!loadingStartPoints && step === 1 && startPoints.length > 1 && (
          <>
            <p className="text-gray-400 text-sm mb-5">
              {t('selectStartPoint')}
            </p>
            <div className="space-y-3 mb-5">
              {startPoints.map(sp => (
                <div
                  key={sp.name}
                  className={`flex items-center gap-4 p-4 border rounded-lg cursor-pointer transition-all ${
                    selectedStartPoint === sp.name
                      ? 'border-[#088d95] bg-[#088d95]/10'
                      : 'border-[#1e2a33] hover:border-[#088d95]/50'
                  }`}
                  onClick={() => handleStartPointSelect(sp.name)}
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[#088d95] text-white">
                    <i className="fas fa-map-marker-alt"></i>
                  </div>
                  <div>
                    <div className="font-semibold text-white">{sp.name}</div>
                    <div className="text-sm text-gray-400">
                      {sp.count} {t('filesAvailable')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Step 2: Tour Type Selection */}
        {!loadingStartPoints && step === 2 && (
          <>
            {startPoints.length > 1 && (
              <button
                onClick={handleBack}
                className="flex items-center gap-1 text-[#088d95] text-sm mb-3 hover:text-[#0da6ae] transition-all"
              >
                <i className="fas fa-arrow-left"></i>
                {selectedStartPoint}
              </button>
            )}

            <p className="text-gray-400 text-sm mb-5">{t('selectTourType')}</p>

            <div className="space-y-3 mb-5">
              {(Object.keys(tourTypeInfo) as TourType[]).map(type => (
                <div
                  key={type}
                  className={`flex items-center gap-4 p-4 border rounded-lg cursor-pointer transition-all ${
                    selectedTourType === type
                      ? 'border-[#088d95] bg-[#088d95]/10'
                      : 'border-[#1e2a33] hover:border-[#088d95]/50'
                  }`}
                  onClick={() => handleTourTypeSelect(type)}
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-black"
                    style={{ background: tourTypeInfo[type].color }}
                  >
                    {tourTypeInfo[type].stages}
                  </div>
                  <div>
                    <div className="font-semibold text-white capitalize">
                      {t(type)}
                    </div>
                    <div className="text-sm text-gray-400">
                      {t(tourTypeInfo[type].labelKey)}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {selectedTourType && !loading && (
              <div className="bg-[#080e11] rounded-lg p-4 mb-5">
                <div className="text-[#088d95] font-semibold mb-3">
                  {t('stages')}:
                </div>
                <div className="space-y-2">
                  {gpxFiles.map((file, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between py-2 border-b border-[#1e2a33] last:border-0"
                    >
                      <div className="flex items-center gap-2 text-white">
                        <i className="fas fa-file text-[#088d95]"></i>
                        {t('stage')} {file.stage_number}
                        {file.id && (
                          <span className="text-xs text-green-500 ml-1">
                            <i className="fas fa-check-circle"></i>
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => handleDownload(file)}
                        disabled={downloading === file.stage_number}
                        className="px-3 py-1.5 bg-[#088d95] hover:bg-[#0da6ae] text-white text-sm rounded-lg transition-all disabled:opacity-50"
                      >
                        {downloading === file.stage_number ? (
                          <i className="fas fa-spinner fa-spin"></i>
                        ) : (
                          <i className="fas fa-download"></i>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {loading && (
              <div className="text-center py-8 text-gray-400">
                <i className="fas fa-spinner fa-spin text-2xl text-[#088d95]"></i>
              </div>
            )}
          </>
        )}

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-4 py-2 border border-[#1e2a33] text-gray-400 hover:text-white hover:border-[#088d95] rounded-lg transition-all"
          >
            <i className="fas fa-times"></i>
            {t('cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
