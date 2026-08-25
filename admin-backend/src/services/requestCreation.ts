import mssql from "mssql";
import { pool, withDbRetry } from "../db";

export type NewEmployeeRequest = {
  userId: number;
  type: string;
  subject: string;
  description: string;
  amount: number | null;
  priority: string;
  details: unknown;
  requestCenter?: string;
  clientRequestId?: string;
};

export type CreatedRequest = Record<string, unknown> & {
  id: number;
  ref_id: string;
  deduplicated: boolean;
  homeCenter: string;
  requestCenter: string;
};

export async function createEmployeeRequest(input: NewEmployeeRequest): Promise<CreatedRequest> {
  return withDbRetry(async () => {
  const result = await pool.request()
    .input("uid", mssql.Int, input.userId)
    .input("type", mssql.NVarChar(30), input.type)
    .input("subject", mssql.NVarChar(160), input.subject.trim())
    .input("description", mssql.NVarChar(mssql.MAX), input.description.trim())
    .input("amount", mssql.Decimal(14, 2), input.amount)
    .input("priority", mssql.NVarChar(20), input.priority)
    .input("details", mssql.NVarChar(mssql.MAX), input.details ? JSON.stringify(input.details) : null)
    .input("requested", mssql.NVarChar(10), input.requestCenter?.trim().toUpperCase() || null)
    .input("clientKey", mssql.NVarChar(64), input.clientRequestId || null)
    .query(`SET XACT_ABORT ON;
      BEGIN TRY
        BEGIN TRANSACTION;
        DECLARE @existing INT;
        IF @clientKey IS NOT NULL
          SELECT @existing=id FROM requests WITH (UPDLOCK,HOLDLOCK)
          WHERE user_id=@uid AND client_request_id=@clientKey;
        IF @existing IS NOT NULL BEGIN
          SELECT r.*,CAST(1 AS bit) deduplicated,r.home_center_code homeCenter,
            r.request_center_code requestCenter FROM requests r WHERE r.id=@existing;
          COMMIT TRANSACTION;
          RETURN;
        END;

        DECLARE @company NVARCHAR(100),@team NVARCHAR(100),@home NVARCHAR(10),@center NVARCHAR(10);
        SELECT @company=company,@team=dept,@home=center_code FROM users WITH (UPDLOCK) WHERE id=@uid AND is_active=1;
        IF @company IS NULL THROW 51001,'User not found or inactive',1;
        IF @home IS NULL THROW 51002,'Employee has no home center assigned',1;
        SET @center=UPPER(COALESCE(@requested,@home));
        IF NOT EXISTS(SELECT 1 FROM centers WHERE code=@center AND is_active=1)
          THROW 51003,'Invalid request center',1;

        IF @type='stationery' BEGIN
          IF ISJSON(@details)<>1 THROW 51004,'Stationery items are required',1;
          SELECT @amount=SUM(CONVERT(DECIMAL(14,2),j.qty)*i.price)
          FROM OPENJSON(@details,'$.items') WITH(sku NVARCHAR(30) '$.sku',qty INT '$.qty') j
          JOIN inventory i ON i.sku=j.sku WHERE j.qty BETWEEN 1 AND 99;
          IF @amount IS NULL THROW 51004,'Valid stationery items are required',1;
        END;
        IF @type='fooding' BEGIN
          DECLARE @foodDate DATE=TRY_CONVERT(DATE,JSON_VALUE(@details,'$.date')),
            @foodTime TIME=TRY_CONVERT(TIME,JSON_VALUE(@details,'$.time')),
            @indiaNow DATETIME2=CONVERT(DATETIME2,SYSUTCDATETIME() AT TIME ZONE 'UTC' AT TIME ZONE 'India Standard Time');
          IF @foodDate IS NULL OR @foodTime IS NULL OR @foodDate<CONVERT(DATE,@indiaNow)
            THROW 51005,'Select a valid food booking date and time',1;
          IF @foodTime<'10:00' OR @foodTime>'20:00'
            THROW 51005,'Food service time must be between 10:00 AM and 8:00 PM',1;
          IF @foodDate=CONVERT(DATE,@indiaNow) AND (CONVERT(TIME,@indiaNow)<'10:00' OR CONVERT(TIME,@indiaNow)>='20:00')
            THROW 51005,'Today food booking is available from 10:00 AM to 8:00 PM',1;
        END;
        IF @type='id_card' AND (ISJSON(@details)<>1 OR JSON_VALUE(@details,'$.brand')<>'vision_india'
          OR NULLIF(JSON_VALUE(@details,'$.employeeCode'),'') IS NULL OR NOT EXISTS(
            SELECT 1 FROM OPENJSON(@details) WITH(photoDataUrl NVARCHAR(MAX) '$.photoDataUrl') WHERE NULLIF(photoDataUrl,'') IS NOT NULL))
          THROW 51006,'Complete the Vision India ID-card preview before submitting',1;
        IF @type='id_card' BEGIN
          DECLARE @phone NVARCHAR(30)=JSON_VALUE(@details,'$.phone'),
            @emergencyPhone NVARCHAR(30)=JSON_VALUE(@details,'$.emergencyPhone');
          IF LEN(ISNULL(@phone,''))<>10 OR @phone LIKE '%[^0-9]%' OR LEFT(@phone,1) NOT IN('6','7','8','9')
            THROW 51007,'Enter a valid 10-digit Indian contact number',1;
          IF LEN(ISNULL(@emergencyPhone,''))<>10 OR @emergencyPhone LIKE '%[^0-9]%' OR LEFT(@emergencyPhone,1) NOT IN('6','7','8','9')
            THROW 51008,'Enter a valid 10-digit Indian emergency number',1;
        END;
        DECLARE @payment NVARCHAR(30)=CASE WHEN @type IN
          ('stationery','travel','courier','fooding','meeting_room','visiting_card','id_card')
          THEN 'pending_approval' ELSE 'not_required' END;
        INSERT INTO requests(user_id,company,team,type,subject,description,amount,priority,details,
          home_center_code,fulfil_center_code,request_center_code,approval_center_code,charge_center_code,
          inventory_center_code,workflow_status,payment_status,client_request_id)
        VALUES(@uid,@company,@team,@type,@subject,@description,@amount,@priority,@details,
          @home,@home,@center,@center,@home,@home,'awaiting_approval',@payment,@clientKey);
        DECLARE @id INT=CONVERT(INT,SCOPE_IDENTITY());
        INSERT INTO request_assignments(request_id,center_code,role,assignment_type,can_act) VALUES
          (@id,@center,'center_admin','owner',1),
          (@id,NULL,'hq_admin','owner',1),
          (@id,NULL,'super_admin','owner',1);
        IF @home<>@center INSERT INTO request_assignments(request_id,center_code,role,assignment_type,can_act)
          VALUES(@id,@home,'center_admin','watcher',0);
        INSERT INTO approvals(request_id,actor_id,action,note)
          VALUES(@id,@uid,'raised','Request raised by employee');
        SELECT r.*,CAST(0 AS bit) deduplicated,@home homeCenter,@center requestCenter
          FROM requests r WHERE r.id=@id;
        COMMIT TRANSACTION;
      END TRY
      BEGIN CATCH
        IF @@TRANCOUNT>0 ROLLBACK TRANSACTION;
        THROW;
      END CATCH`);
  const row = result.recordset[0];
  if (!row) throw new Error("Request creation returned no result");
  return { ...row, deduplicated: Boolean(row.deduplicated) } as CreatedRequest;
  }, 2);
}
