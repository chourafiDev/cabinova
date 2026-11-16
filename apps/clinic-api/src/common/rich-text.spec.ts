import { describe, expect, it } from 'vitest';
import { richOrNull } from './rich-text.js';

describe('richOrNull', () => {
  it('keeps the editor formatting and drops the rest', () => {
    expect(
      richOrNull(
        '<p style="text-align: right; color: red">Toux <em>sèche</em></p><ul><li>a</li></ul><a href="x">lien</a><script>x</script>',
      ),
    ).toBe('<p style="text-align:right">Toux <em>sèche</em></p><ul><li>a</li></ul>lien');
  });

  it('gives null when no text is left', () => {
    expect(richOrNull('<p></p>')).toBeNull();
    expect(richOrNull('<p> <br /></p>')).toBeNull();
    expect(richOrNull('')).toBeNull();
    expect(richOrNull(null)).toBeNull();
  });

  it('keeps plain text as it is', () => {
    expect(richOrNull('Fièvre depuis 3 jours')).toBe('Fièvre depuis 3 jours');
  });
});
