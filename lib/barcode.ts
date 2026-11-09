/**
 * Barcode helpers shared by the scanner (browser) and the server.
 * GTIN family: EAN-8, UPC-A (12), EAN-13, GTIN-14. All end in a mod-10 check digit.
 */

/** Check digit for the given digits (everything except the check digit itself). */
export function gtinCheckDigit(body: string): number {
  const sum = body
    .split('')
    .reverse()
    .reduce((acc, d, i) => acc + Number(d) * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10;
}

const GTIN_LENGTHS = [8, 12, 13, 14];

/** True for GTIN lengths with a correct check digit; other lengths (6-14 digits) can't be checked and pass. */
export function hasValidCheckDigit(code: string): boolean {
  if (!/^\d{6,14}$/.test(code)) return false;
  if (!GTIN_LENGTHS.includes(code.length)) return true;
  return gtinCheckDigit(code.slice(0, -1)) === Number(code.at(-1));
}

/**
 * The form a barcode is stored and looked up under. A 12-digit UPC-A is the same product as the
 * 13-digit EAN with a leading 0 (scanners report either), and Open Food Facts uses the 13-digit form.
 */
export function canonicalBarcode(code: string): string {
  return code.length === 12 ? `0${code}` : code;
}

/** Groups a code as printed on packs ("0 11110 15129 2") so people can compare it with the label. */
export function formatBarcode(code: string): string {
  // A 13-digit code starting with 0 is a UPC-A in EAN form; show it the way the label prints it.
  if (code.length === 13 && code.startsWith('0')) return formatBarcode(code.slice(1));
  if (code.length === 12) return `${code[0]} ${code.slice(1, 6)} ${code.slice(6, 11)} ${code[11]}`;
  if (code.length === 13) return `${code[0]} ${code.slice(1, 7)} ${code.slice(7)}`;
  return code;
}

export type TypedBarcode =
  | { ok: true; code: string; note?: string }
  | { ok: false; error: string };

/**
 * Interprets a barcode typed by hand. On UPC-A labels the first and last digits are printed small,
 * outside the bars, so people often type only the 10 large digits, or 11 of the 12.
 */
export function interpretTypedBarcode(input: string): TypedBarcode {
  const digits = input.replace(/[\s-]/g, '');
  if (!digits) return { ok: false, error: 'Type the numbers printed under the barcode.' };
  if (!/^\d+$/.test(digits)) return { ok: false, error: 'Barcodes contain digits only.' };

  const completed = (code: string, what: string): TypedBarcode => ({
    ok: true,
    code,
    note: `Looked up as ${formatBarcode(code)}: we added ${what} printed beside the bars.`,
  });

  switch (digits.length) {
    case 10: {
      // The two 5-digit groups of a UPC-A: add the usual leading 0 and compute the check digit.
      const body = `0${digits}`;
      return completed(body + gtinCheckDigit(body), 'the small first and last digits');
    }
    case 11: {
      // Either the leading digit or the check digit is missing. If the typed number starts with 0 it
      // almost certainly includes the leading digit, so the check digit is what's missing.
      const withLeadingZero = `0${digits}`;
      if (digits[0] !== '0' && hasValidCheckDigit(withLeadingZero)) return completed(withLeadingZero, 'the small first digit');
      return completed(digits + gtinCheckDigit(digits), 'the small last digit');
    }
    case 8:
    case 12:
    case 13:
    case 14:
      return hasValidCheckDigit(digits)
        ? { ok: true, code: digits }
        : { ok: false, error: "That number doesn't add up: the last digit doesn't match the rest. Check for a typo." };
    default:
      return digits.length >= 6 && digits.length <= 14
        ? { ok: true, code: digits }
        : { ok: false, error: 'Barcodes are 6-14 digits long.' };
  }
}
