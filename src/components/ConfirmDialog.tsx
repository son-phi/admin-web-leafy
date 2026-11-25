import type { ReactNode } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';

type Props = {
  title: string;
  children: ReactNode;
  confirmLabel?: string;
  busy?: boolean;
  danger?: boolean;
  onConfirm: () => void;
  /** "Hủy" giữ nguyên dữ liệu (ngoại lệ 17a / 11a). */
  onCancel: () => void;
};

export function ConfirmDialog({ title, children, confirmLabel = 'Xác nhận', busy, danger, onConfirm, onCancel }: Props) {
  return (
    <Dialog open onClose={() => !busy && onCancel()} maxWidth="xs" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>{children}</DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={busy}>Hủy</Button>
        <Button variant="contained" color={danger ? 'error' : 'primary'} onClick={onConfirm} disabled={busy}>
          {busy ? 'Đang xử lý…' : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
