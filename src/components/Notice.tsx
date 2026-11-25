import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Alert, Snackbar } from '@mui/material';

type Severity = 'success' | 'error' | 'info' | 'warning';
type Notify = (message: string, severity?: Severity) => void;

const NoticeContext = createContext<Notify>(() => undefined);

/** Thông báo thành công/thất bại dạng snackbar cho toàn trang quản trị. */
export function NoticeProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<{ message: string; severity: Severity; key: number }>();
  const notify = useCallback<Notify>((message, severity = 'success') => setNotice({ message, severity, key: Date.now() }), []);
  return (
    <NoticeContext.Provider value={notify}>
      {children}
      <Snackbar key={notice?.key} open={Boolean(notice)} autoHideDuration={4000} onClose={() => setNotice(undefined)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={notice?.severity ?? 'info'} variant="filled" onClose={() => setNotice(undefined)}>{notice?.message}</Alert>
      </Snackbar>
    </NoticeContext.Provider>
  );
}

export const useNotice = () => useContext(NoticeContext);
