import { BadRequestException, Injectable } from '@nestjs/common';
import { strFromU8, unzipSync } from 'fflate';
import { XMLParser } from 'fast-xml-parser';
import { QuestionType } from '../../generated/prisma/client';
import { CLIENT_LIKERT_ITEMS, LIKERT_LABELS } from './client-likert';
import type { SectionInputDto } from './tests.dto';

interface ImportedStatement {
  code: string;
  text: string;
  order: number;
  config: { source: string; scale: string; polarity: 'POSITIVE' | 'NEGATIVE'; selectedScore: number; sourcePair: number };
}

interface ClientSheet { get(row: number, column: number): string }
interface XmlSheet { name: string; 'r:id': string }
interface XmlRelationship { Id: string; Target: string }
interface XmlCell { r: string; t?: string; v?: string; is?: XmlText }
interface XmlRow { r: string; c?: XmlCell | XmlCell[] }
interface XmlText { t?: string | { '#text'?: string }; r?: { t?: string | { '#text'?: string } } | Array<{ t?: string | { '#text'?: string } }> }

@Injectable()
export class ClientWorkbookImporterService {
  parse(buffer: Buffer) {
    const workbook = this.readWorkbook(buffer);
    const source = workbook.get('BaseResultados');
    const scoring = workbook.get('Puntuación');
    if (!source || !scoring) throw new BadRequestException('El libro debe incluir las hojas BaseResultados y Puntuación.');

    const statements = this.readStatements(source, scoring);
    if (statements.length !== 336) throw new BadRequestException(`Se esperaban 336 afirmaciones y se encontraron ${statements.length}.`);
    const positive = statements.filter(({ config }) => config.polarity === 'POSITIVE');
    const negative = statements.filter(({ config }) => config.polarity === 'NEGATIVE');
    if (positive.length !== 192 || negative.length !== 144) throw new BadRequestException('El libro no conserva la distribución esperada de 192 afirmaciones positivas y 144 negativas.');

    const sections: SectionInputDto[] = [
      this.controlSection(),
      this.pairsSection('POSITIVE-PAIRS', 'Afirmaciones positivas', 2, positive, 'POS'),
      this.pairsSection('NEGATIVE-PAIRS', 'Afirmaciones negativas', 3, negative, 'NEG'),
      this.likertSection(),
    ];

    return {
      sections,
      labels: {
        sourceWorkbook: '_DPO Express V 6.0 Mac 24 (Ejemplo).xlsm',
        importedAt: new Date().toISOString(),
        likert: LIKERT_LABELS,
        clientValidation: {
          sourcePairCount: 168,
          positivePairCount: 96,
          negativePairCount: 72,
          availableLikertCount: CLIENT_LIKERT_ITEMS.length,
          expectedLikertCount: 31,
          warning: 'El PDF de Gestión de recursos contiene 25 reactivos; el documento de estructura indica 31. Faltan 6 por validar con el cliente.',
        },
      },
      summary: {
        controlQuestions: 12,
        positivePairs: 96,
        negativePairs: 72,
        likertQuestions: CLIENT_LIKERT_ITEMS.length,
        statements: statements.length,
        warnings: ['El bloque Likert disponible tiene 25 de 31 reactivos esperados.'],
      },
    };
  }

  private readStatements(source: ClientSheet, scoring: ClientSheet): ImportedStatement[] {
    const scoreByText = new Map<string, { scale: string; polarity: 'POSITIVE' | 'NEGATIVE'; selectedScore: number }>();
    for (let row = 14; row <= 349; row += 1) {
      const text = scoring.get(row, 2).trim();
      const scale = scoring.get(row, 3).trim();
      const polarityText = scoring.get(row, 8).trim().toLowerCase();
      const score = Number(scoring.get(row, 9));
      if (text) scoreByText.set(this.normalize(text), { scale, polarity: polarityText.startsWith('neg') ? 'NEGATIVE' : 'POSITIVE', selectedScore: Number.isFinite(score) ? score : 0 });
    }

    const result: ImportedStatement[] = [];
    for (let column = 14; column <= 349; column += 1) {
      const header = source.get(1, column).trim();
      const match = header.match(/^\s*(\d+)\s*\[(.*)]\s*$/s);
      if (!match) continue;
      const text = this.repairMojibake(match[2]?.trim() ?? '');
      const score = scoreByText.get(this.normalize(text));
      if (!score) {
        const normalized = this.normalize(text);
        const candidate = [...scoreByText.keys()].find((value) => value.includes(normalized.slice(0, 40)) || normalized.includes(value.slice(0, 40)));
        throw new BadRequestException(`No se encontró puntuación para la afirmación: ${text.slice(0, 80)}${candidate ? ` (candidato: ${candidate.slice(0, 100)})` : ''}`);
      }
      result.push({
        code: `S-${String(result.length + 1).padStart(3, '0')}`,
        text,
        order: result.length + 1,
        config: { source: 'client-workbook', sourcePair: Number(match[1]), ...score },
      });
    }
    return result;
  }

  private controlSection(): SectionInputDto {
    const choice = (labels: string[]) => labels.map((label, index) => ({ value: String(index + 1), label, order: index + 1 }));
    const question = (code: string, type: QuestionType, prompt: string, order: number, options: string[] = []) => ({ code, type, prompt, order, required: true, config: { source: 'DPO_PRO 5.0 - Google Forms.pdf' }, statements: [], answerOptions: choice(options) });
    return {
      code: 'CONTROL', title: 'Control estadístico', order: 1,
      description: 'Información estadística declarada por la persona evaluada.',
      instructions: 'Completa los datos solicitados. Esta información se conserva separada del perfil de usuario.',
      questions: [
        question('CONTROL-EMAIL', QuestionType.SHORT_TEXT, 'Correo electrónico', 1),
        question('CONTROL-NAME', QuestionType.SHORT_TEXT, 'Nombre y apellidos', 2),
        question('CONTROL-WORK-STATUS', QuestionType.SINGLE_CHOICE, 'Situación laboral', 3, ['Empleado', 'Desempleado', 'Trabajo por cuenta propia, emprendedor o dueño de negocio', 'Soy estudiante o recién egresado']),
        question('CONTROL-GENDER', QuestionType.SINGLE_CHOICE, 'Género', 4, ['Hombre', 'Mujer']),
        question('CONTROL-AGE', QuestionType.NUMBER, 'Edad', 5),
        question('CONTROL-LOCATION', QuestionType.SHORT_TEXT, 'País y ciudad de residencia', 6),
        question('CONTROL-EDUCATION', QuestionType.SINGLE_CHOICE, 'Nivel académico', 7, ['Secundaria', 'Preparatoria', 'Licenciatura', 'Superior a licenciatura']),
        question('CONTROL-SPECIALTY', QuestionType.SHORT_TEXT, '¿A qué te dedicas? (Tu área de especialización)', 8),
        question('CONTROL-POSITION', QuestionType.SHORT_TEXT, '¿Cuál es tu puesto actual? Si estás desempleado, escribe tu último puesto.', 9),
        question('CONTROL-EXPERIENCE', QuestionType.SHORT_TEXT, 'Menciona las 3 áreas en las que tengas mayor experiencia.', 10),
        question('CONTROL-MAX-LEVEL', QuestionType.SINGLE_CHOICE, 'Nivel máximo alcanzado', 11, ['Analista o Especialista', 'Supervisor, Jefe o Coordinador', 'Gerente', 'Subdirector, Director o Superior']),
        question('CONTROL-MAX-INCOME', QuestionType.SINGLE_CHOICE, 'Ingreso máximo alcanzado', 12, ['Hasta 10,000 pesos', 'De 11,000 a 20,000 pesos', 'De 21,000 a 30,000 pesos', 'De 31,000 a 40,000', '41,000 a 50,000', 'Más de 51,000']),
      ],
    };
  }

  private pairsSection(code: string, title: string, order: number, statements: ImportedStatement[], prefix: string): SectionInputDto {
    const pairs = new Map<number, ImportedStatement[]>();
    for (const statement of statements) pairs.set(statement.config.sourcePair, [...(pairs.get(statement.config.sourcePair) ?? []), statement]);
    return {
      code, title, order,
      instructions: 'Lee ambas afirmaciones y elige con cuál te identificas más y con cuál te identificas menos. No puedes elegir la misma afirmación en ambas opciones.',
      questions: [...pairs.entries()].sort(([a], [b]) => a - b).map(([sourcePair, pair], index) => ({
        code: `${prefix}-${String(index + 1).padStart(3, '0')}`,
        type: QuestionType.PAIRED,
        prompt: 'Selecciona la afirmación con la que te identificas más y la que te identifica menos.',
        order: index + 1,
        required: true,
        config: { sourcePair, polarity: pair[0]?.config.polarity, source: 'client-workbook' },
        statements: pair.map((statement, statementIndex) => ({ ...statement, code: statementIndex === 0 ? 'A' : 'B', order: statementIndex + 1 })),
        answerOptions: [],
      })),
    };
  }

  private likertSection(): SectionInputDto {
    return {
      code: 'RESOURCE-MANAGEMENT', title: 'Gestión de recursos', order: 4,
      instructions: 'Indica qué tan falsa o verdadera es cada afirmación de acuerdo con tu situación particular.',
      description: 'Bloque parcial recibido del cliente: 25 de 31 reactivos esperados.',
      questions: CLIENT_LIKERT_ITEMS.map((prompt, index) => ({
        code: `LIKERT-${String(index + 1).padStart(2, '0')}`, type: QuestionType.LIKERT, prompt, order: index + 1, required: true,
        config: { source: 'Gestión de recursos - Google Forms.pdf', pendingClientValidation: true }, statements: [],
        answerOptions: LIKERT_LABELS.map((label, optionIndex) => ({ value: String(optionIndex + 1), label, order: optionIndex + 1 })),
      })),
    };
  }

  private normalize(value: string) { return value.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('es-MX'); }
  private repairMojibake(value: string) {
    if (!/[ÃÂ]/.test(value)) return value;
    return Buffer.from(value, 'latin1').toString('utf8');
  }

  private readWorkbook(buffer: Buffer) {
    let archive: Record<string, Uint8Array>;
    try { archive = unzipSync(new Uint8Array(buffer)); }
    catch { throw new BadRequestException('El archivo no es un libro XLSM/XLSX válido.'); }
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: false, trimValues: false });
    const parse = <T>(path: string): T => {
      const bytes = archive[path];
      if (!bytes) throw new BadRequestException(`El libro no contiene ${path}.`);
      return parser.parse(strFromU8(bytes)) as T;
    };
    const workbookXml = parse<{ workbook: { sheets: { sheet: XmlSheet | XmlSheet[] } } }>('xl/workbook.xml');
    const relationshipsXml = parse<{ Relationships: { Relationship: XmlRelationship | XmlRelationship[] } }>('xl/_rels/workbook.xml.rels');
    const sharedStrings = archive['xl/sharedStrings.xml']
      ? this.asArray(parse<{ sst: { si?: XmlText | XmlText[] } }>('xl/sharedStrings.xml').sst.si).map((item) => this.xmlText(item))
      : [];
    const relationships = new Map(this.asArray(relationshipsXml.Relationships.Relationship).map((relationship) => [relationship.Id, relationship.Target]));
    const sheets = new Map<string, ClientSheet>();

    for (const sheet of this.asArray(workbookXml.workbook.sheets.sheet)) {
      const target = relationships.get(sheet['r:id']);
      if (!target) continue;
      const normalizedTarget = target.replace(/^\/?xl\//, '');
      const path = `xl/${normalizedTarget.replace(/^\//, '')}`;
      const worksheet = parse<{ worksheet: { sheetData?: { row?: XmlRow | XmlRow[] } } }>(path);
      const cells = new Map<string, string>();
      for (const row of this.asArray(worksheet.worksheet.sheetData?.row)) for (const cell of this.asArray(row.c)) {
        const raw = cell.t === 'inlineStr' ? this.xmlText(cell.is) : cell.v ?? '';
        const value = cell.t === 's' ? sharedStrings[Number(raw)] ?? '' : raw;
        cells.set(cell.r, value);
      }
      sheets.set(sheet.name, { get: (row, column) => cells.get(`${this.columnName(column)}${row}`) ?? '' });
    }
    return sheets;
  }

  private xmlText(value: XmlText | undefined) {
    if (!value) return '';
    if (value.t !== undefined) return this.textValue(value.t);
    return this.asArray(value.r).map((run) => this.textValue(run.t)).join('');
  }

  private textValue(value: string | { '#text'?: string } | undefined) { return typeof value === 'string' ? value : value?.['#text'] ?? ''; }

  private asArray<T>(value: T | T[] | undefined): T[] { return value === undefined ? [] : Array.isArray(value) ? value : [value]; }
  private columnName(column: number) { let result = ''; for (let value = column; value > 0; value = Math.floor((value - 1) / 26)) result = String.fromCharCode(65 + ((value - 1) % 26)) + result; return result; }
}
