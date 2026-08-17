// ============================================================
// lib/ingredient-similarity.ts
// 食材名の「似ている度合い」を判定するための共通ユーティリティ。
// - 重複食材の統合ツール（app/api/ingredients/merge/route.ts）
// - 新規登録時の類似食材チェック（app/api/ingredients/route.ts のPOST）
// の両方から使う。
// ============================================================

/**
 * 食材名を比較用に正規化する。
 * 全角/半角の英数字・記号、半角カタカナ/全角カタカナの表記ゆれは String.prototype.normalize('NFKC') で吸収し、
 * さらに前後・内部の空白（全角スペース含む）を除去、ひらがなをカタカナに寄せ、大文字/小文字を統一する。
 * 「小麦粉」「こむぎこ」のようなひらがな/カタカナ表記ゆれと「小麦粉 」「ｺﾑｷﾞｺ」のような
 * 全角半角・空白の表記ゆれの両方を同じ文字列に正規化できるようにするのが目的。
 */
export function normalizeIngredientName(name: string): string {
  let s = (name ?? '').normalize('NFKC');
  s = s.replace(/[\s　]+/g, '');
  s = s.toLowerCase();
  // ひらがな→カタカナ（U+3041-U+3096をU+30A1-U+30F6へシフト）
  s = s.replace(/[ぁ-ゖ]/g, ch => String.fromCharCode(ch.charCodeAt(0) + 0x60));
  return s;
}

/**
 * レーベンシュタイン距離（編集距離）。2つの文字列を一致させるのに必要な
 * 挿入・削除・置換の最小回数。短い食材名同士の比較に使うため、
 * 素朴なDP実装で十分な速度が出る。
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,      // 削除
        curr[j - 1] + 1,  // 挿入
        prev[j - 1] + cost // 置換
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/**
 * 正規化済みの2つの名前が「似ている（表記ゆれの可能性が高い）」かどうかを判定する。
 * - 完全一致（正規化後）は常に似ているとみなす
 * - 2文字以下の短い名前は誤検出（「塩」と「油」のような無関係な短い名前同士が近くなりやすい）が
 *   多いため、完全一致以外は対象外にする
 * - それ以外は編集距離が「長い方の文字数の20%以内（最大2文字まで）」なら似ているとみなす
 */
export function isSimilarName(normA: string, normB: string): boolean {
  if (!normA || !normB) return false;
  if (normA === normB) return true;
  if (normA.length <= 2 || normB.length <= 2) return false;
  const dist = levenshteinDistance(normA, normB);
  const threshold = Math.min(2, Math.floor(Math.max(normA.length, normB.length) * 0.2));
  return dist > 0 && dist <= threshold;
}
