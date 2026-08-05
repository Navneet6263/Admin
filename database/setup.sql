-- ============================================
-- ADMIN REQUEST SYSTEM — DATABASE SETUP
-- Run in SQL Server Management Studio
-- ============================================

IF DB_ID(N'admin_db') IS NULL CREATE DATABASE admin_db;
GO
USE admin_db;
GO

-- CLEANUP EXISTING TABLES IF RE-RUNNING
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS request_assignments;
DROP TABLE IF EXISTS approval_policies;
DROP TABLE IF EXISTS center_inventory;
DROP TABLE IF EXISTS stock_movements;
DROP TABLE IF EXISTS inventory;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS approvals;
DROP TABLE IF EXISTS requests;
DROP TABLE IF EXISTS center_budgets;
DROP TABLE IF EXISTS user_centers;
DROP TABLE IF EXISTS centers;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS teams;
DROP TABLE IF EXISTS companies;
GO

-- COMPANIES TABLE (Dynamic Companies / Brands)
CREATE TABLE companies (
  id         INT PRIMARY KEY IDENTITY(1,1),
  code       VARCHAR(10) NOT NULL UNIQUE,
  name       NVARCHAR(100) NOT NULL,
  legal_name NVARCHAR(150) NOT NULL,
  created_at DATETIME DEFAULT GETDATE()
);
GO

INSERT INTO companies (code, name, legal_name) VALUES
('VI', N'Vision India', N'Vision India Pvt. Ltd.'),
('JJ', N'Just Job', N'Just Job Services Pvt. Ltd.'),
('LS', N'Live Skills', N'Live Skills Education Pvt. Ltd.');
GO

-- TEAMS TABLE (Dynamic Teams / Departments)
CREATE TABLE teams (
  id         INT PRIMARY KEY IDENTITY(1,1),
  name       NVARCHAR(80) NOT NULL UNIQUE,
  company    NVARCHAR(80) NOT NULL DEFAULT 'Vision India',
  created_at DATETIME DEFAULT GETDATE()
);
GO

-- USERS TABLE
CREATE TABLE users (
  id         INT PRIMARY KEY IDENTITY(1,1),
  email      NVARCHAR(100) UNIQUE NOT NULL,
  name       NVARCHAR(100) NOT NULL,
  role       NVARCHAR(20)  NOT NULL CHECK (role IN (
               'employee','admin','hq_admin','center_admin','finance','finance_head','verifier','super_admin')),
  company    NVARCHAR(8)   NOT NULL DEFAULT 'VT',   -- VT / VR / VM / VL
  dept       NVARCHAR(80)  NOT NULL DEFAULT '',
  password_hash NVARCHAR(256) NOT NULL,
  is_active  BIT NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT GETDATE()
);

-- REQUESTS TABLE
CREATE TABLE requests (
  id          INT PRIMARY KEY IDENTITY(1,1),
  ref_id      AS ('REQ-' + RIGHT('000000' + CAST(id AS NVARCHAR), 6)) PERSISTED,
  user_id     INT NOT NULL REFERENCES users(id),
  company     NVARCHAR(8)   NOT NULL DEFAULT 'VT',
  team        NVARCHAR(80)  NOT NULL DEFAULT '',
  type        NVARCHAR(30)  NOT NULL CHECK (type IN (
                'id_card','visiting_card','stationery',
                'travel','courier','meeting_room','fooding')),
  subject     NVARCHAR(160) NOT NULL,
  description NVARCHAR(2000) DEFAULT '',
  amount      DECIMAL(12,2) NULL,
  priority    NVARCHAR(10)  NOT NULL DEFAULT 'normal'
                CHECK (priority IN ('low','normal','high','urgent')),
  status      NVARCHAR(30)  NOT NULL DEFAULT 'pending'
                CHECK (status IN (
                  'pending','queued','awaiting_verification',
                  'approved','rejected','info_requested')),
  details     NVARCHAR(MAX) NULL,   -- JSON blob for specialized forms
  created_at  DATETIME DEFAULT GETDATE(),
  updated_at  DATETIME DEFAULT GETDATE()
);

-- APPROVALS / AUDIT TABLE
CREATE TABLE approvals (
  id          INT PRIMARY KEY IDENTITY(1,1),
  request_id  INT NOT NULL REFERENCES requests(id),
  actor_id    INT NOT NULL REFERENCES users(id),
  action      NVARCHAR(30) NOT NULL CHECK (action IN (
                'raised','withdrawn','approved','rejected','queued','info_requested',
                'verified','sent_back','commented','payment_updated','payment_verified')),
  note        NVARCHAR(1000),
  created_at  DATETIME DEFAULT GETDATE()
);

-- NOTIFICATIONS TABLE
CREATE TABLE notifications (
  id         INT PRIMARY KEY IDENTITY(1,1),
  user_id    INT NOT NULL REFERENCES users(id),
  message    NVARCHAR(500) NOT NULL,
  is_read    BIT DEFAULT 0,
  created_at DATETIME DEFAULT GETDATE()
);
GO

-- INVENTORY TABLE
CREATE TABLE inventory (
  sku        NVARCHAR(30) PRIMARY KEY,
  name       NVARCHAR(200) NOT NULL,
  category   NVARCHAR(20)  NOT NULL CHECK (category IN ('Writing','Paper','Printing','Filing','Desk','Misc')),
  unit       NVARCHAR(50)  NOT NULL,
  price      DECIMAL(10,2) NOT NULL,
  qty        INT NOT NULL DEFAULT 0,
  threshold  INT NOT NULL DEFAULT 10,
  updated_at DATETIME DEFAULT GETDATE()
);
GO

-- STOCK MOVEMENTS TABLE
CREATE TABLE stock_movements (
  id            INT PRIMARY KEY IDENTITY(1,1),
  sku           NVARCHAR(30) NOT NULL REFERENCES inventory(sku),
  direction     NVARCHAR(3)  NOT NULL CHECK (direction IN ('in','out')),
  qty           INT NOT NULL,
  balance_after INT NOT NULL,
  source        NVARCHAR(20) NOT NULL CHECK (source IN ('seed','restock','add_item','adjustment','request','return')),
  ref_id        NVARCHAR(20) NULL,
  actor         NVARCHAR(120) NULL,
  note          NVARCHAR(500) NULL,
  created_at    DATETIME DEFAULT GETDATE()
);
GO

-- ============================================
-- INDEXES
-- ============================================
CREATE NONCLUSTERED INDEX idx_req_status      ON requests(status)           INCLUDE (id,user_id,type,priority,created_at);
CREATE NONCLUSTERED INDEX idx_req_user        ON requests(user_id)          INCLUDE (status,type,created_at);
CREATE NONCLUSTERED INDEX idx_req_company     ON requests(company,status)   INCLUDE (id,type,created_at);
CREATE NONCLUSTERED INDEX idx_req_pending     ON requests(created_at DESC)  WHERE status = 'pending';
CREATE NONCLUSTERED INDEX idx_req_verif       ON requests(created_at DESC)  WHERE status = 'awaiting_verification';
CREATE NONCLUSTERED INDEX idx_req_company_updated ON requests(company, updated_at DESC) INCLUDE (status,type,amount,user_id);
CREATE NONCLUSTERED INDEX idx_users_login ON users(email) INCLUDE (id,name,role,company,dept,is_active);
CREATE NONCLUSTERED INDEX idx_approvals_req   ON approvals(request_id)      INCLUDE (actor_id,action,created_at);
CREATE NONCLUSTERED INDEX idx_notif_user_read ON notifications(user_id,is_read) INCLUDE (message,created_at);
CREATE NONCLUSTERED INDEX idx_inv_category    ON inventory(category)        INCLUDE (qty,threshold);
CREATE NONCLUSTERED INDEX idx_mov_sku         ON stock_movements(sku)       INCLUDE (direction,qty,created_at);
GO

-- ============================================
-- SEED TEAMS (Dynamic Departments)
-- ============================================
INSERT INTO teams (name, company) VALUES
  ('Engineering', 'VT'),
  ('Sales',       'VR'),
  ('Marketing',   'VM'),
  ('Operations',  'VL'),
  ('Design',      'VM'),
  ('HR',          'VT'),
  ('Admin',       'VT'),
  ('Finance',     'VT'),
  ('Compliance',  'VT'),
  ('Executive',   'VT'),
  ('Product',     'VT');
GO

-- ============================================
-- SEED USERS (Single Super Admin: spoken.3764@gmail.com / pass: navneet)
-- ============================================
INSERT INTO users (email, name, role, company, dept, password_hash) VALUES
  ('spoken.3764@gmail.com', 'Navneet (Super Admin)', 'super_admin', 'VT', 'Executive', '680bf4a16323ee35256996f395d68b84:c5f364717d3f92584e19c4b543644397cdd4f3acc9865811b67886cd766ab3c15e8c770d2e18ea47c9166549de37075e45f87011c429a000a7c8ebf61e594e86');
GO

-- Transactional requests, approvals, inventory, and stock movements intentionally
-- start empty. Populate them through the application so every displayed record is real.

-- VERIFY
SELECT COUNT(*) AS users_count FROM users;
SELECT COUNT(*) AS requests_count FROM requests;
SELECT COUNT(*) AS approvals_count FROM approvals;
SELECT COUNT(*) AS inventory_count FROM inventory;
SELECT COUNT(*) AS stock_movements_count FROM stock_movements;
