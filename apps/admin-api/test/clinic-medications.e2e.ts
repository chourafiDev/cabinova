import { Pool } from '@neondatabase/serverless';
import type { INestApplication } from '@nestjs/common';
import { type Agent, createApp, signInAdmin } from './app.js';
import {
  addStaff,
  captureInvitations,
  createClinicApp,
  onCabinet,
  provisionCabinet,
  signInDoctor,
} from './clinic.js';

const SUB = 'medicaments-souss';
/** Test rows in the shared medicines database, removed afterwards. */
const IDS = [910001, 910002, 910003, 910004, 910005, 910006];

type Item = {
  key: string;
  source: string;
  ammpsId: number | null;
  name: string;
  dosage: string | null;
  label: string;
  ppv: string | null;
  isFavorite: boolean;
  defaultPosology: string | null;
  presentations: { ammpsId: number }[];
};

/**
 * Medicines for the ordonnance: the AMMPS list (shared, read only) merged
 * with each doctor's own wording, favorites, hidden ones and own products.
 * Withdrawn medicines are never suggested, and flagged on renewal.
 */
describe('clinic: medications', () => {
  let admin: INestApplication;
  let clinic: INestApplication;
  let medicines: Pool;
  let owner: Agent;
  let colleague: Agent;
  let secretary: Agent;

  const cab = (agent: Agent) => onCabinet(clinic, SUB, agent);
  const search = async (agent: Agent, q: string) =>
    (await cab(agent).get('/medications/search').query({ q }).expect(200)).body as {
      items: Item[];
      catalog: boolean;
    };
  const keys = (items: Item[]) => items.map((i) => i.key);

  beforeAll(async () => {
    admin = await createApp();
    // admin-api has migrated the medicines database at startup.
    medicines = new Pool({ connectionString: process.env.MEDICINES_DATABASE_URL });
    await medicines.query('delete from medications where ammps_id = any($1::int[])', [IDS]);
    await medicines.query(`
      insert into medications (ammps_id, name, substances, dosage, form, presentation, lab, status, availability, ppv, is_active) values
        (910001, 'DOLIPRANE', 'PARACETAMOL', '1 G', 'COMPRIME SECABLE', 'BOITE DE 8', 'SANOFI', 'Commercialisé', 'marketed', 13.10, true),
        (910002, 'DOLIPRANE', 'PARACETAMOL', '1 G', 'COMPRIME SECABLE', 'BOITE DE 16', 'SANOFI', 'Commercialisé', 'marketed', 20.00, true),
        (910003, 'DOLIPRANE', 'PARACETAMOL', '500 MG', 'GELULE', 'BOITE DE 16', 'SANOFI', 'Commercialisé', 'marketed', 9.00, true),
        (910004, 'EFFERALGAN', 'PARACETAMOL', '1 G', 'COMPRIME EFFERVESCENT', 'BOITE DE 8', 'UPSA', 'Non Commercialisé', 'not_marketed', null, true),
        (910005, 'VIOXX', 'ROFECOXIB', '25 MG', 'COMPRIME', 'BOITE DE 14', 'MSD', 'Retiré du Marché', 'withdrawn', null, true),
        (910006, 'ANCIENMED', 'PARACETAMOL // CODEINE', '500 MG', 'COMPRIME', 'BOITE DE 10', 'LABO', 'Commercialisé', 'marketed', 15.00, false)`);

    const adminAgent = await signInAdmin(admin);
    const invitations = captureInvitations(admin);
    const tenantId = await provisionCabinet(adminAgent, SUB, 'medicaments@e2e.test');
    clinic = await createClinicApp();
    owner = await signInDoctor(clinic, SUB, invitations.get('medicaments@e2e.test')!);
    colleague = await addStaff(clinic, adminAgent, tenantId, SUB, {
      name: 'Dr Collègue',
      email: 'collegue@medicaments.test',
      role: 'doctor',
    });
    secretary = await addStaff(clinic, adminAgent, tenantId, SUB, {
      name: 'Hind Accueil',
      email: 'accueil@medicaments.test',
      role: 'secretary',
    });
  });
  afterAll(async () => {
    await medicines?.query('delete from medications where ammps_id = any($1::int[])', [IDS]);
    await medicines?.end();
    await clinic?.close();
    await admin?.close();
  });

  it('is for doctors, from 2 letters', async () => {
    await cab(secretary).get('/medications/search').query({ q: 'doli' }).expect(403);
    await cab(secretary).get('/medications/custom').expect(403);
    await cab(owner).get('/medications/search').query({ q: 'd' }).expect(400);
  });

  it('suggests one line per medicine, boxes grouped, never withdrawn or inactive ones', async () => {
    const { items, catalog } = await search(owner, 'doli');
    expect(catalog).toBe(true);
    expect(keys(items)).toEqual(['ammps:910001', 'ammps:910003']);
    expect(items[0]).toMatchObject({
      source: 'ammps',
      label: 'DOLIPRANE 1 G, comprime secable',
      ppv: '13.10',
      isFavorite: false,
    });
    expect(items[0].presentations.map((p) => p.ammpsId)).toEqual([910001, 910002]);

    // By substance, accents aside; marketed first; not withdrawn (VIOXX), not inactive (ANCIENMED).
    expect(keys((await search(owner, 'paracétamol')).items)).toEqual([
      'ammps:910001',
      'ammps:910003',
      'ammps:910004',
    ]);
    expect((await search(owner, 'vioxx')).items).toEqual([]);
  });

  it("applies the doctor's own wording, posology and favorite — theirs only", async () => {
    await cab(owner)
      .put('/medications/ammps/910002/override')
      .send({ customName: 'Doliprane Sanofi', customDosage: '1 g', defaultPosology: '1 cp x 3 / j', isFavorite: true })
      .expect(200);

    const [first] = (await search(owner, 'doli')).items;
    expect(first).toMatchObject({
      key: 'ammps:910002',
      name: 'Doliprane Sanofi',
      dosage: '1 g',
      label: 'Doliprane Sanofi 1 g, comprime secable',
      defaultPosology: '1 cp x 3 / j',
      isFavorite: true,
    });
    // Their wording is searched too.
    expect(keys((await search(owner, 'sanofi')).items)).toContain('ammps:910002');

    // A field left out keeps its value.
    await cab(owner).put('/medications/ammps/910002/override').send({ isFavorite: false }).expect(200);
    expect((await search(owner, 'doli')).items.find((i) => i.key === 'ammps:910002')).toMatchObject({
      name: 'Doliprane Sanofi',
      isFavorite: false,
    });

    // The colleague sees the AMMPS values.
    expect((await search(colleague, 'doli')).items[0]).toMatchObject({ key: 'ammps:910001', name: 'DOLIPRANE' });
  });

  it('hides what the doctor hid, and an unknown medicine is 404', async () => {
    await cab(owner).put('/medications/ammps/910003/override').send({ isHidden: true }).expect(200);
    expect(keys((await search(owner, 'doli')).items)).toEqual(['ammps:910002']);
    await cab(owner).put('/medications/ammps/999999/override').send({ isFavorite: true }).expect(404);
  });

  it('tells the doctor when the AMMPS changes what they renamed, and takes the new value on accept', async () => {
    await medicines.query("update medications set dosage = '1000 MG' where ammps_id in (910001, 910002)");
    const { body: overrides } = await cab(owner).get('/medications/overrides').expect(200);
    const changed = overrides.find((o: { ammpsId: number }) => o.ammpsId === 910002);
    expect(changed).toMatchObject({
      customDosage: '1 g',
      baseDosage: '1 G',
      updatedByAmmps: true,
      ammps: { dosage: '1000 MG' },
    });

    const { body: accepted } = await cab(owner)
      .post('/medications/ammps/910002/override/accept-ammps')
      .expect(200);
    // Only the dosage changed: the doctor's name stays, their dosage gives way.
    expect(accepted).toMatchObject({
      customName: 'Doliprane Sanofi',
      customDosage: null,
      baseDosage: '1000 MG',
      defaultPosology: '1 cp x 3 / j',
      updatedByAmmps: false,
    });
    await cab(colleague).post('/medications/ammps/910002/override/accept-ammps').expect(404);
  });

  it('goes back to the AMMPS values when the override is deleted', async () => {
    await cab(owner).delete('/medications/ammps/910003/override').expect(204);
    // Back in the list; by name, "DOLIPRANE" comes before their "Doliprane Sanofi".
    expect(keys((await search(owner, 'doli')).items)).toEqual(['ammps:910003', 'ammps:910002']);
  });

  it("keeps each doctor's own medicines", async () => {
    const { body: cream } = await cab(owner)
      .post('/medications/custom')
      .send({ name: 'Crème magistrale urée 10 %', form: 'crème', defaultPosology: '2 applications / j', isFavorite: true })
      .expect(201);
    await cab(owner).post('/medications/custom').send({ name: 'crème MAGISTRALE urée 10 %', form: 'x' }).expect(409);

    const { items } = await search(owner, 'magis');
    expect(items[0]).toMatchObject({ source: 'custom', key: `custom:${cream.id}`, defaultPosology: '2 applications / j' });
    // "%" is searched for, not a wildcard.
    expect(keys((await search(owner, '10 %')).items)).toEqual([`custom:${cream.id}`]);
    expect((await search(colleague, 'magis')).items).toEqual([]);

    await cab(colleague).patch(`/medications/custom/${cream.id}`).send({ name: 'X' }).expect(404);
    const { body: renamed } = await cab(owner)
      .patch(`/medications/custom/${cream.id}`)
      .send({ dosage: '10 %' })
      .expect(200);
    expect(renamed).toMatchObject({ name: 'Crème magistrale urée 10 %', dosage: '10 %', isFavorite: true });

    const { body: favorites } = await cab(owner).get('/medications/favorites').expect(200);
    expect(favorites.map((f: Item) => f.key)).toEqual([`custom:${cream.id}`]);
  });

  it('warns before renewing an ordonnance with a withdrawn or removed medicine', async () => {
    const { body: gone } = await cab(owner).post('/medications/custom').send({ name: 'Sirop maison' }).expect(201);
    await cab(owner).delete(`/medications/custom/${gone.id}`).expect(204);
    await cab(owner).delete(`/medications/custom/${gone.id}`).expect(404);

    const { body } = await cab(owner)
      .post('/medications/check-renewal')
      .send({
        items: [
          { medication: 'DOLIPRANE 1000 MG', ammpsId: 910001 },
          { medication: 'VIOXX 25 MG', ammpsId: 910005 },
          { medication: 'ANCIENMED 500 MG', ammpsId: 910006 },
          { medication: 'Sirop maison', customMedicationId: gone.id },
          { medication: 'Vitamine D (tapée à la main)' },
        ],
      })
      .expect(200);
    expect(body).toEqual({
      catalog: true,
      warnings: [
        { index: 1, medication: 'VIOXX 25 MG', reason: 'withdrawn' },
        { index: 2, medication: 'ANCIENMED 500 MG', reason: 'removed' },
        { index: 3, medication: 'Sirop maison', reason: 'deleted' },
      ],
    });
  });

  it('never writes to the shared medicines database', async () => {
    const { MedicinesDb } = (await import(new URL('../../clinic-api/src/database/medicines.module.ts', import.meta.url).href)) as {
      MedicinesDb: new (...args: never[]) => { pool: Pool };
    };
    const { pool } = clinic.get(MedicinesDb);
    await expect(pool.query("update medications set name = 'X' where ammps_id = 910001")).rejects.toThrow(
      /read-only transaction/,
    );
  });
});
