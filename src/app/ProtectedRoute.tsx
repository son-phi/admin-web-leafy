import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { useSession } from './SessionContext';

/**
 * Chặn mọi trang quản trị khi chưa đăng nhập bằng tài khoản admin: đẩy về /login và nhớ trang định vào.
 * Chỉ phục vụ giao diện – quyền thật do Security Rules và Cloud Functions kiểm tra.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useSession();
  const location = useLocation();
  if (loading) return <Box p={6}><CircularProgress aria-label="Kiểm tra đăng nhập" /></Box>;
  if (!session?.admin) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}
