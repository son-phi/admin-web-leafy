import { useState, type ReactNode } from 'react';
import { Button, Stack, TextField } from '@mui/material';

type Props = {
  label: string;
  onSearch: (value: string) => void;
  onReload: () => void;
  disabled?: boolean;
  children?: ReactNode;
};

/** Ô tìm kiếm + nút Tìm/Tải lại, phần tử bổ sung (bộ lọc) đặt qua children. */
export function ListToolbar({ label, onSearch, onReload, disabled, children }: Props) {
  const [value, setValue] = useState('');
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSearch(value); }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} mb={2}>
        <TextField size="small" fullWidth label={label} value={value} onChange={(e) => setValue(e.target.value)} />
        {children}
        <Stack direction="row" spacing={1}>
          <Button type="submit" variant="outlined" disabled={disabled}>Tìm</Button>
          <Button onClick={onReload} disabled={disabled}>Tải lại</Button>
        </Stack>
      </Stack>
    </form>
  );
}
