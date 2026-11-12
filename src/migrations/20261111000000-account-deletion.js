'use strict';
// Explicit migration: never run against a working database without operator approval.
const references = {
  orders: ['customerId', 'driverId', 'reservedBy', 'candidateDriverId'],
  DriverProfiles: ['userId'], ratings: ['fromUserId', 'toUserId'],
  transactions: ['driverId'], favorites: ['customerId', 'driverId'],
  savedSearches: ['driverId'], notifications: ['userId'],
  supportQuestions: ['userId'], orderResponses: ['driverId'], orderRouteSearchEvents: ['driverId'],
};
module.exports = {
  async up(q, S) {
    await q.sequelize.transaction(async transaction => {
      const options = { transaction };
      if (!(await q.describeTable('users', options)).deletedAt) {
        await q.addColumn('users', 'deletedAt', { type: S.DATE, allowNull: true }, options);
      }
      const tables = await q.showAllTables(options);
      if (!tables.includes('accountDeletionJobs')) await q.createTable('accountDeletionJobs', {
        userId: { type: S.INTEGER, primaryKey: true, allowNull: false },
        pendingFiles: { type: S.JSON, allowNull: false, defaultValue: [] },
        completedAt: { type: S.DATE, allowNull: true },
        createdAt: { type: S.DATE, allowNull: false }, updatedAt: { type: S.DATE, allowNull: false },
      }, options);
      if (!tables.includes('userUploads')) await q.createTable('userUploads', {
        id: {type: S.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false},
        userId: {type: S.INTEGER, allowNull: false},
        url: {type: S.STRING, allowNull: false, unique: true},
        uploading: {type: S.BOOLEAN, allowNull: false, defaultValue: true},
        createdAt: {type: S.DATE, allowNull: false}, updatedAt: {type: S.DATE, allowNull: false},
      }, options);
      if (!(await q.describeTable('userUploads', options)).writerLockKey) {
        await q.addColumn('userUploads', 'writerLockKey', {type: S.STRING, allowNull: true}, options);
      }
      await q.sequelize.query('CREATE INDEX IF NOT EXISTS user_uploads_owner ON "userUploads" ("userId")', options);
      await q.sequelize.query(`
        CREATE OR REPLACE FUNCTION vango_guard_deleted_user() RETURNS trigger AS $$
        BEGIN
          IF OLD."deletedAt" IS NOT NULL THEN
            RAISE EXCEPTION 'Deleted account cannot be modified' USING ERRCODE = '23514';
          END IF;
          RETURN NEW;
        END; $$ LANGUAGE plpgsql;
        DROP TRIGGER IF EXISTS guard_deleted_user ON users;
        CREATE TRIGGER guard_deleted_user BEFORE UPDATE ON users
          FOR EACH ROW EXECUTE FUNCTION vango_guard_deleted_user();
        CREATE OR REPLACE FUNCTION vango_guard_user_reference() RETURNS trigger AS $$
        DECLARE field text; uid integer; account_deleted_at timestamptz;
        BEGIN
          IF current_setting('vango.account_deletion', true) = 'on' THEN RETURN NEW; END IF;
          IF TG_TABLE_NAME = 'userUploads' AND TG_OP = 'UPDATE' THEN
            IF NEW."userId" = OLD."userId" AND NEW.url = OLD.url
              AND NEW."writerLockKey" IS NOT DISTINCT FROM OLD."writerLockKey" THEN RETURN NEW; END IF;
            RAISE EXCEPTION 'Upload ownership cannot change' USING ERRCODE = '23514';
          END IF;
          IF TG_TABLE_NAME = 'notifications' THEN
            IF (NEW.data->>'orderId') ~ '^[0-9]+$' THEN
              FOR uid IN SELECT unnest(ARRAY[o."customerId", o."driverId"])
                FROM orders o WHERE o.id = (NEW.data->>'orderId')::integer LOOP
                IF uid IS NOT NULL THEN
                  SELECT "deletedAt" INTO account_deleted_at FROM users WHERE id = uid FOR SHARE;
                  IF account_deleted_at IS NOT NULL THEN
                    RAISE EXCEPTION 'Deleted participant notification' USING ERRCODE = '23514';
                  END IF;
                END IF;
              END LOOP;
            END IF;
          END IF;
          FOREACH field IN ARRAY TG_ARGV LOOP
            uid := (to_jsonb(NEW)->>field)::integer;
            IF uid IS NOT NULL THEN
              SELECT "deletedAt" INTO account_deleted_at FROM users WHERE id = uid FOR SHARE;
              IF NOT FOUND OR account_deleted_at IS NOT NULL THEN
                -- Financial amounts may still be settled for an unchanged historical party.
                IF TG_TABLE_NAME = 'transactions' AND TG_OP = 'UPDATE' THEN
                  IF (to_jsonb(OLD)->>field)::integer = uid THEN CONTINUE; END IF;
                END IF;
                RAISE EXCEPTION 'Account unavailable' USING ERRCODE = '23514';
              END IF;
            END IF;
          END LOOP;
          RETURN NEW;
        END; $$ LANGUAGE plpgsql;
      `, options);
      // JSON history is a user reference too: fence stale snapshots after deletion.
      await q.sequelize.query(`
        CREATE OR REPLACE FUNCTION vango_guard_deleted_history() RETURNS trigger AS $$
        DECLARE actor_id bigint; actor_deleted_at timestamptz; history_json jsonb;
        BEGIN
          IF current_setting('vango.account_deletion', true) = 'on' THEN RETURN NEW; END IF;
          history_json := NEW.history::jsonb;
          IF jsonb_typeof(history_json) = 'string' THEN
            history_json := (history_json #>> '{}')::jsonb;
          END IF;
          IF jsonb_typeof(history_json) IS DISTINCT FROM 'array' THEN RETURN NEW; END IF;
          FOR actor_id IN
            SELECT DISTINCT actor.id::bigint
              FROM jsonb_array_elements(history_json) entry
              CROSS JOIN LATERAL (VALUES (entry->>'changedById'), (entry->>'uploadedBy')) actor(id)
              WHERE actor.id ~ '^[0-9]{1,10}$'
              ORDER BY 1
          LOOP
            SELECT "deletedAt" INTO actor_deleted_at FROM users WHERE id = actor_id FOR SHARE;
            IF FOUND AND actor_deleted_at IS NOT NULL THEN
              RAISE EXCEPTION 'Deleted account history cannot be restored' USING ERRCODE = '23514';
            END IF;
          END LOOP;
          RETURN NEW;
        END; $$ LANGUAGE plpgsql;
        DROP TRIGGER IF EXISTS guard_deleted_history ON orders;
        CREATE TRIGGER guard_deleted_history BEFORE INSERT OR UPDATE OF history ON orders
          FOR EACH ROW EXECUTE FUNCTION vango_guard_deleted_history();
      `, options);
      await q.sequelize.query(`DROP TRIGGER IF EXISTS guard_user_reference ON "userUploads";
        CREATE TRIGGER guard_user_reference BEFORE INSERT OR UPDATE ON "userUploads"
        FOR EACH ROW EXECUTE FUNCTION vango_guard_user_reference('userId');`, options);
      for (const [table, fields] of Object.entries(references)) {
        if (!tables.includes(table)) throw new Error(`Missing account-deletion dependency: ${table}`);
        await q.sequelize.query(`DROP TRIGGER IF EXISTS guard_user_reference ON "${table}";
          CREATE TRIGGER guard_user_reference BEFORE INSERT OR UPDATE ON "${table}"
          FOR EACH ROW EXECUTE FUNCTION vango_guard_user_reference(${fields.map(f => `'${f}'`).join(',')});`, options);
      }
    });
  },
  async down() {
    throw new Error('Account deletion is irreversible; automatic down migration is not supported');
  },
};
