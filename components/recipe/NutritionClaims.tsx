'use client';
// ============================================================
// components/recipe/NutritionClaims.tsx - 栄養強調表示の判定（目安）（2026-11新設・全プラン）
// ============================================================
// レシピ詳細画面に表示。判定ロジック・基準値の出典は lib/nutrition-claims.ts。
// 100g（100ml）あたりの量は、焼き上がり1個の重量が分かればそれを使い（1個あたり栄養成分 ÷ 重量）、
// 分からなければ材料の合計重量で割る（焼成による水分の減少は考慮できないので注意を出す）。
import { useMemo, useState } from 'react';
import { Award, CheckCircle2, XCircle, MinusCircle, Info, ChevronDown } from 'lucide-react';
import {
  judgeNutritionClaims, parseGramsFromContentAmount, CLAIM_KIND_LABEL, type Per100Values,
} from '@/lib/nutrition-claims';

type Nut = {
  energyKcal?: number | null; protein?: number | null; fat?: number | null;
  sodium?: number | null; saltEquivalent?: number | null; dietaryFiber?: number | null;
} | null | undefined;

interface Props {
  perUnit:       Nut;                 // 1個あたり（ラベルと同じ値）
  total:         Nut;                 // レシピ全体
  totalWeightG:  number | null;       // 材料の合計重量
  contentAmount: string | null;       // 内容量（「60g」等なら初期値に使う）
  unitCount:     number;
  hasUnconfirmedNutrition?: boolean;
}

const num = (v: unknown): number | null => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

function sodiumOf(n: Nut): number | null {
  if (!n) return null;
  const na = num(n.sodium);
  if (na != null) return na;
  const salt = num(n.saltEquivalent);
  return salt != null ? (salt * 1000) / 2.54 : null;
}

function scale(n: Nut, factor: number): Per100Values {
  const s = (v: unknown) => { const x = num(v); return x == null ? null : x * factor; };
  const na = sodiumOf(n);
  return {
    energyKcal:   s(n?.energyKcal),
    protein:      s(n?.protein),
    fat:          s(n?.fat),
    sodium:       na == null ? null : na * factor,
    dietaryFiber: s(n?.dietaryFiber),
  };
}

const r1 = (v: number | null, unit: string) =>
  v == null ? '—' : `${unit === 'mg' || unit === 'kcal' ? Math.round(v) : Math.round(v * 10) / 10}${unit}`;

export default function NutritionClaims({ perUnit, total, totalWeightG, contentAmount, unitCount, hasUnconfirmedNutrition }: Props) {
  const initialWeight = parseGramsFromContentAmount(contentAmount);
  const [weightInput, setWeightInput] = useState(initialWeight != null ? String(initialWeight) : '');
  const [liquid, setLiquid] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const pieceWeight = num(weightInput);
  const useFinished = pieceWeight != null && pieceWeight > 0;

  const per100 = useMemo<Per100Values | null>(() => {
    if (useFinished) return scale(perUnit, 100 / (pieceWeight as number));
    if (totalWeightG && totalWeightG > 0) return scale(total, 100 / totalWeightG);
    return null;
  }, [useFinished, pieceWeight, perUnit, total, totalWeightG]);

  const results = useMemo(() => (per100 ? judgeNutritionClaims(per100, liquid) : []), [per100, liquid]);
  const passed = results.filter(r => r.ok === true);
  // 同じ成分で「含まない旨」を満たすなら「低い旨」も当然満たすので、満たした中で一番強いものだけを主表示にする
  const headline = passed.filter(r =>
    !(r.kind === 'low' && passed.some(p => p.nutrient === r.nutrient && p.kind === 'free')) &&
    !(r.kind === 'source' && passed.some(p => p.nutrient === r.nutrient && p.kind === 'high')));
  const per = liquid ? '100ml' : '100g';

  return (
    <div className="card">
      <h2 className="section-title flex items-center gap-2">
        <Award className="w-5 h-5 text-emerald-600" />
        栄養強調表示の判定（目安）
      </h2>

      {/* 計算の前提 */}
      <div className="flex flex-col sm:flex-row sm:items-end gap-3 mb-3">
        <div>
          <label className="text-xs text-stone-500 block">
            焼き上がり{unitCount > 1 ? '1個' : ''}の重量{liquid ? '（ml）' : '（g）'}
          </label>
          <input type="number" inputMode="decimal" min="0" step="0.1" value={weightInput}
            onChange={e => setWeightInput(e.target.value)}
            className="field-input w-36" placeholder="例: 60" />
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-stone-700 cursor-pointer pb-2">
          <input type="checkbox" checked={liquid} onChange={e => setLiquid(e.target.checked)} />
          飲料など液状の食品（100mlあたりで判定）
        </label>
      </div>
      <p className="text-xs text-stone-500 mb-3">
        {useFinished
          ? `1個あたりの栄養成分を、上の重量で${per}あたりに換算して判定しています。`
          : totalWeightG
            ? `材料の合計重量（${totalWeightG}g）で${per}あたりに換算しています。焼成などで水分が抜ける分は考慮していないため、実際より低めの値になります。焼き上がりの重量を入れると正確になります。`
            : '材料の重量が分からないため判定できません。焼き上がりの重量を入力してください。'}
      </p>

      {hasUnconfirmedNutrition && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
          成分未確認の食材があるため、判定は参考になりません。食材マスタで成分を設定してください。
        </div>
      )}

      {per100 && (
        <>
          {/* 100gあたりの値 */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-600 bg-cream-50 rounded-lg px-3 py-2 mb-3">
            <span className="font-medium">{per}あたり：</span>
            <span>熱量 {r1(per100.energyKcal, 'kcal')}</span>
            <span>たんぱく質 {r1(per100.protein, 'g')}</span>
            <span>脂質 {r1(per100.fat, 'g')}</span>
            <span>食物繊維 {r1(per100.dietaryFiber, 'g')}</span>
            <span>ナトリウム {r1(per100.sodium, 'mg')}</span>
          </div>

          {/* 満たしている表示 */}
          {headline.length > 0 ? (
            <div className="space-y-2 mb-3">
              {headline.map(r => (
                <div key={`${r.nutrient}-${r.kind}`} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium text-stone-800">{r.nutrient}：{CLAIM_KIND_LABEL[r.kind]}</span>
                    <span className="text-stone-500">（{r.examples} など）</span>
                    <div className="text-xs text-stone-400">基準 {r.threshold}{r.basis ? `／${r.basis}` : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-stone-500 mb-3">基準を満たす強調表示はありません。</p>
          )}

          <button type="button" onClick={() => setShowAll(v => !v)}
            className="text-xs text-brand-700 inline-flex items-center gap-1 mb-2">
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAll ? 'rotate-180' : ''}`} />
            すべての判定結果を{showAll ? '閉じる' : '見る'}
          </button>
          {showAll && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-stone-500 border-b border-cream-200">
                    <th className="text-left py-1 pr-2">成分</th>
                    <th className="text-left py-1 pr-2">種類</th>
                    <th className="text-left py-1 pr-2">基準</th>
                    <th className="text-center py-1">判定</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map(r => (
                    <tr key={`${r.nutrient}-${r.kind}`} className="border-b border-cream-100">
                      <td className="py-1 pr-2 whitespace-nowrap">{r.nutrient}</td>
                      <td className="py-1 pr-2 whitespace-nowrap">{CLAIM_KIND_LABEL[r.kind]}</td>
                      <td className="py-1 pr-2">{r.threshold}</td>
                      <td className="py-1 text-center">
                        {r.ok === true  && <CheckCircle2 className="w-4 h-4 text-emerald-600 inline" />}
                        {r.ok === false && <XCircle className="w-4 h-4 text-stone-300 inline" />}
                        {r.ok === null  && <MinusCircle className="w-4 h-4 text-stone-300 inline" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <div className="text-xs text-stone-500 flex gap-2 mt-3 pt-3 border-t border-cream-100">
        <Info className="w-4 h-4 flex-shrink-0" />
        <div className="space-y-1">
          <p>
            食品表示基準（別表第12・第13）の数値基準と、成分表をもとにした推定値で判定した目安です。
            実際に強調表示をする場合は、分析値などの根拠資料を用意し、許容差の範囲に収まることを確認してください。
          </p>
          <p>
            「〇〇30%カット」「減塩」「2倍」などの相対表示は、比較対象の食品名と低減量（割合）の明記、25%以上の差などが必要なため、ここでは判定しません。
            飽和脂肪酸・コレステロール・糖類・ビタミン・ミネラルも判定対象外です（このアプリの「糖質」は糖類とは異なります）。
          </p>
        </div>
      </div>
    </div>
  );
}
