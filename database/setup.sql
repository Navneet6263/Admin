-- ============================================
-- ADMIN REQUEST SYSTEM — DATABASE SETUP
-- Run in SQL Server Management Studio
-- ============================================

IF DB_ID(N'admin_db') IS NULL CREATE DATABASE admin_db;
GO
USE admin_db;
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
  read       BIT DEFAULT 0,
  created_at DATETIME DEFAULT GETDATE()
);

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
CREATE NONCLUSTERED INDEX idx_notif_user_read ON notifications(user_id,read) INCLUDE (message,created_at);
CREATE NONCLUSTERED INDEX idx_inv_category    ON inventory(category)        INCLUDE (qty,threshold);
CREATE NONCLUSTERED INDEX idx_mov_sku         ON stock_movements(sku)       INCLUDE (direction,qty,created_at);

-- ============================================
-- SEED USERS
-- ============================================
INSERT INTO users (email, name, role, company, dept, password_hash) VALUES
  ('rahul@company.com',  'Rahul Kumar',   'employee',    'VT', 'Engineering', '680bf4a16323ee35256996f395d68b84:6e97196b58c71e7f7787ec47ab2403301861dd10255de758c5af30de9bbbce7eef4f2547118e9fe3c467f82db1f285f10c0655bf73b2d03d436c9dd72fd2435d'),
  ('priya@company.com',  'Priya Sharma',  'employee',    'VR', 'Sales', '680bf4a16323ee35256996f395d68b84:6e97196b58c71e7f7787ec47ab2403301861dd10255de758c5af30de9bbbce7eef4f2547118e9fe3c467f82db1f285f10c0655bf73b2d03d436c9dd72fd2435d'),
  ('amit@company.com',   'Amit Verma',    'employee',    'VM', 'Marketing', '680bf4a16323ee35256996f395d68b84:6e97196b58c71e7f7787ec47ab2403301861dd10255de758c5af30de9bbbce7eef4f2547118e9fe3c467f82db1f285f10c0655bf73b2d03d436c9dd72fd2435d'),
  ('neha@company.com',   'Neha Gupta',    'employee',    'VL', 'Operations', '680bf4a16323ee35256996f395d68b84:6e97196b58c71e7f7787ec47ab2403301861dd10255de758c5af30de9bbbce7eef4f2547118e9fe3c467f82db1f285f10c0655bf73b2d03d436c9dd72fd2435d'),
  ('karthik@company.com','Karthik Rao',   'employee',    'VM', 'Design', '680bf4a16323ee35256996f395d68b84:6e97196b58c71e7f7787ec47ab2403301861dd10255de758c5af30de9bbbce7eef4f2547118e9fe3c467f82db1f285f10c0655bf73b2d03d436c9dd72fd2435d'),
  ('meera@company.com',  'Meera Iyer',    'employee',    'VT', 'HR', '680bf4a16323ee35256996f395d68b84:6e97196b58c71e7f7787ec47ab2403301861dd10255de9bbbce7eef4f2547118e9fe3c467f82db1f285f10c0655bf73b2d03d436c9dd72fd2435d'),
  ('admin@company.com',  'John Admin',    'admin',       'VT', 'Admin', '5d6b203b055b4fa54e3c3565d72b5575:95a02063b6ad467cd3af7c00c409d973c94f600f24ee82f4d30200fd570bbea8318fa05a1a2f4a71500d65a4c5975b31f03bbba01ed34a57b4cb283c3ee4e826'),
  ('finance@company.com','Anjali Mehta',  'finance',     'VT', 'Finance', '444b9b6baf0b8d0d56694932d1e40d3e:b2dd9fd2f022f3d0ae91f7be7e79272e59df905d644b00ac1b7a20ef70bfc4d942279e7bef5838442d515c62e70671e887f1d6ef643f822ddde16114d42e482c'),
  ('verifier@company.com','Sneha Iyer',   'verifier',    'VT', 'Compliance', 'ea3029c5bda6d75f870030f9672aae4a:e5c6163b1b9bbdc3cc8bce127ea5de53fd3df0e55e4b3a87b53fcae3e6f9e083b9209aa198e6f1b29a21557eea48f135a6c90c664b9ddec52503a5b66596d4a5'),
  ('coo@company.com',    'Vikram Rathore','super_admin', 'VT', 'Executive', '928d6654964a6d54e21ec0c12b30963d:9ce825c960e23038817271347cf8cf41e8d1fd1528f9aff116c2d113c1a2aba2fc0ca99a14345cda67f0d584e92faf7781c3631b46206ec141127e398a10b49d');

-- ============================================
-- SEED REQUESTS
-- ============================================
INSERT INTO requests (user_id,company,team,type,subject,amount,description,priority,status,created_at) VALUES
  (1,'VT','Engineering','id_card',      'Replacement ID card — lost',                  NULL,   'Lost near cafeteria on 14 Jul.',  'urgent', 'pending',              DATEADD(HOUR,-4,  GETDATE())),
  (2,'VR','Sales',      'visiting_card','Reprint — 500 qty, new designation',           NULL,   'Promoted to Senior AE.',          'normal', 'pending',              DATEADD(HOUR,-9,  GETDATE())),
  (5,'VM','Design',     'stationery',   'Whiteboard markers, sticky notes bulk',        3400,   'Design sprint next week.',        'low',    'pending',              DATEADD(HOUR,-34, GETDATE())),
  (6,'VT','HR',         'travel',       'Flight — DEL → BLR, 24 Jul, return 26 Jul',   22500,  'Campus recruitment at IIM-B.',    'normal', 'pending',              DATEADD(HOUR,-40, GETDATE())),
  (1,'VT','Engineering','courier',      'Blue Dart — legal contracts to Mumbai HQ',    850,    'Physical signed originals.',      'normal', 'pending',              DATEADD(HOUR,-52, GETDATE())),
  (3,'VM','Marketing',  'travel',       'Taxi — Airport pickup, 21 Jul',               1800,   'Client visit — BLR airport.',     'normal', 'awaiting_verification',DATEADD(HOUR,-60, GETDATE())),
  (6,'VT','HR',         'fooding',      'Team lunch — 12 pax',                         4800,   'Q2 wrap-up lunch.',               'normal', 'awaiting_verification',DATEADD(HOUR,-78, GETDATE())),
  (3,'VM','Marketing',  'stationery',   'Printer cartridges — HP LaserJet',            4200,   '',                                'normal', 'approved',             DATEADD(DAY,-7,   GETDATE())),
  (1,'VT','Engineering','visiting_card','Reprint — 250 qty',                           NULL,   '',                                'low',    'approved',             DATEADD(DAY,-9,   GETDATE())),
  (6,'VT','HR',         'courier',      'DTDC — offer letters batch',                  1200,   '',                                'normal', 'approved',             DATEADD(DAY,-11,  GETDATE()));

-- Seed approvals for approved/awaiting requests
INSERT INTO approvals (request_id,actor_id,action,note,created_at) VALUES
  (6, 7, 'approved', 'Approved. Sent to Verifier.',          DATEADD(HOUR,-48, GETDATE())),
  (7, 7, 'approved', 'Approved. Bills to be verified.',      DATEADD(HOUR,-64, GETDATE())),
  (8, 7, 'approved', 'Under petty cash.',                    DATEADD(DAY,-6,   GETDATE())),
  (9, 7, 'approved', 'Standard reprint.',                    DATEADD(DAY,-8,   GETDATE())),
  (10,7, 'approved', 'Approved.',                            DATEADD(DAY,-10,  GETDATE()));

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

-- VERIFY
SELECT 'users' AS tbl, COUNT(*) AS rows FROM users        UNION ALL
SELECT 'requests',      COUNT(*)          FROM requests    UNION ALL
SELECT 'approvals',     COUNT(*)          FROM approvals   UNION ALL
SELECT 'inventory',     COUNT(*)          FROM inventory;
