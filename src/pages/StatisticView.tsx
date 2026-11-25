// Boundary: Xem thống kê (kịch bản 2.2.5.1, biểu đồ 2.3.2.1).
import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, CircularProgress, MenuItem, Paper, Stack, Tab, Table, TableBody, TableCell, TableHead, TableRow, Tabs, TextField, Typography,
} from '@mui/material';
import { ChartCard, SimpleBars, StackedBars, TrendLine, TwoPartPie } from '../components/charts';
import { PageHeading } from '../components/PageHeading';
import { StatCard } from '../components/StatCard';
import { statisticController } from '../controllers';
import type { Overview, StatType, Statistic } from '../controllers/StatisticController';
import { RANGE_LABELS, addDays, resolveRange, startOfDay, toDateInput, type DateRange, type RangeOption } from '../utils/dateRange';
import { MSG, messageOf } from '../utils/messages';
import { formatDate } from '../utils/normalize';

const TYPES: { value: StatType; label: string }[] = [
  { value: 'users', label: 'Người dùng' },
  { value: 'plants', label: 'Cây trồng' },
  { value: 'devices', label: 'Thiết bị IoT' },
];

/** Bảng số liệu theo mốc thời gian (đi kèm mỗi biểu đồ đường/cột). */
function SeriesTable({ rows, columns }: { rows: Record<string, string | number>[]; columns: { key: string; label: string }[] }) {
  return (
    <div className="series-table">
      <Table size="small" stickyHeader>
        <TableHead><TableRow>{columns.map((c, i) => <TableCell key={c.key} align={i ? 'right' : 'left'}>{c.label}</TableCell>)}</TableRow></TableHead>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={String(r[columns[0].key])}>
              {columns.map((c, i) => <TableCell key={c.key} align={i ? 'right' : 'left'}>{r[c.key]}</TableCell>)}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function UsersSection({ stat }: { stat: Extract<Statistic, { type: 'users' }> }) {
  return (
    <div className="chart-grid">
      <ChartCard title="Người dùng đăng ký mới" subtitle="Theo khoảng thời gian đã chọn">
        <TrendLine data={stat.series} dataKey="newUsers" name="Đăng ký mới" />
        <SeriesTable rows={stat.series} columns={[{ key: 'label', label: 'Mốc' }, { key: 'newUsers', label: 'Đăng ký mới' }]} />
      </ChartCard>
      <ChartCard title="Trạng thái tài khoản" subtitle="Hiện tại">
        <div className="status-tiles">
          <div><Typography color="text.secondary">Đang hoạt động</Typography><strong>{stat.active}</strong></div>
          <div><Typography color="text.secondary">Bị khóa</Typography><strong>{stat.locked}</strong></div>
        </div>
      </ChartCard>
    </div>
  );
}

function PlantsSection({ stat }: { stat: Extract<Statistic, { type: 'plants' }> }) {
  return (
    <div className="chart-grid">
      <ChartCard title="Cây trồng tạo mới" subtitle="Theo khoảng thời gian đã chọn">
        <TrendLine data={stat.series} dataKey="newPlants" name="Cây tạo mới" />
        <SeriesTable rows={stat.series} columns={[{ key: 'label', label: 'Mốc' }, { key: 'newPlants', label: 'Cây tạo mới' }]} />
      </ChartCard>
      <ChartCard title="Số cây theo loài" subtitle="Tổng hiện tại">
        <SimpleBars data={stat.bySpecies} xKey="name" dataKey="count" name="Số cây" />
        <Typography fontWeight={600} mt={2} mb={1}>Top 5 loài được trồng nhiều nhất</Typography>
        <SeriesTable rows={stat.top5.map((s, i) => ({ rank: i + 1, name: s.name, count: s.count }))} columns={[{ key: 'rank', label: '#' }, { key: 'name', label: 'Loài cây' }, { key: 'count', label: 'Số cây' }]} />
      </ChartCard>
    </div>
  );
}

function DevicesSection({ stat }: { stat: Extract<Statistic, { type: 'devices' }> }) {
  return (
    <div className="chart-grid">
      <ChartCard title="Thiết bị đăng ký mới" subtitle="Theo khoảng thời gian đã chọn">
        <TrendLine data={stat.series} dataKey="newDevices" name="Đăng ký mới" />
        <SeriesTable rows={stat.series} columns={[{ key: 'label', label: 'Mốc' }, { key: 'newDevices', label: 'Đăng ký mới' }]} />
      </ChartCard>
      <ChartCard title="Trực tuyến / ngoại tuyến" subtitle="Hiện tại (trực tuyến: gửi dữ liệu trong 5 phút gần nhất)">
        <TwoPartPie parts={[{ name: 'Trực tuyến', value: stat.online }, { name: 'Ngoại tuyến', value: stat.offline }]} />
      </ChartCard>
      <ChartCard title="Lượt tưới tự động / thủ công" subtitle="Theo khoảng thời gian đã chọn">
        <StackedBars data={stat.series} keys={[{ key: 'auto', name: 'Tự động (AUTO)' }, { key: 'manual', name: 'Thủ công (MANUAL)' }]} />
        <SeriesTable rows={stat.series} columns={[{ key: 'label', label: 'Mốc' }, { key: 'auto', label: 'AUTO' }, { key: 'manual', label: 'MANUAL' }]} />
      </ChartCard>
      <ChartCard title="Thiết bị mất kết nối hơn 24 giờ" subtitle="Lâu nhất trước, tối đa 20">
        {stat.disconnected.length === 0 ? <Typography color="text.secondary">Không có thiết bị nào.</Typography> : (
          <SeriesTable
            rows={stat.disconnected.map((d) => ({ id: d.id, name: d.name, lastSeen: formatDate(d.lastSeen, true) }))}
            columns={[{ key: 'id', label: 'Mã thiết bị' }, { key: 'name', label: 'Tên' }, { key: 'lastSeen', label: 'Lần cuối kết nối' }]}
          />
        )}
      </ChartCard>
    </div>
  );
}

export function StatisticView() {
  const [overview, setOverview] = useState<Overview>();
  const [overviewError, setOverviewError] = useState('');
  const [type, setType] = useState<StatType>('users');
  const [option, setOption] = useState<RangeOption>('30d');
  const today = startOfDay(new Date());
  const [from, setFrom] = useState(toDateInput(addDays(today, -13)));
  const [to, setTo] = useState(toDateInput(today));
  const [range, setRange] = useState<DateRange>(() => resolveRange('30d', new Date()));
  const [rangeError, setRangeError] = useState('');
  const [stat, setStat] = useState<Statistic>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    setOverviewError('');
    statisticController.getOverview()
      .then((v) => { if (active) setOverview(v); })
      .catch((e) => { if (active) setOverviewError(messageOf(e)); });
    return () => { active = false; };
  }, [version]);

  // Bước 5–7: đổi loại thống kê / khoảng thời gian → tải lại.
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    statisticController.getStatistic(type, range)
      .then((s) => { if (active) setStat(s); })
      .catch((e) => { if (active) { setStat(undefined); setError(messageOf(e)); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [type, range, version]);

  const apply = useCallback((next: RangeOption, f = from, t = to) => {
    try {
      setRange(resolveRange(next, new Date(), f, t));
      setRangeError('');
    } catch (e) {
      setRangeError(messageOf(e)); // 4a INVALID_RANGE
    }
  }, [from, to]);

  return (
    <>
      <PageHeading
        eyebrow="TỔNG QUAN HỆ THỐNG"
        title="Thống kê"
        description="Số liệu đếm bằng truy vấn tổng hợp, không tải toàn bộ dữ liệu."
        actions={<Button onClick={() => setVersion((v) => v + 1)}>Tải lại</Button>}
      />
      {overviewError ? <Alert severity="error" sx={{ mb: 3 }}>{overviewError}</Alert> : !overview ? (
        <Box p={3}><CircularProgress aria-label="Đang tải" /></Box>
      ) : (
        <div className="stats stats-5">
          <StatCard label="Tổng số người dùng" value={overview.users} to="/accounts" />
          <StatCard label="Đăng ký mới trong tháng" value={overview.newUsersThisMonth} />
          <StatCard label="Tổng số cây trồng" value={overview.plants} />
          <StatCard label="Thiết bị IoT đã đăng ký" value={overview.devices} />
          <StatCard label="Thiết bị đang trực tuyến" value={overview.online} />
        </div>
      )}

      <Paper elevation={0} className="data-panel" sx={{ mt: 3 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={2} mb={2}>
          <Tabs value={type} onChange={(_, v: StatType) => setType(v)} aria-label="Loại thống kê">
            {TYPES.map((t) => <Tab key={t.value} value={t.value} label={t.label} />)}
          </Tabs>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
            <TextField
              select size="small" label="Khoảng thời gian" value={option} sx={{ minWidth: 190 }}
              onChange={(e) => { const v = e.target.value as RangeOption; setOption(v); if (v !== 'custom') apply(v); }}
            >
              {(Object.keys(RANGE_LABELS) as RangeOption[]).map((k) => <MenuItem key={k} value={k}>{RANGE_LABELS[k]}</MenuItem>)}
            </TextField>
            {option === 'custom' && (
              <>
                <TextField size="small" type="date" label="Từ ngày" value={from} onChange={(e) => setFrom(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
                <TextField size="small" type="date" label="Đến ngày" value={to} onChange={(e) => setTo(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
                <Button variant="outlined" onClick={() => apply('custom')}>Áp dụng</Button>
              </>
            )}
          </Stack>
        </Stack>
        <Typography variant="body2" color="text.secondary" mb={2}>
          {formatDate(range.start)} – {formatDate(addDays(range.end, -1))} · nhóm theo {range.granularity === 'day' ? 'ngày' : 'tháng'}
        </Typography>

        {rangeError && <Alert severity="warning" sx={{ mb: 2 }}>{rangeError}</Alert>}
        {error && <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" onClick={() => setVersion((v) => v + 1)}>Thử lại</Button>}>{error}</Alert>}
        {loading && <Box p={5} textAlign="center"><CircularProgress aria-label="Đang tải" /></Box>}
        {!loading && stat && (
          <>
            {stat.empty && <Alert severity="info" sx={{ mb: 2 }}>{MSG.NO_DATA_RANGE}</Alert>}
            {stat.type === 'users' && <UsersSection stat={stat} />}
            {stat.type === 'plants' && <PlantsSection stat={stat} />}
            {stat.type === 'devices' && <DevicesSection stat={stat} />}
          </>
        )}
      </Paper>
    </>
  );
}
