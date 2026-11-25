import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DiseaseSchema, SPECIES_FIELDS, isImagePath, SaveSpeciesInput, SpeciesSchema, fingerprint, requireAdmin, type Species,
} from '../shared/catalog';
import { PRODUCTION_PROJECT, validateEnvironment } from '../shared/environment';
import { normalizeSearch, searchPrefixes } from '../shared/normalize';
import { createRequire } from 'node:module';

const requireCjs = createRequire(import.meta.url);
const { checkArgs } = requireCjs('../functions/scripts/grant-admin.cjs') as {
  checkArgs: (argv: string[], env: Record<string, string | undefined>) => { project: string; uid: string; useEmulator: boolean };
};

export const species: Species = {
  commonName: 'Cây thử', scientificName: 'Testus plantus', aiLabel: 'test_plant',
  imageUrl: 'https://example.test/a.png', imagePath: 'species/a.png', description: 'Mô tả',
  lightNeed: 'MEDIUM', wateringCycleDays: 5, fertilizingCycleDays: 30,
  threshold: { soilMoistureMin: 30, soilMoistureMax: 60, temperatureMin: 18, temperatureMax: 30, airHumidityMin: 40, airHumidityMax: 80, lightMin: 100, lightMax: 1000 },
};

function stubLocalStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
  });
}

describe('authorization', () => {
  it('rejects unauthenticated and non-boolean claims', () => {
    expect(() => requireAdmin(undefined)).toThrow('unauthenticated');
    for (const admin of [false, 'true', 1, undefined]) expect(() => requireAdmin({ uid: 'u', token: { admin } })).toThrow('permission-denied');
    expect(requireAdmin({ uid: 'u', token: { admin: true } })).toBe('u');
  });
});

describe('catalog validation (whitelist)', () => {
  it('accepts a valid species and rejects unknown fields, bad URLs and empty names', () => {
    expect(SpeciesSchema.safeParse(species).success).toBe(true);
    for (const bad of [
      { ...species, role: 'admin' },
      { ...species, imageUrl: 'javascript:alert(1)' },
      { ...species, commonName: '  ' },
      { ...species, wateringCycleDays: 1.5 },
      { ...species, lightNeed: 'SUPER' },
    ]) expect(SpeciesSchema.safeParse(bad).success).toBe(false);
  });

  it('reports INVALID_THRESHOLD when min > max (ngoại lệ 7b)', () => {
    const result = SpeciesSchema.safeParse({ ...species, threshold: { ...species.threshold, temperatureMin: 40 } });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.message === 'INVALID_THRESHOLD')).toBe(true);
  });

  it('requires at least one affected species and rejects path-like ids', () => {
    const disease = {
      nameVi: 'Bệnh', scientificName: null, aiLabel: 'x', imageUrl: 'https://example.test/b.png', imagePath: '',
      affectedSpeciesIds: ['trau-ba'], causes: 'a', symptoms: 'b', treatmentMild: 'c', treatmentModerate: 'd', treatmentSevere: 'e', prevention: null,
    };
    expect(DiseaseSchema.safeParse(disease).success).toBe(true);
    expect(DiseaseSchema.safeParse({ ...disease, affectedSpeciesIds: [] }).success).toBe(false);
    expect(DiseaseSchema.safeParse({ ...disease, affectedSpeciesIds: ['../users/x'] }).success).toBe(false);
    expect(SaveSpeciesInput.safeParse({ id: 'users/abc', data: species }).success).toBe(false);
  });

  it('fingerprints business fields only, independent of key order', () => {
    const reversed = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).reverse());
    const reordered = { searchName: 'x', updatedAt: 1, updatedBy: 'u', ...reversed(species), threshold: reversed(species.threshold) };
    expect(fingerprint(SPECIES_FIELDS, reordered)).toBe(fingerprint(SPECIES_FIELDS, species));
    expect(fingerprint(SPECIES_FIELDS, { ...species, description: 'khác' })).not.toBe(fingerprint(SPECIES_FIELDS, species));
  });

  it('normalizes Vietnamese text and builds prefixes for several names', () => {
    expect(normalizeSearch('  Trầu   Bà Đỏ ')).toBe('trau ba do');
    expect(searchPrefixes('Lá', 'Ab')).toEqual(['l', 'la', 'a', 'ab']);
  });

  it('accepts image paths only inside the catalog folder', () => {
    expect(isImagePath('species', 'species/abc_1.webp')).toBe(true);
    for (const p of ['species/../users/x.png', 'diseases/a.png', 'species/a.gif', 'species/a', '/species/a.png']) expect(isImagePath('species', p)).toBe(false);
  });
});

describe('environment', () => {
  const env = { VITE_FIREBASE_PROJECT_ID: 'dev-only', VITE_DEV_PROJECT_ID: 'dev-only', VITE_FIREBASE_API_KEY: 'key', VITE_FIREBASE_AUTH_DOMAIN: 'domain', VITE_FIREBASE_APP_ID: 'app' };
  it('accepts only demo-* projects in emulator mode', () => {
    expect(validateEnvironment('emulator', { ...env, VITE_FIREBASE_PROJECT_ID: 'demo-x' }).kind).toBe('emulator');
    expect(() => validateEnvironment('emulator', env)).toThrow();
    expect(() => validateEnvironment('emulator', { ...env, VITE_FIREBASE_PROJECT_ID: PRODUCTION_PROJECT })).toThrow();
  });
  it('defaults mock without Firebase config', () => expect(validateEnvironment('mock', {}).kind).toBe('mock'));
  it('fails closed for missing or production dev config', () => {
    expect(() => validateEnvironment('development', {})).toThrow();
    expect(() => validateEnvironment('development', { ...env, VITE_FIREBASE_PROJECT_ID: PRODUCTION_PROJECT, VITE_DEV_PROJECT_ID: PRODUCTION_PROJECT })).toThrow();
    expect(validateEnvironment('development', env).kind).toBe('dev');
    expect(() => validateEnvironment('production', env)).toThrow();
  });
});

describe('mock backend + controllers', () => {
  beforeEach(stubLocalStorage);

  async function setup() {
    const { createMockBackend } = await import('../src/services/backendMock');
    const { createSpeciesController } = await import('../src/controllers/SpeciesController');
    const backend = createMockBackend();
    return { backend, controller: createSpeciesController(backend.species, backend.callables, backend.storage) };
  }

  it('denies reads and writes without admin session', async () => {
    const { backend, controller } = await setup();
    await expect(backend.species.getAllSpecies({ search: '' })).rejects.toThrow();
    await expect(backend.auth.login('viewer@example.test', '')).rejects.toThrow('Tài khoản không có quyền truy cập trang quản trị');
    await expect(controller.addSpecies(species, null)).rejects.toThrow();
    await expect(controller.deleteSpecies('trau-ba')).rejects.toThrow();
    expect(await backend.species.countSpecies().catch(() => -1)).toBe(-1);
  });

  it('adds, searches by common or scientific name without accents, and rejects stale updates', async () => {
    const { backend, controller } = await setup();
    await backend.auth.login('admin@example.test', '');
    const before = await backend.species.countSpecies();
    const { id } = await controller.addSpecies(species, null);
    expect(await backend.species.countSpecies()).toBe(before + 1);
    expect((await backend.species.getAllSpecies({ search: 'cay thu' })).items.map((r) => r.id)).toEqual([id]);
    expect((await backend.species.getAllSpecies({ search: 'testus' })).items.map((r) => r.id)).toEqual([id]);
    expect((await backend.species.getAllSpecies({ search: 'trau' })).items[0].data.commonName).toBe('Trầu bà');

    const record = (await backend.species.getSpeciesById(id))!;
    await expect(controller.updateSpecies(id, { ...species, description: 'x' }, 'stale', null)).rejects.toThrow('Dữ liệu đã được người khác cập nhật');
    await controller.updateSpecies(id, { ...species, description: 'Đã sửa' }, record.fingerprint, null);
    expect((await backend.species.getSpeciesById(id))?.data.description).toBe('Đã sửa');
    await expect(controller.updateSpecies(id, species, record.fingerprint, null)).rejects.toThrow('Dữ liệu đã được người khác cập nhật');
  });

  it('rejects duplicate names (7c) and AI labels (7e), but not when editing itself', async () => {
    const { backend, controller } = await setup();
    await backend.auth.login('admin@example.test', '');
    await expect(controller.addSpecies({ ...species, commonName: 'TRAU BA' }, null)).rejects.toThrow('Loài cây đã có trong danh mục');
    await expect(controller.addSpecies({ ...species, aiLabel: 'epipremnum_aureum' }, null)).rejects.toThrow('Mã nhãn đã được sử dụng');
    const own = (await backend.species.getSpeciesById('trau-ba'))!;
    await controller.updateSpecies('trau-ba', { ...own.data, description: 'Sửa chính nó' }, own.fingerprint, null);
  });

  it('validates images: required, type/size (7d), folder of imagePath; uploads before saving', async () => {
    const { backend, controller } = await setup();
    await backend.auth.login('admin@example.test', '');
    const noImage = await controller.addSpecies({ ...species, commonName: 'Không ảnh', aiLabel: 'no_img', imageUrl: '', imagePath: '' }, null).catch((e) => e);
    expect(noImage.fields.imageUrl).toBe('Vui lòng chọn ảnh minh họa');
    const gif = new File(['x'], 'a.gif', { type: 'image/gif' });
    await expect(controller.addSpecies({ ...species, commonName: 'Ảnh GIF', aiLabel: 'gif' }, gif)).rejects.toThrow('Ảnh không hợp lệ');
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'a.png', { type: 'image/png' });
    await expect(controller.addSpecies({ ...species, commonName: 'Ảnh lớn', aiLabel: 'big' }, big)).rejects.toThrow('Ảnh không hợp lệ');
    await expect(controller.addSpecies({ ...species, commonName: 'Đường dẫn lạ', aiLabel: 'path', imagePath: 'diseases/x.png' }, null)).rejects.toThrow('Ảnh không hợp lệ');
    const png = new File(['x'], 'a.png', { type: 'image/png' });
    const { id } = await controller.addSpecies({ ...species, commonName: 'Có ảnh', aiLabel: 'with_img', imageUrl: '', imagePath: '' }, png);
    expect((await backend.species.getSpeciesById(id))?.data.imagePath).toMatch(/^species\/[a-f0-9]+\.png$/);
  });

  it('blocks deleting a species still planted (18a) and deletes an unused one', async () => {
    const { backend, controller } = await setup();
    await backend.auth.login('admin@example.test', '');
    const used = (await backend.species.getSpeciesList())[0].id;
    expect(await backend.species.countPlantsBySpecies(used)).toBeGreaterThan(0);
    await expect(controller.deleteSpecies(used)).rejects.toThrow('Không thể xóa loài cây đang được sử dụng');
    const { id } = await controller.addSpecies(species, null);
    expect(await backend.species.countPlantsBySpecies(id)).toBe(0);
    expect(await controller.deleteSpecies(id)).toBe('Xóa loài cây thành công');
    expect(await backend.species.getSpeciesById(id)).toBeNull();
  });

  it('returns field errors and the threshold message from validation', async () => {
    const { backend, controller } = await setup();
    await backend.auth.login('admin@example.test', '');
    const { ValidationError } = await import('../src/utils/validation');
    const err = await controller.addSpecies({ ...species, commonName: '', wateringCycleDays: Number.NaN }, null).catch((e) => e);
    expect(err).toBeInstanceOf(ValidationError);
    expect(Object.keys(err.fields)).toEqual(expect.arrayContaining(['commonName', 'wateringCycleDays']));
    const t = await controller.addSpecies({ ...species, threshold: { ...species.threshold, lightMin: 5000 } }, null).catch((e) => e);
    expect(t.message).toBe('Ngưỡng không hợp lệ');
  });

  it('manages diseases: species filter, diagnosis counts, duplicates (7b), missing species, delete', async () => {
    const { backend } = await setup();
    const { createDiseaseController } = await import('../src/controllers/DiseaseController');
    const diseases = createDiseaseController(backend.diseases, backend.species, backend.callables, backend.storage);
    await backend.auth.login('admin@example.test', '');
    const onlySenDa = await diseases.getAllDiseases({ search: '', filter: 'sen-da' });
    expect(onlySenDa.items.length).toBeGreaterThan(0);
    expect(onlySenDa.items.every((d) => d.data.affectedSpeciesIds.includes('sen-da'))).toBe(true);
    expect((await diseases.getAllDiseases({ search: 'vang', filter: 'sen-da' })).items).toHaveLength(0);

    const first = onlySenDa.items[0];
    const counts = await diseases.countDiagnosesByDisease([first.id]);
    expect(typeof counts[first.id]).toBe('number');

    const base = { ...first.data, nameVi: 'Bệnh thử', aiLabel: 'test_disease', imagePath: '' };
    await expect(diseases.addDisease({ ...base, nameVi: first.data.nameVi.toUpperCase() }, null)).rejects.toThrow('Bệnh cây đã có trong danh mục');
    await expect(diseases.addDisease({ ...base, aiLabel: first.data.aiLabel }, null)).rejects.toThrow('Bệnh cây đã có trong danh mục');
    await expect(diseases.addDisease({ ...base, affectedSpeciesIds: ['khong-ton-tai'] }, null)).rejects.toThrow('Loài cây được chọn không còn');
    const empty = await diseases.addDisease({ ...base, affectedSpeciesIds: [], causes: '' }, null).catch((e) => e);
    expect(Object.keys(empty.fields)).toEqual(expect.arrayContaining(['affectedSpeciesIds', 'causes']));

    const { id } = await diseases.addDisease(base, null);
    expect(await diseases.deleteDisease(id)).toBe('Xóa bệnh cây thành công');
    expect(await backend.diseases.getDiseaseById(id)).toBeNull();
  });

  it('manages accounts: search by name or email, status filter, prechecks, lock with reason, detail', async () => {
    const { backend } = await setup();
    const { createAccountController } = await import('../src/controllers/AccountController');
    const { ValidationError } = await import('../src/utils/validation');
    const accounts = createAccountController(backend.users, backend.lockLogs, backend.callables);
    await backend.auth.login('admin@example.test', '');

    expect((await accounts.searchUsers({ search: 'nguyen' })).items.map((u) => u.fullName)).toEqual(['Nguyễn An']);
    expect((await accounts.searchUsers({ search: 'user2@' })).items.map((u) => u.fullName)).toEqual(['Trần Bình']);
    expect((await accounts.searchUsers({ search: 'khong co ai' })).items).toEqual([]); // 4a
    const locked = await accounts.searchUsers({ search: '', filter: 'locked' });
    expect(locked.items.length).toBeGreaterThan(0);
    expect(locked.items.every((u) => u.status === 'locked')).toBe(true);
    expect((await accounts.searchUsers({ search: '' })).items.every((u) => u.role === 'user')).toBe(true);

    const target = (await accounts.searchUsers({ search: 'nguyen' })).items[0];
    expect(accounts.precheck(target, target.id)).toBe('Không thể khóa tài khoản đang đăng nhập'); // 9a
    expect(accounts.precheck({ ...target, role: 'admin' }, 'x')).toBe('Không thể khóa tài khoản quản trị viên'); // 9b
    expect(accounts.precheck(target, 'mock-admin')).toBeNull();
    await expect(accounts.setAccountStatus('mock-admin', 'LOCK', 'x')).rejects.toThrow('Không thể khóa tài khoản đang đăng nhập');
    await expect(accounts.setAccountStatus(target.id, 'LOCK')).rejects.toBeInstanceOf(ValidationError);

    expect(await accounts.setAccountStatus(target.id, 'LOCK', 'Vi phạm điều khoản sử dụng'))
      .toMatchObject({ status: 'locked', changed: true, message: 'Cập nhật trạng thái tài khoản thành công' });
    const detail = await accounts.getAccountDetail(target.id);
    expect(detail.user.status).toBe('locked');
    expect(detail.history[0]).toMatchObject({ action: 'LOCK', reason: 'Vi phạm điều khoản sử dụng', adminId: 'mock-admin' });
    expect(Object.keys(detail.usage)).toEqual(['plants', 'devices', 'diagnoses', 'chatSessions']);
    expect(detail.usage.plants).toBe((await accounts.countPlantsByUser([target.id]))[target.id]);
    // Mô phỏng serializer của callable (undefined → null) để bắt lỗi chỉ xảy ra khi gọi Functions thật.
    const sent: unknown[] = [];
    const serializing = { ...backend.callables, setAccountStatus: (input: Parameters<typeof backend.callables.setAccountStatus>[0]) => {
      const wire = JSON.parse(JSON.stringify(input, (_k, v) => (v === undefined ? null : v)));
      sent.push(wire);
      return backend.callables.setAccountStatus(wire);
    } };
    await createAccountController(backend.users, backend.lockLogs, serializing).setAccountStatus(target.id, 'UNLOCK');
    expect(sent).toEqual([{ uid: target.id, action: 'UNLOCK' }]);
    expect((await accounts.getAccountDetail(target.id)).history.map((h) => h.action)).toEqual(['UNLOCK', 'LOCK']);
    await expect(accounts.getAccountDetail('khong-ton-tai')).rejects.toThrow('Không tìm thấy tài khoản');
  });

  it('shows LOAD_FAILED (2a) when the list cannot be loaded', async () => {
    const { backend } = await setup();
    const { createSpeciesController } = await import('../src/controllers/SpeciesController');
    const failing = { ...backend.species, getAllSpecies: async () => { throw new Error('network down'); } };
    const controller = createSpeciesController(failing, backend.callables, backend.storage);
    await expect(controller.getAllSpecies({ search: '' })).rejects.toThrow('Không thể tải dữ liệu, vui lòng thử lại');
  });

  it('paginates users with role user only', async () => {
    const { backend } = await setup();
    await backend.auth.login('admin@example.test', '');
    const first = await backend.users.getAllUser({ search: '' });
    expect(first.items.every((u) => u.role === 'user')).toBe(true);
    expect(first.items.length).toBeLessThanOrEqual(10);
  });
});

describe('login (F0)', () => {
  beforeEach(() => {
    stubLocalStorage();
    const session = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => session.get(k) ?? null,
      setItem: (k: string, v: string) => session.set(k, v),
      removeItem: (k: string) => session.delete(k),
    });
  });

  it('keeps no session for a non-admin account and reports NOT_ADMIN', async () => {
    const { createMockAuth } = await import('../src/services/auth');
    const auth = createMockAuth();
    const seen: unknown[] = [];
    auth.watch((s) => seen.push(s));
    await expect(auth.login('viewer@example.test', '')).rejects.toMatchObject({ key: 'NOT_ADMIN' });
    expect(auth.current()).toBeNull();
    expect(seen.every((s) => s === null)).toBe(true);
    await auth.login('admin@example.test', '');
    expect(auth.current()).toMatchObject({ admin: true });
    expect(createMockAuth().current()).toMatchObject({ admin: true }); // phiên mock giữ qua reload
    await auth.logout();
    expect(createMockAuth().current()).toBeNull();
  });

  it('maps Firebase Auth errors without leaking technical details', async () => {
    const { authErrorKey } = await import('../src/services/auth');
    expect(authErrorKey({ code: 'auth/invalid-credential' })).toBe('LOGIN_FAILED');
    expect(authErrorKey({ code: 'auth/user-not-found' })).toBe('LOGIN_FAILED');
    expect(authErrorKey({ code: 'auth/user-disabled' })).toBe('ACCOUNT_DISABLED');
    expect(authErrorKey({ code: 'auth/too-many-requests' })).toBe('TOO_MANY_ATTEMPTS');
    expect(authErrorKey(new Error('boom'))).toBe('LOGIN_FAILED');
  });
});

describe('grant-admin script arguments', () => {
  const emu = { FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' };
  it('requires confirmation and a matching dev project, blocks production', () => {
    expect(() => checkArgs(['dev-1', 'uid'], { ADMIN_DEV_PROJECT_ID: 'dev-1' })).toThrow();
    expect(() => checkArgs(['dev-1', 'uid', 'dev-2'], { ADMIN_DEV_PROJECT_ID: 'dev-1' })).toThrow();
    expect(() => checkArgs(['dev-1', 'uid', 'dev-1'], { ADMIN_DEV_PROJECT_ID: 'other' })).toThrow();
    expect(() => checkArgs([PRODUCTION_PROJECT, 'uid', PRODUCTION_PROJECT], { ADMIN_DEV_PROJECT_ID: PRODUCTION_PROJECT })).toThrow('Production');
    expect(checkArgs(['dev-1', 'uid', 'dev-1'], { ADMIN_DEV_PROJECT_ID: 'dev-1' })).toEqual({ project: 'dev-1', uid: 'uid', useEmulator: false });
  });
  it('refuses mixed emulator/cloud targets and demo projects outside the emulator', () => {
    expect(() => checkArgs(['dev-1', 'uid', 'dev-1'], { ADMIN_DEV_PROJECT_ID: 'dev-1', FIREBASE_AUTH_EMULATOR_HOST: 'x' })).toThrow();
    expect(() => checkArgs(['demo-a', 'uid', 'demo-a'], { ADMIN_DEV_PROJECT_ID: 'demo-a' })).toThrow('Emulator');
    expect(checkArgs(['demo-a', 'uid', 'demo-a'], { ADMIN_DEV_PROJECT_ID: 'demo-a', ...emu }).useEmulator).toBe(true);
  });
});
