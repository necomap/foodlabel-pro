// app/api/admin/nutrition-import/route.ts
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

  try {
    const buffer = await file.arrayBuffer();
    const XLSX = await import('xlsx');
    const wb = XLSX.read(buffer, { type: 'array' });

    let imported = 0;
    let skipped  = 0;

    const toNum = (val: any) => {
      if (val == null || val === "-" || val === "Tr" || String(val).trim() === "") return null;
      const s = String(val).replace(/[()（）]/g, "").replace("Tr", "0.001").trim();
      const n = parseFloat(s);
      return isNaN(n) ? null : n;
    };

    // 文科省2020年版の固定列位置
    // 行12が成分識別子行、行13からデータ
    // 列: 0=食品群, 1=食品番号, 2=索引番号, 3=食品名, 4=廃棄率
    //     5=エネルギー(kJ), 6=エネルギー(kcal), 7=水分
    //     8=たんぱく質(アミノ酸), 9=たんぱく質, 10=脂質(FA), 11=コレステロール
    //     12=脂質, 13=炭水化物(単糖), ..., 15=炭水化物
    //     18=食物繊維, 23=ナトリウム, 60=食塩相当量
    const DATA_START_ROW = 13; // 1-indexed → 0-indexed = 12
    const COL = {
      foodGroup: 0, foodId: 1, name: 3, waste: 4,
      energyKcal: 6, protein: 9, fat: 12,
      cholesterol: 11, carb: 15, fiber: 18, sodium: 23, salt: 60,
    };

    for (const sheetName of wb.SheetNames) {
      if (sheetName === "表全体") continue; // 表全体シートはスキップ

      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as any[][];

      if (rows.length < DATA_START_ROW) continue;

      for (let i = DATA_START_ROW - 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row) continue;

        const rawId = row[COL.foodId];
        if (!rawId) continue;

        const idStr = String(rawId).trim().replace(/[^0-9]/g, "");
        const foodId = parseInt(idStr);
        if (isNaN(foodId) || foodId <= 0) continue;

        const name = String(row[COL.name] ?? "").replace(/　/g, " ").trim();
        if (!name || name === "成分識別子" || name === "単位") continue;

        try {
          await prisma.nutritionData.upsert({
            where:  { id: foodId },
            update: {
              foodName:       name,
              foodGroup:      String(row[COL.foodGroup] ?? "").trim(),
              wasteRatio:     toNum(row[COL.waste]),
              energyKcal:     toNum(row[COL.energyKcal]),
              protein:        toNum(row[COL.protein]),
              fat:            toNum(row[COL.fat]),
              cholesterol:    toNum(row[COL.cholesterol]),
              carbohydrate:   toNum(row[COL.carb]),
              dietaryFiber:   toNum(row[COL.fiber]),
              sodium:         toNum(row[COL.sodium]),
              saltEquivalent: toNum(row[COL.salt]),
              dataVersion:    "2020",
            },
            create: {
              id:             foodId,
              foodName:       name,
              foodGroup:      String(row[COL.foodGroup] ?? "").trim(),
              wasteRatio:     toNum(row[COL.waste]),
              energyKcal:     toNum(row[COL.energyKcal]),
              protein:        toNum(row[COL.protein]),
              fat:            toNum(row[COL.fat]),
              cholesterol:    toNum(row[COL.cholesterol]),
              carbohydrate:   toNum(row[COL.carb]),
              dietaryFiber:   toNum(row[COL.fiber]),
              sodium:         toNum(row[COL.sodium]),
              saltEquivalent: toNum(row[COL.salt]),
              dataVersion:    "2020",
            },
          });
          imported++;
        } catch (e) {
          skipped++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: { imported, skipped, sheetsProcessed: wb.SheetNames.length - 1 },
      message: `${imported}件の食品データをインポートしました`,
    });

  } catch (err) {
    return NextResponse.json({ success: false, error: `処理エラー: ${String(err)}` }, { status: 500 });
  }
}
