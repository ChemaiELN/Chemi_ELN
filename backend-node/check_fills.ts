import ExcelJS from 'exceljs';
async function inspect(path: string) {
  console.log('=== FILE:', path, '===');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  for (const ws of wb.worksheets) {
    const fillCounts = new Map<string, number>();
    const dim = (ws as any).dimensions;
    if (!dim) continue;
    for (let r = dim.top; r <= dim.bottom; r++) {
      for (let c = dim.left; c <= dim.right; c++) {
        const cell = ws.getCell(r, c);
        const fill = cell.fill as any;
        if (fill?.type === 'pattern' && fill.pattern === 'solid' && fill.fgColor?.argb) {
          const key = fill.fgColor.argb;
          fillCounts.set(key, (fillCounts.get(key) ?? 0) + 1);
        }
      }
    }
    console.log(' Sheet:', ws.name, [...fillCounts.entries()].map(([k,v]) => `${k}:${v}`).join(', '));
  }
}
(async () => {
  await inspect('C:/Users/Tarun.Bollineni/Downloads/SampleMapping-Assay-Multiple (2) (1).xlsx');
  await inspect('C:/Users/Tarun.Bollineni/Downloads/ExcelTemplate.xlsx');
})();
