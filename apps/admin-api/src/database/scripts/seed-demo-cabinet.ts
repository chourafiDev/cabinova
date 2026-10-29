// `pnpm db:seed-demo <subdomain>`: fills a cabinet with demo data to try
// the clinic app — patients (some with antécédents), five months of agenda
// in each space, a price list, checked-out visits, payments, a refund, a
// cancelled payment and the daily cash closes. Development only.
//
// It only adds: what the cabinet already holds is left alone, and the
// offer's limits are respected (demo staff are secretaries; every visit is
// with the responsible doctor unless the offer allows more doctors).
// `pnpm db:seed-demo <subdomain> --remove` takes the demo data back out.
//
// Demo secretaries sign in with DEMO_PASSWORD below (a test value).
import 'dotenv/config';
import { SecretBox } from '@cabinova/secret-box';
import { Pool, type PoolClient } from '@neondatabase/serverless';
import argon2 from 'argon2';
import { configureNeon } from '../neon.js';

const DEMO_NOTE = 'Patient de démonstration';
const DEMO_DOMAIN = 'demo.cabinova.ma';
const DEMO_PASSWORD = 'demo-cabinova-2026';
const TZ = 'Africa/Casablanca';

const [subdomain, flag] = process.argv.slice(2);
if (!subdomain) {
  console.error('Usage: pnpm db:seed-demo <subdomain> [--remove]');
  process.exit(1);
}
if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed demo data in production.');
  process.exit(1);
}

// ── Deterministic randomness (same data on every run) ──────────────────────
let seed = 20261029;
const random = () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = <T>(items: readonly T[]) =>
  items[Math.floor(random() * items.length)];
const chance = (p: number) => random() < p;
const between = (min: number, max: number) =>
  min + Math.floor(random() * (max - min + 1));

const addDays = (day: string, n: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000)
    .toISOString()
    .slice(0, 10);
/** 1 = Monday … 7 = Sunday */
const weekday = (day: string) => new Date(`${day}T00:00:00Z`).getUTCDay() || 7;
const minutes = (time: string) =>
  Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
const clock = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

// ── Moroccan names and details ─────────────────────────────────────────────
const WOMEN = [
  'Fatima Zahra',
  'Khadija',
  'Salma',
  'Imane',
  'Meryem',
  'Nadia',
  'Hajar',
  'Sara',
  'Houda',
  'Amina',
  'Zineb',
  'Latifa',
  'Soukaina',
  'Kawtar',
  'Hanane',
  'Rachida',
  'Asmae',
  'Ghita',
  'Loubna',
  'Nour',
];
const MEN = [
  'Mohamed',
  'Youssef',
  'Ahmed',
  'Omar',
  'Hamza',
  'Mehdi',
  'Karim',
  'Rachid',
  'Said',
  'Anas',
  'Ayoub',
  'Hassan',
  'Abdellah',
  'Ilyas',
  'Othmane',
  'Driss',
  'Mustapha',
  'Amine',
  'Reda',
  'Yassine',
];
const LAST = [
  'El Idrissi',
  'Benjelloun',
  'Alaoui',
  'Bennani',
  'Tazi',
  'Fassi',
  'Berrada',
  'Chraibi',
  'El Amrani',
  'Ouazzani',
  'Lahlou',
  'Sebti',
  'Kettani',
  'Belkadi',
  'Ziani',
  'Haddad',
  'El Mansouri',
  'Bouzid',
  'Amrani',
  'Naciri',
  'Lamrani',
  'Cherkaoui',
  'El Ouafi',
  'Rami',
  'Skalli',
];
const STREETS = [
  'Rue Ibn Sina',
  'Avenue Hassan II',
  'Boulevard Zerktouni',
  'Rue Moulay Ismail',
  'Avenue Mohammed V',
  'Rue Allal Ben Abdellah',
  'Boulevard Al Massira',
  'Rue de Fès',
];
const COVERAGE = [
  'cnss',
  'cnss',
  'cnss',
  'cnops',
  'cnops',
  'amo_tadamon',
  'far',
  'private',
  'none',
  'none',
] as const;
const INSURERS = [
  'Wafa Assurance',
  'Saham Assurance',
  'AXA Assurance Maroc',
  'RMA',
];
const REASONS = [
  'Consultation générale',
  'Contrôle tension',
  'Renouvellement d’ordonnance',
  'Douleurs lombaires',
  'Fièvre et toux',
  'Bilan annuel',
  'Certificat médical',
  'Suivi diabète',
  'Maux de tête',
  'Résultats d’analyses',
  'Douleurs abdominales',
  'Suivi grossesse',
  'Vaccination',
  null,
  null,
];
const BLOOD = ['A+', 'A+', 'O+', 'O+', 'O+', 'B+', 'AB+', 'A-', 'O-'] as const;
const ALLERGIES = ['Pénicilline', 'Aspirine', 'Arachides', 'Pollen', 'Iode'];
const CHRONIC = [
  'Hypertension artérielle',
  'Diabète de type 2',
  'Asthme',
  'Hypothyroïdie',
  'Hypercholestérolémie',
];
const TREATMENTS = [
  'Amlodipine 5 mg, 1 cp/jour',
  'Metformine 850 mg, 2 cp/jour',
  'Ventoline si besoin',
  'Levothyrox 50 µg',
  'Atorvastatine 20 mg',
];
const ACTS = [
  { name: 'Consultation', price: 25000 },
  { name: 'Contrôle', price: 15000 },
  { name: 'ECG', price: 30000 },
  { name: 'Échographie', price: 40000 },
  { name: 'Certificat médical', price: 10000 },
  { name: 'Injection', price: 8000 },
];

configureNeon();

/** The cabinet's own database, with its own credentials (like clinic-api). */
async function connect() {
  const catalog = new Pool({ connectionString: process.env.DATABASE_URL });
  const { rows } = await catalog.query<{
    id: string;
    name: string;
    host: string;
    database_name: string;
    role_name: string;
    ciphertext: string;
    key_version: number;
    max_doctors: number | null;
    max_secretaries: number | null;
    schema_version: string;
  }>(
    `select t.id, t.name, db.host, db.database_name, db.role_name, db.schema_version,
            s.ciphertext, s.key_version, t.max_doctors, t.max_secretaries
       from tenant_domains d
       join tenants t on t.id = d.tenant_id
       join tenant_databases db on db.tenant_id = t.id
       join tenant_secrets s on s.id = db.secret_ref
      where d.subdomain = $1`,
    [subdomain],
  );
  await catalog.end();
  const tenant = rows[0];
  if (!tenant) throw new Error(`No cabinet with a database at "${subdomain}".`);
  const box = SecretBox.fromEnv(
    process.env.TENANT_SECRETS_KEY!,
    Number(process.env.TENANT_SECRETS_KEY_VERSION ?? 1),
    process.env.TENANT_SECRETS_PREVIOUS_KEYS,
  );
  const url = new URL(`postgresql://${tenant.host}/${tenant.database_name}`);
  url.username = tenant.role_name;
  url.password = box.decrypt(tenant.ciphertext, tenant.key_version, tenant.id);
  if (!process.env.NEON_WS_PROXY) url.searchParams.set('sslmode', 'require');
  return {
    tenant,
    pool: new Pool({ connectionString: url.toString(), max: 1 }),
  };
}

async function remove(db: PoolClient) {
  const patients = `(select id from patients where notes = '${DEMO_NOTE}')`;
  const staff = `(select id from users where email like '%@${DEMO_DOMAIN}')`;
  const counts: Record<string, number> = {};
  for (const [label, sql] of [
    ['payments', `delete from payments where patient_id in ${patients}`],
    ['charges', `delete from charges where patient_id in ${patients}`],
    ['cash closes', `delete from cash_closes where closed_by in ${staff}`],
    [
      'appointments',
      `delete from appointments where patient_id in ${patients}`,
    ],
    ['patients', `delete from patients where notes = '${DEMO_NOTE}'`],
    ['staff', `delete from users where email like '%@${DEMO_DOMAIN}'`],
  ] as const) {
    counts[label] = (await db.query(sql)).rowCount ?? 0;
  }
  console.log('Removed:', counts, '(the price list is kept)');
}

type Patient = { id?: string; spaceIndex: number; since: string };
type Visit = {
  spaceIndex: number;
  patient: Patient;
  practitionerId: string;
  day: string;
  time: string;
  status: string;
  reason: string | null;
  bookedDaysBefore: number;
};

async function seedDemo(
  db: PoolClient,
  limits: { doctors: number | null; secretaries: number | null },
) {
  const { rows: existing } = await db.query(
    `select 1 from patients where notes = $1 limit 1`,
    [DEMO_NOTE],
  );
  if (existing.length) {
    throw new Error(
      'Demo data is already there: run with --remove first to seed again.',
    );
  }
  const {
    rows: [now],
  } = await db.query<{ today: string; time: string }>(
    `select to_char(now() at time zone '${TZ}', 'YYYY-MM-DD') as today,
            to_char(now() at time zone '${TZ}', 'HH24:MI') as time`,
  );
  const today = now.today;
  const spaces = (
    await db.query<{ id: string; name: string }>(
      'select id, name from spaces where active order by created_at',
    )
  ).rows;
  const owner = (
    await db.query<{ id: string }>(
      "select id from users where role = 'owner' limit 1",
    )
  ).rows[0];
  if (!owner) throw new Error('This cabinet has no responsible doctor yet.');

  // ── Staff: secretaries within the offer ──────────────────────────────────
  const {
    rows: [team],
  } = await db.query<{ doctors: number; secretaries: number }>(
    `select count(*) filter (where role in ('owner', 'doctor'))::int as doctors,
            count(*) filter (where role = 'secretary')::int as secretaries
       from users where active`,
  );
  const hash = await argon2.hash(DEMO_PASSWORD);
  const secretaryRoom =
    limits.secretaries === null ? 2 : limits.secretaries - team.secretaries;
  let deskId = owner.id;
  if (secretaryRoom > 0) {
    const { rows } = await db.query<{ id: string }>(
      `insert into users (name, email, role, password_hash, last_login_at, tour_completed_at)
       values ('Nadia Benjelloun', 'nadia@${DEMO_DOMAIN}', 'secretary', $1, now() - interval '2 hours', now())
       returning id`,
      [hash],
    );
    deskId = rows[0].id;
    await db.query(
      `insert into space_members (space_id, user_id) select id, $1 from spaces where active`,
      [deskId],
    );
  }
  // A former secretary, deactivated (shows in Équipe › Désactivés).
  const { rows: former } = await db.query<{ id: string }>(
    `insert into users (name, email, role, password_hash, active, last_login_at, tour_completed_at)
     values ('Karim Idrissi', 'karim@${DEMO_DOMAIN}', 'secretary', $1, false, now() - interval '40 days', now())
     returning id`,
    [hash],
  );
  await db.query(
    'insert into space_members (space_id, user_id) values ($1, $2)',
    [spaces[0].id, former[0].id],
  );
  // A demo doctor only when the offer has room for one more.
  const doctors = [owner.id];
  if (limits.doctors === null || limits.doctors > team.doctors) {
    const { rows } = await db.query<{ id: string }>(
      `insert into users (name, email, role, password_hash, last_login_at, tour_completed_at)
       values ('Dr Yassine Amrani', 'amrani@${DEMO_DOMAIN}', 'doctor', $1, now() - interval '1 day', now())
       returning id`,
      [hash],
    );
    doctors.push(rows[0].id);
    await db.query(
      `insert into space_members (space_id, user_id) select id, $1 from spaces where active`,
      [rows[0].id],
    );
  }

  // ── Price list (kept if it already has these names) ──────────────────────
  await db.query(
    `insert into acts (name, price)
     select * from unnest($1::text[], $2::int[]) on conflict do nothing`,
    [ACTS.map((a) => a.name), ACTS.map((a) => a.price)],
  );
  const acts = new Map(
    (
      await db.query<{ id: string; name: string; price: number }>(
        'select id, name, price from acts',
      )
    ).rows.map((a) => [a.name, a]),
  );

  // ── Patients ────────────────────────────────────────────────────────────
  const perSpace = spaces.map((_, i) => (i === 0 ? 60 : 28));
  const patients: (Patient & Record<string, unknown>)[] = [];
  const cins = new Set<string>();
  spaces.forEach((space, spaceIndex) => {
    for (let n = 0; n < perSpace[spaceIndex]; n++) {
      const female = chance(0.56);
      const coverage = pick(COVERAGE);
      let cin: string | null = null;
      if (chance(0.85)) {
        do
          cin = `${pick(['BK', 'BE', 'BJ', 'A', 'AB', 'EE', 'G', 'H', 'JB'])}${between(10000, 999999)}`;
        while (cins.has(cin));
        cins.add(cin);
      }
      const child = chance(0.15);
      patients.push({
        spaceIndex,
        // Most are followed for a while; some came for the first time recently.
        since: chance(0.78)
          ? addDays(today, -between(150, 600))
          : addDays(today, -between(0, 140)),
        first_name: female ? pick(WOMEN) : pick(MEN),
        last_name: pick(LAST),
        sex: female ? 'female' : 'male',
        birth_date: chance(0.92)
          ? addDays(
              today,
              -(child ? between(365, 14 * 365) : between(16 * 365, 85 * 365)),
            )
          : null,
        cin: child ? null : cin,
        phone: chance(0.9)
          ? `0${pick(['6', '6', '7', '5'])}${between(10000000, 99999999)}`
          : null,
        email: chance(0.3) ? `patient${patients.length + 1}@exemple.ma` : null,
        address: chance(0.7) ? `${between(1, 180)}, ${pick(STREETS)}` : null,
        city:
          spaceIndex === 0
            ? pick(['Casablanca', 'Casablanca', 'Mohammedia'])
            : 'Marrakech',
        coverage,
        coverage_number:
          coverage !== 'none' && coverage !== 'private'
            ? String(between(100000000, 999999999))
            : null,
        insurer: coverage === 'private' ? pick(INSURERS) : null,
        emergency_contact_name: chance(0.4)
          ? `${pick(female ? MEN : WOMEN)} ${pick(LAST)} (${pick(['époux', 'épouse', 'fils', 'fille', 'mère', 'frère'])})`
          : null,
        emergency_contact_phone: null,
      });
    }
  });
  for (const p of patients) {
    if (p.emergency_contact_name)
      p.emergency_contact_phone = `06${between(10000000, 99999999)}`;
  }
  const cols = [
    'first_name',
    'last_name',
    'sex',
    'birth_date',
    'cin',
    'phone',
    'email',
    'address',
    'city',
    'coverage',
    'coverage_number',
    'insurer',
    'emergency_contact_name',
    'emergency_contact_phone',
  ];
  const { rows: inserted } = await db.query<{ id: string }>(
    `insert into patients (space_id, ${cols.join(', ')}, notes, created_by, created_at, updated_at)
     select s, f, l, x::sex, b::date, c, ph, e, a, ci, co::coverage, cn, i, ecn, ecp, $16, $17,
            (d::timestamp + interval '8 hours') at time zone '${TZ}',
            (d::timestamp + interval '8 hours') at time zone '${TZ}'
       from unnest($1::uuid[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::text[],
                   $8::text[], $9::text[], $10::text[], $11::text[], $12::text[], $13::text[], $14::text[],
                   $15::text[], $18::text[])
         with ordinality as t(s, f, l, x, b, c, ph, e, a, ci, co, cn, i, ecn, ecp, d, n)
      order by n
     returning id`,
    [
      patients.map((p) => spaces[p.spaceIndex].id),
      ...cols.map((c) => patients.map((p) => p[c] as string | null)),
      DEMO_NOTE,
      deskId,
      patients.map((p) => p.since),
    ],
  );
  inserted.forEach((r, i) => (patients[i].id = r.id));

  // Antécédents for most adults.
  const profiled = patients.filter(() => chance(0.6));
  await db.query(
    `insert into medical_profiles (patient_id, blood_group, allergies, chronic_conditions, medical_history,
                                   surgical_history, family_history, current_treatments, updated_by)
     select * , $9::uuid from unnest($1::uuid[], $2::blood_group[], $3::text[], $4::text[], $5::text[],
                                     $6::text[], $7::text[], $8::text[])`,
    [
      profiled.map((p) => p.id),
      profiled.map(() => (chance(0.8) ? pick(BLOOD) : null)),
      profiled.map(() => (chance(0.2) ? pick(ALLERGIES) : null)),
      profiled.map(() => (chance(0.35) ? pick(CHRONIC) : null)),
      profiled.map(() =>
        chance(0.3)
          ? pick([
              'Appendicectomie en 2012',
              'Fracture du poignet (2018)',
              'COVID-19 en 2021',
              'Pneumopathie en 2019',
            ])
          : null,
      ),
      profiled.map(() =>
        chance(0.2)
          ? pick([
              'Cholécystectomie (2016)',
              'Césarienne (2015)',
              'Amygdalectomie dans l’enfance',
            ])
          : null,
      ),
      profiled.map(() =>
        chance(0.3)
          ? pick([
              'Père diabétique',
              'Mère hypertendue',
              'Antécédents cardiaques chez le père',
            ])
          : null,
      ),
      profiled.map(() => (chance(0.3) ? pick(TREATMENTS) : null)),
      doctors[0],
    ],
  );

  // ── Agenda: 5 months back, 3 weeks ahead ─────────────────────────────────
  // One doctor can't be in two places: with a single doctor, the second
  // space opens two weekdays (Tue/Thu, or Wed/Fri when today is one of
  // them, so today's agenda is in the first space) and the first the rest.
  const secondDays = [2, 4].includes(weekday(today)) ? [3, 5] : [2, 4];
  const visits: Visit[] = [];
  const nowMinutes = minutes(now.time);
  for (let offset = -150; offset <= 21; offset++) {
    const day = addDays(today, offset);
    const wd = weekday(day);
    if (wd === 7) continue;
    const spaceIndex =
      spaces.length > 1 && doctors.length === 1 && secondDays.includes(wd)
        ? 1
        : 0;
    const slots =
      wd === 6
        ? [540, 570, 600, 630, 660, 690]
        : [540, 570, 600, 630, 660, 690, 870, 900, 930, 960, 990, 1020, 1050];
    const fill =
      offset < 0 ? 0.68 : offset === 0 ? 0.8 : offset <= 7 ? 0.55 : 0.25;
    const pool = patients.filter(
      (p) => p.spaceIndex === spaceIndex && p.since <= day,
    );
    for (const practitionerId of doctors) {
      // A second doctor works the other space the same day.
      const space =
        doctors.length > 1 && practitionerId !== doctors[0]
          ? spaceIndex === 0 && spaces.length > 1
            ? 1
            : 0
          : spaceIndex;
      const candidates =
        space === spaceIndex
          ? pool
          : patients.filter((p) => p.spaceIndex === space && p.since <= day);
      for (const slot of slots) {
        if (!chance(fill) || candidates.length === 0) continue;
        let status: string;
        if (offset < 0)
          status = chance(0.07)
            ? 'cancelled'
            : chance(0.07)
              ? 'no_show'
              : 'completed';
        else if (offset > 0)
          status = chance(0.06)
            ? 'cancelled'
            : chance(0.4)
              ? 'confirmed'
              : 'scheduled';
        else if (slot + 30 <= nowMinutes)
          status = chance(0.1) ? 'no_show' : 'completed';
        else if (slot <= nowMinutes) status = 'in_consultation';
        else if (slot <= nowMinutes + 150)
          status = chance(0.6) ? 'arrived' : 'confirmed';
        else status = chance(0.5) ? 'confirmed' : 'scheduled';
        visits.push({
          spaceIndex: space,
          patient: pick(candidates),
          practitionerId,
          day,
          time: clock(slot),
          status,
          reason: pick(REASONS),
          bookedDaysBefore: pick([
            0, 0, 1, 1, 2, 3, 3, 5, 7, 7, 10, 14, 21, 30,
          ]),
        });
      }
    }
  }
  const { rows: appointments } = await db.query<{ id: string }>(
    `insert into appointments (space_id, patient_id, practitioner_id, starts_at, ends_at, status, reason,
                               arrived_at, created_by, created_at, updated_at)
     select s, p, u, st, st + interval '30 minutes', x::appointment_status, r,
            case when x in ('arrived', 'in_consultation', 'completed')
                 then st - make_interval(mins => 5 + (n % 20)::int) end,
            $9, greatest(st - make_interval(days => b), pc), st
       from (select s, p, u, (d::timestamp at time zone '${TZ}') as st, x, r, b, pc, n
               from unnest($1::uuid[], $2::uuid[], $3::uuid[], $4::text[], $5::text[], $6::text[], $7::int[],
                           $8::timestamptz[])
                 with ordinality as t(s, p, u, d, x, r, b, pc, n)) v
      order by n
     returning id`,
    [
      visits.map((v) => spaces[v.spaceIndex].id),
      visits.map((v) => v.patient.id),
      visits.map((v) => v.practitionerId),
      visits.map((v) => `${v.day} ${v.time}`),
      visits.map((v) => v.status),
      visits.map((v) => v.reason),
      visits.map((v) => v.bookedDaysBefore),
      visits.map((v) => `${v.patient.since}T09:00:00Z`),
      deskId,
    ],
  );

  // ── Encaissements: acts, payments, a refund, a cancelled payment ──────────
  type Move = {
    chargeIndex: number;
    kind: 'payment' | 'refund';
    method: string;
    amount: number;
    at: string;
    by: string;
    reference: string | null;
    reason: string | null;
    cancel: string | null;
  };
  const charges: {
    visit: Visit;
    appointmentId: string;
    items: { act: string; quantity: number }[];
    total: number;
  }[] = [];
  const moves: Move[] = [];
  visits.forEach((v, i) => {
    if (v.status !== 'completed') return;
    // Today's last visits are left to check out at the desk.
    if (v.day === today && chance(0.5)) return;
    if (v.day < today && chance(0.06)) return;
    const items = [
      {
        act: pick([
          'Consultation',
          'Consultation',
          'Consultation',
          'Contrôle',
          'Contrôle',
          'Certificat médical',
        ]),
        quantity: 1,
      },
    ];
    if (chance(0.12)) items.push({ act: 'ECG', quantity: 1 });
    if (chance(0.06)) items.push({ act: 'Échographie', quantity: 1 });
    if (chance(0.05))
      items.push({ act: 'Injection', quantity: chance(0.3) ? 2 : 1 });
    const total = items.reduce(
      (s, it) => s + acts.get(it.act)!.price * it.quantity,
      0,
    );
    const chargeIndex =
      charges.push({
        visit: v,
        appointmentId: appointments[i].id,
        items,
        total,
      }) - 1;
    const at = `${v.day} ${clock(minutes(v.time) + between(25, 45))}`;
    const method = pick([
      'cash',
      'cash',
      'cash',
      'cash',
      'card',
      'card',
      'cheque',
      'transfer',
    ]);
    const reference =
      method === 'cheque'
        ? `Chèque n° ${between(1000000, 9999999)}`
        : method === 'card'
          ? `TPE ${between(100000, 999999)}`
          : null;
    const by = chance(0.75) ? deskId : owner.id;
    const r = random();
    if (r < 0.82)
      moves.push({
        chargeIndex,
        kind: 'payment',
        method,
        amount: total,
        at,
        by,
        reference,
        reason: null,
        cancel: null,
      });
    else if (r < 0.91)
      moves.push({
        chargeIndex,
        kind: 'payment',
        method: 'cash',
        amount: Math.round(total / 200) * 100,
        at,
        by,
        reference: null,
        reason: null,
        cancel: null,
      });
    // else: not paid yet
  });
  // A payment entered twice by mistake, cancelled; a refund for an act not done.
  const paidMoves = moves.filter((m) => m.kind === 'payment' && m.at < today);
  if (paidMoves.length > 10) {
    const twice = paidMoves[paidMoves.length - 8];
    moves.push({
      ...twice,
      at: `${twice.at.slice(0, 11)}${clock(minutes(twice.at.slice(11)) + 2)}`,
      cancel: 'Saisi deux fois',
    });
    const refunded = paidMoves.find(
      (m) =>
        charges[m.chargeIndex].items.some((it) => it.act === 'ECG') &&
        m.amount === charges[m.chargeIndex].total,
    );
    if (refunded) {
      moves.push({
        ...refunded,
        kind: 'refund',
        method: 'cash',
        amount: acts.get('ECG')!.price,
        at: `${refunded.at.slice(0, 11)}${clock(minutes(refunded.at.slice(11)) + 10)}`,
        by: owner.id,
        reference: null,
        reason: 'ECG non réalisé (appareil en panne)',
        cancel: null,
      });
    }
  }
  const { rows: chargeRows } = await db.query<{ id: string }>(
    `insert into charges (space_id, patient_id, appointment_id, practitioner_id, total, created_by, created_at, updated_at)
     select a.space_id, a.patient_id, a.id, a.practitioner_id, t.total, $3, a.starts_at + interval '25 minutes',
            a.starts_at + interval '25 minutes'
       from unnest($1::uuid[], $2::int[]) with ordinality as t(appointment_id, total, n)
       join appointments a on a.id = t.appointment_id
      order by t.n
     returning id`,
    [charges.map((c) => c.appointmentId), charges.map((c) => c.total), deskId],
  );
  const lines = charges.flatMap((c, ci) =>
    c.items.map((it, position) => ({
      charge: chargeRows[ci].id,
      act: acts.get(it.act)!,
      quantity: it.quantity,
      position,
    })),
  );
  await db.query(
    `insert into charge_items (charge_id, act_id, label, unit_price, quantity, position)
     select * from unnest($1::uuid[], $2::uuid[], $3::text[], $4::int[], $5::int[], $6::int[])`,
    [
      lines.map((l) => l.charge),
      lines.map((l) => l.act.id),
      lines.map((l) => l.act.name),
      lines.map((l) => l.act.price),
      lines.map((l) => l.quantity),
      lines.map((l) => l.position),
    ],
  );
  // Receipt numbers in the order payments were received.
  moves.sort((a, b) => a.at.localeCompare(b.at));
  const receipts = moves.filter((m) => m.kind === 'payment');
  const { rows: numbers } = await db.query<{ n: string }>(
    `select nextval('receipt_number_seq') as n from generate_series(1, $1)`,
    [receipts.length],
  );
  const receiptOf = new Map(
    receipts.map((m, i) => [
      m,
      `R-${m.at.slice(0, 4)}-${String(numbers[i].n).padStart(6, '0')}`,
    ]),
  );
  await db.query(
    `insert into payments (space_id, patient_id, charge_id, kind, method, amount, reference, receipt_number,
                           reason, received_at, received_by, cancelled_at, cancelled_by, cancel_reason)
     select c.space_id, c.patient_id, c.id, k::payment_kind, m::payment_method, amt, ref, rn, rs,
            (ts::timestamp at time zone '${TZ}'), rb,
            case when cr is not null then (ts::timestamp at time zone '${TZ}') + interval '3 minutes' end,
            case when cr is not null then rb end, cr
       from unnest($1::uuid[], $2::text[], $3::text[], $4::int[], $5::text[], $6::text[], $7::text[], $8::text[],
                   $9::uuid[], $10::text[])
         as t(charge_id, k, m, amt, ref, rn, rs, ts, rb, cr)
       join charges c on c.id = t.charge_id`,
    [
      moves.map((m) => chargeRows[m.chargeIndex].id),
      moves.map((m) => m.kind),
      moves.map((m) => m.method),
      moves.map((m) => m.amount),
      moves.map((m) => m.reference),
      moves.map((m) => receiptOf.get(m) ?? null),
      moves.map((m) => m.reason),
      moves.map((m) => m.at),
      moves.map((m) => m.by),
      moves.map((m) => m.cancel),
    ],
  );

  // ── Cash closes: every past day with movements, the last 6 weeks ─────────
  const days = new Map<string, Record<string, number>>();
  for (const m of moves) {
    const day = m.at.slice(0, 10);
    if (m.cancel || day >= today || day < addDays(today, -42)) continue;
    const key = `${charges[m.chargeIndex].visit.spaceIndex}|${day}`;
    const net = days.get(key) ?? { cash: 0, card: 0, cheque: 0, transfer: 0 };
    net[m.method] += m.kind === 'payment' ? m.amount : -m.amount;
    days.set(key, net);
  }
  const closes = [...days].map(([key, expected]) => {
    const [spaceIndex, day] = key.split('|');
    const difference = chance(0.12) ? pick([-5000, -2000, 1000]) : 0;
    return {
      space: spaces[Number(spaceIndex)].id,
      day,
      expected,
      counted: expected.cash + difference,
      note:
        difference < 0
          ? 'Erreur de rendu de monnaie'
          : difference > 0
            ? 'Pièces en trop dans la caisse'
            : null,
    };
  });
  await db.query(
    `insert into cash_closes (space_id, day, expected, counted_cash, note, closed_by, closed_at)
     select s, d::date, e::jsonb, c, n, $6, (d::date + time '18:40') at time zone '${TZ}'
       from unnest($1::uuid[], $2::text[], $3::text[], $4::int[], $5::text[]) as t(s, d, e, c, n)`,
    [
      closes.map((c) => c.space),
      closes.map((c) => c.day),
      closes.map((c) => JSON.stringify(c.expected)),
      closes.map((c) => c.counted),
      closes.map((c) => c.note),
      deskId,
    ],
  );

  console.log({
    patients: patients.length,
    appointments: visits.length,
    today: visits.filter((v) => v.day === today).length,
    charges: charges.length,
    payments: moves.length,
    cashCloses: closes.length,
    doctors: doctors.length,
    staff:
      secretaryRoom > 0
        ? `nadia@${DEMO_DOMAIN} (+ karim, désactivé)`
        : 'none (offer full)',
  });
}

const { tenant, pool } = await connect();
console.log(
  `Cabinet "${tenant.name}" (${subdomain}), schema ${tenant.schema_version}`,
);
const client = await pool.connect();
try {
  await client.query('begin');
  if (flag === '--remove') await remove(client);
  else
    await seedDemo(client, {
      doctors: tenant.max_doctors,
      secretaries: tenant.max_secretaries,
    });
  await client.query('commit');
} catch (err) {
  await client.query('rollback');
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
