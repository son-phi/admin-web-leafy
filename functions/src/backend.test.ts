import {beforeEach,describe,expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({exists:false,data:{} as Record<string,unknown>,writes:[] as unknown[],failAudit:false}));
vi.mock('firebase-admin/app',()=>({initializeApp:vi.fn()}));
vi.mock('firebase-admin/firestore',()=>({FieldValue:{serverTimestamp:()=> 'SERVER_TIME'},getFirestore:()=>({collection:(name:string)=>({doc:(id='audit-id')=>({path:name+'/'+id})}),runTransaction:async(fn:(tx:unknown)=>Promise<void>)=>{const pending:unknown[]=[];await fn({get:async()=>({exists:state.exists,data:()=>state.data,get:(k:string)=>state.data[k]}),create:(ref:{path:string},data:unknown)=>{if(ref.path.startsWith('admin_audit')&&state.failAudit)throw new Error('audit unavailable');pending.push({ref,data});},update:(ref:unknown,data:unknown)=>pending.push({ref,data})});state.writes.push(...pending);}})}));
vi.mock('firebase-functions/v2/https',()=>({HttpsError:class extends Error{constructor(public code:string,msg:string){super(msg);}},onCall:(_options:unknown,handler:unknown)=>handler}));
import {saveCatalog} from './index';
import {fingerprint} from '../../shared/catalog';
type Request={auth?:{uid:string;token:Record<string,unknown>};data:unknown};
const invoke=saveCatalog as unknown as (r:Request)=>Promise<unknown>;
const plant={id:50,name:'Test',scientificName:'',description:'',light:'',watering:'',soil:'',fertilizer:'',temperature:'',humidity:'',image:'',popularity:0};
const input={collection:'plants',operation:'create',data:plant,expected:null};
const auth={uid:'admin-uid',token:{admin:true}};
describe('callable backend boundary (mocked Admin SDK)',()=>{
 beforeEach(()=>{state.exists=false;state.data={};state.writes=[];state.failAudit=false;vi.stubEnv('GCLOUD_PROJECT','demo-leafy-admin');});
 it('denies unauthenticated/non-admin calls before database writes',async()=>{await expect(invoke({data:input})).rejects.toMatchObject({code:'unauthenticated'});await expect(invoke({auth:{uid:'u',token:{}},data:input})).rejects.toMatchObject({code:'permission-denied'});expect(state.writes).toHaveLength(0);});
 it('blocks production and invalid payloads',async()=>{await expect(invoke({auth,data:{...input,collection:'users'}})).rejects.toMatchObject({code:'invalid-argument'});vi.stubEnv('GCLOUD_PROJECT','leafyapp-cf95a');await expect(invoke({auth,data:input})).rejects.toMatchObject({code:'failed-precondition'});expect(state.writes).toHaveLength(0);});
 it('writes catalog and audit with server timestamp and actor together',async()=>{await invoke({auth,data:input});expect(state.writes).toHaveLength(2);expect(state.writes[1]).toMatchObject({data:{actor:'admin-uid',at:'SERVER_TIME',target:'plants/50',action:'create'}});});
 it('rejects collisions and stale updates without audit writes',async()=>{state.exists=true;state.data=plant;await expect(invoke({auth,data:input})).rejects.toMatchObject({code:'already-exists'});await expect(invoke({auth,data:{...input,operation:'update',expected:'stale'}})).rejects.toMatchObject({code:'aborted'});expect(state.writes).toHaveLength(0);await invoke({auth,data:{...input,operation:'update',expected:fingerprint(plant)}});expect(state.writes).toHaveLength(2);});
 it('does not commit catalog when the audit write fails',async()=>{state.failAudit=true;await expect(invoke({auth,data:input})).rejects.toThrow('audit unavailable');expect(state.writes).toHaveLength(0);});
});

