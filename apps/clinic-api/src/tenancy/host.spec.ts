import { subdomainOf } from './host.js';

describe('subdomainOf', () => {
  const bases = ['cabinova.ma', 'localhost'];

  it('reads the cabinet from its subdomain', () => {
    expect(subdomainOf('atlas.cabinova.ma', bases)).toBe('atlas');
    expect(subdomainOf('Atlas.Cabinova.ma', bases)).toBe('atlas');
    expect(subdomainOf('cabinet-atlas.localhost:3002', bases)).toBe(
      'cabinet-atlas',
    );
  });

  it('refuses hosts that are not one cabinet', () => {
    expect(subdomainOf('cabinova.ma', bases)).toBeNull();
    expect(subdomainOf('localhost:3002', bases)).toBeNull();
    expect(subdomainOf('a.b.cabinova.ma', bases)).toBeNull();
    expect(subdomainOf('atlas.evil.com', bases)).toBeNull();
    expect(subdomainOf('atlas.cabinova.ma.evil.com', bases)).toBeNull();
    expect(subdomainOf('atlas.localhost', ['cabinova.ma'])).toBeNull();
  });
});
