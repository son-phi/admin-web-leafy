import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Alert, Button, Chip, Paper, Stack, TextField, Typography } from '@mui/material';
import { authService } from '../controllers';
import { environment } from '../services/environment';
import { messageOf } from '../utils/messages';
import { useSession } from './SessionContext';

export function LoginPage() {
  const { session, error: sessionError } = useSession();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (session) {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from && from !== '/login' ? from : '/statistics'} replace />;
  }

  async function submit() {
    setBusy(true);
    setError('');
    try {
      await authService.login(email, password);
    } catch (e) {
      setError(messageOf(e, 'LOGIN_FAILED'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <div className="login-intro">
        <div className="brand">❧ Leafy</div>
        <h1>Một nơi quản lý.<br />Nhiều mầm xanh.</h1>
        <p>Quản trị danh mục và thông tin ứng dụng Leafy.</p>
        <Chip label={environment.kind.toUpperCase()} color={environment.kind === 'production' ? 'error' : 'success'} />
      </div>
      <Paper className="login-card" elevation={0}>
        <Typography variant="h4" fontWeight={700}>Chào mừng trở lại</Typography>
        <Typography color="text.secondary" mt={1} mb={3}>Đăng nhập trang quản trị</Typography>
        {(error || sessionError) && <Alert severity="error" sx={{ mb: 2 }} role="alert">{error || sessionError}</Alert>}
        <form onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <Stack spacing={3}>
            <TextField label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
            <TextField
              label="Mật khẩu" type="password" required={environment.kind !== 'mock'} value={password}
              onChange={(e) => setPassword(e.target.value)} autoComplete="current-password"
            />
            <Button type="submit" variant="contained" size="large" disabled={busy}>{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</Button>
            {environment.kind === 'mock' && (
              <Alert severity="info">Dùng email bất kỳ, không cần mật khẩu. Dùng viewer@example.test để thử tài khoản không đủ quyền.</Alert>
            )}
          </Stack>
        </form>
      </Paper>
    </div>
  );
}
