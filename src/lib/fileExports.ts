function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const escapePdfText = (value: string) =>
  value
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');

export function exportRowsToExcel(
  filename: string,
  title: string,
  columns: string[],
  rows: Array<Array<string | number>>
) {
  const headerCells = columns.map((column) => `<th>${escapeHtml(column)}</th>`).join('');
  const bodyRows = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
    .join('');

  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body { font-family: Arial, sans-serif; padding: 24px; }
      h1 { margin-bottom: 16px; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #d1d5db; padding: 8px 10px; text-align: left; }
      th { background: #f3f4f6; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(title)}</h1>
    <table>
      <thead><tr>${headerCells}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
  </body>
</html>`;

  downloadBlob(filename, new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8;' }));
}

export function exportTextLinesToPdf(filename: string, lines: string[]) {
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 40;
  const lineHeight = 16;
  const usableLinesPerPage = Math.max(1, Math.floor((pageHeight - margin * 2) / lineHeight));
  const pages: string[][] = [];

  for (let index = 0; index < lines.length; index += usableLinesPerPage) {
    pages.push(lines.slice(index, index + usableLinesPerPage));
  }

  const objects: string[] = [];
  const addObject = (content: string) => {
    objects.push(content);
    return objects.length;
  };

  const fontObjectId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const contentObjectIds = pages.map((pageLines) => {
    const textCommands = pageLines
      .map((line, lineIndex) => {
        const y = pageHeight - margin - lineIndex * lineHeight;
        return `BT /F1 11 Tf 1 0 0 1 ${margin} ${y} Tm (${escapePdfText(line)}) Tj ET`;
      })
      .join('\n');

    return addObject(`<< /Length ${textCommands.length} >>\nstream\n${textCommands}\nendstream`);
  });

  const pageObjectIds = contentObjectIds.map((contentObjectId) =>
    addObject(`<< /Type /Page /Parent PAGES_ID 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontObjectId} 0 R >> >> /Contents ${contentObjectId} 0 R >>`)
  );

  const kids = pageObjectIds.map((id) => `${id} 0 R`).join(' ');
  const pagesObjectId = addObject(`<< /Type /Pages /Kids [${kids}] /Count ${pageObjectIds.length} >>`);
  const catalogObjectId = addObject(`<< /Type /Catalog /Pages ${pagesObjectId} 0 R >>`);

  objects[pageObjectIds[0] ? pageObjectIds[0] - 1 : 0] = objects[pageObjectIds[0] ? pageObjectIds[0] - 1 : 0];
  const normalizedObjects = objects.map((object, index) =>
    object.replace(/PAGES_ID/g, String(pagesObjectId))
  );

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];

  normalizedObjects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${normalizedObjects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let index = 1; index <= normalizedObjects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${normalizedObjects.length + 1} /Root ${catalogObjectId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  downloadBlob(filename, new Blob([pdf], { type: 'application/pdf' }));
}
