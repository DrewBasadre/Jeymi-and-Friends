export const PARENT_SMS_CHARACTER_LIMIT = 320;

export interface ParentSmsDraft {
  studentId: string;
  parentName: string;
  parentPhone: string;
  message: string;
}

export interface ParentSmsReceipt {
  receiptId: string;
  recipientName: string;
  recipientPhone: string;
  message: string;
  sentAt: string;
  status: 'simulated';
}

export function validateParentSmsDraft(draft: ParentSmsDraft): string | null {
  if (!draft.parentName.trim()) return 'This learner has no parent or guardian name.';
  if (!isValidPhoneNumber(draft.parentPhone)) {
    return 'This learner has no valid parent mobile number.';
  }
  if (!draft.message.trim()) return 'Write a message before sending.';
  if (draft.message.trim().length > PARENT_SMS_CHARACTER_LIMIT) {
    return `Keep the message within ${PARENT_SMS_CHARACTER_LIMIT} characters.`;
  }
  return null;
}

export async function sendParentSmsDemo(
  draft: ParentSmsDraft,
): Promise<ParentSmsReceipt> {
  const error = validateParentSmsDraft(draft);
  if (error) throw new Error(error);

  const sentAt = new Date().toISOString();
  return {
    receiptId: `demo_sms_${Date.now()}`,
    recipientName: draft.parentName.trim(),
    recipientPhone: draft.parentPhone.trim(),
    message: draft.message.trim(),
    sentAt,
    status: 'simulated',
  };
}

function isValidPhoneNumber(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}
