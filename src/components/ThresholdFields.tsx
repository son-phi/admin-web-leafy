import { Box, TextField, Typography } from '@mui/material';
import type { Threshold } from '../../shared/catalog';

export const THRESHOLD_ROWS: { label: string; unit: string; min: keyof Threshold; max: keyof Threshold }[] = [
  { label: 'Độ ẩm đất', unit: '%', min: 'soilMoistureMin', max: 'soilMoistureMax' },
  { label: 'Nhiệt độ', unit: '°C', min: 'temperatureMin', max: 'temperatureMax' },
  { label: 'Độ ẩm không khí', unit: '%', min: 'airHumidityMin', max: 'airHumidityMax' },
  { label: 'Cường độ ánh sáng', unit: 'lux', min: 'lightMin', max: 'lightMax' },
];

export type ThresholdDraft = Record<keyof Threshold, string>;

type Props = {
  values: ThresholdDraft;
  errors: Record<string, string>;
  disabled?: boolean;
  onChange: (key: keyof Threshold, value: string) => void;
};

/** Ngưỡng môi trường – 4 cặp tối thiểu/tối đa (kịch bản 2.2.5.3 bước 5). */
export function ThresholdFields({ values, errors, disabled, onChange }: Props) {
  return (
    <Box className="threshold-grid">
      {THRESHOLD_ROWS.map((row) => (
        <Box key={row.min} className="threshold-row">
          <Typography fontWeight={600}>{row.label} ({row.unit})</Typography>
          {([['Tối thiểu', row.min], ['Tối đa', row.max]] as const).map(([label, key]) => (
            <TextField
              key={key}
              size="small"
              type="number"
              label={label}
              required
              disabled={disabled}
              value={values[key]}
              error={Boolean(errors[`threshold.${key}`])}
              helperText={errors[`threshold.${key}`]}
              onChange={(e) => onChange(key, e.target.value)}
            />
          ))}
        </Box>
      ))}
    </Box>
  );
}
