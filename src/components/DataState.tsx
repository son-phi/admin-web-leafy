import type { ReactNode } from 'react';
import { Alert, Box, Button, CircularProgress, Stack, Typography } from '@mui/material';

type Props = {
  loading: boolean;
  error: string;
  empty: boolean;
  emptyText: string;
  children: ReactNode;
};

/** Loading / lỗi / rỗng / nội dung cho một khối dữ liệu. */
export function DataState({ loading, error, empty, emptyText, children }: Props) {
  if (loading) return <Box p={5} textAlign="center"><CircularProgress aria-label="Đang tải" /></Box>;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (empty) return <Box p={5} textAlign="center"><Typography color="text.secondary">{emptyText}</Typography></Box>;
  return <>{children}</>;
}

type PaginationProps = { page: number; hasPrevious: boolean; hasNext: boolean; disabled: boolean; onPrevious: () => void; onNext: () => void };

export function PaginationBar({ page, hasPrevious, hasNext, disabled, onPrevious, onNext }: PaginationProps) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center" mt={3}>
      <Typography variant="body2" color="text.secondary">Trang {page} · tối đa 10 bản ghi</Typography>
      <Stack direction="row">
        <Button disabled={disabled || !hasPrevious} onClick={onPrevious}>Trước</Button>
        <Button disabled={disabled || !hasNext} onClick={onNext}>Tiếp</Button>
      </Stack>
    </Stack>
  );
}
