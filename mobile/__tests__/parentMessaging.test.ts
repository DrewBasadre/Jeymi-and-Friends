import { describe, expect, it } from '@jest/globals';
import {
  PARENT_SMS_CHARACTER_LIMIT,
  sendParentSmsDemo,
  validateParentSmsDraft,
} from '../src/services/parentMessaging';

const validDraft = {
  studentId: 'student-1',
  parentName: 'Maya Santos',
  parentPhone: '+63 917 555 0199',
  message: 'Ari showed strong progress in fractions this week.',
};

describe('parent messaging demo transport', () => {
  it('validates recipient details and message length', () => {
    expect(validateParentSmsDraft(validDraft)).toBeNull();
    expect(
      validateParentSmsDraft({ ...validDraft, parentPhone: '12' }),
    ).toMatch(/valid parent mobile/i);
    expect(
      validateParentSmsDraft({
        ...validDraft,
        message: 'x'.repeat(PARENT_SMS_CHARACTER_LIMIT + 1),
      }),
    ).toMatch(/within 320 characters/i);
  });

  it('returns a simulated receipt without calling a network provider', async () => {
    await expect(sendParentSmsDemo(validDraft)).resolves.toMatchObject({
      recipientName: 'Maya Santos',
      recipientPhone: '+63 917 555 0199',
      status: 'simulated',
    });
  });
});
