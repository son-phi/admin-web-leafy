// Boundary: Quản lý loài cây (kịch bản 2.2.5.3, biểu đồ 2.3.2.3).
import { useCallback, useEffect, useState } from 'react';
import { Avatar, Button, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { DataState, PaginationBar } from '../components/DataState';
import { ListToolbar } from '../components/ListToolbar';
import { useNotice } from '../components/Notice';
import { PageHeading } from '../components/PageHeading';
import { usePagedList } from '../components/usePagedList';
import { speciesController } from '../controllers';
import type { SpeciesRecord } from '../entities/SpeciesRepository';
import type { PageRequest } from '../entities/types';
import { MSG, messageOf } from '../utils/messages';
import { SpeciesDetailDialog } from './species/SpeciesDetailDialog';
import { SpeciesFormDialog } from './species/SpeciesFormDialog';

export function SpeciesManagementView() {
  const load = useCallback((request: PageRequest) => speciesController.getAllSpecies(request), []);
  const list = usePagedList(load);
  const notify = useNotice();
  const [counts, setCounts] = useState<Record<string, number | null>>({});
  const [viewing, setViewing] = useState<SpeciesRecord>();
  const [editing, setEditing] = useState<SpeciesRecord | null>(); // undefined: đóng, null: thêm mới
  const [deleting, setDeleting] = useState<SpeciesRecord>();
  const [busy, setBusy] = useState(false);

  // countPlantsBySpecies cho các dòng trên trang hiện tại.
  useEffect(() => {
    let active = true;
    const ids = list.items.map((r) => r.id);
    if (ids.length) void speciesController.countPlantsBySpecies(ids).then((c) => { if (active) setCounts(c); });
    return () => { active = false; };
  }, [list.items]);

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      notify(await speciesController.deleteSpecies(deleting.id));
      list.reload();
    } catch (e) {
      notify(messageOf(e, 'UPDATE_FAILED'), 'error'); // 18a: SPECIES_IN_USE
    } finally {
      setBusy(false);
      setDeleting(undefined);
    }
  }

  const count = (id: string) => (id in counts ? counts[id] ?? '—' : '…');

  return (
    <>
      <PageHeading
        eyebrow="DANH MỤC"
        title="Quản lý loài cây"
        actions={<Button variant="contained" onClick={() => setEditing(null)}>Thêm mới</Button>}
      />
      <Paper elevation={0} className="data-panel">
        <ListToolbar
          label="Tìm theo tên thông thường hoặc tên khoa học (tiền tố, không phân biệt dấu)"
          onSearch={list.applySearch}
          onReload={list.reload}
          disabled={list.loading}
        />
        <DataState loading={list.loading} error={list.error} empty={list.items.length === 0} emptyText="Chưa có loài cây phù hợp.">
          <div className="table-wrap">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Ảnh</TableCell>
                  <TableCell>Tên thông thường</TableCell>
                  <TableCell>Tên khoa học</TableCell>
                  <TableCell align="right">Số cây đang trồng</TableCell>
                  <TableCell align="right">Thao tác</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {list.items.map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell><Avatar variant="rounded" src={r.data.imageUrl} alt={r.data.commonName} /></TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>{r.data.commonName}</TableCell>
                    <TableCell sx={{ fontStyle: 'italic' }}>{r.data.scientificName}</TableCell>
                    <TableCell align="right">{count(r.id)}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button size="small" onClick={() => setViewing(r)}>Xem chi tiết</Button>
                        <Button size="small" onClick={() => setEditing(r)}>Chỉnh sửa</Button>
                        <Button size="small" color="error" onClick={() => setDeleting(r)}>Xóa</Button>
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
      {viewing && <SpeciesDetailDialog record={viewing} plantCount={counts[viewing.id] ?? null} onClose={() => setViewing(undefined)} />}
      {editing !== undefined && (
        <SpeciesFormDialog
          record={editing}
          onClose={() => setEditing(undefined)}
          onSaved={(message) => { setEditing(undefined); notify(message); list.reload(); }}
        />
      )}
      {deleting && (
        <ConfirmDialog title="Xóa loài cây" confirmLabel="Xóa" danger busy={busy} onConfirm={() => void confirmDelete()} onCancel={() => setDeleting(undefined)}>
          <Typography>{MSG.CONFIRM_DELETE_SPECIES}</Typography>
          <Typography fontWeight={600} mt={1}>{deleting.data.commonName}</Typography>
        </ConfirmDialog>
      )}
    </>
  );
}
