"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    const normalizedTables = tables.map((table) => (typeof table === "object" ? table.tableName || table.name : table));

    if (!normalizedTables.includes("groups")) {
      await queryInterface.createTable("groups", {
        id: {
          type: Sequelize.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false,
        },
        name: {
          type: Sequelize.STRING,
          allowNull: false,
          unique: true,
        },
        photo: {
          type: Sequelize.STRING,
          allowNull: true,
        },
        createdAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn("NOW"),
        },
        updatedAt: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.fn("NOW"),
        },
      });
    }

    const usersTable = await queryInterface.describeTable("users");

    if (!usersTable.groupId) {
      await queryInterface.addColumn("users", "groupId", {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: "groups", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      });
    }

    if (usersTable.group) {
      await queryInterface.sequelize.query(`
        INSERT INTO "groups" ("name", "createdAt", "updatedAt")
        SELECT DISTINCT TRIM("group"), NOW(), NOW()
        FROM "users"
        WHERE "group" IS NOT NULL AND TRIM("group") <> ''
        ON CONFLICT ("name") DO NOTHING;
      `);

      await queryInterface.sequelize.query(`
        UPDATE "users"
        SET "groupId" = "groups"."id"
        FROM "groups"
        WHERE TRIM("users"."group") = "groups"."name"
          AND "users"."groupId" IS NULL;
      `);

      await queryInterface.removeColumn("users", "group");
    }
  },

  async down(queryInterface, Sequelize) {
    const usersTable = await queryInterface.describeTable("users");

    if (!usersTable.group) {
      await queryInterface.addColumn("users", "group", {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }

    if (usersTable.groupId) {
      await queryInterface.sequelize.query(`
        UPDATE "users"
        SET "group" = "groups"."name"
        FROM "groups"
        WHERE "users"."groupId" = "groups"."id";
      `);
      await queryInterface.removeColumn("users", "groupId");
    }

    await queryInterface.dropTable("groups");
  },
};
