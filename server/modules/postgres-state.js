const PG_STATE_TABLE = 'mesa_it_state';

export async function mutatePostgresStateWithLock(client, normalizeDb, mutator) {
  await client.query('BEGIN');
  try {
    const selected = await client.query(
      `SELECT data, version FROM ${PG_STATE_TABLE} WHERE id = 1 FOR UPDATE`,
    );
    if (!selected.rows[0]) {
      throw new Error('No existe el documento de estado de Mesa IT.');
    }

    const rawDb = selected.rows[0].data || {};
    const currentVersion = Math.max(1, Math.trunc(Number(selected.rows[0].version) || 1));
    const db = normalizeDb(rawDb);
    db.meta.revision = currentVersion;
    const snapshotBefore = JSON.stringify(rawDb);
    const result = await mutator(db);
    const snapshotAfter = JSON.stringify(db);

    if (snapshotAfter !== snapshotBefore) {
      const nextVersion = currentVersion + 1;
      db.meta.revision = nextVersion;
      await client.query(
        `UPDATE ${PG_STATE_TABLE}
         SET data = $1::jsonb, version = $2, updated_at = NOW()
         WHERE id = 1`,
        [JSON.stringify(db), nextVersion],
      );
    }

    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  }
}
