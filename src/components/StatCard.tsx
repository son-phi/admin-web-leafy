import { Paper, Typography } from '@mui/material';
import { Link } from 'react-router-dom';

type Props = { label: string; value: number | string; to?: string; linkText?: string };

export function StatCard({ label, value, to, linkText = 'Xem danh sách' }: Props) {
  return (
    <Paper className="stat" elevation={0}>
      <Typography color="text.secondary">{label}</Typography>
      <strong>{value}</strong>
      {to && <Link to={to}>{linkText}</Link>}
    </Paper>
  );
}
