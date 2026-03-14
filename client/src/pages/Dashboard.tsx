import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { authApi, routesApi, type Route } from '../api';
import ShareModal from '../components/Share/ShareModal';

const ROUTE_IMAGES = [
  'https://images.unsplash.com/photo-1604223190546-a43e4c7f29d7?q=80&w=1169&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1610552050890-fe99536c2615?q=80&w=1207&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1584907600887-9732fa3647ac?q=80&w=1632&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1688936020461-eb11f0ad247a?q=80&w=735&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1700507987180-b7a9610f508f?q=80&w=1631&auto=format&fit=crop',
  'https://plus.unsplash.com/premium_photo-1719933400890-2959b59e4632?q=80&w=1170&auto=format&fit=crop',
];

const getRouteImage = (routeId: number) => {
  return ROUTE_IMAGES[routeId % ROUTE_IMAGES.length];
};

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [shareRoute, setShareRoute] = useState<Route | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const result = await authApi.getProfile();
        if (result.success) {
          setIsAuthenticated(true);
        } else {
          navigate('/admin/login');
        }
      } catch {
        navigate('/admin/login');
      }
    };
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const loadRoutes = async () => {
      try {
        const result = await routesApi.getAll();
        if (result.success) {
          setRoutes(result.data);
        }
      } catch (error) {
        console.error('Failed to load routes:', error);
      } finally {
        setLoading(false);
      }
    };
    loadRoutes();
  }, [isAuthenticated]);

  const handleDelete = async (id: number) => {
    if (!confirm(t('confirmDelete'))) return;
    try {
      const result = await routesApi.delete(id);
      if (result.success) {
        setRoutes(routes.filter(r => r.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete route:', error);
    }
  };

  const handleLogout = async () => {
    await authApi.logout();
    navigate('/admin/login');
  };

  const filteredRoutes = routes.filter(
    route =>
      route.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      route.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen bg-[#0b1215]">
      {/* Sidebar */}
      <div className="w-64 mt-[30px] bg-[#080e11] border-r border-[#1e2a33] flex flex-col">
        {/* Logo */}
        <div className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#088d95] flex items-center justify-center">
              <i className="fas fa-layer-group text-white text-sm"></i>
            </div>
            <div>
              <div className="text-white font-semibold text-sm">Route Dashboard</div>
              <div className="text-gray-500 text-xs">Admin Panel</div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 space-y-1">
          <a
            href="/admin"
            className="flex items-center gap-3 px-4 py-3 bg-[#088d95] text-white rounded-xl font-medium transition-all"
          >
            <i className="fas fa-map text-sm"></i>
            <span className="text-sm">{t('routes')}</span>
          </a>
          <a
            href="/admin/edit"
            className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-[#1e2a33] rounded-xl transition-all"
          >
            <div className="w-5 h-5 rounded-full border border-gray-500 flex items-center justify-center">
              <i className="fas fa-plus text-[10px]"></i>
            </div>
            <span className="text-sm">{t('createRoute')}</span>
          </a>
          <a
            href="/admin/settings"
            className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-[#1e2a33] rounded-xl transition-all"
          >
            <i className="fas fa-cog text-sm"></i>
            <span className="text-sm">Settings</span>
          </a>
        </nav>

        {/* Logout */}
        <div className="p-4">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <i className="fas fa-sign-out-alt"></i>
            <span className="text-sm">{t('logout')}</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-8 border-b border-[#1e2a33]">
          <h1 className="text-lg font-semibold text-white">Route Management</h1>
          <button
            onClick={() => navigate('/admin/edit')}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#088d95] hover:bg-[#0da6ae] text-white text-sm font-medium rounded-xl transition-all"
          >
            <i className="fas fa-plus text-xs"></i>
            Create Route
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-8 overflow-auto">
          {/* Search */}
          <div className="mb-6">
            <div className="relative max-w-2xl">
              <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"></i>
              <input
                type="search"
                placeholder="Search for routes..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-[#080e11] border border-[#1e2a33] rounded-xl text-white placeholder-gray-500 focus:border-[#088d95] focus:outline-none transition-all"
              />
            </div>
          </div>

          {/* Routes Grid */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <i className="fas fa-spinner fa-spin text-4xl text-[#088d95] mb-4"></i>
              <span>{t('loading')}</span>
            </div>
          ) : filteredRoutes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <i className="fas fa-route text-5xl mb-4 opacity-50"></i>
              <span className="text-lg">{t('noRoutes')}</span>
              <button
                onClick={() => navigate('/admin/edit')}
                className="mt-4 px-6 py-2 bg-[#088d95] hover:bg-[#0da6ae] text-white rounded-lg transition-all"
              >
                <i className="fas fa-plus mr-2"></i>
                {t('createFirstRoute')}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredRoutes.map(route => (
                <div
                  key={route.id}
                  className="bg-[#080e11] border border-[#1e2a33] rounded-2xl overflow-hidden hover:border-[#088d95]/50 transition-all group"
                >
                  {/* Route Image */}
                  <div className="h-40 bg-[#0b1215] relative overflow-hidden">
                    <img
                      src={getRouteImage(route.id)}
                      alt={route.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        (e.target as HTMLImageElement).parentElement!.innerHTML = '<i class="fas fa-mountain text-4xl text-[#1e2a33] flex items-center justify-center h-full"></i>';
                      }}
                    />
                  </div>

                  {/* Route Info */}
                  <div className="p-5">
                    <h3 className="text-base font-semibold text-white mb-4 group-hover:text-[#088d95] transition-colors">
                      {route.name}
                    </h3>

                    {/* Stats */}
                    <div className="space-y-2 mb-5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Distance:</span>
                        <span className="text-[#088d95] font-medium">
                          {parseFloat(String(route.distance || 0)).toFixed(1)}km
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Ascent:</span>
                        <span className="text-[#088d95] font-medium">
                          {Math.round(parseFloat(String(route.totalAscent || 0)))}m
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Descent:</span>
                        <span className="text-[#088d95] font-medium">
                          {Math.round(parseFloat(String(route.totalDescent || 0)))}m
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-4 border-t border-[#1e2a33]">
                      <button
                        onClick={() => window.open(`/route/${route.id}`, '_blank')}
                        className="text-gray-400 hover:text-[#088d95] transition-colors"
                        title={t('view')}
                      >
                        <i className="fas fa-eye"></i>
                      </button>
                      <button
                        onClick={() => setShareRoute(route)}
                        className="text-gray-400 hover:text-[#088d95] transition-colors"
                        title={t('share')}
                      >
                        <i className="fas fa-share-alt"></i>
                      </button>
                      <button
                        onClick={() => navigate(`/admin/stages/${route.id}`)}
                        className="text-gray-400 hover:text-[#088d95] transition-colors"
                        title="Stages"
                      >
                        <i className="fas fa-route"></i>
                      </button>
                      <button
                        onClick={() => navigate(`/admin/edit/${route.id}`)}
                        className="text-gray-400 hover:text-[#088d95] transition-colors"
                        title={t('edit')}
                      >
                        <i className="fas fa-pen"></i>
                      </button>
                      <button
                        onClick={() => handleDelete(route.id)}
                        className="text-red-400 hover:text-red-300 transition-colors"
                        title={t('delete')}
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Share Modal */}
      {shareRoute && (
        <ShareModal
          routeId={shareRoute.id}
          routeName={shareRoute.name}
          onClose={() => setShareRoute(null)}
        />
      )}
    </div>
  );
}
