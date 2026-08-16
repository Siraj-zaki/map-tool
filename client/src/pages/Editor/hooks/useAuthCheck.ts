import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../../../api';

export function useAuthCheck() {
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const result = await authApi.getProfile();
        if (!result.success) navigate('/admin/login');
      } catch {
        navigate('/admin/login');
      }
    };
    checkAuth();
  }, [navigate]);
}
