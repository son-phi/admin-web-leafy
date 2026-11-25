import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, onIdTokenChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, collection, query, orderBy, documentId, limit, startAfter, where, getDocs, getDoc, doc, getCountFromServer, type QueryConstraint, type QueryDocumentSnapshot } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';
import type { Repository } from './types';
import { searchFields } from './types';
export function createFirebase():Repository {
 const env=import.meta.env;const app=initializeApp({apiKey:env.VITE_FIREBASE_API_KEY,projectId:env.VITE_FIREBASE_PROJECT_ID,authDomain:env.VITE_FIREBASE_AUTH_DOMAIN,appId:env.VITE_FIREBASE_APP_ID});
 const auth=getAuth(app),db=getFirestore(app),fn=getFunctions(app,env.VITE_FUNCTIONS_REGION||'us-central1');
 if(env.VITE_USE_EMULATORS==='true'){connectAuthEmulator(auth,'http://127.0.0.1:9099');connectFirestoreEmulator(db,'127.0.0.1',8080);connectFunctionsEmulator(fn,'127.0.0.1',5001);}
 return {
 async list(kind,search,cursor){const constraints:QueryConstraint[]=search?[where(searchFields[kind],'>=',search),where(searchFields[kind],'<=',search+'\uf8ff'),orderBy(searchFields[kind]),orderBy(documentId())]:[orderBy(documentId())];if(cursor)constraints.push(startAfter(cursor as QueryDocumentSnapshot));const result=await getDocs(query(collection(db,kind),...constraints,limit(11)));const docs=result.docs.slice(0,10);return {rows:docs.map(d=>({key:d.id,data:d.data()})),cursor:docs.at(-1),more:result.docs.length>10};},
 async get(kind,id){const d=await getDoc(doc(db,kind,id));return d.exists()?{key:d.id,data:d.data()}:null;},
 async counts(){return Object.fromEntries(await Promise.all(['plants','diseases','gardens','users'].map(async k=>[k,(await getCountFromServer(collection(db,k))).data().count])));},
 async save(input){await httpsCallable(fn,'saveCatalog')(input);},
 async login(email,password){await signInWithEmailAndPassword(auth,email,password);},async logout(){await signOut(auth);},
 watch(callback){let generation=0;const unsub=onIdTokenChanged(auth,async user=>{const current=++generation;try{if(!user){callback(null);return;}const token=await user.getIdTokenResult();if(current===generation)callback({uid:user.uid,email:user.email??user.uid,admin:token.claims.admin===true});}catch{if(current===generation)callback(null,'Không kiểm tra được quyền. Vui lòng đăng nhập lại.');}},()=>callback(null,'Lỗi phiên đăng nhập'));return()=>{generation++;unsub();};}
 };
}
