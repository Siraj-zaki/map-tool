import { Suspense, lazy } from 'react';
import { useTranslation } from 'react-i18next';
import { Route, Routes, useLocation } from 'react-router-dom';

// Lazy load pages for better performance
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Editor = lazy(() => import('./pages/Editor'));
const EmbedView = lazy(() => import('./pages/EmbedView'));
const Login = lazy(() => import('./pages/Login'));
const PublicView = lazy(() => import('./pages/PublicView'));

// Loading fallback component
function LoadingFallback() {
  return (
    <div className="h-screen flex flex-col items-center justify-center bg-[#0b1215] text-gray-400">
      <i className="fas fa-mountain text-4xl text-[#088d95] mb-4 animate-bounce"></i>
      <span className="text-sm">Loading...</span>
    </div>
  );
}

function App() {
  const { i18n } = useTranslation();
  const location = useLocation();

  // Hide language toggle on embed and public views
  const showLanguageToggle = location.pathname.startsWith('/admin');

  const toggleLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    // Persist language choice
    localStorage.setItem('i18nextLng', lang);
  };

  return (
    <>
      {/* Language toggle - only show on admin routes */}
      {showLanguageToggle && (
        <div className="fixed top-3 left-3 z-[1000] flex gap-1">
          <button
            className={`px-2 py-1 text-xs rounded border transition-all ${
              i18n.language === 'de'
                ? 'bg-[#088d95] border-[#088d95] text-white'
                : 'bg-transparent border-[#1e2a33] text-gray-400 hover:border-[#088d95]'
            }`}
            onClick={() => toggleLanguage('de')}
          >
            DE
          </button>
          <button
            className={`px-2 py-1 text-xs rounded border transition-all ${
              i18n.language === 'en'
                ? 'bg-[#088d95] border-[#088d95] text-white'
                : 'bg-transparent border-[#1e2a33] text-gray-400 hover:border-[#088d95]'
            }`}
            onClick={() => toggleLanguage('en')}
          >
            EN
          </button>
        </div>
      )}

      <Suspense fallback={<LoadingFallback />}>
        <Routes>
          {/* Public embeddable route viewer */}
          <Route path="/" element={<Dashboard />} />
          <Route path="/route/:id" element={<PublicView />} />

          {/* Minimal iFrame embed (for Shopify) */}
          <Route path="/embed" element={<EmbedView />} />

          {/* Admin routes */}
          <Route path="/admin" element={<Dashboard />} />
          <Route path="/admin/login" element={<Login />} />
          <Route path="/admin/edit" element={<Editor />} />
          <Route path="/admin/edit/:id" element={<Editor />} />
        </Routes>
      </Suspense>
    </>
  );
}

export default App;
