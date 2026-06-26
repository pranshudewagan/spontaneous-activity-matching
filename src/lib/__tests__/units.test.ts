import { formatDistanceMi, metersToMiles, milesToMeters } from '../units';

describe('metersToMiles', () => {
  it('converts 1609.344 m to exactly 1 mi', () => {
    expect(metersToMiles(1609.344)).toBeCloseTo(1);
  });
  it('returns 0 for 0', () => {
    expect(metersToMiles(0)).toBe(0);
  });
});

describe('milesToMeters', () => {
  it('round-trips with metersToMiles', () => {
    expect(metersToMiles(milesToMeters(5))).toBeCloseTo(5);
    expect(metersToMiles(milesToMeters(0.1))).toBeCloseTo(0.1);
  });
});

describe('formatDistanceMi', () => {
  it('shows one decimal for distances under 10 mi', () => {
    expect(formatDistanceMi(1609.344)).toBe('1.0 mi');
    expect(formatDistanceMi(482.8)).toBe('0.3 mi');
  });
  it('rounds to whole number for 10+ mi', () => {
    expect(formatDistanceMi(16093.44)).toBe('10 mi');
    expect(formatDistanceMi(32186.88)).toBe('20 mi');
  });
});
