/* Ready to run in SSMS / Azure Data Studio against admin_db. Safe to rerun. */
USE [admin_db];
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
GO

IF COL_LENGTH('dbo.inventory','is_active') IS NULL
  ALTER TABLE dbo.inventory ADD is_active BIT NOT NULL CONSTRAINT DF_inventory_active DEFAULT(1);
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID('dbo.inventory') AND name='CK_inventory_category_catalog')
BEGIN
  DECLARE @constraint sysname;
  WHILE EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id=OBJECT_ID('dbo.inventory')
      AND (parent_column_id=COLUMNPROPERTY(OBJECT_ID('dbo.inventory'),'category','ColumnId') OR definition LIKE '%category%'))
  BEGIN
    SELECT TOP (1) @constraint=name FROM sys.check_constraints
    WHERE parent_object_id=OBJECT_ID('dbo.inventory')
      AND (parent_column_id=COLUMNPROPERTY(OBJECT_ID('dbo.inventory'),'category','ColumnId') OR definition LIKE '%category%');
    EXEC(N'ALTER TABLE dbo.inventory DROP CONSTRAINT ['+@constraint+N']');
  END;
  IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('dbo.inventory') AND name='category' AND max_length<100)
    ALTER TABLE dbo.inventory ALTER COLUMN category NVARCHAR(50) NOT NULL;
  ALTER TABLE dbo.inventory ADD CONSTRAINT CK_inventory_category_catalog CHECK(category IN
    (N'Writing Pad',N'Diary',N'Notes',N'Pen',N'Premium Pen',N'Marker',N'Writing',N'Writing Accessories',
     N'Measuring',N'Stapling',N'Filing',N'Adhesive',N'Packing',N'Cutting',N'Desk Organizer',N'Labels',N'Paper',
     N'Mailing',N'Register',N'Office Equipment',N'Desk Accessories',N'Pinning',N'Correction',N'Stamping',
     N'Battery',N'Whiteboard',N'Art Material',N'Presentation',N'if Not in above',N'Printing',N'Desk',N'Misc',N'Other'));
END;
GO

DECLARE @catalog TABLE(sku NVARCHAR(30),name NVARCHAR(200),category NVARCHAR(50));
INSERT INTO @catalog(sku,name,category) VALUES
(N'STY-001',N'Spiral Note Pad',N'Writing Pad'),
(N'STY-002',N'Small Diary',N'Diary'),
(N'STY-003',N'Big Diary',N'Diary'),
(N'STY-004',N'Sticky Notes',N'Notes'),
(N'STY-005',N'Montex Pen (Blue/Black/Red)',N'Pen'),
(N'STY-006',N'Natraj Blue Pen',N'Pen'),
(N'STY-007',N'Uni Ball Eye Fine Pen',N'Premium Pen'),
(N'STY-008',N'Highlighter',N'Marker'),
(N'STY-009',N'Red Marker (Big)',N'Marker'),
(N'STY-010',N'Blue Marker',N'Marker'),
(N'STY-011',N'Black Marker (Big)',N'Marker'),
(N'STY-012',N'Whiteboard Marker',N'Marker'),
(N'STY-013',N'Permanent Marker',N'Marker'),
(N'STY-014',N'Pencil (HB)',N'Writing'),
(N'STY-015',N'Mechanical Pencil',N'Writing'),
(N'STY-016',N'Sharpener',N'Writing Accessories'),
(N'STY-017',N'Eraser (Rubber)',N'Writing Accessories'),
(N'STY-018',N'Scale (12"/30 cm)',N'Measuring'),
(N'STY-019',N'Stapler (Small)',N'Stapling'),
(N'STY-020',N'Stapler (Big)',N'Stapling'),
(N'STY-021',N'Stapler Pins (Small No.10)',N'Stapling'),
(N'STY-022',N'Stapler Pins (Big 24/6 or 23/10)',N'Stapling'),
(N'STY-023',N'Staple Remover',N'Stapling'),
(N'STY-024',N'Binder Clips (Large)',N'Filing'),
(N'STY-025',N'Binder Clips (Medium)',N'Filing'),
(N'STY-026',N'Binder Clips (Small)',N'Filing'),
(N'STY-027',N'Paper Clips',N'Filing'),
(N'STY-028',N'Big Clips',N'Filing'),
(N'STY-029',N'Fevistik Glue Stick',N'Adhesive'),
(N'STY-030',N'Glue Bottle',N'Adhesive'),
(N'STY-031',N'Transparent Tape',N'Adhesive'),
(N'STY-032',N'Masking Tape',N'Adhesive'),
(N'STY-033',N'Brown Packing Tape',N'Packing'),
(N'STY-034',N'Tape Dispenser',N'Adhesive'),
(N'STY-035',N'Scissors',N'Cutting'),
(N'STY-036',N'Cutter/Utility Knife',N'Cutting'),
(N'STY-037',N'Cutter Blades',N'Cutting'),
(N'STY-038',N'Button Folder',N'Filing'),
(N'STY-039',N'L Folder',N'Filing'),
(N'STY-040',N'Z-Index File',N'Filing'),
(N'STY-041',N'Lever Arch File',N'Filing'),
(N'STY-042',N'Box File',N'Filing'),
(N'STY-043',N'Display Book/File',N'Filing'),
(N'STY-044',N'Expanding File',N'Filing'),
(N'STY-045',N'Document Tray',N'Desk Organizer'),
(N'STY-046',N'File Divider',N'Filing'),
(N'STY-047',N'Name Labels',N'Labels'),
(N'STY-048',N'Address Labels',N'Labels'),
(N'STY-049',N'A4 Copier Paper (Rim)',N'Paper'),
(N'STY-050',N'A3 Copier Paper',N'Paper'),
(N'STY-051',N'Legal Size Paper',N'Paper'),
(N'STY-052',N'Yellow Envelope (A4)',N'Mailing'),
(N'STY-053',N'Brown Envelope (A4)',N'Mailing'),
(N'STY-054',N'Brown Envelope (Legal)',N'Mailing'),
(N'STY-055',N'Courier Envelope',N'Mailing'),
(N'STY-056',N'Bubble Envelope',N'Mailing'),
(N'STY-057',N'Carbon Paper',N'Paper'),
(N'STY-058',N'Sticky Flags/Page Markers',N'Notes'),
(N'STY-059',N'Index Tabs',N'Filing'),
(N'STY-060',N'Visitor Register',N'Register'),
(N'STY-061',N'Dispatch Register',N'Register'),
(N'STY-062',N'Attendance Register',N'Register'),
(N'STY-063',N'Spiral Register',N'Register'),
(N'STY-064',N'Calculator',N'Office Equipment'),
(N'STY-065',N'Desk Calendar',N'Desk Accessories'),
(N'STY-066',N'Pen Stand',N'Desk Accessories'),
(N'STY-067',N'Paper Weight',N'Desk Accessories'),
(N'STY-068',N'Visiting Card Holder',N'Desk Accessories'),
(N'STY-069',N'Push Pins/Drawing Pins',N'Pinning'),
(N'STY-070',N'Notice Board Pins',N'Pinning'),
(N'STY-071',N'Punch Machine (2-Hole)',N'Filing'),
(N'STY-072',N'Heavy Duty Punch Machine',N'Filing'),
(N'STY-073',N'Correction Pen',N'Correction'),
(N'STY-074',N'Correction Tape',N'Correction'),
(N'STY-075',N'Ink Pad',N'Stamping'),
(N'STY-076',N'Stamp Pad Ink',N'Stamping'),
(N'STY-077',N'Self-Inking Stamp',N'Stamping'),
(N'STY-078',N'Seal Wax (if required)',N'Stamping'),
(N'STY-079',N'Duracell AA Battery',N'Battery'),
(N'STY-080',N'Duracell AAA Battery',N'Battery'),
(N'STY-081',N'Duracell C Cell Battery',N'Battery'),
(N'STY-082',N'Duracell D Cell Battery (Big Cell)',N'Battery'),
(N'STY-083',N'Whiteboard Duster',N'Whiteboard'),
(N'STY-084',N'Whiteboard Cleaner',N'Whiteboard'),
(N'STY-085',N'Mom Colour',N'Art Material'),
(N'STY-086',N'Poster Colour',N'Art Material'),
(N'STY-087',N'Water Colour',N'Art Material'),
(N'STY-088',N'Paint Brush Set',N'Art Material'),
(N'STY-089',N'Chart Paper',N'Presentation'),
(N'STY-090',N'Flip Chart Pad',N'Presentation'),
(N'STY-091',N'Others',N'if Not in above');

INSERT INTO dbo.inventory(sku,name,category,unit,price,qty,threshold)
SELECT c.sku,c.name,c.category,N'piece',0,0,10 FROM @catalog c
WHERE NOT EXISTS (SELECT 1 FROM dbo.inventory i WHERE i.sku=c.sku OR LOWER(LTRIM(RTRIM(i.name)))=LOWER(c.name));

UPDATE dbo.inventory SET category=N'if Not in above',updated_at=GETDATE()
WHERE sku=N'STY-091' AND name=N'Others' AND category<>N'if Not in above';

IF OBJECT_ID('dbo.center_inventory','U') IS NOT NULL
  INSERT INTO dbo.center_inventory(center_code,sku,qty,reserved_qty)
  SELECT c.code,i.sku,0,0 FROM dbo.centers c CROSS JOIN dbo.inventory i
  WHERE c.is_active=1 AND i.is_active=1
    AND NOT EXISTS (SELECT 1 FROM dbo.center_inventory ci WHERE ci.center_code=c.code AND ci.sku=i.sku);

SELECT COUNT(*) AS CatalogItemsPresent
FROM @catalog c WHERE EXISTS (SELECT 1 FROM dbo.inventory i WHERE i.is_active=1 AND (i.sku=c.sku OR LOWER(LTRIM(RTRIM(i.name)))=LOWER(c.name)));
SELECT COALESCE(i.sku,c.sku) sku,c.name,c.category,i.unit,i.price,i.qty,i.threshold
FROM @catalog c OUTER APPLY (SELECT TOP (1) x.* FROM dbo.inventory x WHERE x.sku=c.sku OR LOWER(LTRIM(RTRIM(x.name)))=LOWER(c.name) ORDER BY CASE WHEN x.sku=c.sku THEN 0 ELSE 1 END) i
ORDER BY c.sku;
GO
