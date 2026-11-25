// Boundary: Quản lý bệnh cây (kịch bản 2.2.5.4, biểu đồ 2.3.2.4).
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Autocomplete, Avatar, Button, Chip, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DataState, PaginationBar } from '../components/DataState';
import { ListToolbar } from '../components/ListToolbar';
import { useNotice } from '../components/Notice';
import { PageHeading } from '../components/PageHeading';
import { usePagedList } from '../components/usePagedList';
import { diseaseController } from '../controllers';
import type { DiseaseRecord } from '../entities/DiseaseRepository';
import type { SpeciesOption } from '../entities/SpeciesRepository';
import type { PageRequest } from '../entities/types';
import { MSG, messageOf } from '../utils/messages';
import { DiseaseDetailDialog } from './diseases/DiseaseDetailDialog';
import { DiseaseFormDialog } from './diseases/DiseaseFormDialog';

type DeleteStep = { record: DiseaseRecord; step: 'confirm' | 'labelWarning' };

export function DiseaseManagementView() {
  const load = useCallback((request: PageRequest) => diseaseController.getAllDiseases(request), []);
  const list = usePagedList(load);
  const notify = useNotice();
  const [speciesOptions, setSpeciesOptions] = useState<SpeciesOption[]>([]);
  const [counts, setCounts] = useState<Record<string, number | null>>({});
  const [viewing, setViewing] = useState<DiseaseRecord>();
  const [editing, setEditing] = useState<DiseaseRecord | null>();
  const [deleting, setDeleting] = useState<DeleteStep>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    diseaseController.getSpeciesList().then(setSpeciesOptions).catch((e) => notify(messageOf(e), 'error'));
  }, [notify]);

  // countDiagnosesByDisease cho các dòng trên trang hiện tại.
  useEffect(() => {
    let active = true;
    const ids = list.items.map((r) => r.id);
    if (ids.length) void diseaseController.countDiagnosesByDisease(ids).then((c) => { if (active) setCounts(c); });
    return () => { active = false; };
  }, [list.items]);

  const names = useMemo(() => new Map(speciesOptions.map((o) => [o.id, o.commonName])), [speciesOptions]);
  const speciesName = (id: string) => names.get(id) ?? `${id} (không còn trong danh mục)`;
  const count = (id: string) => (id in counts ? counts[id] ?? '—' : '…');
  const filterValue = speciesOptions.find((o) => o.id === list.filter) ?? null;

  /** Bước 15–18: xác nhận xóa → nếu bệnh có mã nhãn AI thì cảnh báo thêm (18a) → deleteDisease. */
  async function confirmDelete() {
    if (!deleting) return;
    if (deleting.step === 'confirm' && deleting.record.data.aiLabel) {
      setDeleting({ ...deleting, step: 'labelWarning' });
      return;
    }
    setBusy(true);
    try {
      notify(await diseaseController.deleteDisease(deleting.record.id));
      list.reload();
    } catch (e) {
      notify(messageOf(e, 'UPDATE_FAILED'), 'error');
    } finally {
      setBusy(false);
      setDeleting(undefined);
    }
  }

  return (
    <>
      <PageHeading
        eyebrow="DANH MỤC"
        title="Quản lý bệnh cây"
        actions={<Button variant="contained" onClick={() => setEditing(null)}>Thêm mới</Button>}
      />
      <Paper elevation={0} className="data-panel">
        <ListToolbar label="Tìm theo tên bệnh (tiền tố, không phân biệt dấu)" onSearch={list.applySearch} onReload={list.reload} disabled={list.loading}>
          <Autocomplete
            size="small"
            sx={{ minWidth: 240 }}
            options={speciesOptions}
            value={filterValue}
            getOptionLabel={(o) => o.commonName}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            onChange={(_, value) => list.applyFilter(value?.id ?? '')}
            renderInput={(params) => <TextField {...params} label="Loài cây bị ảnh hưởng" />}
          />
        </ListToolbar>
        <DataState loading={list.loading} error={list.error} empty={list.items.length === 0} emptyText="Chưa có bệnh cây phù hợp.">
          <div className="table-wrap">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Ảnh</TableCell>
                  <TableCell>Tên bệnh</TableCell>
                  <TableCell>Mã nhãn AI</TableCell>
                  <TableCell>Loài cây thường mắc</TableCell>
                  <TableCell align="right">Lượt chẩn đoán</TableCell>
                  <TableCell align="right">Thao tác</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {list.items.map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell><Avatar variant="rounded" src={r.data.imageUrl} alt={r.data.nameVi} /></TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{r.data.nameVi}</TableCell>
                    <TableCell><code>{r.data.aiLabel}</code></TableCell>
                    <TableCell>
                      <Stack direction="row" gap={0.5} flexWrap="wrap">
                        {(r.data.affectedSpeciesIds ?? []).map((id) => <Chip key={id} size="small" label={speciesName(id)} />)}
                      </Stack>
                    </TableCell>
                    <TableCell align="right">{count(r.id)}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button size="small" onClick={() => setViewing(r)}>Xem chi tiết</Button>
                        <Button size="small" onClick={() => setEditing(r)}>Chỉnh sửa</Button>
                        <Button size="small" color="error" onClick={() => setDeleting({ record: r, step: 'confirm' })}>Xóa</Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DataState>
        <PaginationBar page={list.pageNumber} hasPrevious={list.hasPrevious} hasNext={list.hasNext} disabled={list.loading} onPrevious={list.previous} onNext={list.next} />
      </Paper>
      {viewing && (
        <DiseaseDetailDialog record={viewing} diagnosisCount={counts[viewing.id] ?? null} speciesName={speciesName} onClose={() => setViewing(undefined)} />
      )}
      {editing !== undefined && (
        <DiseaseFormDialog
          record={editing}
          speciesOptions={speciesOptions}
          onClose={() => setEditing(undefined)}
          onSaved={(message) => { setEditing(undefined); notify(message); list.reload(); }}
        />
      )}
      {deleting?.step === 'confirm' && (
        <ConfirmDialog title="Xóa bệnh cây" confirmLabel="Xóa" danger busy={busy} onConfirm={() => void confirmDelete()} onCancel={() => setDeleting(undefined)}>
          <Typography>{MSG.CONFIRM_DELETE_DISEASE}</Typography>
          <Typography fontWeight={600} mt={1}>{deleting.record.data.nameVi}</Typography>
        </ConfirmDialog>
      )}
      {deleting?.step === 'labelWarning' && (
        <ConfirmDialog title="Cảnh báo" confirmLabel="Vẫn xóa" danger busy={busy} onConfirm={() => void confirmDelete()} onCancel={() => setDeleting(undefined)}>
          <Alert severity="warning">{MSG.DISEASE_LABEL_WARNING}</Alert>
          <Typography variant="body2" mt={1}>Mã nhãn: <code>{deleting.record.data.aiLabel}</code></Typography>
        </ConfirmDialog>
      )}
    </>
  );
}
