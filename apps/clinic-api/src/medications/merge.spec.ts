import {
  type CatalogRow,
  changedByAmmps,
  fromCustom,
  labelOf,
  mergeCatalog,
  type OverrideRow,
  rankSuggestions,
} from './merge.js';

const row = (ammpsId: number, extra: Partial<CatalogRow> = {}): CatalogRow => ({
  ammpsId,
  name: 'DOLIPRANE',
  substances: 'PARACETAMOL',
  dosage: '1 G',
  form: 'COMPRIME SECABLE',
  presentation: 'BOITE DE 8',
  lab: 'SANOFI',
  availability: 'marketed',
  ppv: '13.10',
  isActive: true,
  ...extra,
});

const override = (ammpsId: number, extra: Partial<OverrideRow> = {}): OverrideRow => ({
  ammpsId,
  customName: null,
  customDosage: null,
  defaultPosology: null,
  defaultDuration: null,
  isFavorite: false,
  isHidden: false,
  baseName: 'DOLIPRANE',
  baseDosage: '1 G',
  ...extra,
});

describe('labelOf', () => {
  it('prints name, dosage and form', () => {
    expect(labelOf('DOLIPRANE', '1 G', 'COMPRIME SECABLE')).toBe('DOLIPRANE 1 G, comprime secable');
    expect(labelOf('Crème', null, null)).toBe('Crème');
  });
});

describe('mergeCatalog', () => {
  it('groups the boxes of one medicine, pointing at the marketed, cheapest one', () => {
    const [s, ...rest] = mergeCatalog(
      [
        row(1, { presentation: 'BOITE DE 16', ppv: '20.00' }),
        row(2, { presentation: 'BOITE DE 8', ppv: '13.10' }),
        row(3, { presentation: 'BOITE DE 100', ppv: null, availability: 'not_marketed' }),
      ],
      [],
    );
    expect(rest).toEqual([]);
    expect(s).toMatchObject({
      source: 'ammps',
      key: 'ammps:2',
      ammpsId: 2,
      label: 'DOLIPRANE 1 G, comprime secable',
      availability: 'marketed',
      ppv: '13.10',
      isFavorite: false,
      updatedByAmmps: false,
    });
    expect(s.presentations.map((p) => p.ammpsId)).toEqual([2, 1, 3]);
  });

  it('keeps different dosages and forms apart', () => {
    const merged = mergeCatalog([row(1), row(2, { dosage: '500 MG' }), row(3, { form: 'SACHET' })], []);
    expect(merged.map((s) => s.ammpsId)).toEqual([1, 2, 3]);
  });

  it('never offers withdrawn or inactive medicines', () => {
    expect(
      mergeCatalog([row(1, { availability: 'withdrawn' }), row(2, { isActive: false })], []),
    ).toEqual([]);
  });

  it("applies the doctor's override: their wording, posology, favorite", () => {
    const [s] = mergeCatalog(
      [row(1, { ppv: '20.00' }), row(2)],
      [override(1, { customName: 'Doliprane', defaultPosology: '1 cp x 3 / j', defaultDuration: '5 jours', isFavorite: true })],
    );
    // The override was saved on box 1: the suggestion points at it.
    expect(s).toMatchObject({
      ammpsId: 1,
      name: 'Doliprane',
      dosage: '1 G',
      label: 'Doliprane 1 G, comprime secable',
      defaultPosology: '1 cp x 3 / j',
      defaultDuration: '5 jours',
      isFavorite: true,
      updatedByAmmps: false,
    });
  });

  it('leaves out what the doctor hid', () => {
    expect(mergeCatalog([row(1), row(2)], [override(2, { isHidden: true })])).toEqual([]);
  });

  it('flags a renamed medicine whose AMMPS name or dosage changed since', () => {
    const [s] = mergeCatalog(
      [row(1, { name: 'DOLIPRANE CODEINE' })],
      [override(1, { customName: 'Doliprane' })],
    );
    expect(s.updatedByAmmps).toBe(true);
  });
});

describe('changedByAmmps', () => {
  it('only when the doctor renamed what changed', () => {
    const current = { name: 'DOLIPRANE', dosage: '1000 MG' };
    expect(changedByAmmps(override(1, { customName: 'Doliprane' }), current)).toBe(false);
    expect(changedByAmmps(override(1, { customDosage: '1 g' }), current)).toBe(true);
    // Nothing renamed: the AMMPS values simply show, nothing to accept.
    expect(changedByAmmps(override(1, { isFavorite: true }), current)).toBe(false);
    expect(changedByAmmps(override(1, { customName: 'X', baseName: null, baseDosage: null }), current)).toBe(false);
  });
});

describe('rankSuggestions', () => {
  const custom = fromCustom({
    id: 'c1',
    name: 'Doli crème maison',
    substances: null,
    dosage: null,
    form: null,
    presentation: null,
    defaultPosology: '2 x / j',
    defaultDuration: null,
    isFavorite: false,
  });
  const [doliprane, efferalgan, dafalgan] = mergeCatalog(
    [
      row(1),
      row(2, { name: 'EFFERALGAN', substances: 'PARACETAMOL' }),
      row(3, { name: 'DAFALGAN', substances: 'PARACETAMOL', availability: 'not_marketed' }),
    ],
    [],
  );

  it('puts favorites first, then names starting with the query, then substances', () => {
    expect(rankSuggestions([efferalgan, custom, doliprane], 'doli', 10).map((s) => s.key)).toEqual([
      'custom:c1',
      'ammps:1',
      'ammps:2',
    ]);
    const favorite = { ...efferalgan, isFavorite: true };
    expect(rankSuggestions([doliprane, favorite], 'doli', 10)[0].key).toBe('ammps:2');
  });

  it('matches accents aside and ranks marketed before not marketed', () => {
    expect(rankSuggestions([dafalgan, efferalgan], 'PARACÉTAMOL', 10).map((s) => s.key)).toEqual([
      'ammps:2',
      'ammps:3',
    ]);
  });

  it('ranks on the first word: the others are usually the dosage', () => {
    expect(rankSuggestions([efferalgan, doliprane], 'doli 1 g', 10)[0].key).toBe('ammps:1');
  });

  it('keeps to the limit', () => {
    expect(rankSuggestions([doliprane, efferalgan, dafalgan], 'para', 2)).toHaveLength(2);
  });
});
