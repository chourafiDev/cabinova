import type { INestApplication } from '@nestjs/common';
import type { Response } from 'supertest';
import { type Agent, createApp, signInAdmin, waitFor } from './app.js';
import {
  addStaff,
  captureInvitations,
  createClinicApp,
  onCabinet,
  provisionCabinet,
  signInDoctor,
} from './clinic.js';

const SUB = 'documents-atlas';

const PDF = Buffer.from(
  '%PDF-1.4\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n',
);
const PNG = Buffer.concat([
  Buffer.from('89504e470d0a1a0a', 'hex'),
  Buffer.alloc(32),
]);

/** The response body as raw bytes, whatever its type. */
const bytes = (
  res: Response,
  done: (err: Error | null, body: Buffer) => void,
) => {
  const chunks: Buffer[] = [];
  res.on('data', (c: Buffer) => chunks.push(c));
  res.on('end', () => done(null, Buffer.concat(chunks)));
};

/**
 * Patients' documents: the reception uploads scans and photos (PDF and
 * images only, told apart by their bytes), the whole team opens them, and
 * only the uploader or the responsible doctor deletes one.
 */
describe('clinic: patient documents', () => {
  let admin: INestApplication;
  let clinic: INestApplication;
  let owner: Agent;
  let doctor: Agent;
  let secretary: Agent;
  let patientId: string;

  const cab = (agent: Agent) => onCabinet(clinic, SUB, agent);
  const docs = () => `/patients/${patientId}/documents`;

  beforeAll(async () => {
    admin = await createApp();
    const adminAgent = await signInAdmin(admin);
    const invitations = captureInvitations(admin);
    const tenantId = await provisionCabinet(
      adminAgent,
      SUB,
      'documents@e2e.test',
    );
    clinic = await createClinicApp();
    owner = await signInDoctor(
      clinic,
      SUB,
      invitations.get('documents@e2e.test')!,
    );
    doctor = await addStaff(clinic, adminAgent, tenantId, SUB, {
      name: 'Dr Idrissi',
      email: 'idrissi@documents.test',
      role: 'doctor',
    });
    secretary = await addStaff(clinic, adminAgent, tenantId, SUB, {
      name: 'Salma Accueil',
      email: 'accueil@documents.test',
      role: 'secretary',
    });
    patientId = (
      await cab(owner)
        .post('/patients')
        .send({ firstName: 'Kamal', lastName: 'Benabbou', sex: 'male' })
        .expect(201)
    ).body.id;
  });
  afterAll(async () => {
    await clinic?.close();
    await admin?.close();
  });

  it('uploads at the reception, lists and gives the file back', async () => {
    const { body: uploaded } = await cab(secretary)
      .post(docs())
      .field('category', 'lab')
      .attach('file', PDF, {
        filename: 'Bilan sanguin – février.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);
    expect(uploaded).toMatchObject({
      category: 'lab',
      name: 'Bilan sanguin – février.pdf',
      contentType: 'application/pdf',
      size: PDF.length,
      uploadedBy: 'Salma Accueil',
    });

    const { body: list } = await cab(doctor).get(docs()).expect(200);
    expect(list.map((d: { id: string }) => d.id)).toEqual([uploaded.id]);

    const file = await cab(doctor)
      .get(`${docs()}/${uploaded.id}/file`)
      .buffer(true)
      .parse(bytes)
      .expect(200);
    expect(file.headers['content-type']).toBe('application/pdf');
    expect(file.headers['content-disposition']).toBe(
      `inline; filename*=UTF-8''${encodeURIComponent('Bilan sanguin – février.pdf')}`,
    );
    expect((file.body as Buffer).equals(PDF)).toBe(true);

    const download = await cab(doctor)
      .get(`${docs()}/${uploaded.id}/file?download=1`)
      .buffer(true)
      .parse(bytes)
      .expect(200);
    expect(download.headers['content-disposition']).toMatch(/^attachment;/);

    // Another patient's address doesn't reach it.
    const { body: other } = await cab(owner)
      .post('/patients')
      .send({ firstName: 'Nadia', lastName: 'Alaoui', sex: 'female' })
      .expect(201);
    await cab(owner)
      .get(`/patients/${other.id}/documents/${uploaded.id}/file`)
      .expect(404);
  });

  it('keeps PDFs and images only, up to 10 Mo', async () => {
    // The type comes from the bytes: a renamed text file is refused.
    const { body: fake } = await cab(secretary)
      .post(docs())
      .attach('file', Buffer.from('not a pdf'), {
        filename: 'faux.pdf',
        contentType: 'application/pdf',
      })
      .expect(400);
    expect(fake.code).toBe('DOCUMENT_TYPE');

    const { body: image } = await cab(secretary)
      .post(docs())
      .attach('file', PNG, {
        filename: 'radio.png',
        contentType: 'application/octet-stream',
      })
      .expect(201);
    expect(image).toMatchObject({
      category: 'other',
      contentType: 'image/png',
    });

    const { body: missing } = await cab(secretary)
      .post(docs())
      .field('category', 'lab')
      .expect(400);
    expect(missing.code).toBe('DOCUMENT_MISSING');

    const { body: tooLarge } = await cab(secretary)
      .post(docs())
      .attach(
        'file',
        Buffer.concat([PDF, Buffer.alloc(10 * 1024 * 1024)]),
        'scan.pdf',
      )
      .expect(413);
    expect(tooLarge.code).toBe('DOCUMENT_TOO_LARGE');

    await cab(secretary)
      .post(docs())
      .field('category', 'video')
      .attach('file', PDF, 'x.pdf')
      .expect(400);
  });

  it('is deleted by the uploader or the responsible doctor only', async () => {
    const upload = async (agent: Agent) =>
      (
        await cab(agent)
          .post(docs())
          .attach('file', PDF, 'ordonnance.pdf')
          .expect(201)
      ).body.id as string;

    const bySecretary = await upload(secretary);
    const { body: refused } = await cab(doctor)
      .delete(`${docs()}/${bySecretary}`)
      .expect(403);
    expect(refused.code).toBe('DOCUMENT_NOT_YOURS');
    await cab(owner).delete(`${docs()}/${bySecretary}`).expect(204);
    await cab(owner).get(`${docs()}/${bySecretary}/file`).expect(404);

    const byDoctor = await upload(doctor);
    await cab(doctor).delete(`${docs()}/${byDoctor}`).expect(204);

    // Written after the response: waited for.
    await waitFor(async () => {
      const { body: journal } = await cab(owner)
        .get('/activity?category=patients')
        .expect(200);
      const actions = journal.data.map(
        (e: { action: string; target: string }) => `${e.action} ${e.target}`,
      );
      return (
        actions.includes('document.delete BENABBOU Kamal') &&
        actions.includes('document.upload BENABBOU Kamal')
      );
    });
  });

  it("can't add to an archived file", async () => {
    await cab(owner).post(`/patients/${patientId}/archive`).expect(200);
    const { body } = await cab(secretary)
      .post(docs())
      .attach('file', PDF, 'x.pdf')
      .expect(409);
    expect(body.code).toBe('PATIENT_ARCHIVED');
    // Still readable.
    await cab(secretary).get(docs()).expect(200);
  });
});
