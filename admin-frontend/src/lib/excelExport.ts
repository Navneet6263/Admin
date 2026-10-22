/** Styled .xlsx report generation (exceljs is loaded lazily, only when someone exports). */

export type ExportCellType = 'text' | 'number' | 'currency' | 'date' | 'datetime';
export type ExportValue = string | number | boolean | Date | null | undefined;

export interface ExportColumn<T> {
  key: string;
  label: string;
  value: (row: T) => ExportValue;
  type?: ExportCellType;
  width?: number;
  /** Shown pre-ticked in the export dialog (default true). */
  defaultOn?: boolean;
}

export interface ExcelReport<T> {
  fileName: string;
  sheetName: string;
  title: string;
  subtitle?: string;
  columns: ExportColumn<T>[];
  rows: T[];
  includeTotals: boolean;
  /** Column key to build a grouped "Summary" sheet on. */
  groupBy?: string | null;
}

const numeric = (type?: ExportCellType) => type === 'number' || type === 'currency';
const formats: Record<ExportCellType, string | undefined> = {
  text: undefined, number: '#,##0.##', currency: '"₹"#,##,##0.00', date: 'dd-mmm-yyyy', datetime: 'dd-mmm-yyyy hh:mm',
};

/** Normalises API values into what Excel should store for the column type. */
export function cellValue(value: ExportValue, type: ExportCellType = 'text'): string | number | Date | null {
  if (value === null || value === undefined || value === '') return null;
  if (numeric(type)) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (type === 'date') {
    // Calendar dates (SQL DATE arrives as midnight UTC): keep the day exactly as stored.
    const text = value instanceof Date ? value.toISOString() : String(value);
    const day = text.match(/^\d{4}-\d{2}-\d{2}/);
    return day ? new Date(`${day[0]}T00:00:00Z`) : text;
  }
  if (type === 'datetime') {
    // Excel has no time zones: store the viewer's local wall-clock time.
    const parsed = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(parsed.getTime())) return String(value);
    return new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000);
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

const safeName = (name: string) => name.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'report';
const sheetTitle = (name: string) => name.replace(/[\\/*?:[\]]/g, ' ').slice(0, 31) || 'Report';

export async function downloadExcel<T>(report: ExcelReport<T>) {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'RequestHub';
  workbook.created = new Date();
  const columns = report.columns;
  const sheet = workbook.addWorksheet(sheetTitle(report.sheetName), { views: [{ state: 'frozen', ySplit: 4 }] });
  const lastCol = Math.max(1, columns.length);

  sheet.mergeCells(1, 1, 1, lastCol);
  sheet.getCell(1, 1).value = report.title;
  sheet.getCell(1, 1).font = { bold: true, size: 14, color: { argb: 'FF0F172A' } };
  sheet.mergeCells(2, 1, 2, lastCol);
  sheet.getCell(2, 1).value = [report.subtitle, `Generated ${new Date().toLocaleString('en-IN')}`, `${report.rows.length} rows`]
    .filter(Boolean).join('  ·  ');
  sheet.getCell(2, 1).font = { size: 9, color: { argb: 'FF64748B' } };

  const header = sheet.getRow(4);
  columns.forEach((column, index) => {
    const cell = header.getCell(index + 1);
    cell.value = column.label;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.alignment = { vertical: 'middle', horizontal: numeric(column.type) ? 'right' : 'left', wrapText: true };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF94A3B8' } } };
  });
  header.height = 22;

  report.rows.forEach((row, rowIndex) => {
    const excelRow = sheet.getRow(5 + rowIndex);
    columns.forEach((column, index) => {
      const cell = excelRow.getCell(index + 1);
      cell.value = cellValue(column.value(row), column.type);
      const format = formats[column.type || 'text'];
      if (format) cell.numFmt = format;
      if (rowIndex % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    });
  });

  const firstData = 5;
  const lastData = 4 + report.rows.length;
  if (report.includeTotals && report.rows.length) {
    const totals = sheet.getRow(lastData + 1);
    totals.getCell(1).value = 'Total';
    columns.forEach((column, index) => {
      const cell = totals.getCell(index + 1);
      if (numeric(column.type) && index > 0) {
        const letter = sheet.getColumn(index + 1).letter;
        cell.value = { formula: `SUBTOTAL(9,${letter}${firstData}:${letter}${lastData})` };
        cell.numFmt = formats[column.type!]!;
      }
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      cell.border = { top: { style: 'thin', color: { argb: 'FF475569' } } };
    });
  }
  sheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: Math.max(4, lastData), column: lastCol } };
  columns.forEach((column, index) => {
    const longest = report.rows.slice(0, 500).reduce((max, row) => {
      const value = cellValue(column.value(row), column.type);
      const length = value instanceof Date ? 12 : String(value ?? '').length;
      return Math.max(max, length);
    }, column.label.length);
    sheet.getColumn(index + 1).width = column.width ?? Math.min(48, Math.max(10, longest + 2));
  });

  const group = report.groupBy ? columns.find((column) => column.key === report.groupBy) : null;
  if (group) addSummarySheet(workbook, report, group);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${safeName(report.fileName)}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Pivot-style sheet: one line per group with count and the sum of every numeric column. */
function addSummarySheet<T>(workbook: import('exceljs').Workbook, report: ExcelReport<T>, group: ExportColumn<T>) {
  const measures = report.columns.filter((column) => numeric(column.type));
  const buckets = new Map<string, { count: number; sums: number[] }>();
  for (const row of report.rows) {
    const label = String(cellValue(group.value(row), group.type === 'date' || group.type === 'datetime' ? 'text' : group.type) ?? '(blank)');
    const bucket = buckets.get(label) ?? { count: 0, sums: measures.map(() => 0) };
    bucket.count += 1;
    measures.forEach((column, index) => { bucket.sums[index] += Number(cellValue(column.value(row), column.type) || 0); });
    buckets.set(label, bucket);
  }
  const sheet = workbook.addWorksheet('Summary', { views: [{ state: 'frozen', ySplit: 3 }] });
  const width = 2 + measures.length + (measures.length ? 1 : 0);
  sheet.mergeCells(1, 1, 1, width);
  sheet.getCell(1, 1).value = `${report.title} — by ${group.label}`;
  sheet.getCell(1, 1).font = { bold: true, size: 13 };
  const headers = [group.label, 'Entries', ...measures.map((column) => column.label), ...(measures.length ? [`% of ${measures[0].label}`] : [])];
  const header = sheet.getRow(3);
  headers.forEach((label, index) => {
    const cell = header.getCell(index + 1);
    cell.value = label;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4338CA' } };
  });
  const sorted = [...buckets.entries()].sort((a, b) => (b[1].sums[0] ?? b[1].count) - (a[1].sums[0] ?? a[1].count));
  const grand = sorted.reduce((sum, [, bucket]) => sum + (bucket.sums[0] ?? 0), 0);
  sorted.forEach(([label, bucket], rowIndex) => {
    const row = sheet.getRow(4 + rowIndex);
    row.getCell(1).value = label;
    row.getCell(2).value = bucket.count;
    measures.forEach((column, index) => {
      const cell = row.getCell(3 + index);
      cell.value = bucket.sums[index];
      cell.numFmt = formats[column.type!]!;
    });
    if (measures.length) {
      const cell = row.getCell(3 + measures.length);
      cell.value = grand ? bucket.sums[0] / grand : 0;
      cell.numFmt = '0.0%';
    }
  });
  const totalRow = sheet.getRow(4 + sorted.length);
  totalRow.getCell(1).value = 'Grand total';
  totalRow.getCell(2).value = report.rows.length;
  measures.forEach((column, index) => {
    const cell = totalRow.getCell(3 + index);
    cell.value = sorted.reduce((sum, [, bucket]) => sum + bucket.sums[index], 0);
    cell.numFmt = formats[column.type!]!;
  });
  totalRow.font = { bold: true };
  sheet.columns.forEach((column, index) => { column.width = index === 0 ? 32 : 18; });
}
