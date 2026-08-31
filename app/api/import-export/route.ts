// ============================================================
// app/api/import-export/route.ts
// Excelインポート・エクスポートAPI
// ============================================================

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getPlanLimits, getMonthlyDataTransferCount, logDataTransfer } from '@/lib/plan-limits';
import { prisma } from '@/lib/db';
import { parseExcelFile, exportRecipesToExcel, toFullWidth } from '@/lib/excel-import-export';
import { detectAllergens } from '@/lib/allergen';
import { calcNutritionForAmount, sumNutrition } from '@/lib/nutrition';

// ============================================================
// POST /api/import-export/import - Excelインポート
// ============================================================
export async function POST(request: Request) {
  // 2026-08新設: このリクエスト全体の実行時間を計測する。vercel.jsonのmaxDuration（300秒）に
  // 対して安全マージンを残し、時間切れになりそうな場合は処理を打ち切って「正常なレスポンス」
  // として途中経過を返す（下記SAFETY_MSの使用箇所を参照）。これが無いと、1件の処理に極端に
  // 時間がかかる行（材料点数が非常に多い等）に当たった時、Vercel側の強制終了で接続が
  // 切れてしまい、クライアントには「通信エラー」としか表示されず、しかも同じ行で
  // 何度リトライしても同じ場所で毎回タイムアウトする、という事態になっていた
  // （リトライのたびにoffset=0からやり直すため、既にインポート済みの分をスキップする時間を
  // 差し引いても、問題の行に到達する頃には残り時間が足りない、という状況が再現し続ける）。
  const requestStartTime = Date.now();

  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });


  const formData   = await request.formData();
  const file       = formData.get('file') as File | null;
  const overwrite  = formData.get('overwrite')  === 'true';
  const clearAllReq = formData.get('clearAll')   === 'true';
  // 2026-08新設: 1回のAPI呼び出しでは最大80件までしか処理できない（下記MAX_PER_REQUEST参照）ため、
  // 大量データは複数回のリクエストに分けて呼び出してもらう「続きから」方式に対応。
  // offset=0が「1回目（＝この一連のインポート操作の開始）」を意味し、全削除・月間回数カウントは
  // offset=0のときだけ行う（2回目以降で毎回全削除されたり、複数回分カウントされたりしないように）。
  const offset      = Number(formData.get('offset')) || 0;
  const isFirstChunk = offset === 0;
  // 全削除は最初のチャンクでのみ実行する（クライアントの実装ミス・多重送信対策として
  // isFirstChunkで二重にガードする＝2回目以降のチャンクでclearAll=trueが来ても無視する）
  const clearAll   = isFirstChunk && clearAllReq;

  const planLabel = (session.user.plan ?? 'free') === 'premium' ? 'スタンダードプラン' : 'フリープラン';

  // プラン制限チェック（インポート機能自体の利用可否・月間回数）
  // 2026-08: 以前はここに判定が無く、フリープランでもインポートが使えてしまっていた
  // （レシピ件数の上限だけが実質的な歯止めになっていた）。エクスポートと同様に
  // プレミアムプラン以上限定＋月間回数制限を設ける。全削除より前に判定することで、
  // 上限に達しているユーザーが「全データをクリアして上書き」を選んだ場合に
  // データだけ消えてインポートは弾かれる、という事態を避ける。
  const importLimits = getPlanLimits(session.user.plan ?? 'free');
  if (!importLimits.canExport) {
    return NextResponse.json({
      success: false,
      error: 'インポート機能はスタンダードプラン以上でご利用いただけます。',
      upgradeRequired: true,
    }, { status: 403 });
  }
  // 月間回数の判定・カウントは一連のインポート操作につき1回だけ（最初のチャンクでのみ）。
  // 2回目以降のチャンクは「同じ1回のインポートの続き」なので、ここでは弾かない。
  if (isFirstChunk && importLimits.maxImportsPerMonth !== Infinity) {
    const monthlyImportCount = await getMonthlyDataTransferCount(session.user.id, 'import');
    if (monthlyImportCount >= importLimits.maxImportsPerMonth) {
      return NextResponse.json({
        success: false,
        error: `スタンダードプランのインポートは月${importLimits.maxImportsPerMonth}回までです（今月分はご利用済みです）。プロプランなら回数無制限でご利用いただけます。`,
        upgradeRequired: true,
      }, { status: 403 });
    }
  }

  // 全上書きの場合は先に全削除（最初のチャンクでのみ）
  // 2026-08修正: 以前は論理削除（非表示化）のみだった。「全データをクリアして上書き」は
  // 名前の通り“クリア”のつもりでも実際には非表示レシピが増えるだけで、しかも下の
  // 既存レシピ検索が表示中のレシピしか見ていなかったため、クリア直後は同名判定が
  // 一切効かず、インポートした分がまるごと新規（表示）レシピとして作られてしまい、
  // 「非表示レシピだけがどんどん積み上がる」不具合の主因になっていた。
  // schema.prismaのLabel.recipeにonDelete: Cascadeを追加したことで安全に完全削除できる
  // ようになったため、実際に物理削除するよう変更する。
  // 念のため、本番でこのコードだけ先に反映され、対応するprisma db pushがまだ実行されて
  // いない環境（Label側の外部キー制約がまだCascadeでない）だと物理削除が外部キー制約
  // エラーになる可能性があるため、失敗時は従来の非表示化に自動フォールバックする
  // （＝db push未実施でも即500エラーにはならないようにする安全策）。
  if (clearAll) {
    try {
      await prisma.recipe.deleteMany({ where: { userId: session.user.id } });
    } catch (e) {
      console.error('clearAll: 物理削除に失敗したため非表示化にフォールバックします', e);
      await prisma.$executeRaw`
        UPDATE recipes SET "isActive" = false WHERE "userId" = ${session.user.id}
      `;
    }
  }

// プラン制限チェック（レシピ件数）
  let importLimit = Infinity;
  if (importLimits.maxRecipes !== Infinity) {
    if (clearAll) {
      // 全クリア後はプランの上限がそのままインポート上限
      importLimit = importLimits.maxRecipes;
    } else {
      const recipeCountResult = await prisma.$queryRaw`
        SELECT COUNT(*) as count FROM recipes WHERE "userId" = ${session.user.id} AND "isActive" = true
      ` as any[];
      const currentCount = Number(recipeCountResult[0]?.count ?? 0);
      if (currentCount >= importLimits.maxRecipes) {
        // 2026-08修正: このチェックはインポート機能自体がフリープランでは使えなくなった
        // （上のcanExportチェックで先に弾かれる）ため、実質プレミアムプラン（上限100件）
        // のユーザーしか到達しない。以前は常に「フリープランの上限」と表示していたが、
        // 現在のプラン名と正しいアップグレード先（プロプラン）を表示するよう修正。
        return NextResponse.json({
          success: false,
          error: `${planLabel}のレシピ上限（${importLimits.maxRecipes}件）に達しています。プロプランならレシピ登録数は無制限です。`,
          upgradeRequired: true,
        }, { status: 403 });
      }
      importLimit = importLimits.maxRecipes - currentCount;
    }
  }


  if (!file) {
    return NextResponse.json({ success: false, error: 'ファイルが選択されていません' }, { status: 400 });
  }

  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!['xlsx', 'xlsm', 'xls'].includes(ext ?? '')) {
    return NextResponse.json({ success: false, error: 'Excel形式（.xlsx, .xlsm, .xls）のファイルを選択してください' }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  // 2026-08: 大量データの分割呼び出し対応のため、毎回同じファイル全体を再アップロード
  // してもらい、サーバー側で都度パースしてoffset分だけスキップする方式にしている
  // （ファイル自体をサーバー側に保持し続けるのは複数リクエストをまたぐため難しいので、
  // パース処理そのものは軽い＝再実行しても問題ない、という前提に立っている）。
  // parseExcelFile自体が返すerrors/warnings（行の値が読めない等、ファイル内容そのものの
  // 問題）は再パースするたびに毎回同じ内容が返ってくるため、最初のチャンク（offset=0）の
  // レスポンスにだけ含める（そうしないとチャンク数だけ同じ警告が重複してしまう）。
  const { recipes: parsedRecipes, errors: parseErrors, warnings: parseWarnings } = parseExcelFile(buffer);

  if (parseErrors.length > 0 && parsedRecipes.length === 0) {
    return NextResponse.json({ success: false, error: 'ファイルの読み込みに失敗しました', data: { errors: parseErrors } }, { status: 400 });
  }

  let imported = 0;
  let skipped  = 0;
  const importErrors: Array<{ row: number; message: string }> = [];

  // プラン制限分だけ処理
  // 事前に全食材・全カテゴリをキャッシュして高速化
  const allIngredients = await prisma.ingredient.findMany({
    where: { userId: session.user.id },
    select: { id: true, name: true, nameKana: true },
  });
  const ingredientCache = new Map(allIngredients.map(i => [i.name.trim(), i]));

  const allCategories = await prisma.category.findMany({
    where: { userId: session.user.id },
    select: { id: true, name: true },
  });
  const categoryCache = new Map(allCategories.map(c => [c.name.trim(), c]));

  // 2026-08修正: 以前はisActive:trueのみを対象にしていたため、非表示にしたレシピと
  // 同名でインポートすると「既存として認識されず」新規レコードとして重複作成されてしまい、
  // 非表示レシピがDBに残り続ける、という不具合があった。表示・非表示を問わず対象にすることで、
  // 非表示にしていた（＝季節商品など、普段は使わないが消したくはないレシピ）ものも
  // 正しく上書き対象として認識されるようにする。
  const existingRecipes = await prisma.recipe.findMany({
    where: { userId: session.user.id },
    select: { id: true, name: true, isActive: true },
  });
  const recipeCache = new Map<string, { id: string; name: string; isActive: boolean }>(
    existingRecipes.map(r => [r.name.trim(), r])
  );

  // 1回あたりの処理上限（タイムアウト対策）。
  // 2026-08: vercel.jsonのmaxDurationを60秒→300秒に引き上げたのに合わせて20→80件に引き上げ。
  // 20件で60秒に収まっていた実績（1件あたり約3秒）から逆算し、300秒に対して安全マージンを
  // 大きめに残す形（80件なら理論値約240秒）で設定。件数が非常に多い食材を含むレシピが
  // 続くと超過する可能性は残るため、それでもタイムアウトする場合はさらに下げる。
  const MAX_PER_REQUEST = 80;
  // 2026-08: offsetから続きを処理する。以前はここで「importLimit・MAX_PER_REQUESTを
  // 超えた分」を無言で切り捨てていた（=80件を超えるファイルを1回のリクエストで送ると、
  // 81件目以降は何の警告も無いままインポートされずに消えていた）。
  // 現在はクライアント側が本APIをoffsetを進めながら繰り返し呼び出す前提のため、
  // 「このチャンクで処理する件数」をremainingInFile・importLimit・MAX_PER_REQUESTの
  // 最小値として求め、プラン上限で打ち切った場合だけ明示的に警告を出す。
  const remainingInFile = parsedRecipes.length - offset;
  const effectiveLimit = Math.max(0, Math.min(remainingInFile, importLimit, MAX_PER_REQUEST));
  const recipesToProcess = parsedRecipes.slice(offset, offset + effectiveLimit);

  // 2026-08新設: vercel.jsonのmaxDuration（300秒）に対する安全マージン。ここに達したら
  // 「まだ80件処理し切っていなくても」正常なレスポンスとしてこのチャンクを打ち切り、
  // 続きは次のリクエスト（新しい300秒の枠）に任せる。1件も進まないまま安全マージンに
  // 達することは通常ないはずだが、念のため「最低1件は処理してから判定する」ようにしている。
  const SAFETY_MS = 250_000; // 250秒（残り50秒は認証・パース・レスポンス組み立て等の余白）
  let processedCount = 0;
  for (const pr of recipesToProcess) {
    if (processedCount > 0 && Date.now() - requestStartTime > SAFETY_MS) break;
    processedCount++;
    try {
      const name = toFullWidth(pr.name).trim();
      if (!name) { skipped++; continue; }

      // 既存レシピチェック（表示・非表示問わず同名があれば「既存」として扱う）。
      // 上書きしない場合はスキップ、上書きする場合は後述の通りこのレシピを置き換える。
      const exists = recipeCache.get(name);
      if (exists && !overwrite) { skipped++; continue; }

      // カテゴリを探す or 作る
      let categoryId: string | undefined;
      if (pr.category) {
        let cat = categoryCache.get(pr.category.trim());
        if (!cat) {
          cat = await prisma.category.create({
            data: { userId: session.user.id, name: pr.category },
          });
          categoryCache.set(pr.category.trim(), cat);
        }
        // 2026-08修正: catを解決していたにもかかわらずcategoryIdへの代入が漏れており、
        // インポートされたレシピのカテゴリが常に未設定になっていた不具合を修正。
        categoryId = cat.id;
      }

      // 材料の食材マスタ検索・作成
      const ingredientDetails = [];
      for (const rawIng of pr.ingredients) {
        const ingName = toFullWidth(rawIng.name).trim();
        if (!ingName) continue;

        // 食材マスタを検索（自分の + 共有）
        let ingredient = ingredientCache.get(ingName) as any;

        // なければ自動作成（手入力扱い）
        if (!ingredient) {
          ingredient = await prisma.ingredient.create({
            data: {
              userId:    session.user.id,
              name:      ingName,
              nameKana:  '',
              allergens: detectAllergens(ingName),
              isActive:  true,
            },
            include: { nutritionData: true },
          });
          ingredientCache.set(ingName, ingredient);
        }
        // 栄養計算
        const amountG = ['g', 'ml'].includes(rawIng.unit) ? rawIng.amount : 0;
        const nutrition = amountG > 0 && ingredient.nutritionData
          ? calcNutritionForAmount({
              energyKcal:     ingredient.nutritionData.energyKcal     ? Number(ingredient.nutritionData.energyKcal)     : null,
              protein:        ingredient.nutritionData.protein        ? Number(ingredient.nutritionData.protein)        : null,
              fat:            ingredient.nutritionData.fat            ? Number(ingredient.nutritionData.fat)            : null,
              carbohydrate:   ingredient.nutritionData.carbohydrate   ? Number(ingredient.nutritionData.carbohydrate)   : null,
              sodium:         ingredient.nutritionData.sodium         ? Number(ingredient.nutritionData.sodium)         : null,
              saltEquivalent: ingredient.nutritionData.saltEquivalent  ? Number(ingredient.nutritionData.saltEquivalent) : null,
              dietaryFiber:   ingredient.nutritionData.dietaryFiber   ? Number(ingredient.nutritionData.dietaryFiber)   : null,
              sugar:          ingredient.nutritionData.sugar          ? Number(ingredient.nutritionData.sugar)          : null,
              cholesterol:    ingredient.nutritionData.cholesterol    ? Number(ingredient.nutritionData.cholesterol)    : null,
            }, amountG)
          : { energyKcal: null, protein: null, fat: null, carbohydrate: null, sodium: null, saltEquivalent: null, dietaryFiber: null, sugar: null, cholesterol: null };

        ingredientDetails.push({
          ingredientId:        ingredient.id,
          amount:              rawIng.amount,
          unit:                rawIng.unit || 'g',
          displayOrder:        rawIng.order,
          sortByWeight:        true,
          costPrice:           rawIng.cost ? rawIng.cost / rawIng.amount : undefined,
          costTotal:           rawIng.cost,
          allergenOverride:    [] as string[],
          nutritionUnconfirmed: !ingredient.nutritionData,
          isPrimary:           false,
          nutrition,
          // 2026-08: 個人バックアップ用に追加した材料ごとの原産国・添加物情報。
          // 通常のインポート用Excelには無い列なので、無ければ空文字/falseのまま。
          originCountry:       rawIng.originCountry || null,
          isAdditive:          rawIng.isAdditive ?? false,
          additiveReason:      rawIng.additiveReason || null,
          hideFromLabel:       rawIng.hideFromLabel ?? false,
          processLabel:        rawIng.processLabel || null,
        });
      }

      // 最重量食材にフラグ
      const gIngs = ingredientDetails.filter(i => i.unit === 'g' || i.unit === 'ml');
      if (gIngs.length > 0) {
        const maxIdx = ingredientDetails.indexOf(
          gIngs.reduce((a, b) => b.amount > a.amount ? b : a)
        );
        ingredientDetails[maxIdx].isPrimary = true;
      }

      const totalNutrition = sumNutrition(ingredientDetails.map(i => ({ nutrition: i.nutrition })));
      const totalCost = ingredientDetails.reduce((s, i) => s + (i.costTotal ?? 0), 0);

      // 上書きの場合は既存を論理削除
      // 2026-08修正: 以前は`isActive: true`の既存レシピしか論理削除の対象にしていなかった
      // ため、非表示レシピと同名で上書きインポートしても非表示レシピはそのまま残り、
      // 新しいレシピが別レコードとして重複作成されていた。idで直接指定することで、
      // 表示・非表示どちらの既存レシピも正しく置き換え対象にする。
      if (overwrite && exists) {
        await prisma.recipe.updateMany({
          where: { id: exists.id },
          data:  { isActive: false },
        });
      }

      // 2026-08新設: 新しいレシピの表示/非表示状態は次の優先順位で決める。
      // ① Excelの「FLG」列で明示的に「表示」「非表示」が指定されていればそれに従う
      // ② 指定が無く、既存の同名レシピ（表示・非表示問わず）を上書きする場合はその状態を引き継ぐ
      //    （非表示にしていた季節限定レシピ等が、更新のたびに勝手に表示状態へ戻らないようにする）
      // ③ どちらでもない（新規レシピ）場合は表示状態で作成する
      const newIsActive = pr.isActiveOverride ?? exists?.isActive ?? true;

      // レシピ作成
      await prisma.recipe.create({
        data: {
          userId:         session.user.id,
          categoryId,
          name,
          isActive:       newIsActive,
          nameKana:       pr.nameKana || null,
          unitCount:      pr.unitCount,
          shelfLifeDays:  pr.shelfLifeDays || null,
          salePrice:      pr.salePrice || null,
          totalCost:      totalCost || null,
          unitCost:       pr.unitCount > 0 ? (totalCost / pr.unitCount) || null : null,
          // 2026-08修正: パース済みなのにDB保存が漏れていた項目
          // （エクスポートには出るがインポートし直すと消えていた）
          barcode:         pr.barcode || null,
          variationName:   pr.variationName || null,
          moldType:        pr.moldType || null,
          contentAmount:   pr.contentAmount || null,
          wasteAmountG:    pr.wasteAmountG ?? null,
          shelfLifeType:   pr.shelfLifeType,
          storageMethod:   pr.storageMethod || null,
          notes:           pr.notes || null,
          qualityControl:  pr.qualityControl || null,
          printComment:    pr.printComment || null,
          energyKcal:     totalNutrition.energyKcal,
          protein:        totalNutrition.protein,
          fat:            totalNutrition.fat,
          carbohydrate:   totalNutrition.carbohydrate,
          sodium:         totalNutrition.sodium,
          saltEquivalent: totalNutrition.saltEquivalent,
          dietaryFiber:   totalNutrition.dietaryFiber,
          sugar:          totalNutrition.sugar,
          cholesterol:    totalNutrition.cholesterol,
          bakingConditions: pr.bakingConditions.length > 0
            ? JSON.stringify(pr.bakingConditions)
            : undefined,
          ingredients: {
            create: ingredientDetails.map(ing => ({
              ingredientId:        ing.ingredientId,
              amount:              ing.amount,
              unit:                ing.unit,
              displayOrder:        ing.displayOrder,
              sortByWeight:        ing.sortByWeight,
              costPrice:           ing.costPrice,
              costTotal:           ing.costTotal,
              allergenOverride:    ing.allergenOverride,
              isPrimaryIngredient: ing.isPrimary,
              nutritionUnconfirmed: ing.nutritionUnconfirmed,
              originCountry:       ing.originCountry,
              isAdditive:          ing.isAdditive,
              additiveReason:      ing.additiveReason,
              hideFromLabel:       ing.hideFromLabel,
              processLabel:        ing.processLabel,
              ...ing.nutrition,
            })),
          },
          steps: {
            create: pr.steps.map((instruction, idx) => ({
              stepNumber:  idx + 1,
              instruction,
            })),
          },
        },
      });

      imported++;
    } catch (err) {
      console.error(`Import error for ${pr.name}:`, err);
      importErrors.push({ row: pr.no, message: `「${pr.name}」の取り込みに失敗しました` });
    }
  }

  // インポート回数を記録（プレミアム/プロの月間回数カウント用）。一連の分割インポート
  // 操作につき1回だけカウントする（最初のチャンクでのみ）。
  if (isFirstChunk) {
    await logDataTransfer(session.user.id, 'import');
  }

  // 2026-08新設: 時間切れ安全マージンで打ち切った場合、このチャンクのスライス
  // （recipesToProcess）を全部処理し終えていない＝まだこのスライスの続きが残っている。
  const timeSafetyBreak = processedCount < recipesToProcess.length;
  const nextOffset = offset + processedCount;
  // プラン上限（レシピ件数）で打ち切られ、かつファイル内にまだ未処理の行が残っている場合、
  // このチャンク以降は続けても取り込めないため「打ち切り」として扱う。
  // （時間切れ打ち切りの場合は、プラン上限に達したわけではないので対象外）
  const planLimitReached = !timeSafetyBreak && importLimit <= remainingInFile && effectiveLimit === importLimit && nextOffset < parsedRecipes.length;
  const done = !timeSafetyBreak && (nextOffset >= parsedRecipes.length || planLimitReached);

  const chunkWarnings = isFirstChunk ? [...parseWarnings] : [];
  if (planLimitReached) {
    chunkWarnings.push({
      row: nextOffset + 1,
      message: `${planLabel}のレシピ上限（${importLimits.maxRecipes}件）に達したため、残り${parsedRecipes.length - nextOffset}件は取り込まれませんでした。プロプランならレシピ登録数は無制限です。`,
    });
  }
  const chunkErrors = isFirstChunk ? [...parseErrors, ...importErrors] : importErrors;

  return NextResponse.json({
    success:  true,
    data:     {
      imported, skipped,
      total:          parsedRecipes.length,
      processedSoFar: nextOffset,
      nextOffset,
      done,
      errors:   chunkErrors,
      warnings: chunkWarnings,
    },
    message:  `${imported}件のレシピを取り込みました${skipped > 0 ? `（${skipped}件スキップ）` : ''}`,
  });
}

// ============================================================
// GET /api/import-export/export - Excelエクスポート
// ============================================================
export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const limits = getPlanLimits(session.user.plan ?? 'free');
  if (!limits.canExport) {
    return NextResponse.json({
      success: false,
      error: 'Excelエクスポートはスタンダードプランの機能です。',
      upgradeRequired: true,
    }, { status: 403 });
  }
  // 2026-08: プロプランとの差別化のため、プレミアムは月間回数の上限を設ける
  if (limits.maxExportsPerMonth !== Infinity) {
    const monthlyExportCount = await getMonthlyDataTransferCount(session.user.id, 'export');
    if (monthlyExportCount >= limits.maxExportsPerMonth) {
      return NextResponse.json({
        success: false,
        error: `スタンダードプランのエクスポートは月${limits.maxExportsPerMonth}回までです（今月分はご利用済みです）。プロプランなら回数無制限でご利用いただけます。`,
        upgradeRequired: true,
      }, { status: 403 });
    }
  }

  const { searchParams } = new URL(request.url);
  const includeNutrition = searchParams.get('nutrition') !== 'false';
  const includeSteps     = searchParams.get('steps')     !== 'false';
  const includeCost      = searchParams.get('cost')      !== 'false';
  const categoryFilter   = searchParams.get('category')  ?? undefined;
  // 2026-08新設: 「非表示レシピと表示レシピの行をまとめて一括編集し、そのまま再インポート
  // したい」という要望に対応するため、デフォルトでは表示・非表示問わず全レシピを対象にする
  // （以前はisActive:trueのみが対象で、非表示レシピはエクスポートに一切含まれていなかった）。
  // 「表示レシピのみエクスポート」を選んだ場合のみ、従来通りisActive:trueだけに絞り込む。
  const visibleOnly = searchParams.get('visibleOnly') === 'true';

  const recipes = await prisma.recipe.findMany({
    where: {
      userId:   session.user.id,
      ...(visibleOnly ? { isActive: true } : {}),
      ...(categoryFilter ? { categoryId: categoryFilter } : {}),
    },
    include: {
      category:    { select: { name: true } },
      ingredients: {
        orderBy: [{ sortByWeight: 'desc' }, { displayOrder: 'asc' }],
        include: { ingredient: { select: { name: true, allergens: true } } },
      },
      steps: { orderBy: { stepNumber: 'asc' } },
    },
    // 非表示レシピを先頭にまとめることで、Excel上で「上から非表示◯行、表示◯行」のように
    // 分かれて見え、一括編集しやすくなる（isActive: false(0) < true(1) なのでasc順で非表示が先）。
    orderBy: [{ isActive: 'asc' }, { categoryId: 'asc' }, { name: 'asc' }],
  });

  const exportData = recipes.map(r => ({
    isActive:       r.isActive,
    name:           r.name,
    nameKana:       r.nameKana,
    variationName:  r.variationName ?? null,
    categoryName:   r.category?.name ?? null,
    barcode:        r.barcode ?? null,
    unitCount:      r.unitCount,
    moldType:       r.moldType ?? null,
    contentAmount:  r.contentAmount ?? null,
    wasteAmountG:   r.wasteAmountG  != null ? Number(r.wasteAmountG)  : null,
    wasteRatio:     r.wasteRatio    != null ? Number(r.wasteRatio)    : null,
    totalWeightG:   r.totalWeightG  != null ? Number(r.totalWeightG)  : null,
    totalCost:      r.totalCost     != null ? Number(r.totalCost)     : null,
    unitCost:       r.unitCost      != null ? Number(r.unitCost)      : null,
    salePrice:      r.salePrice    ? Number(r.salePrice)    : null,
    costRate:       r.costRate     ? Number(r.costRate)     : null,
    shelfLifeDays:  r.shelfLifeDays,
    shelfLifeType:  r.shelfLifeType,
    storageMethod:  r.storageMethod ?? null,
    ingredientsLabel: r.ingredients
      .map(i => i.ingredient?.name ?? i.ingredientNameOverride ?? '')
      .join('、'),
    notes:          r.notes,
    qualityControl: r.qualityControl ?? null,
    printComment:   r.printComment ?? null,
    energyKcal:     r.energyKcal     ? Number(r.energyKcal)     : null,
    protein:        r.protein        ? Number(r.protein)        : null,
    fat:            r.fat            ? Number(r.fat)            : null,
    carbohydrate:   r.carbohydrate   ? Number(r.carbohydrate)   : null,
    sugar:          r.sugar          != null ? Number(r.sugar)          : null,
    dietaryFiber:   r.dietaryFiber   != null ? Number(r.dietaryFiber)   : null,
    saltEquivalent: r.saltEquivalent  ? Number(r.saltEquivalent) : null,
    sodium:         r.sodium         != null ? Number(r.sodium)         : null,
    cholesterol:    r.cholesterol    != null ? Number(r.cholesterol)    : null,
    ingredients:    r.ingredients.map(i => ({
      ingredientName: i.ingredient?.name ?? i.ingredientNameOverride ?? '',
      amount:         Number(i.amount),
      unit:           i.unit,
      displayOrder:   i.displayOrder,
      costTotal:      i.costTotal ? Number(i.costTotal) : null,
      // 2026-08: 個人バックアップ用に追加（通常のインポート/エクスポートには不要だが、
      // 材料マスタ側の情報が失われないよう全項目バックアップとして出力する）
      originCountry:  i.originCountry ?? null,
      isAdditive:     i.isAdditive ?? false,
      additiveReason: i.additiveReason ?? null,
      hideFromLabel:  i.hideFromLabel ?? false,
      processLabel:   i.processLabel ?? null,
    })),
    steps: r.steps.map(s => s.instruction),
  }));

  const excelBuffer = exportRecipesToExcel(exportData, {
    includeNutrition,
    includeSteps,
    includeCost,
    categoryFilter,
  });

  // エクスポート回数を記録（プレミアム/プロの月間回数カウント用）
  await logDataTransfer(session.user.id, 'export');

  return new Response(Buffer.from(excelBuffer), {
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''foodlabel_export_${new Date().toISOString().slice(0, 10)}.xlsx`,
    },
  });
}
