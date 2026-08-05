USE admin_db;
GO
-- The backend applies the idempotent workflow migration on startup.
-- Run the backend once, then verify the normalized workflow objects.
SELECT name FROM sys.tables WHERE name IN (
  'approval_policies','request_assignments','payments','center_inventory'
);
GO
