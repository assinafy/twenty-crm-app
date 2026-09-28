// Front components run in a worker that is not a secure context: crypto has getRandomValues there but no randomUUID.
// Formats 16 random bytes as an RFC 9562 version 4 UUID.
export const createRequestId = (): string => {
  const hex = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  );
  const variant = ((Number.parseInt(hex.charAt(16), 16) & 0x3) | 0x8).toString(16);

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20)}`;
};
