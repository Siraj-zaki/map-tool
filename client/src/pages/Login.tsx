import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api';

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await authApi.login(username, password);
      if (result.success) {
        navigate('/admin');
      } else {
        setError(t('invalidCredentials'));
      }
    } catch {
      setError(t('invalidCredentials'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0b1215] p-4">
      {/* Login Card */}
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img
            src="/images/ms-logo.png"
            alt="MountainSquad"
            className="h-16 mx-auto mb-4"
            onError={e => {
              e.currentTarget.style.display = 'none';
            }}
          />
          <h1 className="text-2xl font-bold text-white">{t('adminLogin')}</h1>
          <p className="text-gray-400 mt-2">{t('loginSubtitle')}</p>
        </div>

        {/* Form Card */}
        <div className="bg-[#080e11] border border-[#1e2a33] rounded-xl p-8">
          <form onSubmit={handleSubmit}>
            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-3 px-4 py-3 mb-6 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                <i className="fas fa-exclamation-circle"></i>
                {error}
              </div>
            )}

            {/* Username */}
            <div className="mb-5">
              <label className="block text-gray-400 text-sm mb-2">
                {t('username')}
              </label>
              <div className="relative">
                <i className="fas fa-user absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"></i>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-[#0b1215] border border-[#1e2a33] rounded-lg text-white placeholder-gray-500 focus:border-[#088d95] focus:outline-none transition-all"
                  placeholder="admin"
                  required
                  autoFocus
                />
              </div>
            </div>

            {/* Password */}
            <div className="mb-6">
              <label className="block text-gray-400 text-sm mb-2">
                {t('password')}
              </label>
              <div className="relative">
                <i className="fas fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"></i>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-[#0b1215] border border-[#1e2a33] rounded-lg text-white placeholder-gray-500 focus:border-[#088d95] focus:outline-none transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-3.5 bg-[#088d95] hover:bg-[#0da6ae] text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i>
                  {t('loading')}
                </>
              ) : (
                <>
                  <i className="fas fa-sign-in-alt"></i>
                  {t('login')}
                </>
              )}
            </button>
          </form>

          {/* Demo Credentials */}
          <div className="mt-6 pt-6 border-t border-[#1e2a33]">
            <p className="text-gray-500 text-xs text-center">
              {t('demoCredentials')}:{' '}
              <span className="text-gray-400">admin / admin123</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
