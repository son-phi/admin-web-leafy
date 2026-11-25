const {initializeApp,applicationDefault}=require('firebase-admin/app');
const {getAuth}=require('firebase-admin/auth');
async function main(){
 const [project,uid,confirmation]=process.argv.slice(2);
 if(!project||!uid||uid.length>128||confirmation!==project||project==='leafyapp-cf95a'||project!==process.env.ADMIN_DEV_PROJECT_ID)throw new Error('Cần project dev, UID và xác nhận project; ADMIN_DEV_PROJECT_ID phải khớp. Production bị chặn.');
 initializeApp({projectId:project,...(process.env.FIREBASE_AUTH_EMULATOR_HOST?{}:{credential:applicationDefault()})});
 const auth=getAuth(),user=await auth.getUser(uid);
 await auth.setCustomUserClaims(uid,{...user.customClaims,admin:true});
 console.log('Đã cấp admin trên project dev được xác nhận. Đăng nhập lại để lấy claim.');
}
main().catch(()=>{console.error('Không thể cấp quyền. Kiểm tra project dev, UID, xác nhận và credentials backend.');process.exitCode=1;});
