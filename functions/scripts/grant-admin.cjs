// Cấp quyền quản trị cho MỘT UID trên project dev/emulator (ADMIN_SPEC D2):
//   - custom claim `admin: true` (giữ nguyên các claim đang có) – dùng để phân quyền;
//   - `users/{uid}.role = 'admin'` (merge, không đụng trường khác) – dùng để hiển thị/lọc.
// Không tự chạy. Production bị chặn. Cách dùng:
//   node scripts/grant-admin.cjs <projectId> <uid> <projectId (nhập lại để xác nhận)>
// Biến môi trường: ADMIN_DEV_PROJECT_ID phải bằng projectId. Với Emulator đặt cả
// FIREBASE_AUTH_EMULATOR_HOST và FIRESTORE_EMULATOR_HOST.
const PRODUCTION_PROJECT = 'leafyapp-cf95a';

/** Kiểm tra tham số; ném lỗi nếu không an toàn. Tách riêng để kiểm thử. */
function checkArgs(argv, env) {
  const [project, uid, confirmation] = argv;
  if (!project || !uid || uid.length > 128 || confirmation !== project) {
    throw new Error('Cần projectId, UID (≤128 ký tự) và nhập lại projectId để xác nhận.');
  }
  if (project === PRODUCTION_PROJECT) throw new Error('Production bị chặn.');
  if (project !== env.ADMIN_DEV_PROJECT_ID) throw new Error('ADMIN_DEV_PROJECT_ID phải khớp projectId.');
  const authEmulator = Boolean(env.FIREBASE_AUTH_EMULATOR_HOST);
  const firestoreEmulator = Boolean(env.FIRESTORE_EMULATOR_HOST);
  // Tránh trường hợp cấp claim trên Emulator nhưng ghi Firestore lên cloud (hoặc ngược lại).
  if (authEmulator !== firestoreEmulator) {
    throw new Error('Đặt cả FIREBASE_AUTH_EMULATOR_HOST và FIRESTORE_EMULATOR_HOST, hoặc không đặt cả hai.');
  }
  if (project.startsWith('demo-') && !authEmulator) throw new Error('Project demo-* chỉ tồn tại trên Emulator.');
  return { project, uid, useEmulator: authEmulator };
}

async function main() {
  const { project, uid, useEmulator } = checkArgs(process.argv.slice(2), process.env);
  const { initializeApp, applicationDefault } = require('firebase-admin/app');
  const { getAuth } = require('firebase-admin/auth');
  const { getFirestore } = require('firebase-admin/firestore');
  initializeApp({ projectId: project, ...(useEmulator ? {} : { credential: applicationDefault() }) });

  const auth = getAuth();
  const user = await auth.getUser(uid);
  await auth.setCustomUserClaims(uid, { ...user.customClaims, admin: true });
  await getFirestore().doc(`users/${uid}`).set({ role: 'admin' }, { merge: true });
  console.log(`Đã cấp admin cho UID trên ${useEmulator ? 'Emulator' : 'project dev'} ${project} (claim + users/{uid}.role). Đăng nhập lại để nhận claim.`);
}

if (require.main === module) {
  main().catch((error) => {
    const known = error instanceof Error && /Production|projectId|UID|EMULATOR|Emulator|ADMIN_DEV/.test(error.message);
    console.error(known ? error.message : 'Không thể cấp quyền. Kiểm tra project dev, UID và credentials backend.');
    process.exitCode = 1;
  });
}

module.exports = { checkArgs };
