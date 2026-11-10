import { escapeLike, patientSearch } from './search.js';

describe('patientSearch', () => {
  it('ignores a blank search', () => {
    expect(patientSearch('   ', 1)).toBeNull();
  });

  it('matches name both ways and CIN, numbered from the given placeholder', () => {
    const s = patientSearch('  Fatima   Zahra ', 3)!;
    expect(s.values).toEqual(['%Fatima Zahra%']);
    expect(s.sql).toContain("unaccent(first_name || ' ' || last_name)");
    expect(s.sql).toContain("unaccent(last_name || ' ' || first_name)");
    expect(s.sql).toContain('$3');
    expect(s.sql).not.toContain('$4');
  });

  it('adds phone digits and the exact file number when numeric', () => {
    const s = patientSearch('0612', 1)!;
    expect(s.values).toEqual(['%0612%', '%0612%', 612]);
    expect(s.sql).toContain('phone like $2');
    expect(s.sql).toContain('file_number = $3');
  });

  it('treats a short number as a file number, not part of a CIN', () => {
    const s = patientSearch('2', 1)!;
    expect(s.sql).not.toContain('cin');
    expect(s.sql).toContain('file_number = $2');
    expect(patientSearch('AB12', 1)!.sql).toContain('cin ilike $1');
  });

  it('prefixes columns with the table alias', () => {
    const s = patientSearch('0612', 1, 'p.')!;
    expect(s.sql).toContain("unaccent(p.first_name || ' ' || p.last_name)");
    expect(s.sql).toContain('p.phone like $2');
    expect(s.sql).toContain('p.file_number = $3');
  });

  it('matches LIKE wildcards literally', () => {
    expect(escapeLike('50%_off')).toBe('50\\%\\_off');
  });
});
