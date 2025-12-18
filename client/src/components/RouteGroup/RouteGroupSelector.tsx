import { useEffect, useState } from 'react';
import { routesApi, type Route } from '../../api';

interface RouteGroupSelectorProps {
  groupId?: number;
  onRouteSelect: (route: Route) => void;
}

export default function RouteGroupSelector({
  groupId,
  onRouteSelect,
}: RouteGroupSelectorProps) {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadRoutes = async () => {
      try {
        const result = await routesApi.getAll();
        if (result.success) {
          setRoutes(result.data);
          if (result.data.length > 0 && !selectedRouteId) {
            setSelectedRouteId(result.data[0].id);
          }
        }
      } catch (error) {
        console.error('Failed to load routes:', error);
      } finally {
        setLoading(false);
      }
    };
    loadRoutes();
  }, [groupId]);

  const handleRouteChange = async (routeId: number) => {
    setSelectedRouteId(routeId);
    try {
      const result = await routesApi.getById(routeId);
      if (result.success) {
        onRouteSelect(result.route);
      }
    } catch (error) {
      console.error('Failed to load route:', error);
    }
  };

  if (loading || routes.length === 0 || routes.length === 1) {
    return null;
  }

  return (
    <div className="flex items-center">
      <label className="mr-2 text-sm text-gray-400">Route:</label>
      <select
        value={selectedRouteId || ''}
        onChange={e => handleRouteChange(Number(e.target.value))}
        className="px-3 py-1.5 bg-[#080e11] text-white text-sm rounded-lg border border-[#1e2a33] cursor-pointer focus:border-[#088d95] focus:outline-none"
      >
        {routes.map(route => (
          <option key={route.id} value={route.id}>
            {route.name}
          </option>
        ))}
      </select>
    </div>
  );
}

// Tab-based route selector for iFrame
export function RouteGroupTabs({
  routes,
  selectedId,
  onSelect,
}: {
  routes: Route[];
  selectedId: number;
  onSelect: (id: number) => void;
}) {
  return (
    <div className="flex gap-1 bg-[#0b1215] p-1 rounded-lg">
      {routes.map(route => (
        <button
          key={route.id}
          className={`px-4 py-2 rounded-md text-sm transition-all ${
            route.id === selectedId
              ? 'bg-[#088d95] text-white'
              : 'text-gray-400 hover:text-white'
          }`}
          onClick={() => onSelect(route.id)}
        >
          {route.name}
        </button>
      ))}
    </div>
  );
}
