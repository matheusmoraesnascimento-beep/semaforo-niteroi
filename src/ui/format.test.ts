import { describe, it, expect } from 'vitest';
import { formatDistance } from './format';

describe('formatDistance', () => {
  it('arredonda para múltiplos de 5 m', () => {
    expect(formatDistance(123)).toBe('125 m');
    expect(formatDistance(87)).toBe('85 m');
    expect(formatDistance(2)).toBe('0 m');
  });
  it('km acima de 1000 m, com vírgula', () => {
    expect(formatDistance(1234)).toBe('1,2 km');
  });
});
