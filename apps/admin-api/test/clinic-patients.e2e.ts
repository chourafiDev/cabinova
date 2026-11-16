import type { INestApplication } from '@nestjs/common';
import { type Agent, createApp, signInAdmin } from './app.js';
import {
  captureInvitations,
  createClinicApp,
  onCabinet,
  provisionCabinet,
  signInDoctor,
} from './clinic.js';

const FATIMA = {
  firstName: 'Fatima Zahra',
  lastName: 'El Idrissi',
  sex: 'female',
  birthDate: '1990-04-12',
  cin: 'ab123456',
  phone: '06 12-34 56 78',
  city: 'Fès',
  coverage: 'cnss',
  coverageNumber: '123456789',
};

/**
 * Patients of a cabinet, in its own database: file numbers, accent-free
 * search, unique CIN, archiving, the doctors-only medical profile, and no
 * way to reach another cabinet's patients.
 */
describe('clinic: patients', () => {
  let admin: INestApplication;
  let clinic: INestApplication;
  let doctor: Agent;
  let neighbour: Agent;
  let fatimaId: string;

  const atlas = () => onCabinet(clinic, 'patients-atlas', doctor);

  beforeAll(async () => {
    admin = await createApp();
    const adminAgent = await signInAdmin(admin);
    const invitations = captureInvitations(admin);
    await provisionCabinet(adminAgent, 'patients-atlas', 'p-atlas@e2e.test');
    await provisionCabinet(adminAgent, 'patients-voisin', 'p-voisin@e2e.test');
    clinic = await createClinicApp();
    doctor = await signInDoctor(
      clinic,
      'patients-atlas',
      invitations.get('p-atlas@e2e.test')!,
    );
    neighbour = await signInDoctor(
      clinic,
      'patients-voisin',
      invitations.get('p-voisin@e2e.test')!,
    );
  });
  afterAll(async () => {
    await clinic?.close();
    await admin?.close();
  });

  it('creates patients with sequential file numbers and normalized fields', async () => {
    const { body: fatima } = await atlas()
      .post('/patients')
      .send(FATIMA)
      .expect(201);
    fatimaId = fatima.id;
    expect(fatima).toMatchObject({
      fileNumber: 1,
      firstName: 'Fatima Zahra',
      cin: 'AB123456',
      phone: '0612345678',
      birthDate: '1990-04-12',
      archivedAt: null,
    });
    const { body: karim } = await atlas()
      .post('/patients')
      .send({ firstName: 'Karim', lastName: 'Benjélloun', sex: 'male' })
      .expect(201);
    expect(karim.fileNumber).toBe(2);
    expect(karim.coverage).toBe('none');
  });

  it('refuses invalid fields and a CIN already on file', async () => {
    await atlas()
      .post('/patients')
      .send({ ...FATIMA, cin: 'pas-un-cin' })
      .expect(400);
    const { body } = await atlas()
      .post('/patients')
      .send({ ...FATIMA, firstName: 'Autre' })
      .expect(409);
    expect(body).toMatchObject({
      code: 'CIN_TAKEN',
      message: 'Ce CIN correspond déjà au dossier n° 1.',
    });
  });

  it('searches by name without accents, CIN, phone or file number', async () => {
    const find = async (search: string) =>
      (await atlas().get('/patients').query({ search }).expect(200)).body.data
        .map((p: { lastName: string }) => p.lastName)
        .sort();
    expect(await find('benjelloun')).toEqual(['Benjélloun']);
    expect(await find('zahra el idrissi')).toEqual(['El Idrissi']);
    expect(await find('idrissi fatima')).toEqual(['El Idrissi']);
    expect(await find('ab1234')).toEqual(['El Idrissi']);
    expect(await find('0612 34')).toEqual(['El Idrissi']);
    expect(await find('2')).toEqual(['Benjélloun']);
    expect(await find('%')).toEqual([]);
  });

  it('archives and restores instead of deleting', async () => {
    await atlas().post(`/patients/${fatimaId}/archive`).expect(200);
    const active = (await atlas().get('/patients').expect(200)).body;
    expect(active.total).toBe(1);
    const archived = (
      await atlas().get('/patients').query({ status: 'archived' }).expect(200)
    ).body;
    expect(archived.data[0].id).toBe(fatimaId);
    await atlas().post(`/patients/${fatimaId}/restore`).expect(200);
    expect((await atlas().get('/patients').expect(200)).body.total).toBe(2);
  });

  it('keeps the medical profile for doctors', async () => {
    const { body: saved } = await atlas()
      .put(`/patients/${fatimaId}/medical-profile`)
      .send({
        bloodGroup: 'O+',
        currentTreatments: 'Sintrom 4 mg',
        familyHistory: '',
      })
      .expect(200);
    expect(saved.medicalProfile).toMatchObject({
      bloodGroup: 'O+',
      currentTreatments: 'Sintrom 4 mg',
      familyHistory: null,
    });
    const { body } = await atlas().get(`/patients/${fatimaId}`).expect(200);
    expect(body.medicalProfile.currentTreatments).toBe('Sintrom 4 mg');
    // Allergies are no longer part of the profile.
    expect(body.medicalProfile).not.toHaveProperty('allergies');
    await atlas()
      .put(`/patients/${fatimaId}/medical-profile`)
      .send({ allergies: 'Pénicilline' })
      .expect(400);

    // Antécédents: one rich-text note, cleaned, saved on its own.
    const { body: note } = await atlas()
      .put(`/patients/${fatimaId}/antecedents`)
      .send({
        antecedents:
          '<p style="text-align: center">HTA <strong>2019</strong></p><script>alert(1)</script><img src=x onerror=alert(1)>',
      })
      .expect(200);
    expect(note.antecedents).toBe(
      '<p style="text-align:center">HTA <strong>2019</strong></p>',
    );
    // Saving the structured profile leaves the note alone.
    const { body: again } = await atlas()
      .put(`/patients/${fatimaId}/medical-profile`)
      .send({ bloodGroup: 'O+', currentTreatments: 'Sintrom 4 mg' })
      .expect(200);
    expect(again.medicalProfile.antecedents).toBe(note.antecedents);
    const { body: cleared } = await atlas()
      .put(`/patients/${fatimaId}/antecedents`)
      .send({ antecedents: '<p></p>' })
      .expect(200);
    expect(cleared.antecedents).toBeNull();

    // The permanent note: rich text, saved on its own, kept by a profile save.
    const { body: noted } = await atlas()
      .put(`/patients/${fatimaId}/permanent-note`)
      .send({ permanentNote: '<p>Malentendante : <strong>parler fort</strong></p><script>x</script>' })
      .expect(200);
    expect(noted.permanentNote).toBe('<p>Malentendante : <strong>parler fort</strong></p>');
    const { body: file } = await atlas().get(`/patients/${fatimaId}`).expect(200);
    expect(file.medicalProfile.permanentNote).toBe(noted.permanentNote);

    // Bilan: results kept on the patient, newest analysis first.
    const lab = () => atlas().post(`/patients/${fatimaId}/lab-results`);
    await lab()
      .send({ name: 'Glycémie à jeun', unit: 'g/L', value: '1,32', takenOn: '2026-01-10' })
      .expect(201);
    const { body: latest } = await lab()
      .send({ name: 'Glycémie à jeun', unit: 'g/L', value: ' 1,05 ', takenOn: '2026-03-02' })
      .expect(201);
    expect(latest).toMatchObject({ value: '1,05', unit: 'g/L', takenOn: '2026-03-02' });
    await lab()
      .send({ name: 'ECBU', value: 'Stérile', takenOn: '2999-01-01' })
      .expect(400);
    await lab().send({ name: 'ECBU', value: '', takenOn: '2026-03-02' }).expect(400);
    const { body: results } = await atlas()
      .get(`/patients/${fatimaId}/lab-results`)
      .expect(200);
    expect(results.map((r: { value: string }) => r.value)).toEqual(['1,05', '1,32']);
    await atlas()
      .delete(`/patients/${fatimaId}/lab-results/${latest.id}`)
      .expect(200);
    await atlas()
      .delete(`/patients/${fatimaId}/lab-results/${latest.id}`)
      .expect(404);
  });

  it('keeps each space isolated: patients of Fès are invisible from Marrakech', async () => {
    const { body: me } = await atlas().get('/auth/me').expect(200);
    expect(me.spaces.spaces).toHaveLength(1);
    const principal = me.spaces.current;
    expect(principal.name).toBe('Espace principal');

    // The owner opens a new branch and lands in it.
    const { body: created } = await atlas()
      .post('/spaces')
      .send({ name: 'Marrakech', city: 'Marrakech' })
      .expect(201);
    expect(created.current.name).toBe('Marrakech');
    expect(created.spaces.map((s: { name: string }) => s.name)).toEqual([
      'Espace principal',
      'Marrakech',
    ]);

    expect((await atlas().get('/patients').expect(200)).body.total).toBe(0);
    await atlas().get(`/patients/${fatimaId}`).expect(404);
    await atlas().put(`/patients/${fatimaId}`).send(FATIMA).expect(404);
    await atlas().post(`/patients/${fatimaId}/archive`).expect(404);
    // Same person, own file in this space: the CIN is unique per space.
    const { body: copy } = await atlas()
      .post('/patients')
      .send(FATIMA)
      .expect(201);
    expect(copy.fileNumber).toBeGreaterThan(2);

    // Back to the first space: only its own patients.
    await atlas()
      .put('/spaces/current')
      .send({ spaceId: principal.id })
      .expect(200);
    const back = (await atlas().get('/patients').expect(200)).body;
    expect(back.total).toBe(2);
    expect(back.data.map((p: { id: string }) => p.id)).not.toContain(copy.id);
    await atlas()
      .put('/spaces/current')
      .send({ spaceId: '00000000-0000-0000-0000-000000000000' })
      .expect(404);
  });

  it("never reaches another cabinet's patients", async () => {
    const other = onCabinet(clinic, 'patients-voisin', neighbour);
    expect((await other.get('/patients').expect(200)).body.total).toBe(0);
    await other.get(`/patients/${fatimaId}`).expect(404);
    await other.post(`/patients/${fatimaId}/archive`).expect(404);
    // Atlas's session on the neighbour's address: not signed in there.
    await onCabinet(clinic, 'patients-voisin', doctor)
      .get('/patients')
      .expect(401);
  });

  it('shows a same-name file and creates a homonym only once confirmed', async () => {
    // Accents, case, spaces and the order of the names don't hide it.
    const { body: first } = await atlas()
      .post('/patients')
      .send({ firstName: 'Youssef', lastName: 'El Idrissi', sex: 'male' })
      .expect(201);
    const { body: found } = await atlas()
      .get('/patients/homonyms?firstName=youssef&lastName=EL%20%20IDRISSI%20')
      .expect(200);
    expect(found).toEqual([
      expect.objectContaining({ id: first.id, lastName: 'El Idrissi' }),
    ]);
    const { body: swapped } = await atlas()
      .get('/patients/homonyms?firstName=El%20Idrissi&lastName=Youssef')
      .expect(200);
    expect(swapped).toHaveLength(1);

    const twin = { firstName: 'Youssef ', lastName: 'Él Idrissi', sex: 'male' };
    const { body: refused } = await atlas()
      .post('/patients')
      .send(twin)
      .expect(409);
    expect(refused.code).toBe('PATIENT_HOMONYM');
    expect(refused.patients).toEqual([
      expect.objectContaining({ id: first.id }),
    ]);

    const { body: homonym } = await atlas()
      .post('/patients')
      .send({ ...twin, allowHomonym: true })
      .expect(201);
    expect(homonym.fileNumber).toBe(first.fileNumber + 1);

    // Editing a file keeps its own name without asking; renaming onto another one asks.
    await atlas()
      .put(`/patients/${homonym.id}`)
      .send({ ...twin, phone: '0611223344' })
      .expect(200);
    const { body: own } = await atlas()
      .get(
        `/patients/homonyms?firstName=Youssef&lastName=El%20Idrissi&exceptId=${homonym.id}`,
      )
      .expect(200);
    expect(own.map((p: { id: string }) => p.id)).toEqual([first.id]);
    const { body: renamed } = await atlas()
      .put(`/patients/${fatimaId}`)
      .send({
        ...FATIMA,
        firstName: 'Youssef',
        lastName: 'El Idrissi',
        sex: 'male',
      })
      .expect(409);
    expect(renamed.patients).toHaveLength(2);

    // Another cabinet's Youssef is no homonym.
    const { body: elsewhere } = await onCabinet(
      clinic,
      'patients-voisin',
      neighbour,
    )
      .get('/patients/homonyms?firstName=Youssef&lastName=El%20Idrissi')
      .expect(200);
    expect(elsewhere).toEqual([]);
  });
});
