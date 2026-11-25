import { useState } from 'react';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField, Typography,
} from '@mui/material';
import { ImageUpload } from '../../components/ImageUpload';
import { ThresholdFields } from '../../components/ThresholdFields';
import { speciesController } from '../../controllers';
import type { SpeciesRecord } from '../../entities/SpeciesRepository';
import { MSG, messageOf } from '../../utils/messages';
import { ValidationError } from '../../utils/validation';
import { LIGHT_LABELS, LIGHT_NEEDS, fromDraft, toDraft, type SpeciesDraft } from './speciesDraft';

type Props = {
  /** null = thêm mới; bản ghi = chỉnh sửa (điền sẵn). */
  record: SpeciesRecord | null;
  onClose: () => void;
  onSaved: (message: string) => void;
};

type TextKey = Exclude<keyof SpeciesDraft, 'threshold' | 'lightNeed'>;

/** Biểu mẫu dùng chung thêm/sửa loài cây (kịch bản 2.2.5.3 bước 5). */
export function SpeciesFormDialog({ record, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState<SpeciesDraft>(() => toDraft(record?.data));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const set = (key: keyof SpeciesDraft, value: string) => setDraft((d) => ({ ...d, [key]: value }));
  const field = (key: TextKey, label: string, extra: { multiline?: boolean; type?: string; required?: boolean } = {}) => (
    <TextField
      label={label}
      required={extra.required ?? true}
      type={extra.type}
      multiline={extra.multiline}
      minRows={extra.multiline ? 3 : undefined}
      disabled={busy}
      value={draft[key]}
      error={Boolean(fieldErrors[key])}
      helperText={fieldErrors[key]}
      onChange={(e) => set(key, e.target.value)}
    />
  );

  async function submit() {
    setBusy(true);
    setError('');
    setFieldErrors({});
    try {
      const raw = fromDraft(draft);
      if (record) await speciesController.updateSpecies(record.id, raw, record.fingerprint, file);
      else await speciesController.addSpecies(raw, file);
      onSaved(record ? MSG.UPDATED : MSG.SPECIES_ADDED);
    } catch (e) {
      if (e instanceof ValidationError) setFieldErrors(e.fields);
      setError(messageOf(e, 'UPDATE_FAILED'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onClose={() => !busy && onClose()} maxWidth="md" fullWidth>
      <form onSubmit={(e) => { e.preventDefault(); void submit(); }} noValidate>
        <DialogTitle>{record ? 'Chỉnh sửa loài cây' : 'Thêm loài cây'}</DialogTitle>
        <DialogContent dividers>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Typography className="form-group-title">Thông tin chung</Typography>
          <div className="fields">
            {field('commonName', 'Tên thông thường')}
            {field('scientificName', 'Tên khoa học')}
            {field('aiLabel', 'Mã nhãn trong mô hình AI')}
          </div>
          <Box mt={3}>
            <ImageUpload
              label="Ảnh minh họa"
              currentUrl={draft.imageUrl}
              file={file}
              disabled={busy}
              error={fieldErrors.imageUrl}
              onChange={(f) => { setFile(f); setFieldErrors((errors) => { const next = { ...errors }; delete next.imageUrl; return next; }); }}
            />
          </Box>
          <Typography className="form-group-title">Đặc tính chăm sóc</Typography>
          <div className="fields">
            {field('description', 'Mô tả', { multiline: true })}
            <TextField
              select required label="Nhu cầu ánh sáng" disabled={busy} value={draft.lightNeed}
              error={Boolean(fieldErrors.lightNeed)} helperText={fieldErrors.lightNeed}
              onChange={(e) => set('lightNeed', e.target.value)}
            >
              {LIGHT_NEEDS.map((v) => <MenuItem key={v} value={v}>{LIGHT_LABELS[v]}</MenuItem>)}
            </TextField>
            {field('wateringCycleDays', 'Chu kỳ tưới gợi ý (ngày)', { type: 'number' })}
            {field('fertilizingCycleDays', 'Chu kỳ bón phân gợi ý (ngày)', { type: 'number' })}
          </div>
          <Typography className="form-group-title">Ngưỡng môi trường</Typography>
          <ThresholdFields
            values={draft.threshold}
            errors={fieldErrors}
            disabled={busy}
            onChange={(key, value) => setDraft((d) => ({ ...d, threshold: { ...d.threshold, [key]: value } }))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={busy}>Hủy</Button>
          <Button type="submit" variant="contained" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu'}</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
