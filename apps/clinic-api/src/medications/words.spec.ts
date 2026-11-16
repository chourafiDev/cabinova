import { wordsMatch } from './medications.service.js';

describe('wordsMatch', () => {
  it('needs every word somewhere, the dosage compared without spaces', () => {
    const { sql, params } = wordsMatch(['doliprane', '1g'], { text: ['name', 'substances'], compact: ['dosage'] }, 3);
    expect(sql).toBe(
      "(coalesce(name, '') ilike $3 or coalesce(substances, '') ilike $3 or replace(coalesce(dosage, ''), ' ', '') ilike $4)" +
        " and (coalesce(name, '') ilike $5 or coalesce(substances, '') ilike $5 or replace(coalesce(dosage, ''), ' ', '') ilike $6)",
    );
    expect(params).toEqual(['%doliprane%', '%doliprane%', '%1g%', '%1g%']);
  });

  it('searches "%" and "_" as they are', () => {
    expect(wordsMatch(['10%'], { text: ['name'], compact: [] }, 1).params[0]).toBe('%10\\%%');
  });
});
