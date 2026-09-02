import mssql from "mssql";

const statements = [
  `IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID('approvals')
      AND name='CK_approvals_action_current' AND definition LIKE '%assigned%'
      AND definition LIKE '%receipt_confirmed%' AND definition LIKE '%receipt_disputed%'
      AND definition LIKE '%issue_resolved%') BEGIN
    DECLARE @actionConstraint sysname;
    SELECT TOP 1 @actionConstraint=cc.name FROM sys.check_constraints cc
      WHERE cc.parent_object_id=OBJECT_ID('approvals')
        AND (cc.name='CK_approvals_action_current' OR cc.definition LIKE '%action%')
      ORDER BY CASE WHEN cc.name='CK_approvals_action_current' THEN 0 ELSE 1 END;
    IF @actionConstraint IS NOT NULL EXEC('ALTER TABLE approvals DROP CONSTRAINT ['+@actionConstraint+']');
    ALTER TABLE approvals ADD CONSTRAINT CK_approvals_action_current CHECK(action IN
      ('raised','withdrawn','approved','rejected','queued','info_requested','verified','sent_back',
       'commented','payment_updated','payment_verified','assigned','receipt_confirmed','receipt_disputed',
       'issue_resolved'));
  END`,
  `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('requests') AND name='fulfillment_status')
    ALTER TABLE requests ADD fulfillment_status NVARCHAR(30) NOT NULL
      CONSTRAINT DF_requests_fulfillment DEFAULT 'not_required',
      fulfilled_by INT NULL REFERENCES users(id),fulfilled_at DATETIME2 NULL`,
  `IF NOT EXISTS (SELECT 1 FROM sys.check_constraints
      WHERE parent_object_id=OBJECT_ID('requests') AND name='CK_requests_fulfillment')
    ALTER TABLE requests ADD CONSTRAINT CK_requests_fulfillment CHECK
      (fulfillment_status IN('not_required','ready_to_assign','assigned'))`,
  `IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('requests') AND name='receipt_status')
    ALTER TABLE requests ADD receipt_status NVARCHAR(30) NOT NULL
      CONSTRAINT DF_requests_receipt DEFAULT 'not_required',
      receipt_feedback NVARCHAR(30) NULL,receipt_note NVARCHAR(1000) NULL,
      receipt_confirmed_at DATETIME2 NULL`,
  `IF NOT EXISTS (SELECT 1 FROM sys.check_constraints
      WHERE parent_object_id=OBJECT_ID('requests') AND name='CK_requests_receipt')
    ALTER TABLE requests ADD CONSTRAINT CK_requests_receipt CHECK
      (receipt_status IN('not_required','awaiting_confirmation','received','disputed')
       AND (receipt_feedback IS NULL OR receipt_feedback IN('very_easy','easy','needs_improvement')))`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('requests')
      AND name='IX_requests_fulfillment_queue')
    CREATE INDEX IX_requests_fulfillment_queue ON requests(fulfillment_status,approval_center_code,updated_at DESC)
      INCLUDE(ref_id,user_id,type,subject,inventory_center_code,fulfilled_by,fulfilled_at)`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('requests')
      AND name='IX_requests_receipt_queue')
    CREATE INDEX IX_requests_receipt_queue ON requests(receipt_status,user_id,updated_at DESC)
      INCLUDE(ref_id,type,subject,approval_center_code,fulfilled_at,receipt_confirmed_at)`,
  `UPDATE requests SET receipt_status='awaiting_confirmation'
    WHERE fulfillment_status='assigned' AND receipt_status='not_required'`,
];

export async function ensureFulfillmentSchema(pool: mssql.ConnectionPool) {
  for (const sql of statements) await pool.request().query(sql);
}
