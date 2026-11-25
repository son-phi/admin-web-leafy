export type Collection = 'plants'|'diseases'|'gardens'|'users'|'admin_audit';
export type Row = {key:string; data:Record<string,unknown>};
export type Page = {rows:Row[];cursor:unknown;more:boolean};
export type Session = {uid:string;email:string;admin:boolean};
export interface Repository {
 list(kind:Collection,search:string,cursor?:unknown):Promise<Page>;
 get(kind:Collection,id:string):Promise<Row|null>;
 counts():Promise<Record<string,number>>;
 save(input:import('../../shared/catalog').Mutation):Promise<void>;
 login(email:string,password:string):Promise<void>;
 logout():Promise<void>;
 watch(callback:(session:Session|null,error?:string)=>void):()=>void;
}
export const titles:Record<Collection,string>={plants:'Danh mục cây',diseases:'Bệnh cây',gardens:'Vườn',users:'Hồ sơ người dùng',admin_audit:'Lịch sử quản trị'};
export const searchFields:Record<Collection,string>={plants:'name',diseases:'diseaseName',gardens:'name',users:'displayName',admin_audit:'actor'};
