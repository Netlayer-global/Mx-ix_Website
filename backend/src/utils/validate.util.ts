/**
 * Small request-validation helpers.
 *
 * The existing controllers mostly spread `req.body` straight into Mongoose,
 * which is fine for CMS content but not for records that drive live BGP
 * sessions: a stray field could flip `rsClient`, rewrite a deploy path or
 * change an allocated address. Everything under the IXP admin API goes through
 * `pick()` so only named fields are ever written.
 */

/**
 * Copy only the listed keys, dropping anything undefined.
 *
 * Keys absent from the body are omitted rather than set to undefined, so the
 * result is safe to hand to `$set` without blanking existing values.
 */
export const pick = <T extends Record<string, any> = Record<string, any>>(
  body: any,
  fields: readonly string[]
): Partial<T> => {
  const out: Record<string, any> = {};
  if (!body || typeof body !== 'object') return out as Partial<T>;
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(body, field) && body[field] !== undefined) {
      out[field] = body[field];
    }
  }
  return out as Partial<T>;
};

/** Trimmed string, or undefined when absent/blank. */
export const str = (value: any): string | undefined => {
  if (value === undefined || value === null) return undefined;
  const s = String(value).trim();
  return s === '' ? undefined : s;
};

/** Whole number within optional bounds, or undefined when not a valid integer. */
export const int = (value: any, opts: { min?: number; max?: number } = {}): number | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  if (!Number.isInteger(n)) return undefined;
  if (opts.min !== undefined && n < opts.min) return undefined;
  if (opts.max !== undefined && n > opts.max) return undefined;
  return n;
};

/** Accepts real booleans plus the "true"/"1"/"yes" strings a form sends. */
export const bool = (value: any): boolean | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  const s = String(value).toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(s)) return true;
  if (['false', '0', 'no', 'off'].includes(s)) return false;
  return undefined;
};

/** Restrict a value to a known set. */
export const oneOf = <T extends string>(value: any, allowed: readonly T[]): T | undefined => {
  const s = str(value);
  if (s === undefined) return undefined;
  return (allowed as readonly string[]).includes(s) ? (s as T) : undefined;
};

/**
 * Narrow a route parameter to a plain string.
 *
 * Express 5 types `req.params.x` as `string | string[]` (a param can repeat), so
 * anything handed to a service that expects an id has to be narrowed first.
 * Takes the first value if an array somehow arrives.
 */
export const param = (value: any): string =>
  Array.isArray(value) ? String(value[0] ?? '') : String(value ?? '');

/** 24-character hex ObjectId, or undefined. */
export const objectId = (value: any): string | undefined => {
  const s = str(value);
  if (!s) return undefined;
  return /^[0-9a-fA-F]{24}$/.test(s) ? s : undefined;
};

/** Array of ObjectIds, dropping anything malformed. */
export const objectIds = (value: any): string[] => {
  if (!Array.isArray(value)) return [];
  return value.map(objectId).filter((v): v is string => !!v);
};

/** Array of trimmed non-empty strings. */
export const strArray = (value: any): string[] | undefined => {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return undefined;
  return value.map(str).filter((v): v is string => !!v);
};

/**
 * Collects field errors so a handler can report everything wrong at once
 * instead of making the operator fix one field per round trip.
 */
export class Validator {
  private errors: string[] = [];

  require<T>(value: T | undefined, label: string): T | undefined {
    if (value === undefined) this.errors.push(`${label} is required.`);
    return value;
  }

  add(message: string): void {
    this.errors.push(message);
  }

  get failed(): boolean {
    return this.errors.length > 0;
  }

  get message(): string {
    return this.errors.join(' ');
  }

  get list(): string[] {
    return [...this.errors];
  }
}

export default { pick, str, int, bool, oneOf, objectId, objectIds, strArray, Validator };
