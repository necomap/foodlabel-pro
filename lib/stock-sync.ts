// lib/stock-sync.ts - 印刷時の在庫自動差し引き連携（2026-09新設）
// ============================================================
// ラベル印刷（app/api/labels/generate/route.ts）の完了後に呼ばれる。
// ユーザーがHACCP連携（haccpStoreCode）を設定していればHACCP経由で、
// 設定していなければ在庫アプリ（Lucke Inventory）へ直接、印刷した分の
// 材料在庫を減算するリクエストを送る（HACCPと在庫アプリ、両方に連携している
// 場合はHACCP経由を優先し、在庫アプリへは直接アクセスしない。HACCP側の
// 既存の在庫アプリ連携がそのまま活きる形。ユーザー確認済みの仕様）。
//
// 通信の成否にかかわらず、この関数自体は絶対に例外を投げない
// （haccp-appのmodels/inventorySync.jsと同じ設計方針。呼び出し元の
// ラベル印刷処理自体を絶対に失敗させないため）。連携未設定の場合は
// 何もせず静かにスキップする（attempted:falseを返す）。

export interface StockSyncIngredient {
  name: string;
  amount: number; // レシピ1回分（unitCount個分）あたりの使用量
  unit: string;
}

export interface StockSyncResult {
  attempted: boolean;
  target: 'haccp' | 'inventory' | null;
  ok: boolean;
  error: string | null;
  details?: any;
}

async function fetchWithTimeout(url: string, options: any = {}, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function deductStockForPrint(
  user: { haccpStoreCode?: string | null; inventoryUserId?: string | null },
  params: {
    recipeName: string;
    printCount: number; // 今回印刷した枚数（＝製造した個数）
    unitCount: number;  // レシピの材料使用量が「何個分」の量なのか
    ingredients: StockSyncIngredient[];
  }
): Promise<StockSyncResult> {
  const haccpStoreCode = (user.haccpStoreCode || '').trim();
  const inventoryUserId = (user.inventoryUserId || '').trim();

  if (!haccpStoreCode && !inventoryUserId) {
    return { attempted: false, target: null, ok: false, error: null };
  }

  // 1個あたりの消費量 = レシピの材料使用量(1回分=unitCount個分) ÷ unitCount。
  // これに印刷枚数（＝製造個数）を掛けて、今回の印刷分の消費量を算出する
  // （app/api/labels/consumption/route.tsの集計レポートと同じ計算式に合わせている）。
  const unitCount = params.unitCount > 0 ? params.unitCount : 1;
  const scaledIngredients = params.ingredients
    .map((i) => ({ name: i.name, amount: (i.amount / unitCount) * params.printCount, unit: i.unit }))
    .filter((i) => i.name && i.amount > 0);

  if (haccpStoreCode) {
    const secret = process.env.FOODLABEL_SYNC_SECRET || '';
    if (!secret) {
      return { attempted: true, target: 'haccp', ok: false, error: 'FOODLABEL_SYNC_SECRETが設定されていません（サーバー環境変数）' };
    }
    try {
      const baseUrl = (process.env.HACCP_APP_URL || 'https://haccp.lucke.jp').replace(/\/+$/, '');
      const res = await fetchWithTimeout(`${baseUrl}/api/external/consume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-sync-secret': secret },
        body: JSON.stringify({
          storeCode: haccpStoreCode,
          recipeName: params.recipeName,
          printCount: params.printCount,
          ingredients: scaledIngredients,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json) {
        return { attempted: true, target: 'haccp', ok: false, error: `HACCPへの反映に失敗しました（HTTP ${res.status}）` };
      }
      return { attempted: true, target: 'haccp', ok: true, error: null, details: json };
    } catch (e: any) {
      return { attempted: true, target: 'haccp', ok: false, error: 'HACCPへの接続に失敗しました: ' + e.message };
    }
  }

  // haccpStoreCode未設定・inventoryUserIdのみ設定 → 在庫アプリへ直接まとめて1回で送る。
  const secret = process.env.INVENTORY_SYNC_SECRET || '';
  if (!secret) {
    return { attempted: true, target: 'inventory', ok: false, error: 'INVENTORY_SYNC_SECRETが設定されていません（サーバー環境変数）' };
  }
  try {
    const baseUrl = (process.env.INVENTORY_APP_URL || 'https://inventory.lucke.jp').replace(/\/+$/, '');
    const res = await fetchWithTimeout(`${baseUrl}/api/items/consume`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-sync-secret': secret },
      body: JSON.stringify({
        userId: inventoryUserId,
        items: scaledIngredients.map((i) => ({ name: i.name, amount: i.amount, unit: i.unit })),
        producedItemName: params.recipeName,
        producedQuantity: params.printCount,
      }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json) {
      return { attempted: true, target: 'inventory', ok: false, error: `在庫アプリへの反映に失敗しました（HTTP ${res.status}）` };
    }
    return { attempted: true, target: 'inventory', ok: true, error: null, details: json };
  } catch (e: any) {
    return { attempted: true, target: 'inventory', ok: false, error: '在庫アプリへの接続に失敗しました: ' + e.message };
  }
}
