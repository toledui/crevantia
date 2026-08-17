import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ClientWorkbookImporterService } from '../src/modules/tests/client-workbook-importer.service';

describe('ClientWorkbookImporterService', () => {
  it('imports the client workbook with the documented structure', async () => {
    const file = await readFile(join(process.cwd(), '..', 'docs', '_DPO Express V 6.0 Mac 24 (Ejemplo).xlsm'));
    const result = new ClientWorkbookImporterService().parse(file);

    expect(result.summary).toMatchObject({ controlQuestions: 12, positivePairs: 96, negativePairs: 72, likertQuestions: 25, statements: 336 });
    expect(result.sections).toHaveLength(4);
    expect(result.sections[1]?.questions).toHaveLength(96);
    expect(result.sections[2]?.questions).toHaveLength(72);
    expect(result.sections[1]?.questions[0]?.statements).toHaveLength(2);
    expect(result.summary.warnings).toContain('El bloque Likert disponible tiene 25 de 31 reactivos esperados.');
  }, 30_000);
});
