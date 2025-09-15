import { z } from "zod";
export const RecItem = z.object({ url:z.string().url(), title:z.string().nullable().optional(), why:z.string().min(3).max(120) });
export const RecPayload = z.object({ type:z.literal("recommendations"), items:z.array(RecItem).length(3), rev:z.string().min(3) });
export const ConfirmPayload = z.object({ type:z.literal("confirm"), message:z.string().min(5), options:z.array(z.string()).min(2), freeTextHint:z.string().optional(), rev:z.string().min(3) });
export type TRecPayload = z.infer<typeof RecPayload>;
export type TConfirmPayload = z.infer<typeof ConfirmPayload>;