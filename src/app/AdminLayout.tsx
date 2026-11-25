import { NavLink, Outlet } from 'react-router-dom';
import { Alert, Button, Chip, Stack } from '@mui/material';
import { authService } from '../controllers';
import { environment } from '../services/environment';
import { useSession } from './SessionContext';

/** Đúng 4 mục chức năng theo ADMIN_SPEC mục 8 – F0. */
const NAV = [
  { to: '/statistics', label: 'Thống kê' },
  { to: '/accounts', label: 'Quản lý tài khoản' },
  { to: '/species', label: 'Quản lý loài cây' },
  { to: '/diseases', label: 'Quản lý bệnh cây' },
];

export function AdminLayout() {
  const { session } = useSession();
  return (
    <div className="shell">
      <aside>
        <div className="brand">❧ Leafy<span>KHÔNG GIAN QUẢN TRỊ</span></div>
        <nav>
          {NAV.map((item) => <NavLink key={item.to} to={item.to}>{item.label}</NavLink>)}
        </nav>
        <div className="sidebar-note">Chăm chút dữ liệu.<br />Nuôi dưỡng trải nghiệm.</div>
      </aside>
      <div className="workspace">
        <header>
          <span>Leafy / Quản trị</span>
          <Stack direction="row" spacing={2} alignItems="center">
            <Chip color={environment.kind === 'production' ? 'error' : 'success'} label={environment.kind.toUpperCase()} size="small" />
            <span className="account" title={session?.email}>{session?.displayName}</span>
            <Button onClick={() => void authService.logout()}>Đăng xuất</Button>
          </Stack>
        </header>
        <main>
          {environment.kind === 'mock' && (
            <Alert severity="info" sx={{ mb: 3 }}>Dữ liệu minh họa được lưu trên trình duyệt. Không có kết nối Firebase.</Alert>
          )}
          <Outlet />
        </main>
      </div>
    </div>
  );
}
