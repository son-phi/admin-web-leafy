import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { fingerprint, mutationSchema, requireAdmin } from '../../shared/catalog';
import { PRODUCTION_PROJECT } from '../../shared/environment';
initializeApp();
export const saveCatalog=onCall({region:'us-central1',maxInstances:3},async request=>{
 let actor:string;
 try{actor=requireAdmin(request.auth);}catch(e){throw new HttpsError(e instanceof Error&&e.message==='unauthenticated'?'unauthenticated':'permission-denied','Yêu cầu quyền admin');}
 const project=process.env.GCLOUD_PROJECT;
 // This development backend deliberately refuses production, even if accidentally deployed there.
 if(!project||project===PRODUCTION_PROJECT||(!project.startsWith('demo-')&&project!==process.env.ADMIN_DEV_PROJECT_ID))throw new HttpsError('failed-precondition','Project backend chưa được cho phép');
 const parsed=mutationSchema.safeParse(request.data);
 if(!parsed.success)throw new HttpsError('invalid-argument','Dữ liệu danh mục không hợp lệ');
 const input=parsed.data,db=getFirestore(),ref=db.collection(input.collection).doc(String(input.data.id)),audit=db.collection('admin_audit').doc();
 await db.runTransaction(async tx=>{
  const existing=await tx.get(ref);
  if(input.operation==='create'&&existing.exists)throw new HttpsError('already-exists','ID đã tồn tại');
  if(input.operation==='update'&&(!existing.exists||fingerprint(existing.data()!)!==input.expected))throw new HttpsError('aborted','Bản ghi đã thay đổi. Tải lại trước khi lưu.');
  const schema=input.collection==='plants'?mutationSchema.options[0].shape.data:mutationSchema.options[1].shape.data;
  const before=existing.exists?Object.fromEntries(Object.keys(schema.shape).filter(k=>existing.get(k)!==undefined).map(k=>[k,existing.get(k)])):null;
  if(input.operation==='create')tx.create(ref,input.data);else tx.update(ref,input.data);
  tx.create(audit,{actor,at:FieldValue.serverTimestamp(),action:input.operation,target:ref.path,before,after:input.data});
 });return {ok:true};
});
