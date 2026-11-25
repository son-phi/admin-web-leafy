import { useState } from 'react';
import {
  Alert, Autocomplete, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography,
} from '@mui/material';
import type { Disease } from '../../../shared/catalog';
import { ImageUpload } from '../../components/ImageUpload';
import { diseaseController } from '../../controllers';
import type { DiseaseRecord } from '../../entities/DiseaseRepository';
import type { SpeciesOption } from '../../entities/SpeciesRepository';
import { MSG, messageOf } from '../../utils/messages';
import { ValidationError } from '../../utils/validation';

type Draft = Omit<Record<keyof Disease, string>, 'affectedSpeciesIds'> & { affectedSpeciesIds: string[] };
type TextKey = Exclude<keyof Draft, 'affectedSpeciesIds'>;

const text = (v: unknown) => (v === undefined || v === null ? '' : String(v));

function toDraft(d?: Disease): Draft {
  return {
    nameVi: text(d?.nameVi), scientificName: text(d?.scientificName), aiLabel: text(d?.aiLabel),
    imageUrl: text(d?.imageUrl), imagePath: text(d?.imagePath), affectedSpeciesIds: d?.affectedSpeciesIds ?? [],
    causes: text(d?.causes), symptoms: text(d?.symptoms), treatmentMild: text(d?.treatmentMild),
    treatmentModerate: text(d?.treatmentModerate), treatmentSevere: text(d?.treatmentSevere), prevention: text(d?.prevention),
  };
}

/** Trường không bắt buộc để trống thì lưu null (đúng lược đồ). */
const fromDraft = (d: Draft): Record<string, unknown> => ({
  ...d,
  scientificName: d.scientificName.trim() || null,
  prevention: d.prevention.trim() || null,
});

type Props = {
  record: DiseaseRecord | null;
  speciesOptions: SpeciesOption[];
  onClose: () => void;
  onSaved: (message: string) => void;
};

/** Biểu mẫu thêm/sửa bệnh cây (kịch bản 2.2.5.4 bước 5). */
export function DiseaseFormDialog({ record, speciesOptions, onClose, onSaved }: Props) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(record?.data));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const field = (key: TextKey, label: string, opts: { required?: boolean; multiline?: boolean } = {}) => (
    <TextField
      label={label}
      required={opts.required ?? true}
      multiline={opts.multiline}
      minRows={opts.multiline ? 3 : undefined}
      disabled={busy}
      value={draft[key]}
      error={Boolean(fieldErrors[key])}
      helperText={fieldErrors[key]}
      onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
    />
  );

  async function submit() {
    setBusy(true);
    setError('');
    setFieldErrors({});
    try {
      const raw = fromDraft(draft);
      if (record) await diseaseController.updateDisease(record.id, raw, record.fingerprint, file);
      else await diseaseController.addDisease(raw, file);
      onSaved(record ? MSG.UPDATED : MSG.DISEASE_ADDED);
    } catch (e) {
      if (e instanceof ValidationError) setFieldErrors(e.fields);
      setError(messageOf(e, 'UPDATE_FAILED'));
    } finally {
      setBusy(false);
    }
  }

  const selected = speciesOptions.filter((o) => draft.affectedSpeciesIds.includes(o.id));

  return (
    <Dialog open onClose={() => !busy && onClose()} maxWidth="md" fullWidth>
      <form onSubmit={(e) => { e.preventDefault(); void submit(); }} noValidate>
        <DialogTitle>{record ? 'Chỉnh sửa bệnh cây' : 'Thêm bệnh cây'}</DialogTitle>
        <DialogContent dividers>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Typography className="form-group-title">Thông tin chung</Typography>
          <div className="fields">
            {field('nameVi', 'Tên bệnh (tiếng Việt)')}
            {field('scientificName', 'Tên khoa học', { required: false })}
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
          <Autocomplete
            multiple
            sx={{ mt: 3 }}
            options={speciesOptions}
            value={selected}
            disabled={busy}
            getOptionLabel={(o) => o.commonName}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            onChange={(_, value) => setDraft((d) => ({ ...d, affectedSpeciesIds: value.map((v) => v.id) }))}
            renderInput={(params) => (
              <TextField
                {...params}
                required
                label="Loài cây thường mắc"
                error={Boolean(fieldErrors.affectedSpeciesIds)}
                helperText={fieldErrors.affectedSpeciesIds}
              />
            )}
          />
          <Typography className="form-group-title">Nhận biết</Typography>
          <div className="fields">
            {field('causes', 'Nguyên nhân', { multiline: true })}
            {field('symptoms', 'Triệu chứng nhận biết trên lá', { multiline: true })}
          </div>
          <Typography className="form-group-title">Hướng xử lý</Typography>
          <div className="fields fields-3">
            {field('treatmentMild', 'Mức độ nhẹ', { multiline: true })}
            {field('treatmentModerate', 'Mức độ trung bình', { multiline: true })}
            {field('treatmentSevere', 'Mức độ nặng', { multiline: true })}
          </div>
          <div className="fields" style={{ marginTop: 24 }}>
            {field('prevention', 'Biện pháp phòng ngừa', { required: false, multiline: true })}
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={busy}>Hủy</Button>
          <Button type="submit" variant="contained" disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu'}</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
