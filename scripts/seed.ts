// scripts/seed.ts
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial data...');

  // アレルゲンマスタ
  const allergens = [
    { name: 'えび',    category: 'REQUIRED_8'  as const, keywords: ['えび','エビ','海老','蝦'],           displayOrder: 10 },
    { name: 'かに',    category: 'REQUIRED_8'  as const, keywords: ['かに','カニ','蟹'],                   displayOrder: 20 },
    { name: '小麦',    category: 'REQUIRED_8'  as const, keywords: ['小麦','強力粉','薄力粉','中力粉','準強力粉','全粒粉','ライ麦','ふすま','グルテン'], displayOrder: 30 },
    { name: 'そば',    category: 'REQUIRED_8'  as const, keywords: ['そば','ソバ','蕎麦','そば粉'],       displayOrder: 40 },
    { name: '卵',      category: 'REQUIRED_8'  as const, keywords: ['卵','全卵','卵黄','卵白','たまご','鶏卵','乾燥卵白'], displayOrder: 50 },
    { name: '乳',      category: 'REQUIRED_8'  as const, keywords: ['牛乳','生クリーム','バター','チーズ','ヨーグルト','クリームチーズ','マスカルポーネ','バターミルク','脱脂粉乳'], displayOrder: 60 },
    { name: '落花生',  category: 'REQUIRED_8'  as const, keywords: ['落花生','ピーナッツ','ピーナツ'],    displayOrder: 70 },
    { name: 'くるみ',  category: 'REQUIRED_8'  as const, keywords: ['くるみ','クルミ','胡桃'],            displayOrder: 80 },
    { name: 'アーモンド',    category: 'OPTIONAL_20' as const, keywords: ['アーモンド','アーモンドプードル'], displayOrder: 110 },
    { name: 'あわび',        category: 'OPTIONAL_20' as const, keywords: ['あわび','アワビ'],             displayOrder: 120 },
    { name: 'いか',          category: 'OPTIONAL_20' as const, keywords: ['いか','イカ','烏賊'],           displayOrder: 130 },
    { name: 'いくら',        category: 'OPTIONAL_20' as const, keywords: ['いくら','イクラ'],             displayOrder: 140 },
    { name: 'オレンジ',      category: 'OPTIONAL_20' as const, keywords: ['オレンジ','オレンジピール'],   displayOrder: 150 },
    { name: 'カシューナッツ', category: 'OPTIONAL_20' as const, keywords: ['カシューナッツ'],             displayOrder: 160 },
    { name: 'キウイフルーツ', category: 'OPTIONAL_20' as const, keywords: ['キウイ','キウイフルーツ'],     displayOrder: 170 },
    { name: '牛肉',          category: 'OPTIONAL_20' as const, keywords: ['牛肉','ビーフ','牛','ゼラチン'], displayOrder: 180 },
    { name: 'ごま',          category: 'OPTIONAL_20' as const, keywords: ['ごま','ゴマ','胡麻','ごま油'], displayOrder: 190 },
    { name: 'さけ',          category: 'OPTIONAL_20' as const, keywords: ['さけ','サケ','鮭','塩鮭','サーモン'], displayOrder: 200 },
    { name: 'さば',          category: 'OPTIONAL_20' as const, keywords: ['さば','サバ','鯖'],            displayOrder: 210 },
    { name: '大豆',          category: 'OPTIONAL_20' as const, keywords: ['大豆','豆乳','豆腐','味噌','しょうゆ','醤油','枝豆','酒粕'], displayOrder: 220 },
    { name: '鶏肉',          category: 'OPTIONAL_20' as const, keywords: ['鶏肉','チキン','鶏'],          displayOrder: 230 },
    { name: 'バナナ',        category: 'OPTIONAL_20' as const, keywords: ['バナナ'],                      displayOrder: 240 },
    { name: '豚肉',          category: 'OPTIONAL_20' as const, keywords: ['豚肉','ポーク','ベーコン','ハム','ウインナー','ソーセージ','豚'], displayOrder: 250 },
    { name: 'まつたけ',      category: 'OPTIONAL_20' as const, keywords: ['まつたけ','マツタケ','松茸'], displayOrder: 260 },
    { name: 'もも',          category: 'OPTIONAL_20' as const, keywords: ['もも','モモ','桃','ピーチ'],   displayOrder: 270 },
    { name: 'やまいも',      category: 'OPTIONAL_20' as const, keywords: ['やまいも','山芋','長芋'],      displayOrder: 280 },
    { name: 'りんご',        category: 'OPTIONAL_20' as const, keywords: ['りんご','リンゴ','林檎'],      displayOrder: 290 },
    { name: 'ゼラチン',      category: 'OPTIONAL_20' as const, keywords: ['ゼラチン','コラーゲン'],       displayOrder: 300 },
  ];
  for (const a of allergens) {
    await prisma.allergenMaster.upsert({ where:{name:a.name}, update:{keywords:a.keywords,displayOrder:a.displayOrder}, create:a });
  }
  console.log(`  allergen_master: ${allergens.length} records`);

  // カテゴリ初期値: パン・焼菓子・総菜の3種のみ
  const categories = [
    { name: 'パン',   sortOrder: 10 },
    { name: '焼菓子', sortOrder: 20 },
    { name: '総菜',   sortOrder: 30 },
  ];
  for (const cat of categories) {
    const existing = await prisma.category.findFirst({ where: { name: cat.name, userId: null } });
    if (!existing) await prisma.category.create({ data: { userId: null, ...cat } });
  }
  console.log(`  categories: ${categories.length} initial records (users can add more in settings)`);

  // 管理者ユーザー
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) {
    const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (!existing) {
      const pw = process.env.ADMIN_INITIAL_PASSWORD ?? 'Admin1234!';
      const passwordHash = await hash(pw, 12);
      const admin = await prisma.user.create({
        data: { email: adminEmail, emailVerified: true, passwordHash, companyName: 'FoodLabel Pro', plan: 'admin' },
      });
      await prisma.shop.create({ data: { userId: admin.id, shopName: 'FoodLabel Pro', isDefault: true } });
      console.log(`  admin created: ${adminEmail} / ${pw}`);
    } else {
      await prisma.user.update({ where:{email:adminEmail}, data:{plan:'admin', emailVerified:true} });
      console.log(`  admin updated: ${adminEmail}`);
    }
  }
  console.log('Seed complete!');
}

main().catch(e=>{console.error(e);process.exit(1);}).finally(()=>prisma.$disconnect());
