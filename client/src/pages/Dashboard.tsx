import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { authApi, routesApi, type Route } from '../api';
import ShareModal from '../components/Share/ShareModal';

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
      <div className="w-64 bg-[#080e11] mt-[30px] border-r border-[#1e2a33] p-5 flex flex-col">
        <div className="mb-8">
          <img
            src="/images/ms-logo.png"
            alt="Logo"
            className="h-10 object-contain"
            onError={e => {
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>

        <nav className="flex-1 space-y-2">
          <a
            href="/admin"
            className="flex items-center gap-3 px-4 py-3 bg-[#088d95] text-[#0b1215] rounded-lg font-medium hover:bg-[#0da6ae] transition-all"
          >
            <i className="fas fa-map-marked-alt"></i>
            {t('routes')}
          </a>
          <a
            href="/admin/edit"
            className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-[#1e2a33] rounded-lg transition-all"
          >
            <i className="fas fa-plus"></i>
            {t('createRoute')}
          </a>
        </nav>

        <button
          onClick={handleLogout}
          className="flex items-center justify-center gap-2 w-full px-4 py-3 text-gray-400 hover:text-white hover:bg-red-500/20 border border-[#1e2a33] rounded-lg transition-all"
        >
          <i className="fas fa-sign-out-alt"></i>
          {t('logout')}
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <div className="h-16 bg-[#080e11] border-b border-[#1e2a33] flex items-center px-6">
          <h2 className="flex items-center gap-3 text-xl font-semibold text-white">
            <i className="fas fa-map-marked-alt text-[#088d95]"></i>
            {t('routeManagement')}
          </h2>
          <div className="ml-auto flex items-center gap-4">
            <span className="text-gray-400 text-sm">
              {routes.length} {routes.length === 1 ? t('route') : t('routes')}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-auto">
          {/* Search and Create */}
          <div className="flex gap-4 mb-6">
            <div className="relative flex-1">
              <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"></i>
              <input
                type="search"
                placeholder={t('searchRoutes')}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-[#080e11] border border-[#1e2a33] rounded-lg text-white placeholder-gray-500 focus:border-[#088d95] focus:outline-none transition-all"
              />
            </div>
            <button
              onClick={() => navigate('/admin/edit')}
              className="flex items-center gap-2 px-6 py-3 bg-[#088d95] hover:bg-[#0da6ae] text-white font-medium rounded-lg transition-all"
            >
              <i className="fas fa-plus"></i>
              {t('createRoute')}
            </button>
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
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredRoutes.map(route => (
                <div
                  key={route.id}
                  className="bg-[#080e11] border border-[#1e2a33] rounded-xl p-5 hover:border-[#088d95]/50 transition-all group"
                >
                  {/* Route Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-white truncate group-hover:text-[#088d95] transition-colors">
                        {route.name}
                      </h3>
                      {route.description && (
                        <p className="text-gray-400 text-sm mt-1 line-clamp-2">
                          {route.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Route Stats */}
                  <div className="grid grid-cols-3 gap-3 mb-4 p-3 bg-[#0b1215] rounded-lg">
                    <div className="text-center">
                      <div className="text-xs text-gray-500 mb-1">
                        {t('distance')}
                      </div>
                      <div className="text-[#088d95] font-semibold">
                        {route.distance?.toFixed(1) || '0'} km
                      </div>
                    </div>
                    <div className="text-center border-x border-[#1e2a33]">
                      <div className="text-xs text-gray-500 mb-1">
                        {t('ascent')}
                      </div>
                      <div className="text-green-500 font-semibold">
                        ↑ {Math.round(route.totalAscent || 0)} m
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-gray-500 mb-1">
                        {t('descent')}
                      </div>
                      <div className="text-red-400 font-semibold">
                        ↓ {Math.round(route.totalDescent || 0)} m
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        window.open(`/route/${route.id}`, '_blank')
                      }
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#1e2a33] hover:bg-[#2a3a47] text-gray-300 rounded-lg transition-all"
                      title={t('view')}
                    >
                      <i className="fas fa-eye"></i>
                    </button>
                    <button
                      onClick={() => setShareRoute(route)}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#088d95] hover:bg-[#0da6ae] text-white rounded-lg transition-all"
                      title={t('share')}
                    >
                      <i className="fas fa-share-alt"></i>
                    </button>
                    <button
                      onClick={() => navigate(`/admin/edit/${route.id}`)}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[#1e2a33] hover:bg-[#2a3a47] text-gray-300 rounded-lg transition-all"
                      title={t('edit')}
                    >
                      <i className="fas fa-edit"></i>
                    </button>
                    <button
                      onClick={() => handleDelete(route.id)}
                      className="flex items-center justify-center px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-all"
                      title={t('delete')}
                    >
                      <i className="fas fa-trash"></i>
                    </button>
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
