// app/api/admin/nutrition-import/route.ts - 成分表インポートAPI（管理者専用）
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function POST(request: Request) {
  const session = await auth();
  if (session?.user?.plan !== 'admin') {
    return NextResponse.json({ success: false, error: '管理者権限が必要です' }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ success: false, error: 'ファイルが必要です' }, { status: 400 });

  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!['xlsx','xls'].includes(ext ?? '')) {
    return NextResponse.json({ success: false, error: '.xlsx または .xls ファイルを選択してください' }, { status: 400 });
  }

  try {
    const buffer = await file.arrayBuffer();
    // xlsxライブラリでパース
    const XLSX = await import('xlsx');
    const wb   = XLSX.read(buffer, { type: 'array' });

    let imported = 0;
    let skipped  = 0;
    const errors: string[] = [];

    // 各シートを処理（文科省の成分表は穀類・肉類などカテゴリ別にシートが分かれている）
    for (const sheetName of wb.SheetNames) {
      const ws   = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { header: 1, defval: null }) as unknown[][];

      // ヘッダー行を探す（食品番号を含む行）
      let headerRow = -1;
      for (let i = 0; i < Math.min(rows.length, 10); i++) {
        const row = rows[i] as unknown[];
        if (row && row.some(c => String(c ?? '').includes('食品番号') || String(c ?? '').includes('ENERC'))) {
          headerRow = i;
          break;
        }
      }
      if (headerRow < 0) continue;

      const headers = (rows[headerRow] as unknown[]).map(c => String(c ?? ''));

      const findCol = (candidates: string[]) => {
        for (const name of candidates) {
          const idx = headers.findIndex(h => h.includes(name));
          if (idx >= 0) return idx;
        }
        return -1;
      };

      const ci = {
        id:       findCol(['食品番号','0']),
        name:     findCol(['食品名','3']),
        group:    findCol(['食品群']),
        waste:    findCol(['廃棄率','廃棄']),
        energy:   findCol(['エネルギー（kcal）','ENERC_KCAL','kcal']),
        protein:  findCol(['たんぱく質','PROT']),
        fat:      findCol(['脂質','FAT']),
        chol:     findCol(['コレステロール','CHOLE']),
        carb:     findCol(['炭水化物','CHOCDF']),
        fiber:    findCol(['食物繊維総量','FIBTG']),
        sugar:    findCol(['糖質']),
        sodium:   findCol(['ナトリウム','NA']),
        salt:     findCol(['食塩相当量','NACL']),
      };

      if (ci.id < 0 || ci.name < 0) continue;

      const toNum = (val: unknown) => {
        if (val == null || String(val).trim() === '-' || String(val).trim() === '') return null;
        const s = String(val).replace(/[()（）Tr]/g, (m) => m === 'Tr' ? '0.001' : '');
        const n = parseFloat(s);
        return isNaN(n) ? null : n;
      };

      for (let i = headerRow + 1; i < rows.length; i++) {
        const row = rows[i] as unknown[];
        if (!row) continue;
        const rawId = row[ci.id];
        if (!rawId) continue;
        const foodId = parseInt(String(rawId).trim());
        if (isNaN(foodId) || foodId <= 0) continue;
        const name = String(row[ci.name] ?? '').trim();
        if (!name) continue;

        try {
          await prisma.nutritionData.upsert({
            where:  { id: foodId },
            update: {
              foodName:      name,
              foodGroup:     ci.group >= 0 ? String(row[ci.group] ?? '').trim() : undefined,
              wasteRatio:    ci.waste  >= 0 ? toNum(row[ci.waste])   : undefined,
              energyKcal:    ci.energy >= 0 ? toNum(row[ci.energy])  : undefined,
              protein:       ci.protein >= 0 ? toNum(row[ci.protein]) : undefined,
              fat:           ci.fat    >= 0 ? toNum(row[ci.fat])     : undefined,
              cholesterol:   ci.chol  >= 0 ? toNum(row[ci.chol])    : undefined,
              carbohydrate:  ci.carb  >= 0 ? toNum(row[ci.carb])    : undefined,
              dietaryFiber:  ci.fiber >= 0 ? toNum(row[ci.fiber])   : undefined,
              sugar:         ci.sugar >= 0 ? toNum(row[ci.sugar])   : undefined,
              sodium:        ci.sodium >= 0 ? toNum(row[ci.sodium])  : undefined,
              saltEquivalent: ci.salt >= 0 ? toNum(row[ci.salt])    : undefined,
              dataVersion:   '2020',
            },
            create: {
              id:            foodId,
              foodName:      name,
              foodGroup:     ci.group >= 0 ? String(row[ci.group] ?? '').trim() : '',
              wasteRatio:    ci.waste  >= 0 ? toNum(row[ci.waste])   : null,
              energyKcal:    ci.energy >= 0 ? toNum(row[ci.energy])  : null,
              protein:       ci.protein >= 0 ? toNum(row[ci.protein]) : null,
              fat:           ci.fat    >= 0 ? toNum(row[ci.fat])     : null,
              cholesterol:   ci.chol  >= 0 ? toNum(row[ci.chol])    : null,
              carbohydrate:  ci.carb  >= 0 ? toNum(row[ci.carb])    : null,
              dietaryFiber:  ci.fiber >= 0 ? toNum(row[ci.fiber])   : null,
              sugar:         ci.sugar >= 0 ? toNum(row[ci.sugar])   : null,
              sodium:        ci.sodium >= 0 ? toNum(row[ci.sodium])  : null,
              saltEquivalent: ci.salt >= 0 ? toNum(row[ci.salt])    : null,
              dataVersion:   '2020',
            },
          });
          imported++;
        } catch (e) {
          skipped++;
          if (errors.length < 10) errors.push(`ID ${foodId}: ${String(e).slice(0, 80)}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: { imported, skipped, sheetsProcessed: wb.SheetNames.length },
      message: `${imported}件の食品データをインポートしました（シート数: ${wb.SheetNames.length}）`,
    });

  } catch (err) {
    return NextResponse.json({ success: false, error: `処理エラー: ${String(err)}` }, { status: 500 });
  }
}
