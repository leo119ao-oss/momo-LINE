// src/lib/slug.ts

export const slugify = (s: string) =>
  (s || "")
    .toLowerCase()
    .normalize("NFKD").replace(/[^\w\s-]/g, "")
    .trim().replace(/\s+/g, "-").slice(0, 80) + "-" + Date.now().toString(36);
