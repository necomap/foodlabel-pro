// ============================================================
// app/api/recipes/samples/route.ts - サンプルレシピ（2026-09-30新設）
// GET  : サンプル一覧（ジャンル・材料・取り込み済みか）と、あと何件取り込めるか
// POST : { keys: string[] } を自分のレシピとして取り込む
// ============================================================
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { SAMPLE_RECIPES, SAMPLE_INGREDIENTS, SAMPLE_GENRES } from '@/lib/sample-recipes';
import { getImportedSampleKeys, getRemainingRecipeSlots, importSampleRecipes } from '@/lib/sample-import';

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const plan = (session.user as any).plan ?? 'free';
  const [imported, remaining] = await Promise.all([
    getImportedSampleKeys(session.user.id),
    getRemainingRecipeSlots(session.user.id, plan),
  ]);

  return NextResponse.json({
    success: true,
    data: {
      genres: SAMPLE_GENRES,
      remaining: remaining === Infinity ? null : remaining,
      samples: SAMPLE_RECIPES.map(r => ({
        key:         r.key,
        genre:       r.genre,
        name:        r.name,
        unitCount:   r.unitCount,
        contentAmount: r.contentAmount,
        ingredients: r.ingredients.map(i => SAMPLE_INGREDIENTS[i.ing].labelName),
        imported:    imported.has(r.key),
      })),
    },
  });
}

const postSchema = z.object({ keys: z.array(z.string()).min(1, 'サンプルを選んでください').max(SAMPLE_RECIPES.length) });

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const parsed = postSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.errors[0].message }, { status: 400 });
  }

  try {
    const plan = (session.user as any).plan ?? 'free';
    const result = await importSampleRecipes(session.user.id, plan, parsed.data.keys);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error('sample import error:', err);
    return NextResponse.json({ success: false, error: 'サンプルの取り込み中にエラーが発生しました' }, { status: 500 });
  }
}
