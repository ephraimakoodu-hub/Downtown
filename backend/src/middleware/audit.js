// Records who did what. Never store secrets or full personal records in `changes`.
export async function writeAudit(conn, { userId, action, entity, entityId, changes, requestId }) {
  await conn.execute(
    'INSERT INTO audit_logs (user_id, action, entity, entity_id, changes, request_id) VALUES (?, ?, ?, ?, ?, ?)',
    [userId ?? null, action, entity, entityId == null ? null : String(entityId), changes ? JSON.stringify(changes) : null, requestId ?? null],
  );
}
