import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { AdminLayout } from './AdminLayout';
import { LoginPage } from './LoginPage';
import { ProtectedRoute } from './ProtectedRoute';

// Tải trang theo yêu cầu: Recharts chỉ nạp khi mở trang Thống kê.
const StatisticView = lazy(() => import('../pages/StatisticView').then((m) => ({ default: m.StatisticView })));
const AccountManagementView = lazy(() => import('../pages/AccountManagementView').then((m) => ({ default: m.AccountManagementView })));
const SpeciesManagementView = lazy(() => import('../pages/SpeciesManagementView').then((m) => ({ default: m.SpeciesManagementView })));
const DiseaseManagementView = lazy(() => import('../pages/DiseaseManagementView').then((m) => ({ default: m.DiseaseManagementView })));

const loading = <Box p={5} textAlign="center"><CircularProgress aria-label="Đang tải" /></Box>;

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
        <Route path="/statistics" element={<Suspense fallback={loading}><StatisticView /></Suspense>} />
        <Route path="/accounts" element={<Suspense fallback={loading}><AccountManagementView /></Suspense>} />
        <Route path="/species" element={<Suspense fallback={loading}><SpeciesManagementView /></Suspense>} />
        <Route path="/diseases" element={<Suspense fallback={loading}><DiseaseManagementView /></Suspense>} />
      </Route>
      <Route path="*" element={<Navigate to="/statistics" replace />} />
    </Routes>
  );
}
