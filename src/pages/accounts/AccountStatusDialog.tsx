import { useState } from 'react';
import { Alert, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { LOCK_REASONS } from '../../../shared/accounts';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { accountController } from '../../controllers';
import type { UserRecord } from '../../entities/UserRepository';
import { messageOf } from '../../utils/messages';

type Props = {
  user: UserRecord;
  onDone: (message: string, status: 'active' | 'locked') => void;
  onError: (message: string) => void;
  /** "Hủy" giữ nguyên trạng thái (11a). */
  onCancel: () => void;
};

/** Xác nhận khóa / mở khóa (bước 9–13). Khóa bắt buộc chọn lý do. */
export function AccountStatusDialog({ user, onDone, onError, onCancel }: Props) {
  const locking = user.status !== 'locked';
  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function confirm() {
    if (locking && !reason) { setError('Vui lòng chọn lý do khóa'); return; }
    const fullReason = reason === 'Khác' && detail.trim() ? `Khác: ${detail.trim()}` : reason;
    setBusy(true);
    try {
      const result = await accountController.setAccountStatus(user.id, locking ? 'LOCK' : 'UNLOCK', fullReason);
      onDone(result.message, result.status);
    } catch (e) {
      onError(messageOf(e, 'UPDATE_FAILED'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConfirmDialog
      title={locking ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
      confirmLabel={locking ? 'Khóa' : 'Mở khóa'}
      danger={locking}
      busy={busy}
      onConfirm={() => void confirm()}
      onCancel={onCancel}
    >
      <Stack spacing={2}>
        <Typography>
          {locking ? 'Bạn có chắc muốn khóa tài khoản' : 'Bạn có chắc muốn mở khóa tài khoản'} <strong>{user.fullName || user.email}</strong>?
        </Typography>
        {locking && (
          <>
            <TextField
              select required label="Lý do khóa" value={reason} disabled={busy}
              error={Boolean(error)} helperText={error || 'Người dùng sẽ bị đăng xuất và không thể đăng nhập lại.'}
              onChange={(e) => { setReason(e.target.value); setError(''); }}
            >
              {LOCK_REASONS.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
            </TextField>
            {reason === 'Khác' && (
              <TextField label="Chi tiết lý do" value={detail} disabled={busy} inputProps={{ maxLength: 250 }} onChange={(e) => setDetail(e.target.value)} />
            )}
          </>
        )}
        {!locking && <Alert severity="info">Người dùng có thể đăng nhập lại sau khi mở khóa.</Alert>}
      </Stack>
    </ConfirmDialog>
  );
}
