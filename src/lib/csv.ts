/**
 * One CSV line. Cells starting with = + - @ (or tab/CR) are prefixed with an
 * apostrophe so spreadsheet apps do not evaluate attendee-supplied formulas.
 */
export function toCsvRow(cells: (string | number | null | undefined)[]): string {
  return (
    cells
      .map((cell) => {
        let v = cell === null || cell === undefined ? "" : String(cell);
        if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
        return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
      })
      .join(",") + "\r\n"
  );
}
