import { useEffect, useState } from 'react';
import {
  Alert, Avatar, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography,
} from '@mui/material';
import { accountController } from '../../controllers';
import type { AccountDetail } from '../../controllers/AccountController';
import { messageOf } from '../../utils/messages';
import { formatDate } from '../../utils/normalize';

function Item({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography component="div">{value}</Typography>
    </div>
  );
}

export const StatusChip = ({ status }: { status: 'active' | 'locked' }) => (
  <Chip size="small" color={status === 'locked' ? 'error' : 'success'} label={status === 'locked' ? 'Đã khóa' : 'Đang hoạt động'} />
);

/** Chi tiết tài khoản (bước 5–8): thông tin cá nhân, thông tin sử dụng, lịch sử khóa/mở khóa. */
export function AccountDetailDialog({ uid, onClose }: { uid: string; onClose: () => void }) {
  const [detail, setDetail] = useState<AccountDetail>();
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    accountController.getAccountDetail(uid)
      .then((d) => { if (active) setDetail(d); })
      .catch((e) => { if (active) setError(messageOf(e)); });
    return () => { active = false; };
  }, [uid]);

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Chi tiết tài khoản</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error">{error}</Alert>}
        {!detail && !error && <Box p={4} textAlign="center"><CircularProgress aria-label="Đang tải" /></Box>}
        {detail && (
          <>
            <Typography className="form-group-title">Thông tin cá nhân</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3}>
              <Avatar src={detail.user.avatarUrl || undefined} alt={detail.user.fullName} sx={{ width: 72, height: 72 }}>
                {detail.user.fullName.charAt(0)}
              </Avatar>
              <div className="fields" style={{ flex: 1 }}>
                <Item label="Họ tên" value={detail.user.fullName || '—'} />
                <Item label="Email" value={detail.user.email || '—'} />
                <Item label="Ngày đăng ký" value={formatDate(detail.user.createdAt)} />
                <Item label="Lần đăng nhập gần nhất" value={formatDate(detail.lastLogin, true)} />
                <Item label="Trạng thái" value={<StatusChip status={detail.user.status} />} />
              </div>
            </Stack>

            <Typography className="form-group-title">Thông tin sử dụng</Typography>
            <div className="usage-grid">
              <Item label="Số cây" value={detail.usage.plants} />
              <Item label="Số thiết bị IoT" value={detail.usage.devices} />
              <Item label="Số lượt chẩn đoán" value={detail.usage.diagnoses} />
              <Item label="Số phiên hội thoại" value={detail.usage.chatSessions} />
            </div>

            <Typography className="form-group-title">Lịch sử khóa / mở khóa</Typography>
            {detail.history.length === 0 ? (
              <Typography color="text.secondary">Chưa có lịch sử.</Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow><TableCell>Thời gian</TableCell><TableCell>Hành động</TableCell><TableCell>Lý do</TableCell><TableCell>Quản trị viên</TableCell></TableRow>
                </TableHead>
                <TableBody>
                  {detail.history.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell>{formatDate(h.createdAt, true)}</TableCell>
                      <TableCell>{h.action === 'LOCK' ? 'Khóa' : 'Mở khóa'}</TableCell>
                      <TableCell>{h.reason || '—'}</TableCell>
                      <TableCell><code>{h.adminId}</code></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Đóng</Button></DialogActions>
    </Dialog>
  );
}
