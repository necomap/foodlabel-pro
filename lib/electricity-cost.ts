// ============================================================
// lib/electricity-cost.ts - 電気代目安計算（全プラン共通機能）
// ============================================================
// 2026-08新設。レシピの焼成条件（上火/下火・スチームON/OFF・時間）から、電気代の
// 「目安」を概算する。オーブンの機種によって実際の消費電力（kW）は大きく異なり、
// 上火・下火の設定温度と消費電力の関係も機種ごとにまちまちで正確な計算はできないため、
// あえて温度は計算に使わず、ユーザーが設定した「オーブン1台分の消費電力（固定値）」を
// 使用時間に掛けるだけのシンプルな概算にしている（正確さより手軽さを優先）。
//
// 設定（電力量単価・オーブン消費電力）はUser（アカウント単位・全プラン共通）に保存する。
// 詳細はapp/dashboard/settings/page.tsxのProfileTab、app/api/user/profile/route.ts参照。

import type { BakingStep } from '@/types';

export interface ElectricityCostSettings {
  electricityUnitPrice: number | null;  // 円/kWh
  ovenPowerKw:           number | null;  // オーブンの消費電力（kW）
  ovenSteamExtraKw?:      number | null;  // スチームON時に上乗せする消費電力（kW・任意）
}

export interface ElectricityCostEstimate {
  totalYen:    number;   // このレシピ1回分（unitCount個分）の目安電気代
  perUnitYen:  number | null;  // 1個あたりの目安電気代（unitCountで割ったもの）
  totalHours:  number;   // 使用した焼成時間の合計（時間）
}

/**
 * 焼成条件と電気代設定から、目安の電気代を概算する。
 * 設定（単価・消費電力）が未入力、または焼成時間が1つも入力されていない場合はnullを返す
 * （nullの場合はUI側で「未設定」の案内を表示し、0円とは表示しない）。
 */
export function calcElectricityCostEstimate(
  steps: BakingStep[] | null | undefined,
  settings: ElectricityCostSettings,
  unitCount: number | null | undefined,
): ElectricityCostEstimate | null {
  const unitPrice = settings.electricityUnitPrice;
  const ovenPowerKw = settings.ovenPowerKw;
  if (unitPrice == null || unitPrice <= 0 || ovenPowerKw == null || ovenPowerKw <= 0) return null;
  if (!steps || steps.length === 0) return null;

  const steamExtraKw = settings.ovenSteamExtraKw ?? 0;

  let totalHours = 0;
  let totalYen = 0;
  for (const step of steps) {
    const minutes = step.timeMin ?? 0;
    if (minutes <= 0) continue;
    const hours   = minutes / 60;
    const powerKw = ovenPowerKw + (step.steam === 'ON' ? steamExtraKw : 0);
    totalHours += hours;
    totalYen   += powerKw * hours * unitPrice;
  }
  if (totalHours <= 0) return null;

  totalYen = Math.round(totalYen);
  const cnt = unitCount && unitCount > 0 ? unitCount : null;
  const perUnitYen = cnt ? Math.round((totalYen / cnt) * 10) / 10 : null;

  return { totalYen, perUnitYen, totalHours: Math.round(totalHours * 100) / 100 };
}
