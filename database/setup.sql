-- ============================================
-- ADMIN REQUEST SYSTEM — DATABASE SETUP
-- Run in SQL Server Management Studio
-- ============================================

IF DB_ID(N'admin_db') IS NULL CREATE DATABASE admin_db;
GO
USE admin_db;
GO

-- CLEANUP EXISTING TABLES IF RE-RUNNING
DROP TABLE IF EXISTS stock_movements;
DROP TABLE IF EXISTS inventory;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS approvals;
DROP TABLE IF EXISTS requests;
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
  role       NVARCHAR(20)  NOT NULL CHECK (role IN ('employee','admin','finance','verifier','super_admin')),
  company    NVARCHAR(8)   NOT NULL DEFAULT 'VT',   -- VT / VR / VM / VL
  dept       NVARCHAR(80)  NOT NULL DEFAULT '',
  password_hash NVARCHAR(256) NOT NULL,
  is_active  BIT NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT GETDATE()
);

-- REQUESTS TABLE
CREATE TABLE requests (
  id          INT PRIMARY KEY IDENTITY(1,1),
  ref_id      AS ('REQ-2026-' + RIGHT('0000' + CAST(id AS NVARCHAR), 4)) PERSISTED,
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
                'approved','rejected','queued','info_requested',
                'verified','sent_back','commented')),
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

-- ============================================
-- SEED REQUESTS (15 Realistic Sample Requests)
-- ============================================
INSERT INTO requests (user_id,company,team,type,subject,amount,description,priority,status,created_at) VALUES
  (1,'VT','Engineering','id_card',      'Replacement ID card — lost',                  NULL,   'Lost original card near cafeteria on 14 Jul. Need urgent replacement.', 'urgent', 'pending',              DATEADD(HOUR,-2,  GETDATE())),
  (1,'VR','Sales',      'visiting_card','Reprint — 500 qty, Senior AE title',           NULL,   'Promoted to Senior Account Executive. Need updated title cards.',        'normal', 'pending',              DATEADD(HOUR,-5,  GETDATE())),
  (1,'VM','Design',     'stationery',   'Whiteboard markers & sticky notes bulk',       3400,   'Design sprint preparation for next week.',                              'low',    'pending',              DATEADD(HOUR,-12, GETDATE())),
  (1,'VT','HR',         'travel',       'Flight — DEL → BLR, 24 Jul, return 26 Jul',   22500,  'Campus recruitment drive at IIM Bangalore.',                             'urgent', 'pending',              DATEADD(HOUR,-18, GETDATE())),
  (1,'VT','Engineering','courier',      'Blue Dart — legal contracts to Mumbai HQ',    850,    'Physical signed original contracts for legal review.',                   'normal', 'pending',              DATEADD(HOUR,-24, GETDATE())),
  (1,'VM','Marketing',  'meeting_room', 'Executive Board Room A — Q3 review, 4 hrs',    NULL,   'Quarterly marketing review with leadership.',                             'high',   'pending',              DATEADD(HOUR,-30, GETDATE())),
  (1,'VT','Operations', 'fooding',      'Team lunch catering — 15 pax',                5500,   'Project milestone completion lunch.',                                    'normal', 'awaiting_verification',DATEADD(HOUR,-36, GETDATE())),
  (1,'VM','Marketing',  'travel',       'Taxi — Airport pickup & hotel drop',          1800,   'Client visit from Bangalore airport.',                                   'normal', 'awaiting_verification',DATEADD(HOUR,-48, GETDATE())),
  (1,'VT','Admin',      'stationery',   'Printer cartridges — HP LaserJet 88A (qty 2)', 8400,  'Stock depletion in 2nd floor admin desk.',                               'normal', 'approved',             DATEADD(DAY,-4,   GETDATE())),
  (1,'VT','Engineering','visiting_card','Reprint — 250 qty standard',                  NULL,   'Stock exhaustion.',                                                      'low',    'approved',             DATEADD(DAY,-6,   GETDATE())),
  (1,'VT','HR',         'courier',      'DTDC — offer letters batch dispatch',          1200,   'Dispatching signed offer letters.',                                      'normal', 'approved',             DATEADD(DAY,-8,   GETDATE())),
  (1,'VM','Marketing',  'fooding',      'Client dinner & catering',                     9200,   'Prospective client dinner at Taj.',                                      'high',   'approved',             DATEADD(DAY,-10,  GETDATE())),
  (1,'VL','Logistics',  'travel',       'Flight — BOM → DEL emergency travel',         18500,  'Emergency warehouse inspection.',                                       'urgent', 'rejected',             DATEADD(DAY,-12,  GETDATE())),
  (1,'VT','Engineering','stationery',   'A4 printer paper (10 reams)',                 4500,   'Bulk paper supply for engineering section.',                             'normal', 'info_requested',       DATEADD(DAY,-14,  GETDATE())),
  (1,'VR','Sales',      'meeting_room', 'Conference Hall B — Product Launch',          NULL,   'New product demo session with partners.',                                'normal', 'queued',               DATEADD(DAY,-15,  GETDATE()));
GO

-- Seed approvals for approved/awaiting/rejected requests
INSERT INTO approvals (request_id,actor_id,action,note,created_at) VALUES
  (7, 1, 'approved', 'Approved by Admin. Sent to Verifier for bill check.', DATEADD(HOUR,-32, GETDATE())),
  (8, 1, 'approved', 'Approved. Taxi bill to be verified.',                 DATEADD(HOUR,-44, GETDATE())),
  (9, 1, 'approved', 'Approved under admin budget.',                        DATEADD(DAY,-3,   GETDATE())),
  (10,1, 'approved', 'Standard reprint approved.',                          DATEADD(DAY,-5,   GETDATE())),
  (11,1, 'approved', 'Approved for HR dispatch.',                           DATEADD(DAY,-7,   GETDATE())),
  (12,1, 'approved', 'Approved by Finance & Executive.',                    DATEADD(DAY,-9,   GETDATE())),
  (13,1, 'rejected', 'Exceeds travel budget limits for Q3.',                DATEADD(DAY,-11,  GETDATE())),
  (14,1, 'info_requested', 'Please specify exact GSM requirement.',         DATEADD(DAY,-13,  GETDATE()));
GO

-- ============================================
-- SEED INVENTORY
-- ============================================
INSERT INTO inventory (sku,name,category,unit,price,qty,threshold) VALUES
  ('STA-WBM-10',  'Whiteboard markers (assorted)',  'Writing',  'pack of 10',  300,  25, 10),
  ('STA-STN-100', 'Sticky notes 3×3 (yellow)',      'Paper',    '100 sheets',  80,   40, 10),
  ('STA-A4P-500', 'A4 printer paper (75 gsm)',      'Paper',    '500 sheets',  450,  15, 10),
  ('STA-BPP-10',  'Ballpoint pens (blue)',          'Writing',  'pack of 10',  120,  8,  10),
  ('STA-HPC-01',  'HP LaserJet cartridge 88A',      'Printing', '1 cartridge', 4200, 5,  6 ),
  ('STA-FLD-25',  'File folders (A4, plastic)',     'Filing',   'pack of 25',  550,  30, 10),
  ('STA-HLT-05',  'Highlighters (5-colour)',        'Writing',  'pack of 5',   150,  20, 8 ),
  ('STA-STP-01',  'Stapler + 1000 pins',            'Desk',     '1 kit',       450,  12, 6 ),
  ('STA-NBK-05',  'A5 notebooks (ruled)',           'Paper',    'pack of 5',   200,  18, 10),
  ('STA-USB-01',  'USB drive 32 GB',               'Misc',     '1 pc',        550,  4,  6 ),
  ('STA-BAT-04',  'AA batteries (pack of 4)',       'Misc',     'pack of 4',   90,   30, 10);
GO

-- ============================================
-- SEED INITIAL STOCK MOVEMENTS
-- ============================================
INSERT INTO stock_movements (sku,direction,qty,balance_after,source,actor,note) VALUES
  ('STA-WBM-10', 'in', 25, 25, 'seed', 'System', 'Initial stock seed'),
  ('STA-STN-100', 'in', 40, 40, 'seed', 'System', 'Initial stock seed'),
  ('STA-A4P-500', 'in', 15, 15, 'seed', 'System', 'Initial stock seed'),
  ('STA-BPP-10',  'in', 8,  8,  'seed', 'System', 'Initial stock seed'),
  ('STA-HPC-01',  'in', 5,  5,  'seed', 'System', 'Initial stock seed'),
  ('STA-FLD-25',  'in', 30, 30, 'seed', 'System', 'Initial stock seed'),
  ('STA-HLT-05',  'in', 20, 20, 'seed', 'System', 'Initial stock seed'),
  ('STA-STP-01',  'in', 12, 12, 'seed', 'System', 'Initial stock seed'),
  ('STA-NBK-05',  'in', 18, 18, 'seed', 'System', 'Initial stock seed'),
  ('STA-USB-01',  'in', 4,  4,  'seed', 'System', 'Initial stock seed'),
  ('STA-BAT-04',  'in', 30, 30, 'seed', 'System', 'Initial stock seed');
GO

-- VERIFY
SELECT COUNT(*) AS users_count FROM users;
SELECT COUNT(*) AS requests_count FROM requests;
SELECT COUNT(*) AS approvals_count FROM approvals;
SELECT COUNT(*) AS inventory_count FROM inventory;
SELECT COUNT(*) AS stock_movements_count FROM stock_movements;
