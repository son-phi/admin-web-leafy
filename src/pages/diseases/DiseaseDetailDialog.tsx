import { Avatar, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material';
import type { DiseaseRecord } from '../../entities/DiseaseRepository';

function Item({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{value || '—'}</Typography>
    </div>
  );
}

/** Chi tiết bệnh cây (bước 9–10): triệu chứng, hướng xử lý từng mức. */
type Props = { record: DiseaseRecord; diagnosisCount: number | null; speciesName: (id: string) => string; onClose: () => void };

export function DiseaseDetailDialog({ record, diagnosisCount, speciesName, onClose }: Props) {
  const d = record.data;
  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{d.nameVi}</DialogTitle>
      <DialogContent dividers>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} mb={3}>
          <Avatar variant="rounded" src={d.imageUrl} alt={d.nameVi} sx={{ width: 120, height: 120 }} />
          <Stack spacing={1.5}>
            <Item label="Tên khoa học" value={d.scientificName} />
            <Item label="Mã nhãn trong mô hình AI" value={d.aiLabel} />
            <Item label="Số lượt được chẩn đoán" value={diagnosisCount === null ? null : String(diagnosisCount)} />
            <div>
              <Typography variant="body2" color="text.secondary">Loài cây thường mắc</Typography>
              <Stack direction="row" gap={1} flexWrap="wrap" mt={0.5}>
                {(d.affectedSpeciesIds ?? []).map((id) => <Chip key={id} size="small" label={speciesName(id)} />)}
              </Stack>
            </div>
          </Stack>
        </Stack>
        <Stack spacing={1.5}>
          <Item label="Nguyên nhân" value={d.causes} />
          <Item label="Triệu chứng nhận biết trên lá" value={d.symptoms} />
          <Item label="Hướng xử lý – mức độ nhẹ" value={d.treatmentMild} />
          <Item label="Hướng xử lý – mức độ trung bình" value={d.treatmentModerate} />
          <Item label="Hướng xử lý – mức độ nặng" value={d.treatmentSevere} />
          <Item label="Biện pháp phòng ngừa" value={d.prevention} />
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Đóng</Button></DialogActions>
    </Dialog>
  );
}
