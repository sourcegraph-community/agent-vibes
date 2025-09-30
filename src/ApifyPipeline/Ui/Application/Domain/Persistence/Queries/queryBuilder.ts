export type SupabaseFilterOperator = 'eq' | 'gte' | 'lte' | 'in';

export interface SupabaseFilter {
  column: string;
  operator: SupabaseFilterOperator;
  value: unknown;
}

export interface SupabaseOrderBy {
  column: string;
  ascending: boolean;
}

export interface SupabaseQuery {
  from: string;
  select: string;
  filters: SupabaseFilter[];
  orderBy?: SupabaseOrderBy[];
  limit?: number;
}

export interface SupabaseClientLike {
  from: (table: string) => SupabaseSelectBuilder;
}

export interface SupabaseSelectBuilder {
  select: (columns: string) => SupabaseSelectBuilder;
  eq: (column: string, value: unknown) => SupabaseSelectBuilder;
  gte: (column: string, value: unknown) => SupabaseSelectBuilder;
  lte: (column: string, value: unknown) => SupabaseSelectBuilder;
  in: (column: string, values: unknown[]) => SupabaseSelectBuilder;
  order: (column: string, options?: { ascending?: boolean }) => SupabaseSelectBuilder;
  limit: (count: number) => SupabaseSelectBuilder;
}

export interface SupabaseQueryResult<T = unknown> {
  data: T[] | null;
  error: unknown;
}

export type SupabaseExecutor = (
  client: SupabaseClientLike,
  query: SupabaseQuery
) => Promise<SupabaseQueryResult<unknown>>;

export const defaultExecutor: SupabaseExecutor = async (client, query) => {
  let builder = client.from(query.from).select(query.select);

  for (const filter of query.filters) {
    if (filter.operator === 'in' && Array.isArray(filter.value)) {
      builder = builder.in(filter.column, filter.value);
    } else if (filter.operator === 'eq') {
      builder = builder.eq(filter.column, filter.value);
    } else if (filter.operator === 'gte') {
      builder = builder.gte(filter.column, filter.value);
    } else if (filter.operator === 'lte') {
      builder = builder.lte(filter.column, filter.value);
    }
  }

  if (query.orderBy) {
    for (const order of query.orderBy) {
      builder = builder.order(order.column, { ascending: order.ascending });
    }
  }

  if (typeof query.limit === 'number') {
    builder = builder.limit(query.limit);
  }

  const result = builder as unknown as Promise<SupabaseQueryResult<unknown>>;
  return await result;
};
