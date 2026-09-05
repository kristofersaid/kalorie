import {
  getDb,
  TemplateItemRow,
  TemplateRow,
} from './database';

export type TemplateItemInput = {
  nazwa: string;
  waga: number;
  kcal: number;
  bialko: number;
  tluszcze: number;
  wegle: number;
};

export type TemplateWithItems = {
  id: number;
  nazwa: string;
  created_at: string;
  items: TemplateItemRow[];
  kcal: number;
  bialko: number;
  tluszcze: number;
  wegle: number;
  waga: number;
};

function sumItems(items: TemplateItemRow[]): TemplateWithItems {
  let kcal = 0;
  let bialko = 0;
  let tluszcze = 0;
  let wegle = 0;
  let waga = 0;
  for (const i of items) {
    kcal += i.kcal;
    bialko += i.bialko;
    tluszcze += i.tluszcze;
    wegle += i.wegle;
    waga += i.waga;
  }
  return {
    id: 0,
    nazwa: '',
    created_at: '',
    items,
    kcal,
    bialko,
    tluszcze,
    wegle,
    waga,
  };
}

export async function listTemplates(): Promise<TemplateWithItems[]> {
  const db = await getDb();
  const templates = await db.getAllAsync<TemplateRow>(
    'SELECT * FROM templates ORDER BY created_at DESC',
  );
  const out: TemplateWithItems[] = [];
  for (const t of templates) {
    const items = await db.getAllAsync<TemplateItemRow>(
      'SELECT * FROM template_items WHERE template_id = ?',
      [t.id],
    );
    const s = sumItems(items);
    out.push({ ...s, id: t.id, nazwa: t.nazwa, created_at: t.created_at });
  }
  return out;
}

export async function createTemplate(
  nazwa: string,
  items: TemplateItemInput[],
): Promise<number> {
  const db = await getDb();
  const res = await db.runAsync(
    'INSERT INTO templates (nazwa, created_at) VALUES (?, ?)',
    [
      nazwa.trim() === '' ? 'Mój posiłek' : nazwa.trim(),
      new Date().toISOString(),
    ],
  );
  const id = res.lastInsertRowId;
  for (const it of items) {
    await db.runAsync(
      `INSERT INTO template_items (template_id, nazwa, waga, kcal, bialko, tluszcze, wegle)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, it.nazwa, it.waga, it.kcal, it.bialko, it.tluszcze, it.wegle],
    );
  }
  return id;
}

export async function deleteTemplate(id: number): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM template_items WHERE template_id = ?', [
    id,
  ]);
  await db.runAsync('DELETE FROM templates WHERE id = ?', [id]);
}
