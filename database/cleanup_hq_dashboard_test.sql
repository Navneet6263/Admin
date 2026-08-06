-- Removes only HQ_FILTER_SEED_V1 test data and users.
-- Safe to re-run. Any error rolls the complete cleanup back.
USE admin_db;
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID(N'dbo.users',N'U') IS NULL OR OBJECT_ID(N'dbo.requests',N'U') IS NULL
  THROW 50101, 'admin_db schema is missing.', 1;

BEGIN TRY
  BEGIN TRANSACTION;

  CREATE TABLE #SeedUsers(id INT NOT NULL PRIMARY KEY);
  INSERT #SeedUsers(id)
  SELECT id FROM dbo.users WHERE dept=N'HQ Filter Seed';

  CREATE TABLE #SeedRequests(id INT NOT NULL PRIMARY KEY,ref_id NVARCHAR(20));
  INSERT #SeedRequests(id,ref_id)
  SELECT r.id,r.ref_id FROM dbo.requests r
  WHERE LEFT(r.description,LEN(N'[HQ_FILTER_SEED_V1]'))=N'[HQ_FILTER_SEED_V1]'
     OR EXISTS(SELECT 1 FROM #SeedUsers u WHERE u.id=r.user_id);

  DECLARE @UserCount INT=(SELECT COUNT(*) FROM #SeedUsers);
  DECLARE @RequestCount INT=(SELECT COUNT(*) FROM #SeedRequests);
  DECLARE @BudgetCount INT=0;

  -- Request-owned rows.
  DELETE a FROM dbo.approvals a JOIN #SeedRequests r ON r.id=a.request_id;
  DELETE p FROM dbo.payments p JOIN #SeedRequests r ON r.id=p.request_id;
  DELETE a FROM dbo.request_assignments a JOIN #SeedRequests r ON r.id=a.request_id;
  DELETE n FROM dbo.notifications n
  WHERE EXISTS(SELECT 1 FROM #SeedRequests r WHERE n.message LIKE N'%'+r.ref_id+N'%');
  DELETE m FROM dbo.stock_movements m
  WHERE m.source=N'request' AND EXISTS(SELECT 1 FROM #SeedRequests r WHERE r.ref_id=m.ref_id);
  DELETE r FROM dbo.requests r JOIN #SeedRequests s ON s.id=r.id;

  -- References created if test logins were used through the UI.
  DELETE a FROM dbo.approvals a WHERE EXISTS(SELECT 1 FROM #SeedUsers u WHERE u.id=a.actor_id);
  DELETE a FROM dbo.request_assignments a
  WHERE EXISTS(SELECT 1 FROM #SeedUsers u WHERE u.id=a.user_id);
  UPDATE p SET updated_by=NULL FROM dbo.payments p
  WHERE EXISTS(SELECT 1 FROM #SeedUsers u WHERE u.id=p.updated_by);
  UPDATE p SET verified_by=NULL FROM dbo.payments p
  WHERE EXISTS(SELECT 1 FROM #SeedUsers u WHERE u.id=p.verified_by);
  DELETE p FROM dbo.approval_policies p
  WHERE EXISTS(SELECT 1 FROM #SeedUsers u WHERE u.id=p.user_id OR u.id=p.created_by);
  UPDATE c SET hq_admin_id=NULL FROM dbo.centers c
  WHERE EXISTS(SELECT 1 FROM #SeedUsers u WHERE u.id=c.hq_admin_id);
  UPDATE uc SET assigned_by=NULL FROM dbo.user_centers uc
  WHERE EXISTS(SELECT 1 FROM #SeedUsers u WHERE u.id=uc.assigned_by)
    AND NOT EXISTS(SELECT 1 FROM #SeedUsers u WHERE u.id=uc.user_id);
  DELETE uc FROM dbo.user_centers uc
  WHERE EXISTS(SELECT 1 FROM #SeedUsers u WHERE u.id=uc.user_id);
  DELETE n FROM dbo.notifications n
  WHERE EXISTS(SELECT 1 FROM #SeedUsers u WHERE u.id=n.user_id);

  -- Only budgets inserted by the seed are tracked and removed.
  IF OBJECT_ID(N'dbo.hq_filter_seed_artifacts',N'U') IS NOT NULL
  BEGIN
    SELECT @BudgetCount=COUNT(*) FROM dbo.hq_filter_seed_artifacts
      WHERE artifact_type=N'center_budget';
    DELETE b FROM dbo.center_budgets b JOIN dbo.hq_filter_seed_artifacts a
      ON a.artifact_type=N'center_budget' AND a.artifact_id=b.id;
    DROP TABLE dbo.hq_filter_seed_artifacts;
  END;

  DELETE u FROM dbo.users u JOIN #SeedUsers s ON s.id=u.id;
  COMMIT TRANSACTION;

  SELECT @UserCount deleted_test_users,@RequestCount deleted_test_requests,
         @BudgetCount deleted_test_budgets,N'HQ test seed removed successfully' result;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
GO
