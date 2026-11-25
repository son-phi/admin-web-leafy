import { useEffect, useMemo, useRef } from 'react';
import { Avatar, Box, Button, FormHelperText, Stack, Typography } from '@mui/material';
import { IMAGE_TYPES } from '../../shared/catalog';

type Props = {
  label: string;
  /** Ảnh hiện có (khi sửa). */
  currentUrl: string;
  file: File | null;
  error?: string;
  disabled?: boolean;
  onChange: (file: File | null) => void;
};

/** Chọn ảnh minh họa: xem trước, chỉ jpg/png/webp ≤ 5 MB (kiểm tra lại khi lưu và ở Storage Rules). */
export function ImageUpload({ label, currentUrl, file, error, disabled, onChange }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : currentUrl), [file, currentUrl]);
  useEffect(() => () => { if (file) URL.revokeObjectURL(preview); }, [file, preview]);

  return (
    <Box>
      <Typography variant="body2" color={error ? 'error' : 'text.secondary'} mb={1}>{label} *</Typography>
      <Stack direction="row" spacing={2} alignItems="center">
        <Avatar variant="rounded" src={preview || undefined} alt={label} sx={{ width: 72, height: 72, bgcolor: '#e6efe8' }} />
        <Stack spacing={0.5} alignItems="flex-start">
          <Button variant="outlined" size="small" disabled={disabled} onClick={() => input.current?.click()}>
            {preview ? 'Đổi ảnh' : 'Chọn ảnh'}
          </Button>
          <Typography variant="caption" color="text.secondary">{file ? file.name : 'JPG, PNG hoặc WEBP, tối đa 5 MB'}</Typography>
        </Stack>
      </Stack>
      {error && <FormHelperText error>{error}</FormHelperText>}
      <input
        ref={input}
        hidden
        type="file"
        accept={IMAGE_TYPES.join(',')}
        onChange={(e) => { onChange(e.target.files?.[0] ?? null); e.target.value = ''; }}
      />
    </Box>
  );
}
