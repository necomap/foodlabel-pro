// ============================================================
// lib/label-settings.ts - ラベル印刷画面で最後に使った印刷設定を読み出す（ブラウザ専用）
// ============================================================
// 2026-11 まとめてラベル印刷用に新設。ラベル印刷画面（app/dashboard/labels/page.tsx）は
// 設定を localStorage の 'label_<キー>' に保存している。まとめて印刷画面では同じキーから読み出し、
// /api/labels/generate-batch に送る共通設定（レシピ・枚数・期限以外）を組み立てる。
// 既定値はラベル印刷画面の useState の初期値と同じにしている（画面側の既定値を変えたらこちらも合わせる）。
// ============================================================

export interface StoredLabelSettings {
  /** generate-batch にそのまま送る共通設定 */
  payload: Record<string, unknown>;
  /** 画面に表示する要約 */
  summary: string[];
  deviceType: 'LABEL_PRINTER' | 'A4_PRINTER';
  fontSizePt: number;
  /** 法令上の文字サイズ下限（表示可能面積から判定。ラベル印刷画面と同じ計算） */
  legalMinFontPt: number;
  /** 一度もラベル印刷画面で設定していない（既定値のまま）なら false */
  hasSaved: boolean;
}

const FONT_LABELS: Record<string, string> = {
  'noto-sans-jp': 'Noto Sans JP', 'yu-gothic': '游ゴシック', 'hiragino-kaku-gothic': 'ヒラギノ角ゴ', 'meiryo': 'メイリオ',
};

export function loadStoredLabelSettings(): StoredLabelSettings {
  const getL = (k: string): string | null => {
    try { return localStorage.getItem('label_' + k); } catch { return null; }
  };
  const str = (k: string, def: string) => getL(k) || def;
  const bool = (k: string, def: boolean) => { const v = getL(k); return v !== null ? v === 'true' : def; };
  const num = (k: string, def: number) => { const v = parseFloat(getL(k) ?? ''); return Number.isFinite(v) ? v : def; };
  const optNum = (k: string) => { const v = parseFloat(getL(k) ?? ''); return Number.isFinite(v) && v > 0 ? v : undefined; };
  const json = <T,>(k: string, def: T): T => { try { const v = getL(k); return v ? JSON.parse(v) as T : def; } catch { return def; } };

  const deviceType: 'LABEL_PRINTER' | 'A4_PRINTER' = getL('deviceType') === 'A4_PRINTER' ? 'A4_PRINTER' : 'LABEL_PRINTER';
  const fontSizePt = num('fontSizePt', 8);
  const fontFamily = str('fontFamily', 'noto-sans-jp');
  const language: 'ja' | 'en' = getL('language') === 'en' ? 'en' : 'ja';
  const labelW = num('labelW', 60);
  const labelH = num('labelH', 60);
  const labelHeightAuto = bool('labelHeightAuto', false);
  const a4Cols = Math.max(1, Math.round(num('a4Cols', 3)));
  const a4Rows = Math.max(1, Math.round(num('a4Rows', 5)));
  const startPosition = Math.max(1, Math.round(num('startPos', 1)));
  const recycleMarks = json<string[]>('recycleMarks', []);
  const recycleMarkRoles = json<Record<string, string>>('recycleMarkRoles', {});
  const packageWidthMm = optNum('packageWidthMm');
  const packageHeightMm = optNum('packageHeightMm');
  const showNutrition = bool('showNutrition', true);

  const payload: Record<string, unknown> = {
    shopId: getL('shopId') || undefined,
    fontSizePt,
    fontFamily,
    deviceType,
    ...(deviceType === 'LABEL_PRINTER' ? {
      labelWidthMm:  labelW,
      labelHeightMm: labelH,
      labelHeightAuto,
      labelPaddingTopMm:    num('labelPaddingTopMm', 3),
      labelPaddingBottomMm: num('labelPaddingBottomMm', 2),
      labelPaddingLeftMm:   num('labelPaddingLeftMm', 2),
      labelPaddingRightMm:  num('labelPaddingRightMm', 2),
    } : {
      a4Cols, a4Rows,
      marginTopMm:    num('marginT', 0),
      marginBottomMm: num('marginB', 0),
      marginLeftMm:   num('marginL', 10),
      marginRightMm:  num('marginR', 0),
      startPosition,
      a4SealWidthMm:  optNum('a4SealW'),
      a4SealHeightMm: optNum('a4SealH'),
      a4ColGapMm:     optNum('a4ColGap'),
      a4RowGapMm:     optNum('a4RowGap'),
    }),
    language,
    displaySettings: {
      showPostalCode:     bool('showPostalCode', true),
      showPhone:          bool('showPhone', true),
      showRepresentative: bool('showRep', false),
      showEmail:          false,
      showNutrition,
      showDietaryFiber:   bool('showFiber', true),
      applyZeroRule:      bool('applyZeroRule', true),
      showSugar:          bool('showSugar', true),
      showCholesterol:    bool('showCholest', false),
      showQualityControl: bool('showQC', true),
      showComment:        bool('showComment', true),
      nutritionNote:      '※推定値',
    },
    logoHeightMm:    Math.round(num('logoHeightMm', 8)),
    qrSizeMm:        Math.round(num('qrSizeMm', 6)),
    showLogo:        getL('showLogo') !== 'false',
    showQr:          getL('showQr') !== 'false',
    showBarcode:     getL('showBarcode') !== 'false',
    barcodeHeightMm: Math.round(num('barcodeHeightMm', 7)),
    recycleMarks:    recycleMarks.map(key => ({ key, role: recycleMarkRoles[key]?.trim() || undefined })),
    recycleMarkHeightMm: num('recycleMarkHeightMm', 8),
    showBarcodeText: getL('showBarcodeText') !== 'false',
    packageWidthMm,
    packageHeightMm,
  };

  // 法令上の文字サイズ下限（ラベル印刷画面の computeLegalMinFontPt と同じ）
  const areaCm2 = (packageWidthMm && packageHeightMm)
    ? (packageWidthMm / 10) * (packageHeightMm / 10)
    : (labelW / 10) * (labelH / 10);
  const legalMinFontPt = areaCm2 > 150 ? 8 : 5.5;

  const summary: string[] = [];
  if (deviceType === 'LABEL_PRINTER') {
    summary.push(`ラベルプリンター ${labelW}×${labelHeightAuto ? '長さ自動' : labelH + 'mm'}`);
  } else {
    const sw = optNum('a4SealW'), sh = optNum('a4SealH');
    summary.push(`A4シール ${a4Cols}列×${a4Rows}行${sw && sh ? `（${sw}×${sh}mm）` : ''}・開始位置 ${startPosition}`);
  }
  summary.push(`文字 ${fontSizePt}pt・${FONT_LABELS[fontFamily] ?? fontFamily}`);
  summary.push(language === 'en' ? '英語の補助ラベル' : '日本語ラベル');
  if (!showNutrition) summary.push('栄養成分表示なし');

  return { payload, summary, deviceType, fontSizePt, legalMinFontPt, hasSaved: getL('deviceType') !== null };
}
