import type { INestApplication } from '@nestjs/common';
import { type Agent, createApp, signInAdmin } from './app.js';
import {
  addStaff,
  captureInvitations,
  createClinicApp,
  onCabinet,
  provisionCabinet,
  signInAgain,
  signInDoctor,
} from './clinic.js';

const SUB = 'reglages-atlas';
const EMAIL = 'reglages@e2e.test';
const week = (day: Record<string, { from: string; to: string }[]>) => ({
  0: [],
  1: [],
  2: [],
  3: [],
  4: [],
  5: [],
  6: [],
  ...day,
});

/** The editable fields of GET /settings/cabinet (the subdomain is Super Admin's). */
const identity = ({ subdomain: _, ...fields }: Record<string, unknown>) =>
  fields;

/**
 * Paramètres: profile, password and devices for everyone; the cabinet's
 * identity (synced to the catalog), spaces and agenda for the owner.
 */
describe('clinic: settings', () => {
  let admin: INestApplication;
  let clinic: INestApplication;
  let adminAgent: Agent;
  let doctor: Agent;
  let secretary: Agent;
  let tenantId: string;
  let firstSpaceId: string;

  const cab = (agent: Agent = doctor) => onCabinet(clinic, SUB, agent);

  beforeAll(async () => {
    admin = await createApp();
    adminAgent = await signInAdmin(admin);
    const invitations = captureInvitations(admin);
    tenantId = await provisionCabinet(adminAgent, SUB, EMAIL);
    clinic = await createClinicApp();
    doctor = await signInDoctor(clinic, SUB, invitations.get(EMAIL)!);
    secretary = await addStaff(clinic, adminAgent, tenantId, SUB, {
      name: 'Salma Secrétaire',
      email: 'secretaire@reglages.test',
      role: 'secretary',
    });
    const { body } = await cab().get('/auth/me').expect(200);
    firstSpaceId = body.spaces.current.id;
  });
  afterAll(async () => {
    await clinic?.close();
    await admin?.close();
  });

  it('renames the signed-in person', async () => {
    const { body } = await cab(secretary)
      .put('/settings/profile')
      .send({ name: '  Salma Idrissi ' })
      .expect(200);
    expect(body.name).toBe('Salma Idrissi');
    const { body: me } = await cab(secretary).get('/auth/me').expect(200);
    expect(me.user.name).toBe('Salma Idrissi');
    await cab(secretary)
      .put('/settings/profile')
      .send({ name: 'S' })
      .expect(400);
  });

  it('lists devices and signs out another one', async () => {
    const laptop = await signInAgain(clinic, SUB, EMAIL);
    const { body: sessions } = await cab()
      .get('/settings/sessions')
      .expect(200);
    expect(sessions.length).toBeGreaterThanOrEqual(2);
    expect(sessions[0].current).toBe(true);
    const other = sessions.find((s: { current: boolean }) => !s.current);

    // Not someone else's session, and not the current one.
    await cab(secretary).delete(`/settings/sessions/${other.id}`).expect(404);
    await cab().delete(`/settings/sessions/${sessions[0].id}`).expect(404);

    await cab().delete(`/settings/sessions/${other.id}`).expect(204);
    await cab(laptop).get('/auth/me').expect(401);
    await cab().get('/auth/me').expect(200);
  });

  it('changes the password and signs out the other devices', async () => {
    const phone = await signInAgain(clinic, SUB, EMAIL);
    const { body: wrong } = await cab()
      .put('/settings/password')
      .send({ currentPassword: 'faux', newPassword: 'nouveau-mot-de-passe' })
      .expect(400);
    expect(wrong.code).toBe('WRONG_PASSWORD');
    await cab()
      .put('/settings/password')
      .send({ currentPassword: 'mot-de-passe-docteur', newPassword: 'court' })
      .expect(400);

    await cab()
      .put('/settings/password')
      .send({
        currentPassword: 'mot-de-passe-docteur',
        newPassword: 'nouveau-mot-de-passe',
      })
      .expect(204);
    await cab(phone).get('/auth/me').expect(401);
    await cab().get('/auth/me').expect(200);
    await signInAgain(clinic, SUB, EMAIL, 'nouveau-mot-de-passe');
  });

  it('keeps the cabinet, spaces and agenda settings to the owner', async () => {
    await cab(secretary).get('/settings/cabinet').expect(403);
    await cab(secretary)
      .put('/settings/agenda')
      .send({ defaultAppointmentMinutes: 20 })
      .expect(403);
    await cab(secretary).get('/spaces/manage').expect(403);
    await cab(secretary)
      .put(`/spaces/${firstSpaceId}/hours`)
      .send({ openingHours: week({}) })
      .expect(403);
    // Everyone reads the agenda settings (booking form).
    const { body } = await cab(secretary).get('/settings/agenda').expect(200);
    expect(body).toEqual({ defaultAppointmentMinutes: 30 });
  });

  it('edits the identity in the catalog, audited as the cabinet’s change', async () => {
    const { body: before } = await cab().get('/settings/cabinet').expect(200);
    expect(before).toMatchObject({
      name: `Cabinet ${SUB}`,
      subdomain: SUB,
      email: EMAIL,
    });

    const { body } = await cab()
      .put('/settings/cabinet')
      .send({
        ...identity(before),
        name: 'Cabinet Atlas Santé',
        city: 'Fès',
        phone: '0535 00 00 00',
        legalName: '',
      })
      .expect(200);
    expect(body).toMatchObject({
      name: 'Cabinet Atlas Santé',
      city: 'Fès',
      legalName: null,
    });

    // Super Admin sees it, with who changed it.
    const { body: tenant } = await adminAgent
      .get(`/tenants/${tenantId}`)
      .expect(200);
    expect(tenant).toMatchObject({ name: 'Cabinet Atlas Santé', city: 'Fès' });
    const { body: audit } = await adminAgent
      .get(`/tenants/${tenantId}/audit`)
      .expect(200);
    expect(audit.data[0]).toMatchObject({
      action: 'tenant.update',
      actor: null,
      metadata: {
        source: 'clinic',
        by: { name: expect.any(String) },
        changes: {
          name: { from: `Cabinet ${SUB}`, to: 'Cabinet Atlas Santé' },
          city: { from: null, to: 'Fès' },
        },
      },
    });
    // The clinic app shows the new name right away (cache dropped).
    const { body: me } = await cab().get('/auth/me').expect(200);
    expect(me.cabinet.name).toBe('Cabinet Atlas Santé');
  });

  it('refuses a name or e-mail another cabinet uses', async () => {
    const { body: current } = await cab().get('/settings/cabinet').expect(200);
    await adminAgent
      .post('/tenants')
      .send({
        name: 'Cabinet Réglages Voisin',
        responsibleName: 'Dr Réglages Voisin',
        email: 'reglages-voisin@e2e.test',
        subdomain: 'reglages-voisin',
        planKey: 'pro',
      })
      .expect(201);
    const { body: name } = await cab()
      .put('/settings/cabinet')
      .send({ ...identity(current), name: 'cabinet réglages voisin' })
      .expect(409);
    expect(name.code).toBe('NAME_TAKEN');
    const { body: email } = await cab()
      .put('/settings/cabinet')
      .send({ ...identity(current), email: 'Reglages-Voisin@e2e.test' })
      .expect(409);
    expect(email.code).toBe('EMAIL_TAKEN');
  });

  it('sets the default booking duration', async () => {
    await cab()
      .put('/settings/agenda')
      .send({ defaultAppointmentMinutes: 25 })
      .expect(400);
    await cab()
      .put('/settings/agenda')
      .send({ defaultAppointmentMinutes: 20 })
      .expect(200);
    const { body } = await cab(secretary).get('/settings/agenda').expect(200);
    expect(body.defaultAppointmentMinutes).toBe(20);
  });

  it('edits a space and its opening hours', async () => {
    const { body: space } = await cab()
      .put(`/spaces/${firstSpaceId}`)
      .send({ name: 'Fès centre', city: 'Fès', address: null, phone: null })
      .expect(200);
    expect(space.name).toBe('Fès centre');
    // Default hours from the migration: Mon–Fri 08–18, Sat 08–13.
    expect(space.openingHours[6]).toEqual([{ from: '08:00', to: '13:00' }]);

    const { body: overlap } = await cab()
      .put(`/spaces/${firstSpaceId}/hours`)
      .send({
        openingHours: week({
          1: [
            { from: '09:00', to: '13:00' },
            { from: '12:00', to: '19:00' },
          ],
        }),
      })
      .expect(400);
    expect(overlap.code).toBe('INVALID_OPENING_HOURS');

    const hours = week({
      1: [
        { from: '15:00', to: '19:00' },
        { from: '09:00', to: '13:00' },
      ],
    });
    const { body: saved } = await cab()
      .put(`/spaces/${firstSpaceId}/hours`)
      .send({ openingHours: hours })
      .expect(200);
    expect(saved.openingHours[1]).toEqual([
      { from: '09:00', to: '13:00' },
      { from: '15:00', to: '19:00' },
    ]);
    // Staff get them with their current space (the agenda uses them).
    const { body: me } = await cab(secretary).get('/auth/me').expect(200);
    expect(me.spaces.current.openingHours[1]).toHaveLength(2);
  });

  it('closes and reopens a space, never the last open one', async () => {
    const { body: last } = await cab()
      .post(`/spaces/${firstSpaceId}/close`)
      .expect(409);
    expect(last.code).toBe('LAST_SPACE');

    const { body: created } = await cab()
      .post('/spaces')
      .send({ name: 'Marrakech' })
      .expect(201);
    const marrakech = created.current.id;
    await cab().post(`/spaces/${marrakech}/close`).expect(200);

    // Closed: out of the switcher, still in Paramètres; the owner was moved.
    const { body: me } = await cab().get('/auth/me').expect(200);
    expect(me.spaces.current.id).toBe(firstSpaceId);
    expect(me.spaces.spaces.map((s: { id: string }) => s.id)).not.toContain(
      marrakech,
    );
    const { body: all } = await cab().get('/spaces/manage').expect(200);
    expect(all.find((s: { id: string }) => s.id === marrakech)).toMatchObject({
      active: false,
      patients: 0,
    });

    await cab().post(`/spaces/${marrakech}/reopen`).expect(200);
    const { body: again } = await cab().get('/spaces').expect(200);
    expect(again.spaces.map((s: { id: string }) => s.id)).toContain(marrakech);
  });
});
