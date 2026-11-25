// Biểu đồ dùng chung cho trang thống kê (Recharts). Màu theo palette tham chiếu đã kiểm (slot 1 xanh, slot 2 cam),
// nét mảnh, lưới mờ, tooltip khi rê chuột; mọi biểu đồ đều có bảng số liệu đi kèm để không phụ thuộc màu.
import type { ReactNode } from 'react';
import { Paper, Typography } from '@mui/material';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
  type PieLabelRenderProps,
} from 'recharts';

export const SERIES = ['#2a78d6', '#eb6834'] as const;
const GRID = '#e1e8e3';
const AXIS = { fontSize: 12, fill: '#52685d' };
const SURFACE = '#ffffff';
const TEXT = '#33473d';

export function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <Paper elevation={0} className="chart-card">
      <Typography fontWeight={700}>{title}</Typography>
      {subtitle && <Typography variant="body2" color="text.secondary">{subtitle}</Typography>}
      <div className="chart-body">{children}</div>
    </Paper>
  );
}

/** Một chuỗi theo thời gian: đường 2px, điểm đánh dấu khi ít mốc; tiêu đề thẻ gọi tên chuỗi nên không cần chú giải. */
type Rows = Record<string, unknown>[];

export function TrendLine({ data, dataKey, name }: { data: Rows; dataKey: string; name: string }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} interval="preserveStartEnd" minTickGap={16} />
        <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
        <Tooltip />
        <Line
          type="monotone" dataKey={dataKey} name={name} stroke={SERIES[0]} strokeWidth={2}
          dot={data.length <= 12 ? { r: 4, stroke: SURFACE, strokeWidth: 2, fill: SERIES[0] } : false} activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Cột đơn (vd. số cây theo loài). */
export function SimpleBars({ data, xKey, dataKey, name }: { data: Rows; xKey: string; dataKey: string; name: string }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey={xKey} tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} interval={0} />
        <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
        <Tooltip cursor={{ fill: '#f4f7f5' }} />
        <Bar dataKey={dataKey} name={name} fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={48} stroke={SURFACE} strokeWidth={2} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Cột xếp chồng 2 chuỗi (AUTO / MANUAL) – có chú giải; chỉ đoạn trên cùng bo góc, khe 2px giữa các đoạn. */
export function StackedBars({ data, keys }: { data: Rows; keys: { key: string; name: string }[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} interval="preserveStartEnd" minTickGap={16} />
        <YAxis allowDecimals={false} tick={AXIS} tickLine={false} axisLine={false} />
        <Tooltip cursor={{ fill: '#f4f7f5' }} />
        <Legend iconType="square" wrapperStyle={{ fontSize: 13 }} />
        {keys.map((k, i) => (
          <Bar
            key={k.key} dataKey={k.key} name={k.name} stackId="s" fill={SERIES[i]} maxBarSize={36}
            stroke={SURFACE} strokeWidth={2} radius={i === keys.length - 1 ? [4, 4, 0, 0] : 0}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Biểu đồ tròn 2 phần (trực tuyến / ngoại tuyến), nhãn trực tiếp kèm số. */
export function TwoPartPie({ parts }: { parts: { name: string; value: number }[] }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Tooltip />
        <Legend
          content={() => (
            <ul className="chart-legend">
              {total > 0 && parts.map((p, i) => <li key={p.name}><span style={{ background: SERIES[i] }} />{p.name}</li>)}
            </ul>
          )}
        />
        <Pie
          data={total ? parts : [{ name: 'Không có thiết bị', value: 1 }]} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} startAngle={90} endAngle={-270}
          stroke={SURFACE} strokeWidth={2} isAnimationActive={false}
          label={total ? (p: PieLabelRenderProps) => (
            <text x={p.x} y={p.y} fill={TEXT} fontSize={12} textAnchor={p.textAnchor} dominantBaseline="central">{`${p.name}: ${p.value}`}</text>
          ) : false}
        >
          {(total ? parts : [{ name: '', value: 1 }]).map((p, i) => <Cell key={p.name || i} fill={total ? SERIES[i] : GRID} />)}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}
