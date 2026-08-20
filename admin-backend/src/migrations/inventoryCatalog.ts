import mssql from "mssql";

const stationery: Array<[string, string]> = [
  ["Spiral Note Pad", "Writing Pad"], ["Small Diary", "Diary"], ["Big Diary", "Diary"],
  ["Sticky Notes", "Notes"], ["Montex Pen (Blue/Black/Red)", "Pen"], ["Natraj Blue Pen", "Pen"],
  ["Uni Ball Eye Fine Pen", "Premium Pen"], ["Highlighter", "Marker"], ["Red Marker (Big)", "Marker"],
  ["Blue Marker", "Marker"], ["Black Marker (Big)", "Marker"], ["Whiteboard Marker", "Marker"],
  ["Permanent Marker", "Marker"], ["Pencil (HB)", "Writing"], ["Mechanical Pencil", "Writing"],
  ["Sharpener", "Writing Accessories"], ["Eraser (Rubber)", "Writing Accessories"], ["Scale (12\"/30 cm)", "Measuring"],
  ["Stapler (Small)", "Stapling"], ["Stapler (Big)", "Stapling"], ["Stapler Pins (Small No.10)", "Stapling"],
  ["Stapler Pins (Big 24/6 or 23/10)", "Stapling"], ["Staple Remover", "Stapling"], ["Binder Clips (Large)", "Filing"],
  ["Binder Clips (Medium)", "Filing"], ["Binder Clips (Small)", "Filing"], ["Paper Clips", "Filing"],
  ["Big Clips", "Filing"], ["Fevistik Glue Stick", "Adhesive"], ["Glue Bottle", "Adhesive"],
  ["Transparent Tape", "Adhesive"], ["Masking Tape", "Adhesive"], ["Brown Packing Tape", "Packing"],
  ["Tape Dispenser", "Adhesive"], ["Scissors", "Cutting"], ["Cutter/Utility Knife", "Cutting"],
  ["Cutter Blades", "Cutting"], ["Button Folder", "Filing"], ["L Folder", "Filing"],
  ["Z-Index File", "Filing"], ["Lever Arch File", "Filing"], ["Box File", "Filing"],
  ["Display Book/File", "Filing"], ["Expanding File", "Filing"], ["Document Tray", "Desk Organizer"],
  ["File Divider", "Filing"], ["Name Labels", "Labels"], ["Address Labels", "Labels"],
  ["A4 Copier Paper (Rim)", "Paper"], ["A3 Copier Paper", "Paper"], ["Legal Size Paper", "Paper"],
  ["Yellow Envelope (A4)", "Mailing"], ["Brown Envelope (A4)", "Mailing"], ["Brown Envelope (Legal)", "Mailing"],
  ["Courier Envelope", "Mailing"], ["Bubble Envelope", "Mailing"], ["Carbon Paper", "Paper"],
  ["Sticky Flags/Page Markers", "Notes"], ["Index Tabs", "Filing"], ["Visitor Register", "Register"],
  ["Dispatch Register", "Register"], ["Attendance Register", "Register"], ["Spiral Register", "Register"],
  ["Calculator", "Office Equipment"], ["Desk Calendar", "Desk Accessories"], ["Pen Stand", "Desk Accessories"],
  ["Paper Weight", "Desk Accessories"], ["Visiting Card Holder", "Desk Accessories"], ["Push Pins/Drawing Pins", "Pinning"],
  ["Notice Board Pins", "Pinning"], ["Punch Machine (2-Hole)", "Filing"], ["Heavy Duty Punch Machine", "Filing"],
  ["Correction Pen", "Correction"], ["Correction Tape", "Correction"], ["Ink Pad", "Stamping"],
  ["Stamp Pad Ink", "Stamping"], ["Self-Inking Stamp", "Stamping"], ["Seal Wax (if required)", "Stamping"],
  ["Duracell AA Battery", "Battery"], ["Duracell AAA Battery", "Battery"], ["Duracell C Cell Battery", "Battery"],
  ["Duracell D Cell Battery (Big Cell)", "Battery"], ["Whiteboard Duster", "Whiteboard"], ["Whiteboard Cleaner", "Whiteboard"],
  ["Mom Colour", "Art Material"], ["Poster Colour", "Art Material"], ["Water Colour", "Art Material"],
  ["Paint Brush Set", "Art Material"], ["Chart Paper", "Presentation"], ["Flip Chart Pad", "Presentation"],
  ["Others", "if Not in above"],
];

const quote = (value: string) => `N'${value.replace(/'/g, "''")}'`;
const rows = stationery.map(([name, category], index) =>
  `('STY-${String(index + 1).padStart(3, "0")}',${quote(name)},${quote(category)})`).join(",\n");
export const INVENTORY_CATEGORIES = [...new Set([...stationery.map(([, category]) => category), 'Printing', 'Desk', 'Misc', 'Other'])];
const allowedCategories = INVENTORY_CATEGORIES.map(quote).join(',');

export async function ensureInventoryCatalog(pool: mssql.ConnectionPool) {
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('inventory') AND name='is_active')
      ALTER TABLE inventory ADD is_active BIT NOT NULL CONSTRAINT DF_inventory_active DEFAULT 1;
  `);
  await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID('inventory') AND name='CK_inventory_category_catalog')
    BEGIN
      DECLARE @constraint sysname;
      WHILE EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID('inventory') AND (parent_column_id=COLUMNPROPERTY(OBJECT_ID('inventory'),'category','ColumnId') OR definition LIKE '%category%'))
      BEGIN
        SELECT TOP 1 @constraint=name FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID('inventory') AND (parent_column_id=COLUMNPROPERTY(OBJECT_ID('inventory'),'category','ColumnId') OR definition LIKE '%category%');
        EXEC(N'ALTER TABLE inventory DROP CONSTRAINT ['+@constraint+N']');
      END;
      IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id=OBJECT_ID('inventory') AND name='category' AND max_length<100)
        ALTER TABLE inventory ALTER COLUMN category NVARCHAR(50) NOT NULL;
      ALTER TABLE inventory ADD CONSTRAINT CK_inventory_category_catalog CHECK(category IN (${allowedCategories}));
    END;
  `);
  await pool.request().query(`
    INSERT INTO inventory(sku,name,category,unit,price,qty,threshold)
    SELECT v.sku,v.name,v.category,N'piece',0,0,10
    FROM (VALUES ${rows}) v(sku,name,category)
    WHERE NOT EXISTS (SELECT 1 FROM inventory i WHERE i.sku=v.sku OR LOWER(LTRIM(RTRIM(i.name)))=LOWER(v.name));
  `);
  await pool.request().query(`
    UPDATE inventory SET category=N'if Not in above',updated_at=GETDATE()
    WHERE sku=N'STY-091' AND name=N'Others' AND category<>N'if Not in above';
  `);
  await pool.request().query(`
    INSERT INTO center_inventory(center_code,sku,qty,reserved_qty)
    SELECT c.code,i.sku,0,0 FROM centers c CROSS JOIN inventory i
    WHERE c.is_active=1 AND i.is_active=1
      AND NOT EXISTS(SELECT 1 FROM center_inventory ci WHERE ci.center_code=c.code AND ci.sku=i.sku);
  `);
}
