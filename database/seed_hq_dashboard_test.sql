-- HQ filter seed: 2 users + 5 requests per status per active center.
-- Every generated login, including hqadmin@greencall.com, uses password: navneet

USE admin_db;
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF OBJECT_ID(N'dbo.centers', N'U') IS NULL
   OR OBJECT_ID(N'dbo.users', N'U') IS NULL
   OR OBJECT_ID(N'dbo.requests', N'U') IS NULL
   OR OBJECT_ID(N'dbo.request_assignments', N'U') IS NULL
   OR OBJECT_ID(N'dbo.payments', N'U') IS NULL
   OR COL_LENGTH(N'dbo.requests', N'workflow_status') IS NULL
  THROW 50001, 'Required schema is missing. Start the backend once so all migrations run, then execute this file.', 1;
DECLARE @PasswordHash NVARCHAR(256) =
  N'98752dd6cbf7d4b6e06fb2a266894d0c:aa863c8d104dc3156d882884f24d10c578ceb841ced987842a57b03af2acd50c2f95da8f5da33dffcc1b376349d6358146968042cbf9d878869d6359f0512092';
DECLARE @Marker NVARCHAR(40) = N'[HQ_FILTER_SEED_V1]';

BEGIN TRY
  BEGIN TRANSACTION;

  IF OBJECT_ID(N'dbo.hq_filter_seed_artifacts', N'U') IS NULL
    CREATE TABLE dbo.hq_filter_seed_artifacts (
      id BIGINT IDENTITY PRIMARY KEY, artifact_type NVARCHAR(30) NOT NULL,
      artifact_id BIGINT NOT NULL, created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );

  CREATE TABLE #SeedCenters (
    seq INT NOT NULL PRIMARY KEY, center_code NVARCHAR(10) NOT NULL UNIQUE,
    center_name NVARCHAR(100) NOT NULL, company NVARCHAR(100) NOT NULL
  );
  INSERT #SeedCenters(seq, center_code, center_name, company)
  SELECT CONVERT(INT, ROW_NUMBER() OVER (ORDER BY code)), code, name,
         COALESCE(NULLIF(company, N''), N'Vision India')
  FROM dbo.centers WHERE is_active = 1;
  IF NOT EXISTS (SELECT 1 FROM #SeedCenters)
    THROW 50002, 'No active centers found. Load/activate centers first.', 1;

  -- Remove only requests created by an earlier run of this seed.
  CREATE TABLE #OldRequests (id INT NOT NULL PRIMARY KEY);
  INSERT #OldRequests(id)
  SELECT id FROM dbo.requests WHERE LEFT(description,LEN(@Marker))=@Marker;
  DELETE a FROM dbo.approvals a JOIN #OldRequests x ON x.id = a.request_id;
  DELETE p FROM dbo.payments p JOIN #OldRequests x ON x.id = p.request_id;
  DELETE a FROM dbo.request_assignments a JOIN #OldRequests x ON x.id = a.request_id;
  DELETE r FROM dbo.requests r JOIN #OldRequests x ON x.id = r.id;

  CREATE TABLE #SeedUsers (
    email NVARCHAR(100) NOT NULL PRIMARY KEY, display_name NVARCHAR(100) NOT NULL,
    role NVARCHAR(20) NOT NULL, center_code NVARCHAR(10) NULL, company NVARCHAR(100) NOT NULL
  );
  INSERT #SeedUsers(email, display_name, role, center_code, company)
  SELECT CONCAT(N'admin', seq, N'@greencall.com'),
         CONCAT(N'Center Admin ', seq, N' - ', center_code), N'center_admin', center_code, company
  FROM #SeedCenters
  UNION ALL
  SELECT CONCAT(N'emp', seq, N'@greencall.com'),
         CONCAT(N'Test Employee ', seq, N' - ', center_code), N'employee', center_code, company
  FROM #SeedCenters
  UNION ALL
  SELECT N'hqadmin@greencall.com', N'HQ Dashboard Test Admin', N'hq_admin', NULL, N'Vision India';

  UPDATE u SET u.name=s.display_name, u.role=s.role, u.company=s.company,
    u.dept=N'HQ Filter Seed', u.center_code=s.center_code,
    u.password_hash=@PasswordHash, u.is_active=1
  FROM dbo.users u JOIN #SeedUsers s ON s.email=u.email;
  INSERT dbo.users(email,name,role,company,dept,center_code,password_hash,is_active)
  SELECT s.email,s.display_name,s.role,s.company,N'HQ Filter Seed',s.center_code,@PasswordHash,1
  FROM #SeedUsers s WHERE NOT EXISTS (SELECT 1 FROM dbo.users u WHERE u.email=s.email);
  UPDATE u SET is_active=0, center_code=NULL
  FROM dbo.users u
  WHERE u.dept=N'HQ Filter Seed' AND NOT EXISTS (SELECT 1 FROM #SeedUsers s WHERE s.email=u.email);

  DELETE uc FROM dbo.user_centers uc JOIN dbo.users u ON u.id=uc.user_id
  WHERE u.dept=N'HQ Filter Seed';
  INSERT dbo.user_centers(user_id,home_center_code,assigned_by)
  SELECT u.id,s.center_code,h.id
  FROM #SeedUsers s JOIN dbo.users u ON u.email=s.email
  CROSS JOIN (SELECT id FROM dbo.users WHERE email=N'hqadmin@greencall.com') h
  WHERE s.center_code IS NOT NULL;

  CREATE TABLE #Statuses (
    status_no INT PRIMARY KEY, request_status NVARCHAR(30),
    workflow_status NVARCHAR(30), payment_status NVARCHAR(30)
  );
  INSERT #Statuses VALUES
    (1,N'pending',N'awaiting_approval',N'pending_approval'),
    (2,N'queued',N'awaiting_approval',N'pending_approval'),
    (3,N'awaiting_verification',N'approved',N'awaiting_verification'),
    (4,N'approved',N'completed',N'paid'),
    (5,N'rejected',N'rejected',N'not_required'),
    (6,N'info_requested',N'awaiting_approval',N'pending_approval');

  INSERT dbo.requests(
    user_id,company,team,type,subject,description,amount,priority,status,details,
    created_at,updated_at,home_center_code,fulfil_center_code,request_center_code,
    approval_center_code,charge_center_code,inventory_center_code,
    workflow_status,payment_status,actual_amount,payment_due_at
  )
  SELECT emp.id,c.company,N'HQ Filter Seed',
    CHOOSE(((c.seq+s.status_no+n.sample_no-3)%7)+1,
      N'id_card',N'visiting_card',N'stationery',N'travel',N'courier',N'meeting_room',N'fooding'),
    CONCAT(N'HQ test ',s.request_status,N' #',n.sample_no,N' - ',c.center_code),
    CONCAT(@Marker,N' Center ',c.center_code,N'; status ',s.request_status,N'; sample ',n.sample_no),
    calc.estimated_amount,
    CHOOSE(((c.seq+s.status_no+n.sample_no-3)%4)+1,N'low',N'normal',N'high',N'urgent'),
    s.request_status,
    CONCAT(N'{"seed":true,"center":"',c.center_code,N'","sample":',n.sample_no,N'}'),
    dates.created_at,DATEADD(HOUR,s.status_no*3+n.sample_no,dates.created_at),
    c.center_code,c.center_code,c.center_code,c.center_code,c.center_code,c.center_code,
    s.workflow_status,s.payment_status,
    CASE WHEN s.request_status IN(N'approved',N'awaiting_verification')
         THEN calc.actual_amount END,
    CASE WHEN s.request_status=N'awaiting_verification' THEN DATEADD(DAY,2,SYSUTCDATETIME()) END
  FROM #SeedCenters c CROSS JOIN #Statuses s
  CROSS JOIN (VALUES(1),(2),(3),(4),(5)) n(sample_no)
  JOIN dbo.users emp ON emp.email=CONCAT(N'emp',c.seq,N'@greencall.com')
  CROSS APPLY (SELECT CONVERT(DECIMAL(12,2),
    500+((c.seq*137+s.status_no*791+n.sample_no*173)%99000)) AS estimated_amount) calc0
  CROSS APPLY (SELECT calc0.estimated_amount,
    CONVERT(DECIMAL(14,2),calc0.estimated_amount+((c.seq+n.sample_no)%900)) AS actual_amount) calc
  CROSS APPLY (SELECT CONVERT(DATETIME,DATEADD(DAY,
    -((c.seq*7+s.status_no*19+n.sample_no*11)%330),SYSUTCDATETIME())) AS created_at) dates;

  CREATE TABLE #NewRequests (
    id INT PRIMARY KEY, user_id INT, center_code NVARCHAR(10), request_status NVARCHAR(30),
    amount DECIMAL(14,2), actual_amount DECIMAL(14,2), created_at DATETIME
  );
  INSERT #NewRequests
  SELECT id,user_id,approval_center_code,status,amount,actual_amount,created_at
  FROM dbo.requests WHERE LEFT(description,LEN(@Marker))=@Marker;

  DECLARE @HqId INT=(SELECT id FROM dbo.users WHERE email=N'hqadmin@greencall.com');
  INSERT dbo.request_assignments(request_id,center_code,role,user_id,assignment_type,can_act,is_active,created_at)
  SELECT r.id,r.center_code,
    CASE WHEN r.request_status=N'queued' THEN N'super_admin'
         WHEN r.request_status IN(N'pending',N'info_requested') AND ((r.id%5)+1)>3 THEN N'hq_admin'
         ELSE N'center_admin' END,
    CASE WHEN r.request_status=N'queued' THEN NULL
         WHEN r.request_status IN(N'pending',N'info_requested') AND ((r.id%5)+1)>3 THEN @HqId
         ELSE ca.id END,
    N'owner',CASE WHEN r.request_status IN(N'pending',N'queued',N'info_requested') THEN 1 ELSE 0 END,
    1,r.created_at
  FROM #NewRequests r JOIN #SeedCenters c ON c.center_code=r.center_code
  JOIN dbo.users ca ON ca.email=CONCAT(N'admin',c.seq,N'@greencall.com');

  INSERT dbo.payments(request_id,estimated_amount,actual_amount,vendor_name,invoice_number,
    payment_method,transaction_ref,status,notes,due_at,updated_by,verified_by,paid_at,verified_at,created_at,updated_at)
  SELECT r.id,r.amount,r.actual_amount,CONCAT(N'Test Vendor - ',r.center_code),
    CONCAT(N'SEED-',r.id),N'bank_transfer',CONCAT(N'TXN-SEED-',r.id),
    CASE WHEN r.request_status=N'approved' THEN N'paid' ELSE N'awaiting_verification' END,
    @Marker,CASE WHEN r.request_status=N'awaiting_verification' THEN DATEADD(DAY,2,SYSUTCDATETIME()) END,
    ca.id,CASE WHEN r.request_status=N'approved' THEN @HqId END,
    CASE WHEN r.request_status=N'approved' THEN r.created_at END,
    CASE WHEN r.request_status=N'approved' THEN DATEADD(HOUR,8,r.created_at) END,r.created_at,SYSUTCDATETIME()
  FROM #NewRequests r JOIN #SeedCenters c ON c.center_code=r.center_code
  JOIN dbo.users ca ON ca.email=CONCAT(N'admin',c.seq,N'@greencall.com')
  WHERE r.request_status IN(N'approved',N'awaiting_verification');

  INSERT dbo.approvals(request_id,actor_id,action,note,created_at)
  SELECT r.id,r.user_id,N'raised',@Marker,r.created_at FROM #NewRequests r;
  INSERT dbo.approvals(request_id,actor_id,action,note,created_at)
  SELECT r.id,ca.id,
    CASE r.request_status WHEN N'queued' THEN N'queued'
      WHEN N'awaiting_verification' THEN N'payment_updated'
      WHEN N'approved' THEN N'approved' WHEN N'rejected' THEN N'rejected'
      WHEN N'info_requested' THEN N'info_requested' END,
    @Marker,DATEADD(HOUR,4,r.created_at)
  FROM #NewRequests r JOIN #SeedCenters c ON c.center_code=r.center_code
  JOIN dbo.users ca ON ca.email=CONCAT(N'admin',c.seq,N'@greencall.com')
  WHERE r.request_status<>N'pending';

  INSERT dbo.center_budgets(center_code,month,year,allocated,committed,spent)
  OUTPUT N'center_budget',inserted.id
    INTO dbo.hq_filter_seed_artifacts(artifact_type,artifact_id)
  SELECT c.center_code,MONTH(GETDATE()),YEAR(GETDATE()),
    1500000+(c.seq*5000),0,COALESCE(SUM(CASE WHEN r.request_status=N'approved' THEN r.actual_amount ELSE 0 END),0)
  FROM #SeedCenters c LEFT JOIN #NewRequests r ON r.center_code=c.center_code
  WHERE NOT EXISTS (SELECT 1 FROM dbo.center_budgets b WHERE b.center_code=c.center_code
    AND b.month=MONTH(GETDATE()) AND b.year=YEAR(GETDATE()))
  GROUP BY c.center_code,c.seq;

  COMMIT TRANSACTION;

  SELECT COUNT(*) active_centers, COUNT(*)*2 center_users, COUNT(*)*30 seeded_requests
  FROM dbo.centers WHERE is_active=1;
  SELECT c.center_code,c.center_name,
    CONCAT(N'admin',c.seq,N'@greencall.com') admin_login,
    CONCAT(N'emp',c.seq,N'@greencall.com') employee_login,N'navneet' password
  FROM #SeedCenters c ORDER BY c.seq;
  SELECT r.approval_center_code center_code,r.status,COUNT(*) request_count
  FROM dbo.requests r WHERE LEFT(r.description,LEN(@Marker))=@Marker
  GROUP BY r.approval_center_code,r.status ORDER BY r.approval_center_code,r.status;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
GO
