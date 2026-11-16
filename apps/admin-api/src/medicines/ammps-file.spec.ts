import { strToU8 } from 'fflate';
import { HEADER, xlsx } from '../../test/xlsx.js';
import {
  AmmpsFileError,
  availabilityOf,
  parsePrice,
  readAmmpsFile,
} from './ammps-file.js';


const DOLIPRANE = ['1001', 'DOLIPRANE', 'PARACETAMOL', '1 G', 'COMPRIME SECABLE', 'BOITE DE 8', 'SANOFI', 'Commercialisé', 13.1, 9.4];
const WITHDRAWN = ['1002', 'VIEUX', 'X // Y', '5 MG', 'GELULE', 'BOITE DE 20', 'LABO', 'Retiré du Marché', null, null];
const NO_PRICE = ['1003', '18F PSMA RIM', '[18F] PSMA-1007', '250 MBQ / ML', 'SOLUTION INJECTABLE', 'FLACON', 'RIM PHARMA', 'AMM sans prix', 'SANS PPV DH', 'SANS PPV DH'];

describe('parsePrice', () => {
  it.each([
    ['4.303.00 DH', '4303.00'],
    ['10,70 DH', '10.70'],
    ['SANS PPV DH', null],
    ['10.411.00 DH', '10411.00'],
    ['1.200,50 DH', '1200.50'],
    ['64.40 DH', '64.40'],
    [4303, '4303.00'],
    ['10.7', '10.70'],
    ['', null],
    [null, null],
  ])('%s → %s', (input, expected) => {
    expect(parsePrice(input)).toBe(expected);
  });
});

describe('availabilityOf', () => {
  it.each([
    ['Commercialisé', 'marketed'],
    ['Commercialisé AO', 'marketed'],
    ['Commercialisé AO / Export', 'marketed'],
    ['Commercialisé Export', 'marketed'],
    ['Non Commercialisé', 'not_marketed'],
    ['AMM sans prix', 'not_marketed'],
    ['En cours de fixation de prix', 'not_marketed'],
    ['Retiré du Marché', 'withdrawn'],
    ['Suspendu du Marché', 'withdrawn'],
    ['Suspendu du marché', 'withdrawn'],
    [null, 'not_marketed'],
  ] as const)('%s → %s', (status, expected) => {
    expect(availabilityOf(status)).toBe(expected);
  });
});

describe('readAmmpsFile', () => {
  it.each(['inline', 'shared'] as const)('reads the export (%s strings)', (style) => {
    const file = readAmmpsFile(xlsx([HEADER, DOLIPRANE, WITHDRAWN, NO_PRICE], style));
    expect(file.skipped).toEqual([]);
    expect(file.duplicates).toBe(0);
    expect(file.rows).toEqual([
      {
        ammpsId: 1001,
        name: 'DOLIPRANE',
        substances: 'PARACETAMOL',
        dosage: '1 G',
        form: 'COMPRIME SECABLE',
        presentation: 'BOITE DE 8',
        lab: 'SANOFI',
        status: 'Commercialisé',
        availability: 'marketed',
        ppv: '13.10',
        ph: '9.40',
      },
      expect.objectContaining({ ammpsId: 1002, substances: 'X // Y', availability: 'withdrawn', ppv: null }),
      expect.objectContaining({ ammpsId: 1003, name: '18F PSMA RIM', availability: 'not_marketed', ppv: null, ph: null }),
    ]);
  });

  it('finds columns by header in any order, cleans spaces and special characters', () => {
    const file = readAmmpsFile(
      xlsx([
        ['Substance active', 'PPV', 'ID AMMPS', 'Nom commercial'],
        ['  AMLODIPINE\n BESILATE ', '54,80 DH', '7', 'AMLOR & CO <5>'],
      ]),
    );
    expect(file.rows[0]).toMatchObject({
      ammpsId: 7,
      name: 'AMLOR & CO <5>',
      substances: 'AMLODIPINE BESILATE',
      dosage: null,
      ppv: '54.80',
    });
  });

  it('skips bad lines, keeps the first of a repeated id, ignores blank lines', () => {
    const file = readAmmpsFile(
      xlsx([
        HEADER,
        DOLIPRANE,
        ['abc', 'X', 'Y'],
        ['', '', ''],
        ['1004', '', 'Z'],
        ['1001', 'DOLIPRANE BIS', 'PARACETAMOL'],
      ]),
    );
    expect(file.rows.map((r) => r.name)).toEqual(['DOLIPRANE']);
    expect(file.duplicates).toBe(1);
    expect(file.skipped).toEqual([
      { line: 3, reason: 'ID AMMPS invalide (« abc »)' },
      { line: 5, reason: 'Nom commercial manquant' },
    ]);
  });

  it('refuses a file without the required columns', () => {
    expect(() => readAmmpsFile(xlsx([['Nom', 'Dosage'], ['A', '1']]))).toThrow(
      'Colonnes manquantes : ID AMMPS, Substance active.',
    );
  });

  it('refuses what is not an .xlsx, an empty sheet, or no readable row', () => {
    expect(() => readAmmpsFile(strToU8('id;nom\n1;A'))).toThrow(AmmpsFileError);
    expect(() => readAmmpsFile(xlsx([]))).toThrow('La feuille est vide.');
    expect(() => readAmmpsFile(xlsx([HEADER, ['x', 'A', 'B']]))).toThrow(
      'Aucun médicament lisible dans le fichier.',
    );
  });
});
