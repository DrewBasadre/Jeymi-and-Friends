export function isValidParentPin(pin: string): boolean {
  return /^\d{4,8}$/.test(pin);
}

export function parseStoredParentPinHash(
  value: string,
): { salt: string; digest: string } | null {
  const [salt, digest, ...rest] = value.split(':');
  if (
    rest.length > 0 ||
    !salt ||
    !/^[a-f0-9-]{16,}$/i.test(salt) ||
    !digest ||
    !/^[a-f0-9]{64}$/i.test(digest)
  ) {
    return null;
  }
  return { salt, digest: digest.toLocaleLowerCase() };
}
