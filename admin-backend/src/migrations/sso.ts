import type mssql from 'mssql';

/** SSO from an external HRMS (Green HR), employee OTP login and the supporting user profile fields. */
export async function ensureSsoSchema(pool: mssql.ConnectionPool) {
  await pool.request().query(`
    IF NOT EXISTS(SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('users') AND name='auth_source')
      ALTER TABLE users ADD auth_source NVARCHAR(10) NOT NULL CONSTRAINT DF_users_auth_source DEFAULT 'local',
        email_placeholder BIT NOT NULL CONSTRAINT DF_users_email_placeholder DEFAULT 0,
        mobile NVARCHAR(20) NULL, designation NVARCHAR(100) NULL, sso_client_id INT NULL, last_sso_at DATETIME2 NULL;
  `);
  await pool.request().query(`
    SET XACT_ABORT ON;
    BEGIN TRANSACTION;
    IF OBJECT_ID('sso_clients','U') IS NULL
      CREATE TABLE sso_clients (
        id           INT IDENTITY PRIMARY KEY,
        name         NVARCHAR(100) NOT NULL,
        key_prefix   CHAR(8)       NOT NULL CONSTRAINT UX_sso_clients_prefix UNIQUE,
        key_hash     CHAR(64)      NOT NULL,
        is_active    BIT           NOT NULL DEFAULT 1,
        created_by   INT           NOT NULL REFERENCES users(id),
        created_at   DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
        rotated_at   DATETIME2     NULL,
        last_used_at DATETIME2     NULL
      );
    IF OBJECT_ID('sso_company_map','U') IS NULL
      CREATE TABLE sso_company_map (
        client_id   INT           NOT NULL REFERENCES sso_clients(id),
        company     NVARCHAR(100) NOT NULL,
        center_code NVARCHAR(10)  NULL REFERENCES centers(code),
        CONSTRAINT PK_sso_company_map PRIMARY KEY(client_id,company)
      );
    IF OBJECT_ID('sso_tickets','U') IS NULL BEGIN
      CREATE TABLE sso_tickets (
        ticket_hash CHAR(64)     NOT NULL PRIMARY KEY,
        client_id   INT          NOT NULL REFERENCES sso_clients(id),
        user_id     INT          NOT NULL REFERENCES users(id),
        outcome     VARCHAR(20)  NOT NULL CONSTRAINT CK_sso_tickets_outcome CHECK(outcome IN('login','admin_account','inactive')),
        expires_at  DATETIME2    NOT NULL,
        used_at     DATETIME2    NULL,
        created_at  DATETIME2    NOT NULL DEFAULT SYSUTCDATETIME()
      );
      CREATE INDEX IX_sso_tickets_expiry ON sso_tickets(expires_at);
    END;
    IF OBJECT_ID('sso_events','U') IS NULL BEGIN
      CREATE TABLE sso_events (
        id            BIGINT IDENTITY PRIMARY KEY,
        client_id     INT           NULL,
        user_id       INT           NULL,
        employee_code NVARCHAR(40)  NULL,
        event         VARCHAR(30)   NOT NULL,
        detail        NVARCHAR(300) NULL,
        ip            NVARCHAR(64)  NULL,
        created_at    DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
      );
      CREATE INDEX IX_sso_events_created ON sso_events(created_at DESC);
    END;
    IF OBJECT_ID('login_otps','U') IS NULL BEGIN
      CREATE TABLE login_otps (
        id         INT IDENTITY PRIMARY KEY,
        user_id    INT           NOT NULL REFERENCES users(id),
        purpose    VARCHAR(12)   NOT NULL CONSTRAINT CK_login_otps_purpose CHECK(purpose IN('login','email')),
        target     NVARCHAR(100) NOT NULL,
        code_hash  CHAR(64)      NOT NULL,
        attempts   TINYINT       NOT NULL DEFAULT 0,
        expires_at DATETIME2     NOT NULL,
        used_at    DATETIME2     NULL,
        created_at DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
      );
      CREATE INDEX IX_login_otps_user ON login_otps(user_id,purpose,created_at DESC);
    END;
    COMMIT TRANSACTION;
  `);
  // Default center is optional: employees are matched to an existing center automatically.
  await pool.request().query(`
    IF EXISTS(SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('sso_company_map') AND name='center_code' AND is_nullable=0)
      ALTER TABLE sso_company_map ALTER COLUMN center_code NVARCHAR(10) NULL;
  `);
}
