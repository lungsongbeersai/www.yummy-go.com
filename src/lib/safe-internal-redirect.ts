const DEFAULT_REDIRECT = "/";
const INTERNAL_REDIRECT_ORIGIN = "https://internal.invalid";
const ENCODED_CONTROL_CHARACTER = /%(?:0[0-9a-f]|1[0-9a-f]|7f)/i;

export function safeInternalRedirect(value: string | null | undefined): string {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    hasControlCharacter(value) ||
    ENCODED_CONTROL_CHARACTER.test(value)
  ) {
    return DEFAULT_REDIRECT;
  }

  try {
    const target = new URL(value, INTERNAL_REDIRECT_ORIGIN);
    return target.origin === INTERNAL_REDIRECT_ORIGIN ? value : DEFAULT_REDIRECT;
  } catch {
    return DEFAULT_REDIRECT;
  }
}

function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code <= 0x1f || code === 0x7f;
  });
}
