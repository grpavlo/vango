const { randomBytes } = require('node:crypto');
const { Pool } = require('pg');
const db = require('../config/db');
const UserUpload = require('../models/userUpload');

// Keep long-lived upload locks outside Sequelize's request/transaction pool.
// Uses the same resolved connection settings, including SSL and Unix sockets.
const writers = new Pool({
  user: db.config.username, password: db.config.password,
  host: db.config.host, port: db.config.port, database: db.config.database,
  ...db.config.dialectOptions,
  max: 4, allowExitOnIdle: true,
});
writers.on('error', () => { /* checked-out writers handle loss; idle locks hold no upload */ });

async function beginUploadWriter(userId, url) {
  const connection = await writers.connect();
  const key = randomBytes(8).readBigInt64BE().toString();
  let lost = false;
  let abort = null;
  let finished = false;
  const onError = () => { lost = true; if (abort) abort(new Error('Upload writer connection lost')); };
  connection.on('error', onError);
  try {
    await connection.query('SELECT pg_advisory_lock($1::bigint)', [key]);
    // The lock exists before the manifest becomes visible or any file opens.
    const manifest = await UserUpload.create({userId, url, writerLockKey: key, uploading: true});
    if (lost) throw new Error('Upload writer unavailable');
    return {
      manifest,
      setAbort(handler) { abort = handler; if (lost) handler(new Error('Upload writer unavailable')); },
      async finish() {
        if (finished) return;
        finished = true;
        try { await manifest.update({uploading: false}); }
        finally {
          try { if (!lost) await connection.query('SELECT pg_advisory_unlock($1::bigint)', [key]); }
          catch { lost = true; }
          connection.removeListener('error', onError);
          connection.release(lost);
        }
      },
    };
  } catch (error) {
    // Destroying the session releases the lock even if registration failed.
    connection.removeListener('error', onError);
    connection.release(true);
    throw error;
  }
}
async function closeUploadWriters() { await writers.end(); }
module.exports = { beginUploadWriter, closeUploadWriters };
