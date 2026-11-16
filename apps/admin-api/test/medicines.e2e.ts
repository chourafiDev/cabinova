import type { INestApplication } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { readAmmpsFile } from '../src/medicines/ammps-file.js';
import { ImportBusyError, importAmmps } from '../src/medicines/ammps-import.js';
import { MedicinesDbService } from '../src/medicines/medicines-db.module.js';
import { type Agent, createApp, inviteUser, signInAdmin } from './app.js';
import { HEADER, xlsx } from './xlsx.js';

type Line = (string | number | null)[];
const med = (id: number, name: string, status = 'Commercialisé', ppv: number | null = 10): Line => [
  String(id), name, `${name} SUBSTANCE`, '10 MG', 'COMPRIME', 'BOITE DE 20', 'LABO', status, ppv, ppv,
];
const file = (...lines: Line[]) => readAmmpsFile(xlsx([HEADER, ...lines]));

/**
 * The shared medicines database: migrated at startup, trigram search ready,
 * and the AMMPS import — all or nothing, never deleting, refusing a file
 * that would empty the list, one import at a time.
 */
describe('medicines database', () => {
  let app: INestApplication;
  let medicines: MedicinesDbService;

  const rows = async () =>
    (
      await medicines.db.execute<{ ammps_id: number; name: string; is_active: boolean; ppv: string | null; updated_at: Date }>(
        sql`select ammps_id, name, is_active, ppv, updated_at from medications order by ammps_id`,
      )
    ).rows;

  beforeAll(async () => {
    app = await createApp();
    medicines = app.get(MedicinesDbService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('is migrated at startup', async () => {
    expect(medicines.configured).toBe(true);
    const { rows: tables } = await medicines.db.execute<{ table_name: string }>(
      sql`select table_name from information_schema.tables where table_schema = 'public' order by 1`,
    );
    expect(tables.map((r) => r.table_name)).toEqual(['medication_imports', 'medications']);
    const { rows: ext } = await medicines.db.execute(sql`select 1 from pg_extension where extname = 'pg_trgm'`);
    expect(ext).toHaveLength(1);
  });

  it('imports a first file', async () => {
    const run = await importAmmps(medicines.db, {
      file: file(med(1, 'DOLIPRANE'), med(2, 'AMLOR'), med(3, 'VIEUX', 'Retiré du Marché', null), med(4, 'GLUCOPHAGE'), med(5, 'SPASFON')),
      fileName: 'ammps-1.xlsx',
      by: { id: '00000000-0000-4000-8000-000000000001', name: 'Super Admin' },
    });
    expect(run).toMatchObject({
      status: 'success',
      rowsRead: 5,
      rowsInserted: 5,
      rowsUpdated: 0,
      rowsDeactivated: 0,
      importedByName: 'Super Admin',
    });
    expect(run.finishedAt).toBeInstanceOf(Date);
    const { rows: found } = await medicines.db.execute<{ name: string; availability: string }>(
      sql`select name, availability::text from medications where name ilike ${'%lipr%'} or substances ilike ${'%vieu%'} order by name`,
    );
    expect(found).toEqual([
      { name: 'DOLIPRANE', availability: 'marketed' },
      { name: 'VIEUX', availability: 'withdrawn' },
    ]);
  });

  it('adds, updates only what changed, deactivates what left, never deletes', async () => {
    const before = await rows();
    const run = await importAmmps(medicines.db, {
      // 2 changes price, 5 is gone, 6 is new; 1, 3 and 4 are unchanged.
      file: file(med(1, 'DOLIPRANE'), med(2, 'AMLOR', 'Commercialisé', 12.5), med(3, 'VIEUX', 'Retiré du Marché', null), med(4, 'GLUCOPHAGE'), med(6, 'AUGMENTIN')),
      fileName: 'ammps-2.xlsx',
    });
    expect(run).toMatchObject({ status: 'success', rowsInserted: 1, rowsUpdated: 1, rowsDeactivated: 1 });
    const after = await rows();
    expect(after.map((r) => [r.ammps_id, r.is_active, r.ppv])).toEqual([
      [1, true, '10.00'],
      [2, true, '12.50'],
      [3, true, null],
      [4, true, '10.00'],
      [5, false, '10.00'],
      [6, true, '10.00'],
    ]);
    // Unchanged rows keep their updated_at.
    expect(after[0].updated_at).toEqual(before[0].updated_at);
  });

  it('reactivates a medicine that comes back', async () => {
    const run = await importAmmps(medicines.db, {
      file: file(med(1, 'DOLIPRANE'), med(2, 'AMLOR', 'Commercialisé', 12.5), med(3, 'VIEUX', 'Retiré du Marché', null), med(4, 'GLUCOPHAGE'), med(5, 'SPASFON'), med(6, 'AUGMENTIN')),
      fileName: 'ammps-3.xlsx',
    });
    expect(run).toMatchObject({ status: 'success', rowsInserted: 0, rowsUpdated: 1, rowsDeactivated: 0 });
    expect((await rows()).find((r) => r.ammps_id === 5)?.is_active).toBe(true);
  });

  it('refuses a file far smaller than the active list, and changes nothing', async () => {
    const before = await rows();
    const run = await importAmmps(medicines.db, { file: file(med(1, 'DOLIPRANE'), med(2, 'AMLOR')), fileName: 'cut.xlsx' });
    expect(run.status).toBe('failed');
    expect(run.error).toContain('2 médicaments contre 6 actifs');
    expect(await rows()).toEqual(before);
  });

  it('refuses a file with too many unreadable lines', async () => {
    const lines = [1, 2, 3, 4, 5, 6].map((id) => med(id, `MED ${id}`));
    const run = await importAmmps(medicines.db, {
      file: file(...lines, ['x', 'A', 'B']),
      fileName: 'broken.xlsx',
    });
    expect(run).toMatchObject({ status: 'failed' });
    expect(run.error).toContain('Trop de lignes illisibles (1 sur 7)');
  });

  it('runs one import at a time, and frees one cut off by a restart', async () => {
    await medicines.db.execute(sql`insert into medication_imports (file_name) values ('running.xlsx')`);
    const next = { file: file(med(1, 'DOLIPRANE'), med(2, 'AMLOR'), med(3, 'VIEUX'), med(4, 'GLUCOPHAGE'), med(5, 'SPASFON'), med(6, 'AUGMENTIN')), fileName: 'next.xlsx' };
    await expect(importAmmps(medicines.db, next)).rejects.toBeInstanceOf(ImportBusyError);

    // The same running import, 20 minutes old: a restart cut it off.
    await medicines.db.execute(
      sql`update medication_imports set started_at = now() - interval '20 minutes' where file_name = 'running.xlsx'`,
    );
    expect((await importAmmps(medicines.db, next)).status).toBe('success');
    const { rows: stale } = await medicines.db.execute<{ status: string; error: string }>(
      sql`select status::text, error from medication_imports where file_name = 'running.xlsx'`,
    );
    expect(stale).toEqual([{ status: 'failed', error: 'Import interrompu (redémarrage du serveur).' }]);
  });

  describe('Super Admin API', () => {
    let admin: Agent;
    let support: Agent;
    const six = () =>
      xlsx([HEADER, med(1, 'DOLIPRANE'), med(2, 'AMLOR'), med(3, 'VIEUX', 'Retiré du Marché', null), med(4, 'GLUCOPHAGE'), med(5, 'SPASFON'), med(6, 'AUGMENTIN'), med(7, 'ZYVOXID', 'Non Commercialisé', null)]);

    beforeAll(async () => {
      admin = await signInAdmin(app);
      ({ agent: support } = await inviteUser(app, admin, {
        name: 'Agent Support',
        email: 'support-medicines@e2e.test',
        roleKeys: ['support_agent'],
      }));
    });

    it('uploads the AMMPS export and audits it', async () => {
      const { body } = await admin
        .post('/medicines/imports')
        .attach('file', Buffer.from(six()), 'médicaments-ammps.xlsx')
        .expect(201);
      expect(body).toMatchObject({
        import: { status: 'success', fileName: 'médicaments-ammps.xlsx', rowsInserted: 1, importedByName: expect.any(String) },
        skipped: [],
        skippedTotal: 0,
        duplicates: 0,
      });
      const { body: imports } = await admin.get('/medicines/imports').expect(200);
      expect(imports[0]).toMatchObject({ id: body.import.id, status: 'success' });
      const { body: audit } = await admin.get('/security/audit').query({ search: 'medicines.import' }).expect(200);
      expect(JSON.stringify(audit)).toContain(body.import.id);
    });

    it('gives the overview', async () => {
      const { body } = await admin.get('/medicines/overview').expect(200);
      expect(body).toMatchObject({
        configured: true,
        active: 7,
        inactive: 0,
        withPrice: 5,
        byAvailability: { marketed: 5, not_marketed: 1, withdrawn: 1 },
        lastImport: { fileName: 'médicaments-ammps.xlsx' },
        running: null,
      });
    });

    it('lists and searches the medicines', async () => {
      const { body } = await admin.get('/medicines').query({ q: 'dolip' }).expect(200);
      expect(body).toMatchObject({ total: 1, page: 1, items: [{ ammpsId: 1, name: 'DOLIPRANE', ppv: '10.00' }] });
      const { body: withdrawn } = await admin.get('/medicines').query({ availability: 'withdrawn' }).expect(200);
      expect(withdrawn.items.map((m: { name: string }) => m.name)).toEqual(['VIEUX']);
      const { body: none } = await admin.get('/medicines').query({ q: '100%' }).expect(200);
      expect(none.total).toBe(0);
    });

    it('refuses what is not a usable AMMPS export', async () => {
      const csv = await admin.post('/medicines/imports').attach('file', Buffer.from('id;nom'), 'liste.csv').expect(400);
      expect(csv.body.message).toBe('Le fichier doit être un export Excel (.xlsx).');
      const fake = await admin.post('/medicines/imports').attach('file', Buffer.from('not a zip'), 'faux.xlsx').expect(400);
      expect(fake.body.message).toContain('Fichier illisible');
      const cols = await admin
        .post('/medicines/imports')
        .attach('file', Buffer.from(xlsx([['Nom'], ['A']])), 'colonnes.xlsx')
        .expect(400);
      expect(cols.body.message).toBe('Colonnes manquantes : ID AMMPS, Substance active.');
      await admin.post('/medicines/imports').expect(400);
    });

    it('answers a refused import with its reason', async () => {
      const { body } = await admin
        .post('/medicines/imports')
        .attach('file', Buffer.from(xlsx([HEADER, med(1, 'DOLIPRANE')])), 'court.xlsx')
        .expect(201);
      expect(body.import).toMatchObject({ status: 'failed', error: expect.stringContaining('1 médicaments contre 7 actifs') });
    });

    it('is closed to users without the medicines permission', async () => {
      await support.get('/medicines/overview').expect(403);
      await support.post('/medicines/imports').attach('file', Buffer.from(six()), 'a.xlsx').expect(403);
    });
  });
});
