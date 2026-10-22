import type mssql from 'mssql';

/** Center staff (sub-accounts created by a Center Admin) and the daily-use consumables register. */
export async function ensureCenterStaffSchema(pool: mssql.ConnectionPool) {
  await pool.request().query(`
    SET XACT_ABORT ON;
    BEGIN TRANSACTION;
    IF OBJECT_ID('center_staff','U') IS NULL
      CREATE TABLE center_staff (
        user_id     INT PRIMARY KEY REFERENCES users(id),
        center_code NVARCHAR(10)   NOT NULL REFERENCES centers(code),
        created_by  INT            NOT NULL REFERENCES users(id),
        permissions NVARCHAR(2000) NOT NULL DEFAULT '{}',
        created_at  DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at  DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
      );
    IF OBJECT_ID('daily_items','U') IS NULL
      CREATE TABLE daily_items (
        id          INT IDENTITY PRIMARY KEY,
        center_code NVARCHAR(10)  NOT NULL REFERENCES centers(code),
        name        NVARCHAR(120) NOT NULL,
        unit        NVARCHAR(30)  NOT NULL DEFAULT 'piece',
        qty         INT           NOT NULL DEFAULT 0 CONSTRAINT CK_daily_items_qty CHECK(qty>=0),
        threshold   INT           NOT NULL DEFAULT 0,
        is_active   BIT           NOT NULL DEFAULT 1,
        created_by  INT           NOT NULL REFERENCES users(id),
        created_at  DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at  DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UX_daily_items_center_name UNIQUE(center_code,name)
      );
    IF OBJECT_ID('daily_movements','U') IS NULL BEGIN
      CREATE TABLE daily_movements (
        id            INT IDENTITY PRIMARY KEY,
        item_id       INT           NOT NULL REFERENCES daily_items(id),
        center_code   NVARCHAR(10)  NOT NULL,
        direction     VARCHAR(10)   NOT NULL CONSTRAINT CK_daily_movements_direction
                        CHECK(direction IN('opening','purchase','issue','return','adjust_in','adjust_out')),
        qty           INT           NOT NULL,
        balance_after INT           NOT NULL,
        amount        DECIMAL(14,2) NULL,
        handed_to     NVARCHAR(120) NULL,
        note          NVARCHAR(500) NULL,
        actor_id      INT           NOT NULL REFERENCES users(id),
        created_at    DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
      );
      CREATE INDEX IX_daily_movements_center ON daily_movements(center_code,created_at DESC);
      CREATE INDEX IX_daily_movements_item ON daily_movements(item_id,created_at DESC);
    END;
    COMMIT TRANSACTION;
  `);
  // Stock-register upgrade: item master fields, weighted-average valuation and full voucher types.
  await pool.request().query(`
    IF NOT EXISTS(SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('daily_items') AND name='category')
      ALTER TABLE daily_items ADD category NVARCHAR(40) NOT NULL CONSTRAINT DF_daily_items_category DEFAULT 'Cleaning',
        avg_cost DECIMAL(14,4) NOT NULL CONSTRAINT DF_daily_items_avg DEFAULT 0;
    IF NOT EXISTS(SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('daily_movements') AND name='rate')
      ALTER TABLE daily_movements ADD rate DECIMAL(14,4) NULL, value DECIMAL(14,2) NULL, vendor NVARCHAR(150) NULL,
        bill_no NVARCHAR(60) NULL, bill_date DATE NULL, payment_mode NVARCHAR(20) NULL,
        department NVARCHAR(80) NULL, reason NVARCHAR(40) NULL;
  `);
  await pool.request().query(`
    IF EXISTS(SELECT 1 FROM sys.check_constraints WHERE name='CK_daily_movements_direction'
      AND definition NOT LIKE '%adjust_out%') BEGIN
      ALTER TABLE daily_movements DROP CONSTRAINT CK_daily_movements_direction;
      ALTER TABLE daily_movements ADD CONSTRAINT CK_daily_movements_direction
        CHECK(direction IN('opening','purchase','issue','return','adjust_in','adjust_out'));
    END;
  `);
}
