// ============================================================
// app/api/recipes/bulk-delete-hidden/route.ts
// 非表示レシピの一括完全削除API（2026-08新設）
// ============================================================
//
// 従来、レシピの「削除」ボタン（DELETE /api/recipes/[id]）は実際には論理削除
// （isActive: falseにするだけ）で、非表示にしているレシピを物理的に消す手段が無かった。
// 非表示にしただけで長期間使わないレシピ（間違えて登録した、廃番になった等）を
// 完全に消したいユーザーの要望に応え、非表示レシピをまとめて物理削除するAPIを追加する。
//
// 物理削除が安全に行えるのは、schema.prismaのLabel.recipeにonDelete: Cascadeを
// 追加した後（npx prisma db push実行後）。それより前にこのAPIが呼ばれた場合は、
// ラベル発行履歴があるレシピの削除時に外部キー制約エラーになる可能性があるため、
// 明示的にエラーメッセージを返す（無言で失敗させない）。
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function DELETE(_req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const hiddenCount = await prisma.recipe.count({
    where: { userId: session.user.id, isActive: false },
  });
  if (hiddenCount === 0) {
    return NextResponse.json({ success: true, data: { deleted: 0 }, message: '非表示レシピはありません' });
  }

  try {
    const result = await prisma.recipe.deleteMany({
      where: { userId: session.user.id, isActive: false },
    });
    return NextResponse.json({
      success: true,
      data:    { deleted: result.count },
      message: `${result.count}件の非表示レシピを完全に削除しました`,
    });
  } catch (e) {
    console.error('bulk-delete-hidden error:', e);
    // 2026-08: Label.recipeのonDelete: Cascade（schema.prisma）がまだ本番DBに
    // 反映されていない（npx prisma db push未実行）場合、ラベル発行履歴のある
    // レシピを削除しようとすると外部キー制約エラーになる。原因が分かるよう
    // 通常のエラーと文言を分ける。
    return NextResponse.json({
      success: false,
      error: '削除に失敗しました。データベースの更新（db push）が完了していない可能性があります。開発者にお問い合わせください。',
    }, { status: 500 });
  }
}
