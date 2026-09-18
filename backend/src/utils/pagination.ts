/**
 * Shared pagination for list endpoints.
 *
 * Every member-facing list is bounded: an account with thousands of tickets,
 * orders or peers must not be able to pull the whole collection in one response.
 * Responses keep `data` as a plain array (so existing clients keep working) and
 * add a `meta` block describing the window.
 *
 * Query params: `?page=1&pageSize=50`
 */

export interface PageParams {
  /** 1-based page number. */
  page: number;
  pageSize: number;
  /** Mongo `skip` value. */
  skip: number;
  /** Mongo `limit` value. */
  limit: number;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface PagingOptions {
  defaultPageSize?: number;
  maxPageSize?: number;
}

const toInt = (value: unknown, fallback: number): number => {
  const n = parseInt(String(value ?? ''), 10);
  return Number.isFinite(n) ? n : fallback;
};

/** Read and clamp `page` / `pageSize` from a request query. */
export const parsePaging = (query: any, opts: PagingOptions = {}): PageParams => {
  const defaultPageSize = opts.defaultPageSize ?? 50;
  const maxPageSize = opts.maxPageSize ?? 200;

  const page = Math.max(1, toInt(query?.page, 1));
  const pageSize = Math.min(maxPageSize, Math.max(1, toInt(query?.pageSize, defaultPageSize)));

  return { page, pageSize, skip: (page - 1) * pageSize, limit: pageSize };
};

/** Build the meta block for a known total. */
export const pageMeta = (total: number, p: PageParams): PageMeta => {
  const totalPages = total === 0 ? 1 : Math.ceil(total / p.pageSize);
  return {
    page: p.page,
    pageSize: p.pageSize,
    total,
    totalPages,
    hasMore: p.page < totalPages,
  };
};

/**
 * Page an already-materialised array. Used where the source is an upstream API
 * (Alice-LG, Zoho) rather than a Mongo query we can skip/limit.
 */
export const paginateArray = <T>(items: T[], p: PageParams): { items: T[]; meta: PageMeta } => ({
  items: items.slice(p.skip, p.skip + p.limit),
  meta: pageMeta(items.length, p),
});

export default { parsePaging, pageMeta, paginateArray };
