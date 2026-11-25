// Boundary: Quản lý tài khoản (kịch bản 2.2.5.2, biểu đồ 2.3.2.2).
import { useCallback, useEffect, useState } from 'react';
import { Avatar, Button, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField } from '@mui/material';
import { useSession } from '../app/SessionContext';
import { DataState, PaginationBar } from '../components/DataState';
import { ListToolbar } from '../components/ListToolbar';
import { useNotice } from '../components/Notice';
import { PageHeading } from '../components/PageHeading';
import { usePagedList } from '../components/usePagedList';
import { accountController } from '../controllers';
import type { PageRequest } from '../entities/types';
import type { UserRecord } from '../entities/UserRepository';
import { MSG } from '../utils/messages';
import { formatDate } from '../utils/normalize';
import { AccountDetailDialog, StatusChip } from './accounts/AccountDetailDialog';
import { AccountStatusDialog } from './accounts/AccountStatusDialog';

export function AccountManagementView() {
  const load = useCallback((request: PageRequest) => accountController.searchUsers(request), []);
  const list = usePagedList(load);
  const notify = useNotice();
  const { session } = useSession();
  const [counts, setCounts] = useState<Record<string, number | null>>({});
  const [viewing, setViewing] = useState<string>();
  const [changing, setChanging] = useState<UserRecord>();
  // Trạng thái đã đổi trên trang hiện tại (cập nhật dòng ngay, không cần tải lại – bước 13).
  const [overrides, setOverrides] = useState<Record<string, 'active' | 'locked'>>({});

  useEffect(() => {
    let active = true;
    setOverrides({});
    const ids = list.items.map((u) => u.id);
    if (ids.length) void accountController.countPlantsByUser(ids).then((c) => { if (active) setCounts(c); });
    return () => { active = false; };
  }, [list.items]);

  const statusOf = (u: UserRecord) => overrides[u.id] ?? u.status;
  const filtering = Boolean(list.search || list.filter);

  function requestChange(u: UserRecord) {
    const blocked = accountController.precheck(u, session?.uid ?? ''); // 9a, 9b
    if (blocked) notify(blocked, 'warning');
    else setChanging({ ...u, status: statusOf(u) });
  }

  return (
    <>
      <PageHeading eyebrow="NGƯỜI DÙNG" title="Quản lý tài khoản" />
      <Paper elevation={0} className="data-panel">
        <ListToolbar label="Tìm theo họ tên hoặc email (tiền tố, không phân biệt dấu)" onSearch={list.applySearch} onReload={list.reload} disabled={list.loading}>
          <TextField select size="small" label="Trạng thái" value={list.filter} sx={{ minWidth: 180 }} onChange={(e) => list.applyFilter(e.target.value)}>
            <MenuItem value="">Tất cả</MenuItem>
            <MenuItem value="active">Đang hoạt động</MenuItem>
            <MenuItem value="locked">Đã khóa</MenuItem>
          </TextField>
        </ListToolbar>
        <DataState
          loading={list.loading}
          error={list.error}
          empty={list.items.length === 0}
          emptyText={filtering ? MSG.ACCOUNT_NOT_FOUND : 'Chưa có tài khoản người dùng.'}
        >
          <div className="table-wrap">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell />
                  <TableCell>Họ tên</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Ngày đăng ký</TableCell>
                  <TableCell align="right">Số cây</TableCell>
                  <TableCell>Trạng thái</TableCell>
                  <TableCell align="right">Thao tác</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {list.items.map((u) => {
                  const status = statusOf(u);
                  return (
                    <TableRow key={u.id} hover>
                      <TableCell><Avatar src={u.avatarUrl || undefined} alt={u.fullName}>{u.fullName.charAt(0)}</Avatar></TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{u.fullName || '—'}</TableCell>
                      <TableCell>{u.email || '—'}</TableCell>
                      <TableCell>{formatDate(u.createdAt)}</TableCell>
                      <TableCell align="right">{u.id in counts ? counts[u.id] ?? '—' : '…'}</TableCell>
                      <TableCell><StatusChip status={status} /></TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Button size="small" onClick={() => setViewing(u.id)}>Xem chi tiết</Button>
                          <Button size="small" color={status === 'locked' ? 'primary' : 'error'} onClick={() => requestChange(u)}>
                            {status === 'locked' ? 'Mở khóa' : 'Khóa'}
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </DataState>
        <PaginationBar page={list.pageNumber} hasPrevious={list.hasPrevious} hasNext={list.hasNext} disabled={list.loading} onPrevious={list.previous} onNext={list.next} />
      </Paper>
      {viewing && <AccountDetailDialog uid={viewing} onClose={() => setViewing(undefined)} />}
      {changing && (
        <AccountStatusDialog
          user={changing}
          onCancel={() => setChanging(undefined)}
          onError={(message) => { setChanging(undefined); notify(message, 'error'); }}
          onDone={(message, status) => {
            setOverrides((o) => ({ ...o, [changing.id]: status }));
            setChanging(undefined);
            notify(message);
          }}
        />
      )}
    </>
  );
}
