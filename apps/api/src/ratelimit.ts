// Janela fixa simples em D1. Suficiente contra força bruta de código de acesso.
export async function hit(db: D1Database, key: string, limit: number, windowMs: number, now: number): Promise<boolean> {
  const row = await db
    .prepare(
      `INSERT INTO rate_limits (key, window_start, count) VALUES (?1, ?2, 1)
       ON CONFLICT(key) DO UPDATE SET
         count = CASE WHEN ?2 - window_start >= ?3 THEN 1 ELSE count + 1 END,
         window_start = CASE WHEN ?2 - window_start >= ?3 THEN ?2 ELSE window_start END
       RETURNING count`
    )
    .bind(key, now, windowMs)
    .first<{ count: number }>();
  return (row?.count ?? 1) <= limit;
}
