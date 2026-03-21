// app/api/shops/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  // Prismaのカラム名はキャメルケース（shopName, isDefault等）
  const shops = await prisma.$queryRaw`
    SELECT
      id::text,
      "shopName",
      "companyName",
      "representative",
      "postalCode",
      address,
      phone,
      email,
      "showPhone",
      "showRepresentative",
      "isDefault"
    FROM shops
    WHERE "userId" = ${session.user.id} AND "isActive" = true
    ORDER BY "isDefault" DESC, "createdAt" ASC
  ` as Array<Record<string, unknown>>;

  return NextResponse.json({ success: true, data: shops });
}

const shopSchema = z.object({
  shopName:           z.string().min(1).max(200),
  companyName:        z.string().max(200).optional(),
  representative:     z.string().max(100).optional(),
  postalCode:         z.string().max(8).optional(),
  address:            z.string().optional(),
  phone:              z.string().max(20).optional(),
  email:              z.string().email().optional().or(z.literal('')),
  showPhone:          z.boolean().default(true),
  showRepresentative: z.boolean().default(false),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 });

  const body   = await request.json();
  const result = shopSchema.safeParse(body);
  if (!result.success) return NextResponse.json({ success: false, error: result.error.errors[0].message }, { status: 400 });

  const d = result.data;
  try {
    const rows = await prisma.$queryRaw`
      INSERT INTO shops (
        id, "userId", "shopName", "companyName", representative,
        "postalCode", address, phone, email,
        "showPhone", "showRepresentative",
        "isDefault", "isActive", "createdAt", "updatedAt"
      ) VALUES (
        gen_random_uuid(), ${session.user.id}, ${d.shopName}, ${d.companyName ?? null}, ${d.representative ?? null},
        ${d.postalCode ?? null}, ${d.address ?? null}, ${d.phone ?? null}, ${d.email || null},
        ${d.showPhone}, ${d.showRepresentative},
        false, true, NOW(), NOW()
      )
      RETURNING id::text
    ` as Array<{id: string}>;
    return NextResponse.json({ success: true, data: { id: rows[0].id } });
  } catch (err) {
    console.error('shop create error:', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
