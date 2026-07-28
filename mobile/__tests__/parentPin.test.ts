import { describe, expect, it } from '@jest/globals';
import {
  isValidParentPin,
  parseStoredParentPinHash,
} from '../src/domain/parentPin';

describe('parent PIN domain', () => {
  it('accepts only 4 to 8 digits', () => {
    expect(isValidParentPin('1234')).toBe(true);
    expect(isValidParentPin('12345678')).toBe(true);
    expect(isValidParentPin('123')).toBe(false);
    expect(isValidParentPin('12a4')).toBe(false);
    expect(isValidParentPin('123456789')).toBe(false);
  });

  it('parses only salted SHA-256 storage values', () => {
    const digest = 'a'.repeat(64);
    expect(
      parseStoredParentPinHash(`12345678-1234-1234-1234-123456789abc:${digest}`),
    ).toEqual({
      salt: '12345678-1234-1234-1234-123456789abc',
      digest,
    });
    expect(parseStoredParentPinHash('1234')).toBeNull();
  });
});
