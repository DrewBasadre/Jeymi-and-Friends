/** RFC 9285 Base45, which stays inside the QR alphanumeric character set. */
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
const LOOKUP = new Map([...ALPHABET].map((character, index) => [character, index]));

export function encodeBase45(bytes: Uint8Array): string {
  let output = '';
  for (let index = 0; index < bytes.length; index += 2) {
    if (index + 1 < bytes.length) {
      let value = bytes[index]! * 256 + bytes[index + 1]!;
      for (let digit = 0; digit < 3; digit += 1) {
        output += ALPHABET[value % 45];
        value = Math.floor(value / 45);
      }
    } else {
      const value = bytes[index]!;
      output += ALPHABET[value % 45]! + ALPHABET[Math.floor(value / 45)]!;
    }
  }
  return output;
}

export function decodeBase45(text: string): Uint8Array {
  if (text.length % 3 === 1) throw new Error('Invalid Base45 length.');
  const output: number[] = [];
  for (let index = 0; index < text.length; index += 3) {
    const digits = [...text.slice(index, index + 3)].map((character) => {
      const value = LOOKUP.get(character);
      if (value === undefined) throw new Error('Invalid Base45 character.');
      return value;
    });
    const value = digits.reduce((sum, digit, position) => sum + digit * 45 ** position, 0);
    if (digits.length === 3) {
      if (value > 0xffff) throw new Error('Invalid Base45 group.');
      output.push(value >> 8, value & 0xff);
    } else {
      if (value > 0xff) throw new Error('Invalid Base45 group.');
      output.push(value);
    }
  }
  return Uint8Array.from(output);
}
