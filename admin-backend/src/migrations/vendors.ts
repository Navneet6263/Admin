import type mssql from 'mssql';

export async function ensureVendorSchema(pool: mssql.ConnectionPool) {
  await pool.request().query(`
    SET XACT_ABORT ON;
    BEGIN TRY
    BEGIN TRANSACTION;
    IF OBJECT_ID('vendors','U') IS NULL BEGIN
      CREATE TABLE vendors (
        id INT IDENTITY PRIMARY KEY, name NVARCHAR(120) NOT NULL,
        contact_name NVARCHAR(120) NOT NULL DEFAULT '', email NVARCHAR(254) NOT NULL,
        phone NVARCHAR(30) NOT NULL DEFAULT '', service VARCHAR(20) NOT NULL,
        is_active BIT NOT NULL DEFAULT 1, created_by INT NOT NULL REFERENCES users(id),
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT CK_vendor_service CHECK(service IN('id_card','visiting_card','both'))
      );
      CREATE UNIQUE INDEX UX_vendors_email ON vendors(email);
      CREATE INDEX IX_vendors_active ON vendors(is_active,id) INCLUDE(name,email,service);
    END;
    IF OBJECT_ID('vendor_deliveries','U') IS NULL BEGIN
      CREATE TABLE vendor_deliveries (
        id UNIQUEIDENTIFIER PRIMARY KEY, payload_hash CHAR(64) NOT NULL,
        vendor_id INT NOT NULL REFERENCES vendors(id), vendor_name NVARCHAR(120) NOT NULL,
        vendor_email NVARCHAR(254) NOT NULL, actor_id INT NOT NULL REFERENCES users(id),
        status VARCHAR(20) NOT NULL, message_id NVARCHAR(254) NULL, error_code VARCHAR(60) NULL,
        verified_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(), sent_at DATETIME2 NULL,
        CONSTRAINT CK_vendor_delivery_status CHECK(status IN('sending','sent','failed','unknown'))
      );
      CREATE INDEX IX_vendor_deliveries_created ON vendor_deliveries(created_at DESC);
      CREATE TABLE vendor_delivery_items (
        delivery_id UNIQUEIDENTIFIER NOT NULL REFERENCES vendor_deliveries(id),
        request_id INT NOT NULL REFERENCES requests(id), ref_id NVARCHAR(50) NOT NULL,
        company NVARCHAR(200) NOT NULL, template NVARCHAR(100) NOT NULL, quantity INT NOT NULL,
        revision CHAR(64) NOT NULL, pdf_hash CHAR(64) NOT NULL,
        CONSTRAINT PK_vendor_delivery_items PRIMARY KEY(delivery_id,request_id)
      );
      CREATE INDEX IX_vendor_delivery_items_request ON vendor_delivery_items(request_id,delivery_id);
    END;
    IF OBJECT_ID('vendor_audit','U') IS NULL CREATE TABLE vendor_audit (
      id BIGINT IDENTITY PRIMARY KEY, vendor_id INT NOT NULL REFERENCES vendors(id),
      actor_id INT NOT NULL REFERENCES users(id), action VARCHAR(20) NOT NULL,
      details NVARCHAR(1000) NOT NULL, created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
    IF NOT EXISTS(SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('requests') AND name='IX_requests_vendor_cards')
      CREATE INDEX IX_requests_vendor_cards ON requests(status,type,approval_center_code,created_at DESC,id DESC)
        INCLUDE(ref_id,company,subject);
    COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
      IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
      THROW;
    END CATCH;
  `);
}
