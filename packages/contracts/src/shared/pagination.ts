import { z } from 'zod';

export const CursorPaginationSchema = z.object({
  cursor: z.string().nullable().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});
export type CursorPagination = z.infer<typeof CursorPaginationSchema>;

export const CursorPageSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
    hasMore: z.boolean(),
  });
export type CursorPage<T> = {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
};
