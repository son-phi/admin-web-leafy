import { Avatar, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { THRESHOLD_ROWS } from '../../components/ThresholdFields';
import type { SpeciesRecord } from '../../entities/SpeciesRepository';
import { LIGHT_LABELS } from './speciesDraft';

function Item({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{value === '' ? '—' : value}</Typography>
    </div>
  );
}

/** Xem chi tiết loài cây (bước 9–10), chỉ đọc, có bảng ngưỡng. */
export function SpeciesDetailDialog({ record, plantCount, onClose }: { record: SpeciesRecord; plantCount: number | null; onClose: () => void }) {
  const s = record.data;
  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{s.commonName}</DialogTitle>
      <DialogContent dividers>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} mb={3}>
          <Avatar variant="rounded" src={s.imageUrl} alt={s.commonName} sx={{ width: 120, height: 120 }} />
          <Stack spacing={1.5}>
            <Item label="Tên khoa học" value={s.scientificName} />
            <Item label="Mã nhãn trong mô hình AI" value={s.aiLabel} />
            <Item label="Nhu cầu ánh sáng" value={s.lightNeed ? LIGHT_LABELS[s.lightNeed] : ''} />
            <Item label="Số cây người dùng đang trồng" value={plantCount ?? '—'} />
          </Stack>
        </Stack>
        <Stack spacing={1.5} mb={3}>
          <Item label="Mô tả" value={s.description} />
          <Item label="Chu kỳ tưới gợi ý" value={`${s.wateringCycleDays} ngày`} />
          <Item label="Chu kỳ bón phân gợi ý" value={`${s.fertilizingCycleDays} ngày`} />
        </Stack>
        <Typography fontWeight={700} mb={1}>Ngưỡng môi trường</Typography>
        <Table size="small">
          <TableHead><TableRow><TableCell>Chỉ số</TableCell><TableCell>Tối thiểu</TableCell><TableCell>Tối đa</TableCell></TableRow></TableHead>
          <TableBody>
            {THRESHOLD_ROWS.map((row) => (
              <TableRow key={row.min}>
                <TableCell>{row.label} ({row.unit})</TableCell>
                <TableCell>{s.threshold?.[row.min] ?? '—'}</TableCell>
                <TableCell>{s.threshold?.[row.max] ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Đóng</Button></DialogActions>
    </Dialog>
  );
}
