import { describe, it, expect } from 'vitest';
import { formatDistance, formatDuration } from './format';

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

describe('formatDuration', () => {
  it('mínimo de 1 min', () => {
    expect(formatDuration(20)).toBe('1 min');
  });
  it('minutos abaixo de 1 h', () => {
    expect(formatDuration(600)).toBe('10 min');
  });
  it('horas exatas e com minutos', () => {
    expect(formatDuration(3600)).toBe('1 h');
    expect(formatDuration(5400)).toBe('1 h 30 min');
  });
});

import { formatSpeed } from './format';

describe('formatSpeed', () => {
  it('converte m/s em km/h inteiro', () => {
    expect(formatSpeed(10)).toBe('36');
    expect(formatSpeed(0)).toBe('0');
  });
  it('sem velocidade mostra traços', () => {
    expect(formatSpeed(null)).toBe('--');
  });
});
