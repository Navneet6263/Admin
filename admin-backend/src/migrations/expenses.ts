import type mssql from 'mssql';

/** Manually recorded operating expenses (centre / HQ), mapped to a company for reporting. */
export async function ensureExpenseSchema(pool: mssql.ConnectionPool) {
  await pool.request().query(`
    SET XACT_ABORT ON;
    BEGIN TRANSACTION;
    IF OBJECT_ID('expenses','U') IS NULL BEGIN
      CREATE TABLE expenses (
        id            INT IDENTITY PRIMARY KEY,
        expense_date  DATE          NOT NULL,
        company       NVARCHAR(100) NOT NULL,
        center_code   NVARCHAR(10)  NULL REFERENCES centers(code),
        category      NVARCHAR(60)  NOT NULL,
        description   NVARCHAR(500) NOT NULL,
        paid_to       NVARCHAR(150) NULL,
        amount        DECIMAL(14,2) NOT NULL CONSTRAINT CK_expenses_amount CHECK(amount>0),
        gst_amount    DECIMAL(14,2) NOT NULL CONSTRAINT DF_expenses_gst DEFAULT 0,
        payment_mode  NVARCHAR(20)  NOT NULL,
        reference_no  NVARCHAR(60)  NULL,
        notes         NVARCHAR(500) NULL,
        created_by    INT           NOT NULL REFERENCES users(id),
        created_at    DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_by    INT           NULL REFERENCES users(id),
        updated_at    DATETIME2     NULL,
        is_deleted    BIT           NOT NULL DEFAULT 0,
        deleted_by    INT           NULL REFERENCES users(id),
        deleted_at    DATETIME2     NULL,
        delete_reason NVARCHAR(300) NULL,
        CONSTRAINT CK_expenses_gst CHECK(gst_amount>=0 AND gst_amount<=amount),
        CONSTRAINT CK_expenses_mode CHECK(payment_mode IN('Cash','UPI','Bank transfer','Card','Cheque','Company account'))
      );
      CREATE INDEX IX_expenses_date ON expenses(is_deleted,expense_date DESC) INCLUDE(company,center_code,category,amount);
      CREATE INDEX IX_expenses_center ON expenses(center_code,expense_date DESC);
    END;
    COMMIT TRANSACTION;
  `);
}
