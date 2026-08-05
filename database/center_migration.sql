-- ============================================================
-- CENTER-WISE SYSTEM MIGRATION
-- Run in SSMS on admin_db (after setup.sql has already run)
-- ============================================================
USE admin_db;
GO

-- ── 1. CENTERS TABLE ─────────────────────────────────────────
IF OBJECT_ID('centers','U') IS NULL
BEGIN
  CREATE TABLE centers (
    id           INT PRIMARY KEY IDENTITY(1,1),
    code         NVARCHAR(10)  NOT NULL UNIQUE,
    name         NVARCHAR(100) NOT NULL,
    city         NVARCHAR(80)  NOT NULL,
    company      NVARCHAR(8)   NOT NULL DEFAULT 'VT',
    hq_admin_id  INT           NULL REFERENCES users(id),
    is_active    BIT           NOT NULL DEFAULT 1,
    created_at   DATETIME      DEFAULT GETDATE()
  );
END
GO

-- ── 2. USER_CENTERS TABLE ────────────────────────────────────
IF OBJECT_ID('user_centers','U') IS NULL
BEGIN
  CREATE TABLE user_centers (
    id                  INT PRIMARY KEY IDENTITY(1,1),
    user_id             INT          NOT NULL REFERENCES users(id),
    home_center_code    NVARCHAR(10) NOT NULL REFERENCES centers(code),
    assigned_by         INT          NULL REFERENCES users(id),
    assigned_at         DATETIME     DEFAULT GETDATE(),
    CONSTRAINT uq_user_center UNIQUE (user_id)
  );
END
GO

-- ── 3. CENTER_BUDGETS TABLE ──────────────────────────────────
IF OBJECT_ID('center_budgets','U') IS NULL
BEGIN
  CREATE TABLE center_budgets (
    id           INT PRIMARY KEY IDENTITY(1,1),
    center_code  NVARCHAR(10) NOT NULL REFERENCES centers(code),
    month        TINYINT      NOT NULL CHECK (month BETWEEN 1 AND 12),
    year         SMALLINT     NOT NULL,
    allocated    DECIMAL(14,2) NOT NULL DEFAULT 0,
    committed    DECIMAL(14,2) NOT NULL DEFAULT 0,
    spent        DECIMAL(14,2) NOT NULL DEFAULT 0,
    updated_at   DATETIME     DEFAULT GETDATE(),
    CONSTRAINT uq_center_budget UNIQUE (center_code, month, year)
  );
END
GO

-- ── 4. ADD COLUMNS TO REQUESTS (if not already there) ────────
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('requests') AND name = 'home_center_code'
)
BEGIN
  ALTER TABLE requests ADD home_center_code   NVARCHAR(10) NULL;
  ALTER TABLE requests ADD fulfil_center_code NVARCHAR(10) NULL;
END
GO

-- ── 5. ADD center_code TO USERS TABLE ────────────────────────
-- Stored for quick lookup at login (denormalized from user_centers)
IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('users') AND name = 'center_code'
)
BEGIN
  ALTER TABLE users ADD center_code NVARCHAR(10) NULL;
END
GO

-- ── 6. INDEXES ────────────────────────────────────────────────
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_req_center')
  CREATE NONCLUSTERED INDEX idx_req_center
    ON requests(home_center_code, status)
    INCLUDE (id, type, amount, created_at);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_user_center')
  CREATE NONCLUSTERED INDEX idx_user_center
    ON user_centers(home_center_code)
    INCLUDE (user_id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_budget_center_month')
  CREATE NONCLUSTERED INDEX idx_budget_center_month
    ON center_budgets(center_code, year, month);
GO

-- Centers and budgets intentionally start empty. Create them through the
-- Super Admin center-management flow so no demo location reaches production.

-- ── VERIFY ────────────────────────────────────────────────────
SELECT 'centers'       AS tbl, COUNT(*) AS rows FROM centers
UNION ALL
SELECT 'user_centers'  AS tbl, COUNT(*) AS rows FROM user_centers
UNION ALL
SELECT 'center_budgets'AS tbl, COUNT(*) AS rows FROM center_budgets;
GO
