const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * Normalizes { page, limit } query params into Prisma's { take, skip }.
 */
export function paginate({ page, limit } = {}) {
  const take = Math.min(parseInt(limit, 10) || DEFAULT_LIMIT, MAX_LIMIT);
  const currentPage = Math.max(parseInt(page, 10) || 1, 1);
  const skip = (currentPage - 1) * take;
  return { take, skip, page: currentPage, limit: take };
}

export function paginatedResult({ rows, total, page, limit }) {
  return {
    data: rows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}
