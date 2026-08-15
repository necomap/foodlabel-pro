// ============================================================
// lib/label.ts - ラベル内容生成ロジック
// ============================================================

import { addDays, format } from 'date-fns';
import { ja } from 'date-fns/locale';
import type { LabelContent, LabelConfig, RecipeDetail } from '@/types';
import { buildIngredientsLabel, collectRecipeAllergens } from './allergen';
import { calcPerUnit, roundForDisplay } from './nutrition';

/**
 * レシピと設定からラベル内容を生成する
 */
export function generateLabelContent(
  recipe: RecipeDetail,
  config: LabelConfig,
  shopInfo: {
    shopName:       string;
    companyName?:   string;
    postalCode?:    string;
    address?:       string;
    phone?:         string;
    representative?: string;
    qrUrl?:         string | null;
    logoUrl?:       string | null;
    logoHeightMm?:  number;
    qrSizeMm?:      number;
    email?:         string;
    showPhone:      boolean;
    showRepresentative: boolean;
    showEmail:      boolean;
  }
): LabelContent {
  // 賞味期限計算
  const manufactureDate = new Date(config.manufactureDate);
  const shelfLifeDays = config.shelfLifeDays ?? recipe.shelfLifeDays ?? 0;
  const expiryDate = shelfLifeDays > 0
    ? addDays(manufactureDate, shelfLifeDays)
    : manufactureDate;
  const expiryDateStr = format(expiryDate, 'yyyy.MM.dd', { locale: ja });
  const expiryType = recipe.shelfLifeType === 'BEST_BEFORE' ? '賞味期限' : '消費期限';

  // アレルゲン集約
  const allergenInfo = collectRecipeAllergens(
    recipe.ingredients.map(ing => ({
      allergens:        ing.allergenOverride?.length ? [] : (ing as any).allergens ?? [],
      allergenOverride: ing.allergenOverride ?? [],
      ingredientName:   ing.ingredientName,
    }))
  );

  // 原材料表示（重量順ソート済み前提）
  const sortedIngredients = [...recipe.ingredients].sort((a, b) => {
    if (a.sortByWeight && a.unit === 'g' && b.unit === 'g') {
      return b.amount - a.amount;
    }
    return (a.displayOrder ?? 0) - (b.displayOrder ?? 0);
  });

  const ingredientsText = buildIngredientsLabel(
    sortedIngredients.map(i => ({
      ingredientName: i.ingredientName,
      amount: i.amount,
      unit: i.unit,
      originCountry: i.originCountry ?? undefined,
      isAdditive: (i as any).isAdditive ?? false,
      additiveReason: (i as any).additiveReason ?? undefined,
    })),
    allergenInfo.all
  );

  // 栄養成分（1個あたり）
  const totalNutrition = recipe.nutrition;
  const perUnit = roundForDisplay(
    calcPerUnit(totalNutrition, recipe.unitCount, Number((recipe as any).wasteRatio ?? 0))
  );

  // 未確認成分の警告
  const warnings = recipe.ingredients
    .filter(i => i.nutritionUnconfirmed)
    .map(i => `「${i.ingredientName}」の成分情報が未確認です`);

  // 製造者情報
  const manufacturerName = shopInfo.companyName ?? shopInfo.shopName;
  const { displaySettings } = config;

  return {
    productName:     recipe.name,
    categoryName:    recipe.categoryName ?? '',
    ingredientsText,
    contentAmount:   recipe.contentAmount ?? `1個`,
    expiryDate:      expiryDateStr,
    expiryType,
    storageMethod:   recipe.storageMethod ?? '直射日光・高温多湿を避けて保存してください。',
    manufacturerName,
    qrUrl:       shopInfo.qrUrl ?? null,
    logoUrl:     shopInfo.logoUrl ?? null,
    logoHeightMm: shopInfo.logoHeightMm ?? 8,
    qrSizeMm:    shopInfo.qrSizeMm ?? 6,
    postalCode:      displaySettings.showPostalCode !== false && shopInfo.postalCode 
                       ? `〒${shopInfo.postalCode}` 
                       : '',
    address:         shopInfo.address ?? '',
    phone:           displaySettings.showPhone
                       ? shopInfo.phone ?? undefined
                       : undefined,
    representative:  displaySettings.showRepresentative
                       ? shopInfo.representative ?? undefined
                       : undefined,
    email:           displaySettings.showEmail && shopInfo.showEmail
                       ? shopInfo.email ?? undefined
                       : undefined,
    qualityControl:  displaySettings.showQualityControl
                       ? recipe.qualityControl ?? undefined
                       : undefined,
    comment:         displaySettings.showComment
                       ? recipe.printComment ?? undefined
                       : undefined,
    nutritionPerUnit: {
      label:          `${recipe.contentAmount ?? '1個'}あたり`,
      energyKcal:     perUnit.energyKcal ?? 0,
      protein:        perUnit.protein ?? 0,
      fat:            perUnit.fat ?? 0,
      carbohydrate:   perUnit.carbohydrate ?? 0,
      saltEquivalent: perUnit.saltEquivalent ?? 0,
      dietaryFiber:   displaySettings.showDietaryFiber
                        ? perUnit.dietaryFiber ?? undefined
                        : undefined,
      sugar:          displaySettings.showSugar
                        ? perUnit.sugar ?? undefined
                        : undefined,
      cholesterol:    displaySettings.showCholesterol
                        ? perUnit.cholesterol ?? undefined
                        : undefined,
    },
    isEstimated: true,  // 推定値として表示
    warnings,
    barcode:         recipe.barcode ?? undefined,
    showBarcode:     (recipe as any).showBarcode !== false,
    showBarcodeText: (recipe as any).showBarcodeText !== false,
    barcodeHeightMm: (recipe as any).barcodeHeightMm ?? 7,
    barcodeHeightPx: 300,  // 高解像度で取得してCSSでリサイズ
    ...( { recycleMarks: (recipe as any).recycleMarks ?? [] } as any ),
  };
}

/**
 * ラベルHTMLを生成する（印刷用）
 * @param content - ラベル内容
 * @param config - 印刷設定
 * @param count - 枚数（A4の場合はページ全体）
 */

/** JAN-13のチェックデジットを検証 */
function isValidJan13(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false;
  const digits = code.split('').map(Number);
  const sum = digits.slice(0, 12).reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 1 : 3), 0);
  const check = (10 - (sum % 10)) % 10;
  return check === digits[12];
}

/** バーコードの種類を自動判定してAPIのパスを返す */
function getBarcodeApiPath(code: string): string {
  if (isValidJan13(code)) return 'ean13';
  if (/^\d{8}$/.test(code) || /^\d{12}$/.test(code)) return 'code128';
  return 'code128';
}

// 識別マーク（リサイクルマーク）
// plastic/paper/pet/board/steel/aluminum は公式マークの実データをトレースしたSVGパス（2026-08 差し替え）。
// board（段ボール）は法定必須ではない任意表示だが、多くの事業者が併記するため選択肢に追加。
type RecycleMarkDef =
  { kind: 'svg'; viewBox: string; transform: string; paths: string[]; caption?: string };

const RECYCLE_MARK_DEFS: Record<string, RecycleMarkDef> = {
  plastic: {
    kind: 'svg',
    viewBox: '0 0 2500 2500',
    transform: 'translate(0.000000,2500.000000) scale(0.100000,-0.100000)',
    paths: [
      'M6305 23179 c-980 -58 -1697 -351 -2485 -1012 -287 -242 -591 -548 -788 -795 -475 -597 -772 -1301 -881 -2092 -41 -300 -43 -365 -44 -2102 l-2 -1678 1387 0 1388 0 3 1758 c3 1958 -3 1781 72 2008 151 454 523 826 1010 1009 125 47 324 97 480 121 116 18 323 19 6120 19 5725 0 6006 -1 6120 -18 285 -43 537 -117 749 -221 493 -241 830 -628 1002 -1153 45 -137 96 -368 112 -505 l8 -78 -984 0 c-575 0 -982 -4 -980 -9 5 -15 3162 -3661 3170 -3661 4 0 673 807 1487 1793 l1481 1792 -840 3 -840 2 0 100 c0 201 -45 589 -101 880 -216 1114 -720 2074 -1423 2711 -640 580 -1430 936 -2377 1074 -449 64 139 59 -6599 61 -3358 1 -6168 -3 -6245 -7z',
      'M12380 17714 c-149 -13 -314 -41 -445 -74 -690 -175 -1275 -650 -1585 -1285 -113 -230 -175 -423 -221 -680 -27 -154 -37 -471 -20 -641 27 -259 108 -556 211 -771 l49 -103 -1380 0 -1379 0 0 -780 0 -780 2261 0 2261 0 -6 -117 c-49 -827 -262 -1525 -636 -2083 -165 -245 -432 -537 -655 -714 -350 -278 -734 -482 -1195 -636 -522 -174 -1073 -260 -1672 -260 l-238 0 0 -741 0 -741 98 6 c1603 111 2864 523 3826 1249 338 256 664 582 918 922 557 745 904 1688 1012 2750 24 236 36 454 36 661 l0 192 96 52 c568 306 1007 860 1179 1486 57 207 76 345 82 581 9 329 -22 547 -118 839 -214 651 -709 1193 -1340 1467 -295 129 -593 194 -924 201 -93 2 -190 2 -215 0z m270 -1404 c357 -41 649 -251 800 -573 53 -114 81 -230 87 -363 14 -300 -89 -560 -303 -764 -133 -127 -264 -200 -443 -247 -134 -36 -344 -38 -473 -4 -370 95 -639 359 -733 717 -117 449 103 931 520 1134 184 90 356 122 545 100z',
      'M3032 13984 c-131 -159 -805 -971 -1496 -1804 l-1256 -1515 840 -3 839 -2 4 -2168 c2 -1986 4 -2179 20 -2312 28 -228 56 -412 88 -580 203 -1044 643 -1918 1284 -2555 639 -634 1485 -1032 2507 -1180 448 -64 -130 -59 6538 -63 6149 -3 6279 -3 6600 34 942 105 1665 470 2510 1267 504 474 860 988 1093 1577 178 451 271 887 307 1445 8 114 9 343 4 698 -7 527 -7 527 -28 527 -362 9 -2733 36 -2738 31 -4 -3 -9 -321 -11 -706 -3 -624 -5 -708 -21 -775 -177 -755 -799 -1244 -1676 -1320 -74 -6 -2303 -10 -6215 -10 -5595 -1 -6109 0 -6205 15 -533 83 -944 322 -1194 695 -181 269 -279 596 -306 1015 -6 99 -10 958 -10 2262 l0 2103 949 2 949 3 -1540 1770 c-847 974 -1552 1785 -1568 1804 l-28 33 -240 -288z',
      'M15390 13440 l0 -720 3150 0 3150 0 0 720 0 720 -3150 0 -3150 0 0 -720z',
      'M15410 11150 l0 -730 2165 -2 2165 -3 -68 -85 c-482 -599 -1199 -1052 -2088 -1320 -581 -176 -1167 -268 -1829 -288 l-220 -7 -3 -712 -2 -713 53 0 c81 0 463 37 736 71 2632 328 4415 1414 5129 3124 175 418 292 942 292 1308 l0 87 -3165 0 -3165 0 0 -730z'
    ],
  },
  paper: {
    kind: 'svg',
    viewBox: '0 0 2500 2500',
    transform: 'translate(0.000000,2500.000000) scale(0.100000,-0.100000)',
    paths: [
      'M14560 24529 c-2055 -116 -4106 -758 -6050 -1894 -1776 -1038 -3442 -2512 -4654 -4115 -47 -63 -85 -118 -84 -122 4 -9 1738 -1722 1747 -1726 4 -1 57 64 117 145 227 307 563 715 858 1043 171 190 761 780 951 951 1145 1032 2360 1816 3690 2384 2277 972 4645 1146 6560 485 893 -309 1714 -815 2324 -1433 l84 -85 -19 -24 c-10 -13 -419 -437 -909 -942 -489 -505 -891 -922 -893 -927 -2 -5 1070 -9 2542 -9 l2546 0 0 128 c0 70 11 1263 25 2651 14 1389 23 2526 22 2528 -6 5 -330 -327 -1593 -1636 l-32 -34 -139 130 c-1383 1306 -3079 2121 -5008 2407 -204 30 -480 61 -745 82 -229 18 -1097 27 -1340 13z',
      'M8511 18483 c-146 -313 -398 -797 -629 -1208 -138 -246 -383 -668 -396 -682 -8 -10 -51 23 -179 138 -93 83 -170 149 -171 148 -2 -2 -152 -242 -335 -533 l-331 -528 47 -42 c574 -499 1062 -965 1312 -1251 145 -165 321 -385 321 -399 -1 -6 -160 -240 -353 -521 l-353 -510 -99 -8 c-55 -4 -277 -9 -492 -10 -392 -2 -393 -2 -393 -23 0 -12 16 -267 35 -568 19 -301 35 -554 35 -562 0 -18 73 -18 390 1 391 24 1495 107 1603 121 l47 6 0 -2721 0 -2721 570 0 570 0 0 2770 0 2769 33 5 c17 3 100 12 182 21 247 26 450 53 629 86 92 16 170 28 173 26 2 -3 36 -119 74 -258 39 -140 72 -255 73 -257 2 -2 243 86 535 194 384 142 531 201 531 212 0 34 -187 608 -290 892 -168 461 -318 821 -557 1342 l-95 206 -505 -204 c-279 -112 -508 -206 -511 -209 -7 -7 31 -103 200 -499 81 -192 148 -354 148 -361 0 -18 -375 -61 -1009 -115 -195 -16 -367 -30 -382 -30 -28 0 -25 5 84 153 492 662 1309 1872 1759 2603 238 386 507 867 491 877 -19 12 -1090 460 -1108 464 -18 4 -27 -11 -69 -109 -100 -233 -286 -578 -494 -918 -167 -272 -686 -1049 -712 -1065 -4 -2 -82 78 -173 178 -91 100 -214 233 -274 296 l-109 115 95 150 c143 230 691 1143 943 1576 306 525 403 700 392 709 -10 8 -1149 431 -1163 431 -4 0 -45 -80 -90 -177z',
      'M16965 18539 c-672 -205 -1708 -408 -2750 -538 -690 -87 -1313 -140 -2067 -177 l-138 -6 0 -4823 0 -4822 -347 -57 c-192 -31 -390 -63 -441 -70 -51 -7 -96 -16 -99 -20 -4 -3 32 -301 78 -662 l84 -656 70 7 c518 49 2496 506 3295 761 96 31 179 60 184 65 10 9 -103 1231 -115 1250 -3 6 -20 3 -40 -5 -68 -28 -337 -108 -544 -161 -172 -45 -855 -205 -871 -205 -2 0 -4 1046 -4 2325 l0 2325 715 0 715 0 4 -22 c3 -13 8 -84 11 -158 15 -346 66 -1028 110 -1480 213 -2161 613 -3659 1158 -4329 185 -227 395 -371 611 -418 84 -18 264 -20 356 -4 318 57 564 255 748 601 171 322 293 779 381 1435 28 203 81 682 81 725 l0 36 -542 242 c-298 133 -544 240 -546 238 -2 -3 -10 -60 -18 -128 -76 -670 -184 -1127 -289 -1230 -61 -61 -117 -26 -185 116 -196 412 -414 1618 -544 3021 -46 490 -96 1169 -96 1296 l0 59 1058 2 1057 3 0 630 0 630 -1091 3 -1091 2 -6 348 c-4 191 -10 789 -14 1330 l-6 982 25 0 c77 0 773 130 1153 216 224 50 767 183 773 189 5 4 -651 1185 -658 1184 -3 -1 -77 -23 -165 -50z m-2349 -2581 c-1 -480 3 -1041 7 -1245 l8 -373 -686 0 -685 0 0 1185 0 1184 33 5 c17 3 119 12 224 21 106 9 369 31 585 50 216 19 416 36 443 38 28 2 55 4 61 5 7 1 10 -262 10 -870z',
      'M3478 17993 c-192 -264 -561 -865 -796 -1294 l-42 -77 891 -866 c490 -476 895 -866 899 -866 5 0 50 80 101 178 165 316 373 673 607 1035 l115 179 -225 226 c-123 125 -515 521 -870 880 l-645 654 -35 -49z',
      'M21613 17085 c10 -33 56 -250 82 -385 43 -227 88 -568 110 -822 l7 -77 1180 -1166 c650 -641 1182 -1164 1184 -1162 12 12 69 609 80 845 l7 144 -599 600 c-1015 1016 -2057 2044 -2051 2023z',
      'M2281 16123 c-239 -480 -571 -1231 -559 -1263 2 -4 437 -432 967 -950 l964 -942 97 284 c115 336 227 630 344 898 l84 195 -924 923 c-508 507 -927 922 -932 922 -4 0 -23 -30 -41 -67z',
      'M21781 14102 c-29 -280 -97 -710 -160 -1012 l-20 -95 212 -215 c967 -979 1798 -1809 1802 -1798 40 113 186 663 250 942 l46 199 -1003 996 c-552 548 -1028 1020 -1059 1049 l-56 52 -12 -118z',
      'M1373 13947 c-73 -244 -153 -543 -208 -777 l-54 -224 1047 -1051 c576 -577 1050 -1051 1055 -1053 4 -2 7 4 7 12 0 34 61 489 85 635 14 85 43 244 65 352 22 109 40 205 40 214 0 15 -1974 2035 -1989 2035 -3 0 -25 -64 -48 -143z',
      'M21277 11812 c-117 -355 -263 -736 -410 -1074 l-17 -36 930 -914 c511 -502 934 -914 938 -916 9 -3 195 382 339 703 118 262 255 603 251 625 -3 14 -1925 1880 -1938 1880 -3 0 -45 -121 -93 -268z',
      'M812 11408 c-34 -301 -52 -521 -55 -670 l-2 -136 1309 -1321 c720 -727 1311 -1319 1313 -1317 3 2 -9 66 -26 143 -61 279 -125 714 -151 1023 l-10 125 -1173 1173 c-644 644 -1175 1172 -1178 1172 -3 0 -15 -87 -27 -192z',
      'M10568 11210 c-269 -69 -490 -128 -491 -131 -2 -2 18 -83 44 -179 193 -702 314 -1377 390 -2182 14 -148 27 -238 33 -238 25 0 1082 223 1089 230 21 19 -260 1392 -418 2045 -56 231 -142 552 -153 571 -5 8 -159 -28 -494 -116z',
      'M7036 10978 c-96 -1283 -269 -2421 -447 -2941 -23 -65 -38 -121 -35 -124 3 -4 259 -97 569 -209 379 -136 564 -198 568 -190 11 20 77 288 113 456 149 701 268 1861 293 2842 l6 266 -34 6 c-19 4 -236 31 -484 61 -247 30 -468 57 -491 60 l-40 6 -18 -233z',
      'M20510 9993 c-177 -341 -407 -738 -622 -1072 l-100 -154 874 -874 c480 -480 875 -873 878 -873 9 1 270 400 412 630 169 275 452 776 446 790 -2 3 -361 350 -798 769 -437 420 -841 809 -896 863 l-101 100 -93 -179z',
      'M19497 8348 c-13 -18 -64 -87 -112 -153 -589 -802 -1349 -1617 -2139 -2294 -1287 -1103 -2749 -1942 -4261 -2447 -1776 -592 -3554 -700 -5097 -308 -1002 254 -1895 718 -2613 1355 -60 54 -157 144 -213 202 l-104 104 909 949 909 949 -255 3 c-330 3 -4830 -24 -4835 -29 -4 -5 -25 -5303 -21 -5307 1 -2 361 372 799 830 438 458 803 837 811 842 10 8 41 -16 122 -95 432 -417 1018 -861 1573 -1191 1320 -786 2795 -1219 4429 -1299 272 -13 983 -7 1216 11 419 31 810 77 1158 135 2550 425 5052 1656 7202 3541 289 254 428 385 801 758 370 371 548 561 809 866 259 302 696 860 694 884 -1 6 -218 222 -483 480 -264 259 -660 645 -878 858 l-396 389 -25 -33z'
    ],
  },
  pet: {
    kind: 'svg',
    viewBox: '0 0 2500 2500',
    transform: 'translate(0.000000,2500.000000) scale(0.100000,-0.100000)',
    paths: [
      'M12180 24053 c-491 -47 -874 -154 -1280 -357 -439 -220 -833 -538 -1136 -917 -98 -123 -99 -125 -1544 -2634 -844 -1464 -1252 -2183 -1268 -2230 -48 -140 -13 -287 91 -381 67 -60 1077 -645 1167 -676 97 -33 198 -31 272 5 34 17 72 45 92 70 18 23 613 1047 1320 2276 708 1229 1307 2264 1331 2300 175 261 458 473 767 575 183 61 249 71 483 71 234 0 300 -10 481 -70 222 -74 412 -192 585 -364 64 -64 130 -136 146 -161 17 -25 99 -168 182 -318 254 -457 805 -1391 1413 -2394 109 -180 198 -330 198 -332 0 -2 -221 -125 -490 -272 -270 -147 -487 -270 -483 -274 9 -8 2792 -850 2809 -850 10 0 818 2889 811 2896 -2 2 -235 -116 -518 -261 -407 -210 -516 -262 -524 -251 -5 7 -440 732 -965 1610 -641 1072 -978 1626 -1024 1684 -89 112 -397 418 -504 502 -220 171 -391 281 -617 395 -388 197 -802 315 -1235 355 -105 9 -475 12 -560 3z',
      'M12261 17564 c-52 -110 -99 -188 -181 -299 -195 -262 -431 -444 -733 -564 -90 -36 -299 -89 -392 -98 l-70 -8 -3 -772 -2 -773 390 0 390 0 0 -2280 0 -2280 770 0 770 0 0 3580 0 3580 -450 0 -449 0 -40 -86z',
      'M18435 16563 c-27 -10 -288 -156 -579 -323 -484 -279 -536 -311 -601 -376 -55 -54 -77 -84 -94 -127 -24 -66 -27 -147 -7 -203 7 -22 595 -1049 1306 -2284 712 -1235 1310 -2282 1331 -2326 189 -408 181 -897 -21 -1307 -78 -158 -153 -261 -290 -398 -184 -184 -375 -303 -610 -377 -192 -61 -188 -61 -1075 -60 -734 0 -1526 -10 -2400 -31 -176 -4 -322 -6 -324 -5 -2 2 2 254 9 559 7 305 11 557 9 560 -4 3 -1960 -1832 -2098 -1970 l-54 -53 948 -969 c1171 -1196 1153 -1178 1158 -1173 3 3 17 264 32 580 15 316 29 576 29 577 1 1 825 16 1832 32 1006 17 1865 33 1909 36 108 7 384 64 551 114 552 167 1078 487 1474 897 523 542 840 1203 947 1974 25 179 25 683 -1 860 -39 277 -105 540 -195 778 -61 161 -64 167 -1032 1847 -405 704 -959 1667 -1232 2140 -366 636 -508 875 -547 917 -99 110 -252 155 -375 111z',
      'M5740 15915 c-773 -200 -1422 -369 -1443 -375 l-38 -11 488 -316 c268 -173 489 -316 491 -317 1 -2 -408 -743 -910 -1647 -954 -1721 -943 -1701 -1027 -1979 -89 -294 -130 -559 -138 -896 -8 -326 14 -558 79 -844 187 -826 665 -1547 1355 -2044 413 -296 874 -490 1413 -591 153 -29 799 -35 3257 -33 l2378 3 65 22 c115 40 211 133 242 236 10 32 13 198 13 697 0 649 0 656 -22 726 -36 112 -109 194 -202 226 -28 10 -620 14 -2726 18 -2536 5 -2694 7 -2765 24 -482 114 -853 402 -1060 824 -176 358 -204 763 -79 1152 30 91 79 185 212 407 237 394 803 1398 1357 2411 112 204 207 372 210 372 4 0 220 -131 480 -290 260 -160 475 -289 476 -287 2 2 -147 647 -331 1432 -184 786 -335 1433 -335 1437 0 4 -8 8 -17 7 -10 0 -650 -164 -1423 -364z',
      'M8200 2505 l0 -1575 300 0 300 0 0 455 0 455 413 0 c227 0 451 5 497 10 338 42 634 219 802 480 100 155 142 318 141 545 -1 229 -50 433 -149 626 -138 267 -394 469 -692 544 -118 30 -246 35 -924 35 l-688 0 0 -1575z m1445 900 c192 -41 323 -162 370 -340 23 -89 20 -251 -6 -327 -47 -140 -150 -232 -306 -272 -51 -13 -131 -16 -482 -16 l-421 0 0 485 0 485 388 0 c302 0 402 -4 457 -15z',
      'M11357 4073 c-4 -3 -7 -712 -7 -1575 l0 -1568 1205 0 1205 0 0 305 0 305 -875 0 -875 0 0 330 0 330 813 2 812 3 0 295 0 295 -812 3 -813 2 0 315 0 315 895 0 895 0 0 325 0 325 -1218 0 c-670 0 -1222 -3 -1225 -7z',
      'M14437 4073 c-4 -3 -7 -150 -7 -325 l0 -318 485 0 485 0 0 -1250 0 -1250 340 0 340 0 0 1250 0 1250 455 0 455 0 0 325 0 325 -1273 0 c-701 0 -1277 -3 -1280 -7z'
    ],
  },
  board: {
    kind: 'svg',
    viewBox: '0 0 2500 1792',
    transform: 'translate(0.000000,1792.000000) scale(0.100000,-0.100000)',
    paths: [
      'M11930 17913 c-670 -28 -1278 -117 -1905 -278 -2146 -550 -4018 -1880 -5252 -3730 -618 -927 -1048 -1935 -1288 -3020 -121 -550 -186 -1074 -204 -1656 -38 -1241 177 -2462 634 -3599 929 -2312 2787 -4143 5118 -5042 680 -262 1412 -444 2137 -532 405 -49 444 -51 1110 -51 683 0 762 4 1190 61 2240 297 4269 1414 5726 3149 880 1049 1514 2303 1834 3629 59 244 100 451 139 696 45 286 45 257 8 264 -18 3 -596 82 -1286 176 -1346 184 -1271 177 -1271 118 0 -45 -58 -369 -95 -536 -325 -1448 -1153 -2744 -2338 -3656 -883 -678 -1922 -1113 -3027 -1266 -517 -71 -1080 -78 -1600 -20 -2500 281 -4598 1990 -5374 4380 -142 435 -232 877 -283 1380 -25 248 -25 901 0 1150 135 1338 619 2496 1473 3521 142 170 531 566 694 706 342 293 666 522 1038 734 1566 892 3460 1081 5177 514 325 -107 573 -209 866 -356 1230 -615 2244 -1629 2858 -2857 130 -260 287 -638 267 -645 -6 -2 -168 -37 -359 -77 -304 -65 -346 -76 -330 -88 28 -20 2447 -1482 2458 -1484 5 -2 337 521 737 1162 426 681 724 1166 716 1167 -7 2 -155 -28 -328 -65 l-316 -68 -53 156 c-379 1107 -982 2139 -1780 3044 -167 190 -589 610 -788 783 -1008 882 -2172 1520 -3443 1888 -824 238 -1695 359 -2545 353 -137 -1 -279 -3 -315 -5z',
      'M8740 12789 c-1015 -577 -1856 -1056 -1869 -1063 -22 -12 4 -35 675 -586 1283 -1054 1257 -1032 1243 -1041 -8 -4 -603 -239 -1323 -523 -720 -284 -1311 -518 -1314 -521 -3 -3 -3 -7 -1 -9 2 -1 792 -453 1754 -1002 1094 -624 1759 -999 1775 -998 14 0 648 240 1408 532 l1384 532 1283 -470 1283 -470 1897 1028 c1043 566 1898 1033 1898 1037 1 5 -607 232 -1350 505 -744 272 -1353 497 -1353 500 0 3 418 327 930 720 511 393 929 717 930 720 0 10 -3563 2115 -3579 2114 -9 0 -449 -334 -979 -742 l-963 -743 -322 264 c-177 146 -596 490 -932 766 -335 275 -614 501 -620 500 -5 -1 -840 -473 -1855 -1050z m5315 -1729 c864 -517 1571 -944 1572 -948 2 -7 -3228 -1814 -3254 -1820 -16 -4 -3224 1809 -3220 1820 3 9 3308 1887 3322 1887 6 1 717 -422 1580 -939z',
      'M12630 5580 c0 -1009 4 -1820 9 -1818 4 1 742 408 1639 903 l1632 900 0 708 c0 389 -2 707 -5 707 -3 0 -202 -99 -443 -219 l-438 -219 -1178 424 c-649 233 -1187 426 -1197 429 -18 6 -19 -47 -19 -1815z',
      'M10792 6880 l-1193 -448 -497 253 -497 253 -3 -681 c-1 -402 2 -685 7 -690 17 -17 3396 -1784 3404 -1780 4 2 7 800 7 1774 0 1678 -1 1769 -17 1768 -10 -1 -555 -203 -1211 -449z'
    ],
    caption: 'ダンボール',
  },
  steel: {
    kind: 'svg',
    viewBox: '0 0 701.906202 654.736318',
    transform: 'translate(-2.093798,654.832579) scale(0.100000,-0.100000)',
    paths: [
      'M3360 6543 c-584 -42 -1154 -241 -1635 -571 -174 -119 -238 -174 -425 -361 -333 -334 -571 -675 -735 -1053 -44 -102 -125 -324 -125 -343 0 -3 182 -5 404 -5 l404 0 36 76 c120 254 345 571 551 778 414 417 997 676 1587 706 319 16 548 -7 831 -85 321 -88 669 -266 908 -467 123 -103 204 -177 198 -182 -2 -3 -82 -8 -178 -13 l-173 -8 566 -472 566 -472 18 27 c40 56 535 885 539 902 4 16 -8 18 -139 24 -211 10 -208 9 -244 64 -108 164 -510 603 -672 733 -590 475 -1335 735 -2082 727 -85 -1 -175 -3 -200 -5z',
      'M395 4033 c-9 -43 -21 -93 -26 -112 -4 -19 -6 -37 -3 -40 3 -3 180 -7 392 -9 l387 -3 29 103 c16 57 31 111 34 121 4 16 -20 17 -396 17 l-401 0 -16 -77z',
      'M3227 3893 c-4 -3 -7 -96 -7 -205 l0 -198 274 0 273 0 7 -77 c3 -42 6 -100 6 -129 l0 -54 -307 -2 -308 -3 -3 -187 -2 -188 301 0 302 0 -7 -74 c-14 -154 -56 -238 -153 -302 -67 -45 -189 -89 -290 -105 l-73 -12 0 -228 c0 -126 2 -229 5 -229 3 0 49 14 102 31 250 80 414 163 515 260 110 108 171 283 184 537 l7 122 219 0 218 0 0 190 0 190 -216 0 -217 0 6 83 c4 45 7 103 7 130 l0 47 170 0 170 0 0 205 0 205 -588 0 c-324 0 -592 -3 -595 -7z',
      'M5850 3261 c0 -351 -3 -660 -7 -686 -8 -60 -54 -110 -163 -176 l-75 -45 -3 -227 c-1 -125 -1 -227 1 -227 2 0 28 7 58 16 101 30 189 84 274 170 89 89 132 155 182 277 l33 82 0 728 0 727 -150 0 -150 0 0 -639z',
      'M6291 3068 c1 -458 5 -907 8 -998 l6 -165 30 3 c55 7 189 53 285 99 86 42 106 57 216 167 97 97 127 134 153 189 44 93 51 147 51 415 l0 232 -144 0 -144 0 -4 -212 c-4 -244 -8 -259 -86 -309 -25 -16 -50 -29 -54 -29 -4 0 -8 98 -8 218 0 119 -3 443 -7 720 l-6 502 -149 0 -148 0 1 -832z',
      'M1920 3695 l0 -195 378 -2 377 -3 3 -70 c6 -119 -17 -322 -44 -405 -50 -149 -153 -320 -254 -420 -56 -56 -88 -77 -235 -151 -93 -48 -191 -94 -217 -104 l-48 -18 0 -196 c0 -108 4 -202 8 -208 6 -10 22 -8 73 6 255 76 409 164 592 341 l109 105 27 -31 c76 -90 396 -434 403 -434 4 0 8 98 8 218 l-1 217 -27 31 c-15 17 -73 84 -130 147 l-103 116 31 97 c49 154 78 275 95 396 18 131 35 435 35 626 l0 132 -540 0 -540 0 0 -195z',
      'M326 3689 c-3 -17 -6 -42 -6 -56 l0 -24 238 6 c130 3 305 8 389 11 165 7 162 5 163 72 l0 22 -389 0 -388 0 -7 -31z',
      'M361 2929 c-262 -351 -349 -474 -339 -480 7 -5 99 -9 204 -9 l191 0 37 -112 c134 -403 318 -759 564 -1088 105 -140 359 -402 502 -517 425 -343 938 -579 1475 -678 234 -43 317 -48 660 -42 351 6 316 1 672 91 613 154 1073 393 1479 767 121 111 334 340 334 359 0 4 -252 10 -560 14 l-561 7 -96 -62 c-244 -158 -582 -306 -828 -364 -342 -80 -782 -68 -1154 31 -335 89 -696 275 -951 488 -251 210 -478 490 -624 767 -71 136 -151 318 -143 326 3 2 109 7 236 10 128 4 234 9 236 13 2 3 -80 87 -183 185 -103 98 -284 271 -402 384 -118 113 -256 245 -306 294 l-91 88 -352 -472z',
      'M4610 3050 l0 -190 540 0 540 0 -2 188 -3 187 -537 3 -538 2 0 -190z',
      'M5615 1799 c-20 -28 -35 -52 -33 -54 2 -1 204 -5 451 -8 l447 -6 30 59 30 60 -444 0 -444 0 -37 -51z',
      'M5320 1465 l-125 -125 521 0 521 0 75 118 75 117 -276 6 c-152 4 -364 7 -471 8 l-195 1 -125 -125z',
    ],
  },
  aluminum: {
    kind: 'svg',
    viewBox: '0 0 688.901828 613.987672',
    transform: 'translate(-0.141445,613.987672) scale(0.100000,-0.100000)',
    paths: [
      'M3323 6125 c-57 -16 -143 -57 -183 -87 -59 -45 -152 -145 -198 -211 -27 -40 -121 -196 -209 -347 -201 -345 -1096 -1897 -1112 -1927 l-12 -23 454 0 453 0 116 198 c64 108 196 337 293 507 404 707 421 732 490 755 53 17 116 -16 160 -84 85 -134 284 -480 279 -488 -3 -4 -120 -8 -260 -8 -140 0 -254 -3 -254 -7 1 -7 1497 -908 1508 -908 11 0 355 885 347 893 -3 3 -99 10 -212 14 -114 5 -208 10 -209 11 -1 1 -113 196 -249 432 -361 627 -561 964 -618 1040 -149 199 -381 294 -584 240z',
      'M2580 3215 l0 -185 576 0 577 0 -7 -52 c-9 -66 -30 -115 -64 -152 -52 -55 -76 -60 -334 -64 l-238 -4 0 -281 c0 -277 -1 -283 -24 -334 -62 -132 -227 -223 -407 -223 l-66 0 -7 -92 c-3 -50 -6 -142 -6 -205 l0 -113 99 0 c222 0 349 40 455 144 139 135 226 365 242 637 l7 106 97 7 c116 7 233 36 303 73 111 61 199 185 232 327 18 77 35 304 35 474 l0 122 -735 0 -735 0 0 -185z',
      'M4188 2748 l-3 -653 -28 -47 c-33 -57 -97 -103 -169 -122 l-53 -13 -3 -202 -2 -201 29 0 c141 0 354 129 454 276 94 138 89 90 95 902 l5 712 -161 0 -161 0 -3 -652z',
      'M4660 2449 l0 -952 88 6 c125 9 241 41 361 99 90 43 116 62 185 132 95 95 142 179 156 276 5 36 10 145 10 243 l0 177 -135 0 -135 0 0 -108 c0 -128 -14 -214 -42 -260 -23 -38 -84 -80 -128 -89 l-30 -6 0 535 c0 294 -3 617 -7 716 l-6 182 -159 0 -158 0 0 -951z',
      'M5580 3215 l0 -185 650 0 650 0 0 185 0 185 -650 0 -650 0 0 -185z',
      'M1459 3272 l-66 -119 225 -6 c124 -4 327 -7 451 -7 l226 0 64 116 c34 63 60 118 56 122 -4 4 -205 8 -448 10 l-442 3 -66 -119z',
      'M1307 3008 c-8 -13 -26 -44 -41 -70 l-27 -48 454 0 454 0 41 70 40 70 -454 0 -454 0 -13 -22z',
      'M5584 2827 c-2 -7 -3 -89 -2 -182 l3 -170 643 -3 642 -2 0 185 0 185 -640 0 c-513 0 -642 -3 -646 -13z',
      'M1490 2593 c-184 -108 -908 -542 -1159 -694 -298 -180 -300 -163 15 -174 112 -4 204 -11 204 -15 0 -4 -84 -153 -186 -331 -322 -562 -352 -627 -361 -789 -7 -119 7 -195 51 -285 59 -120 167 -209 318 -262 70 -25 85 -27 378 -34 168 -4 1505 -8 2971 -8 l2667 -1 68 21 c229 70 382 212 423 390 24 101 10 255 -35 392 l-16 47 -479 0 c-275 0 -479 -4 -479 -9 0 -5 -13 -23 -29 -40 l-29 -31 -2367 0 c-1524 0 -2373 3 -2385 10 -21 11 -40 60 -40 104 0 42 51 141 268 516 l187 325 200 6 c110 4 217 7 237 8 l37 1 -19 53 c-72 205 -329 857 -338 857 -4 -1 -50 -26 -102 -57z',
      'M5580 2080 l0 -200 48 0 c60 0 170 -16 245 -35 86 -22 185 -68 339 -157 250 -144 370 -187 556 -196 l102 -5 -2 199 -3 199 -105 7 c-188 12 -297 51 -540 193 -148 87 -228 125 -310 148 -71 21 -233 47 -287 47 l-43 0 0 -200z',
      'M5749 1500 l-196 -5 40 -72 41 -73 452 0 453 0 -44 78 -44 77 -253 0 c-139 1 -341 -2 -449 -5z',
      'M5773 1105 l71 -125 206 0 c113 0 316 3 451 7 l246 6 -66 116 -67 116 -456 3 -457 2 72 -125z',
    ],
  },
};

function buildRecycleMarkSvg(markKey: string, heightMm: number): string {
  const def = RECYCLE_MARK_DEFS[markKey];
  if (!def) return '';
  // キャプション（段ボールのみ）がある場合はその分の高さを確保し、それ以外は上下に均等な余白だけ残す
  // （印刷時に端がわずかに切れてもマーク本体を巻き込まないよう、上下中央寄せ＋小さな安全マージンにしている）
  const captionReserveMm = def.caption ? 3 : 0.6;
  const iconHeight = Math.max(heightMm - captionReserveMm, 4);
  return `<div style="display:inline-flex;flex-direction:column;align-items:center;height:${heightMm}mm;justify-content:center;">
    <svg viewBox="${def.viewBox}" style="height:${iconHeight}mm;width:auto;" xmlns="http://www.w3.org/2000/svg">
      <g transform="${def.transform}" fill="#000000" stroke="none">
        ${def.paths.map(d => `<path d="${d}"/>`).join('')}
      </g>
    </svg>
    ${def.caption ? `<span style="font-size:5pt;line-height:1;">${escHtmlModule(def.caption)}</span>` : ''}
  </div>`;
}
function escHtmlModule(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function generateLabelHtml(
  content: LabelContent,
  config: LabelConfig,
  isPreview: boolean = false
): string {
  const { fontSizePt, labelWidthMm, labelHeightMm } = config;
  const width = labelWidthMm ?? 60;
  const height = labelHeightMm ?? 60;
  const recycleMarks: string[] = (content as any).recycleMarks ?? [];
  // 表示可能面積から法令上の文字サイズ下限を判定（食品表示基準）
  // 150cm²超: 8pt以上 / 150cm²以下: 5.5pt以上
  // 容器全体サイズ（packageWidthMm/packageHeightMm）が未入力の場合はシールサイズから推定
  // （実際の容器全体の表示可能面積とは異なる場合がある簡易推定）
  const packageWidthMm  = (config as any).packageWidthMm as number | undefined;
  const packageHeightMm = (config as any).packageHeightMm as number | undefined;
  const displayAreaCm2 = (packageWidthMm && packageHeightMm)
    ? (packageWidthMm / 10) * (packageHeightMm / 10)
    : (width / 10) * (height / 10);
  const legalMinFontPt = displayAreaCm2 > 150 ? 8 : 5.5;
  // ラベルサイズに合わせてフォントサイズを自動調整
  // 基準: 60mm×60mmで8pt。シールが基準より小さい場合のみ面積比で縮小する（下限は法令上の最小値）。
  // シールが基準より大きくても、入力したptより拡大はしない（拡大すると設定値と実際の表示が
  // 食い違ってわかりにくいため、入力値を上限として扱う）。
  const baseFontSize = fontSizePt ?? 8;
  const areaRatio = Math.min(Math.sqrt((width * height) / (60 * 60)), 1);
  const autoFontSize = Math.max(Math.round(baseFontSize * areaRatio * 10) / 10, legalMinFontPt);
  const fontSize = autoFontSize;
  // バーコード幅：シールの横幅に応じて自動計算（25mm〜45mmの範囲、リーダーで読み取れる実用サイズ）
  const barcodeWidthMm = Math.min(Math.max(Math.round(width * 0.7 * 10) / 10, 25), 45);

  const escHtml = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // 栄養成分：必須5項目（法令上の表示順固定）＋ ON になっている任意項目を末尾に追加し、
  // 左列に切り上げ半分・右列に残りを詰めて、非表示項目があっても左右の行数バランスを保つ
  const nutritionItems: Array<{ label: string; value: string }> = [
    { label: '熱量',      value: `${content.nutritionPerUnit.energyKcal}kcal` },
    { label: 'たんぱく質', value: `${content.nutritionPerUnit.protein}g` },
    { label: '脂質',      value: `${content.nutritionPerUnit.fat}g` },
    { label: '炭水化物',   value: `${content.nutritionPerUnit.carbohydrate}g` },
    { label: '食塩相当量', value: `${content.nutritionPerUnit.saltEquivalent}g` },
  ];
  if (content.nutritionPerUnit.sugar != null) {
    nutritionItems.push({ label: '糖質', value: `${content.nutritionPerUnit.sugar}g` });
  }
  if (content.nutritionPerUnit.dietaryFiber != null) {
    nutritionItems.push({ label: '食物繊維', value: `${content.nutritionPerUnit.dietaryFiber}g` });
  }
  if (content.nutritionPerUnit.cholesterol != null) {
    nutritionItems.push({ label: 'コレステロール', value: `${content.nutritionPerUnit.cholesterol}mg` });
  }
  const nutritionLeftCount = Math.ceil(nutritionItems.length / 2);
  const nutritionLeftItems  = nutritionItems.slice(0, nutritionLeftCount);
  const nutritionRightItems = nutritionItems.slice(nutritionLeftCount);
  const nutritionRowsHtml = nutritionLeftItems.map((item, i) => {
    const right = nutritionRightItems[i];
    return `<tr>
        <td>${item.label}</td><td style="text-align:right;">${item.value}</td>
        ${right ? `<td style="padding-left:2mm;">${right.label}</td><td style="text-align:right;">${right.value}</td>` : '<td></td><td></td>'}
      </tr>`;
  }).join('');

  const singleLabel = `
<div class="label" style="
  width: ${width}mm;
  min-height: ${height}mm;
  max-height: ${height}mm;
  overflow: hidden;
  font-size:${fontSize}pt;
  font-family: 'Noto Sans JP', 'Hiragino Sans', Meiryo, sans-serif;
  line-height: 1.15;
  padding: 1.2mm;
  border: none;
  box-sizing: border-box;
  break-inside: avoid;
  page-break-inside: avoid;
  break-after: avoid;
">
  <!-- 品名 -->
  <div style="font-weight:bold; font-size:${Math.round(fontSize * 1.1)}pt; border-bottom:0.3mm solid #ccc; margin-bottom:0.5mm; padding-bottom:0.3mm;">
    ${escHtml(content.productName)}
  </div>
  <!-- 名称 -->
  <div style="margin-bottom:0.3mm;">
    <span style="font-weight:bold;">名称：</span>${escHtml(content.categoryName)}
  </div>
  <!-- 原材料名 -->
  <div style="margin-bottom:0.3mm;">
    <span style="font-weight:bold;">原材料名：</span>${escHtml(content.ingredientsText)}
  </div>
  <!-- 内容量 -->
  <div style="margin-bottom:0.3mm;">
    <span style="font-weight:bold;">内容量：</span>${escHtml(content.contentAmount)}
  </div>
  <!-- 賞味期限 -->
  <div style="margin-bottom:0.3mm;">
    <span style="font-weight:bold;">${escHtml(content.expiryType)}：</span>${escHtml(content.expiryDate)}
  </div>
  <!-- 保存方法 -->
  <div style="margin-bottom:0.3mm;">
    <span style="font-weight:bold;">保存方法：</span>${escHtml(content.storageMethod)}
  </div>
  <!-- 栄養成分 -->
  <div style="border:0.3mm solid #ccc; padding:0.5mm 1mm; margin-bottom:0.3mm;">
    <div style="font-weight:bold; margin-bottom:0.2mm;">
      栄養成分表示（${escHtml(content.nutritionPerUnit.label)}）${content.isEstimated ? '※推定値' : ''}
    </div>
    <table style="width:100%; border-collapse:collapse;">
      ${nutritionRowsHtml}
    </table>
  </div>
  <!-- 注意事項（コメント＋お客様へのお願い） -->
  ${(content.comment || content.qualityControl) ? `<div style="border:0.3mm solid #ccc; padding:0.5mm 1mm; margin-bottom:0.3mm;">
    ${content.comment ? `<div>${escHtml(content.comment)}</div>` : ''}
    ${content.qualityControl ? `<div>${escHtml(content.qualityControl)}</div>` : ''}
  </div>` : ''}
  <!-- 製造者情報（ロゴ・QRコード含む） -->
  <div style="margin-top:0.3mm; border-top:0.3mm solid #ccc; padding-top:0.3mm; display:flex; align-items:flex-start; justify-content:space-between; gap:1mm;">
    <div style="flex:1; word-break:break-all; overflow-wrap:break-word; line-height:1.15;">
    <span style="font-weight:bold;">製造者：</span>${escHtml(content.manufacturerName)}${content.representative ? '　' + escHtml(content.representative) : ''}
    ${content.postalCode ? '<br>' + escHtml(content.postalCode) : ''}
    ${content.address ? '<br>' + escHtml(content.address) : ''}
    ${content.phone ? '<br>TEL ' + escHtml(content.phone) : ''}
    ${content.email ? '<br>' + escHtml(content.email) : ''}
    </div>
    ${(content.logoUrl || content.qrUrl) ? `<div style="display:flex;flex-direction:row;align-items:center;gap:0.5mm;flex-shrink:0;">
      ${content.logoUrl ? `<img src="${content.logoUrl}" style="max-height:${content.logoHeightMm ?? 8}mm;max-width:${(content.logoHeightMm ?? 8) * 2.5}mm;object-fit:contain;" />` : ''}
      ${content.qrUrl ? `<img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(content.qrUrl)}" style="width:${content.qrSizeMm ?? 6}mm;height:${content.qrSizeMm ?? 6}mm;" />` : ''}
    </div>` : ''}
  </div>
  <!-- バーコード＋リサイクルマーク（一番下） -->
${(content.barcode && content.showBarcode !== false) || (recycleMarks.length > 0) ? `<div style="display:flex; align-items:center; justify-content:center; gap:2mm; margin-top:0.5mm; width:100%;">
    ${content.barcode && content.showBarcode !== false ? `<div style="display:flex;flex-direction:column;align-items:center;width:${barcodeWidthMm}mm;max-width:60%;">
      <div style="width:100%;height:${content.barcodeHeightMm ?? 10}mm;overflow:hidden;">
        <!-- 数値はバーコード画像側の文字ではなく、下の行にラベル本文と同じフォントサイズで表示する
             （barcodeapi.org側の数値はバーコード縦幅に連動して大きくなり、フォントサイズと無関係に
             不自然に大きく見えることがあったため、常に text=none で画像側の数値は非表示にしている） -->
        <img src="https://barcodeapi.org/api/${getBarcodeApiPath(content.barcode)}/${encodeURIComponent(content.barcode)}?height=${content.barcodeHeightPx ?? 300}&text=none" style="width:100%;height:100%;object-fit:contain;" onerror="this.parentElement.parentElement.style.display='none'" />
      </div>
      ${content.showBarcodeText !== false ? `<div style="font-size:${fontSize}pt;line-height:1.1;margin-top:0.3mm;white-space:nowrap;">${escHtml(content.barcode)}</div>` : ''}
    </div>` : ''}
    ${recycleMarks.length > 0 ? `<div style="display:flex; gap:1mm; align-items:center;">
      ${recycleMarks.map((m: string) => buildRecycleMarkSvg(m, content.barcodeHeightMm ?? 10)).join('')}
    </div>` : ''}
  </div>` : ''}
</div>
`;
  // ラベルプリンタ用：ラベルのみ
  if (config.deviceType === 'LABEL_PRINTER') {
    const labels = Array(config.printCount).fill(singleLabel).join('\n');
    return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<style>
  @page { margin: 0; size: ${width}mm ${height}mm; }
  body { margin: 0; padding: 0; } html, body { height: auto !important; }
  .label { break-after: page; }
  .label:last-child { break-after: avoid; page-break-after: avoid; }
  @media print { * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>${labels}
<script>
// フォント自動縮小：ラベルが枠からはみ出す場合にフォントを縮小（下限は法令上の最小値）
document.querySelectorAll('.label').forEach(function(label) {
  var maxH = label.style.maxHeight;
  if (!maxH) return;
  var maxPx = parseFloat(maxH) * 3.7795; // mm to px
  var minSize = ${legalMinFontPt};
  var step = 0.5;
  var el = label;
  while (el.scrollHeight > maxPx + 2 && parseFloat(el.style.fontSize) > minSize) {
    var cur = parseFloat(el.style.fontSize);
    el.style.fontSize = (cur - step) + 'pt';
    // 内部の小フォントも縮小
    el.querySelectorAll('[style*="font-size"]').forEach(function(child) {
      var cs = parseFloat(child.style.fontSize);
      if (cs > minSize) child.style.fontSize = Math.max(cs - step, minSize) + 'pt';
    });
  }
  // 法令上の下限まで縮小しても収まらない場合はフラグを立てる（勝手にこれ以上は縮小しない）
  if (el.scrollHeight > maxPx + 2) {
    el.setAttribute('data-overflow', 'true');
  }
});
${isPreview ? `
// プレビュー限定：実際に表示されているフォントサイズ、またはオーバーフロー警告をバッジで表示
(function() {
  var firstLabel = document.querySelector('.label');
  if (!firstLabel) return;
  var actualSize = parseFloat(firstLabel.style.fontSize);
  var baseSize = ${fontSize};
  var overflow = firstLabel.getAttribute('data-overflow') === 'true';
  var badge = document.createElement('div');
  if (overflow) {
    badge.textContent = '⚠ 文字サイズ' + actualSize.toFixed(1) + 'pt（法令上の下限）でも内容が収まっていません。シールを大きくするか表示内容を減らしてください';
    badge.style.cssText = 'background:#c0392b;color:#fff;font-size:11px;padding:4px 8px;font-family:sans-serif;';
  } else {
    badge.textContent = actualSize < baseSize
      ? '自動縮小: ' + baseSize.toFixed(1) + 'pt → ' + actualSize.toFixed(1) + 'pt'
      : '表示フォントサイズ: ' + actualSize.toFixed(1) + 'pt';
    badge.style.cssText = 'background:#333;color:#fff;font-size:10px;padding:2px 6px;font-family:sans-serif;white-space:nowrap;';
  }
  document.body.insertBefore(badge, document.body.firstChild);
})();
` : ''}
</script>
</body>
</html>`;
  }

  // A4プリンタ用：グリッドレイアウト
  const cols      = config.a4Cols ?? 3;
  const rows      = config.a4Rows ?? 5;
  const labelsPerPage = cols * rows;
  const startPos  = (config.startPosition ?? 1) - 1;
  const marginTop  = config.marginTopMm  ?? 0;
  const marginLeft = config.marginLeftMm ?? 0;
  // シール同士のスキマ（市販のスキマありラベル用紙向け）。未指定なら0（隙間なし・従来通り）。
  const colGap = Math.max((config as any).a4ColGapMm ?? 0, 0);
  const rowGap = Math.max((config as any).a4RowGapMm ?? 0, 0);
  // シールサイズが指定されている場合はそのサイズを使用、なければ印刷領域（スキマ分を除く）から自動計算
  const sealW = (config as any).a4SealWidthMm;
  const sealH = (config as any).a4SealHeightMm;
  const cellW = sealW ?? Math.floor((((210 - marginLeft) - colGap * (cols - 1)) / cols) * 10) / 10;
  const cellH = sealH ?? Math.floor((((297 - marginTop)  - rowGap * (rows - 1)) / rows) * 10) / 10;
  // 右余白・下余白は自動計算（シール同士のスキマの合計分も差し引く）
  const marginRight  = Math.max(210 - marginLeft - cellW * cols - colGap * (cols - 1), 0);
  const marginBottom = Math.max(297 - marginTop  - cellH * rows - rowGap * (rows - 1), 0);

  const totalSlots = startPos + config.printCount;
  const pages      = Math.ceil(totalSlots / labelsPerPage);

  // A4セルサイズに合わせてフォントサイズを再計算（こちらもシールが基準より大きくても拡大はしない）
  const a4AreaRatio = Math.min(Math.sqrt((cellW * cellH) / (60 * 60)), 1);
  const a4FontSize = Math.max(Math.round((fontSizePt ?? 8) * a4AreaRatio * 10) / 10, legalMinFontPt);

  // ラベルHTMLをセルサイズとフォントサイズに合わせて調整
  const cellLabel = singleLabel
    .replace(`width: ${width}mm`, `width: ${cellW}mm`)
    .replace(`min-height: ${height}mm`, `height: ${cellH}mm`)
    .replace(`max-height: ${height}mm`, `max-height: ${cellH}mm`)
    .replace(new RegExp(`font-size:${fontSize}pt`, 'g'), `font-size:${a4FontSize}pt`)
    .replace(new RegExp(`font-size:${Math.round(fontSize * 1.1)}pt`, 'g'), `font-size:${Math.round(a4FontSize * 1.1)}pt`);

  let gridHtml = '';
  for (let p = 0; p < pages; p++) {
    const isLastPage = p === pages - 1;
    gridHtml += `<div style="display:grid;grid-template-columns:repeat(${cols},${cellW}mm);grid-template-rows:repeat(${rows},${cellH}mm);gap:${rowGap}mm ${colGap}mm;width:${210 - marginLeft - marginRight}mm;height:${297 - marginTop - marginBottom}mm;margin:${marginTop}mm ${marginRight}mm ${marginBottom}mm ${marginLeft}mm;${isLastPage ? '' : 'page-break-after:always;'}">`;
    for (let i = 0; i < labelsPerPage; i++) {
      const slot = p * labelsPerPage + i;
      const isEmpty = slot < startPos || slot >= startPos + config.printCount;
      gridHtml += `<div style="width:${cellW}mm;height:${cellH}mm;box-sizing:border-box;">${isEmpty ? '' : cellLabel}</div>`;
    }
    gridHtml += '</div>';
  }

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { margin: 0; size: A4 portrait; }
  html, body { width: 210mm; height: auto; margin: 0; padding: 0; background: white; overflow: hidden; }
  @media print { * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>${gridHtml}
<script>
document.querySelectorAll('.label').forEach(function(label) {
  var maxH = label.style.maxHeight;
  if (!maxH) return;
  var maxPx = parseFloat(maxH) * 3.7795;
  var minSize = ${legalMinFontPt};
  var step = 0.5;
  while (label.scrollHeight > maxPx + 2 && parseFloat(label.style.fontSize) > minSize) {
    var cur = parseFloat(label.style.fontSize);
    label.style.fontSize = (cur - step) + 'pt';
    label.querySelectorAll('[style*="font-size"]').forEach(function(child) {
      var cs = parseFloat(child.style.fontSize);
      if (cs > minSize) child.style.fontSize = Math.max(cs - step, minSize) + 'pt';
    });
  }
  if (label.scrollHeight > maxPx + 2) {
    label.setAttribute('data-overflow', 'true');
  }
});
${isPreview ? `
(function() {
  var firstLabel = document.querySelector('.label');
  if (!firstLabel) return;
  var actualSize = parseFloat(firstLabel.style.fontSize);
  var baseSize = ${a4FontSize};
  var overflow = firstLabel.getAttribute('data-overflow') === 'true';
  var badge = document.createElement('div');
  if (overflow) {
    badge.textContent = '⚠ 文字サイズ' + actualSize.toFixed(1) + 'pt（法令上の下限）でも内容が収まっていません。シールを大きくするか表示内容を減らしてください';
    badge.style.cssText = 'background:#c0392b;color:#fff;font-size:11px;padding:4px 8px;font-family:sans-serif;';
  } else {
    badge.textContent = actualSize < baseSize
      ? '自動縮小: ' + baseSize.toFixed(1) + 'pt → ' + actualSize.toFixed(1) + 'pt'
      : '表示フォントサイズ: ' + actualSize.toFixed(1) + 'pt';
    badge.style.cssText = 'background:#333;color:#fff;font-size:10px;padding:2px 6px;font-family:sans-serif;white-space:nowrap;';
  }
  document.body.insertBefore(badge, document.body.firstChild);
})();
` : ''}
</script>
</body>
</html>`;
}

/**
 * デフォルトの表示設定を返す
 */
export function getDefaultDisplaySettings() {
  return {
    showPhone:          true,
    showRepresentative: false,
    showEmail:          false,
    showNutrition:      true,
    showDietaryFiber:   true,
    showSugar:          true,
    showCholesterol:    false,
    showQualityControl: true,
    showComment:        true,
    nutritionNote:      '※推定値',
  };
}
