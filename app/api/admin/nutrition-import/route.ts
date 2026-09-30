// app/api/admin/nutrition-import/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const maxDuration = 300;

type Row = {
  id: number;
  foodName: string;
  foodGroup: string;
  wasteRatio: number | null;
  energyKcal: number | null;
  protein: number | null;
  fat: number | null;
  cholesterol: number | null;
  carbohydrate: number | null;
  dietaryFiber: number | null;
  sodium: number | null;
  saltEquivalent: number | null;
};

// 1回のSQLでまとめて登録・更新する件数（12パラメータ×300件＝3,600。PostgreSQLの上限32,767以内）
const CHUNK_SIZE = 300;

// 2026-09-30: 1件ずつ upsert していたため約2,500件で数分かかり、Vercelの時間切れで失敗していた。
// INSERT ... ON CONFLICT で300件ずつまとめて書き込むように変更（DBへの問い合わせ 約2,500回 → 約10回）。
// まとめて書き込んで失敗したチャンクだけ、従来どおり1件ずつ upsert して不正な行をスキップする。
async function bulkUpsert(rows: Row[]) {
  const params: unknown[] = [];
  const values = rows.map((r) => {
    const b = params.length;
    params.push(
      r.id, r.foodName, r.foodGroup, r.wasteRatio, r.energyKcal, r.protein,
      r.fat, r.cholesterol, r.carbohydrate, r.dietaryFiber, r.sodium, r.saltEquivalent,
    );
    return `($${b + 1}::int, $${b + 2}::text, $${b + 3}::text, $${b + 4}::numeric, $${b + 5}::numeric, $${b + 6}::numeric, ` +
      `$${b + 7}::numeric, $${b + 8}::numeric, $${b + 9}::numeric, $${b + 10}::numeric, $${b + 11}::numeric, $${b + 12}::numeric, '2020')`;
  });
  const sql = `
    INSERT INTO "nutrition_data"
      ("id","foodName","foodGroup","wasteRatio","energyKcal","protein","fat","cholesterol",
       "carbohydrate","dietaryFiber","sodium","saltEquivalent","dataVersion")
    VALUES ${values.join(',')}
    ON CONFLICT ("id") DO UPDATE SET
      "foodName"       = EXCLUDED."foodName",
      "foodGroup"      = EXCLUDED."foodGroup",
      "wasteRatio"     = EXCLUDED."wasteRatio",
      "energyKcal"     = EXCLUDED."energyKcal",
      "protein"        = EXCLUDED."protein",
      "fat"            = EXCLUDED."fat",
      "cholesterol"    = EXCLUDED."cholesterol",
      "carbohydrate"   = EXCLUDED."carbohydrate",
      "dietaryFiber"   = EXCLUDED."dietaryFiber",
      "sodium"         = EXCLUDED."sodium",
      "saltEquivalent" = EXCLUDED."saltEquivalent",
      "dataVersion"    = EXCLUDED."dataVersion"`;
  await prisma.$executeRawUnsafe(sql, ...params);
}

async function singleUpsert(r: Row) {
  const { id, ...data } = r;
  await prisma.nutritionData.upsert({
    where: { id },
    update: { ...data, dataVersion: '2020' },
    create: { id, ...data, dataVersion: '2020' },
  });
}

export async function POST(request: Request) {
  const session = await auth();
  if (session?.user?.plan !== 'admin') {
    return NextResponse.json({ success: false, error: '管理者権限が必要です' }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ success: false, error: 'ファイルが必要です' }, { status: 400 });

  const startedAt = Date.now();

  try {
    const buffer = await file.arrayBuffer();
    const XLSX = await import('xlsx');
    const wb = XLSX.read(buffer, { type: 'array' });

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
    //     12=脂質, 13=炭水化物(単糖), ..., 15=利用可能炭水化物(質量計), 18=食物繊維総量, 20=炭水化物
    //     18=食物繊維, 23=ナトリウム, 60=食塩相当量
    const DATA_START_ROW = 13; // 1-indexed → 0-indexed = 12
    const COL = {
      foodGroup: 0, foodId: 1, name: 3, waste: 4,
      energyKcal: 6, protein: 9, fat: 12,
      // 2026-09-30修正: 炭水化物は以前 15列目（CHOAVL＝利用可能炭水化物・質量計）を読んでいたが、
      // 食品表示基準の「炭水化物」は食物繊維を含む値（100 −（水分＋たんぱく質＋脂質＋灰分）相当）のため
      // 20列目（CHOCDF-＝炭水化物）に変更。野菜・果物・調味料などで大きく過少表示になっていた
      // （例：にんにく 1.0g→27.5g、レモン果汁 1.5g→8.6g／100g）。2020年版・2023年増補版とも同じ列位置。
      // ※ 修正を反映するには、管理画面から成分表Excelを再インポートする必要がある。
      cholesterol: 11, carb: 20, fiber: 18, sodium: 23, salt: 60,
    };

    // 同じ食品番号が複数シートにあっても1件にまとめる（後勝ち。従来の逐次upsertと同じ結果）
    const byId = new Map<number, Row>();
    let sheetsProcessed = 0;

    for (const sheetName of wb.SheetNames) {
      if (sheetName === "表全体") continue; // 表全体シートはスキップ
      sheetsProcessed++;

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

        byId.set(foodId, {
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
        });
      }
    }

    const all: Row[] = [];
    byId.forEach((r) => all.push(r));

    if (all.length === 0) {
      return NextResponse.json({
        success: false,
        error: '食品データが1件も見つかりませんでした。文部科学省の食品成分表（本表）のExcelか確認してください',
      }, { status: 400 });
    }

    let imported = 0;
    let skipped  = 0;

    for (let i = 0; i < all.length; i += CHUNK_SIZE) {
      const chunk = all.slice(i, i + CHUNK_SIZE);
      try {
        await bulkUpsert(chunk);
        imported += chunk.length;
      } catch {
        // まとめて失敗したときは1件ずつ（不正な行だけスキップ）
        for (const r of chunk) {
          try { await singleUpsert(r); imported++; } catch { skipped++; }
        }
      }
    }

    const seconds = Math.round((Date.now() - startedAt) / 100) / 10;
    return NextResponse.json({
      success: true,
      data: { imported, skipped, sheetsProcessed, seconds },
      message: `${imported}件の食品データをインポートしました`,
    });

  } catch (err) {
    return NextResponse.json({ success: false, error: `処理エラー: ${String(err)}` }, { status: 500 });
  }
}
