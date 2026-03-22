// ============================================================
// lib/auth.ts - NextAuth.js v5 設定
// ============================================================

import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import { prisma } from '@/lib/db';
import type { UserPlan } from '@/types';

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email:    { label: 'メールアドレス', type: 'email' },
        password: { label: 'パスワード',     type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('メールアドレスとパスワードを入力してください');
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user) {
          throw new Error('メールアドレスまたはパスワードが違います');
        }

        if (!user.emailVerified) {
          throw new Error('メール認証が完了していません。認証メールをご確認ください。');
        }

        if (!user.isActive) {
          throw new Error('このアカウントは無効化されています');
        }

        const isValid = await compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!isValid) {
          throw new Error('メールアドレスまたはパスワードが違います');
        }

        return {
          id:          user.id,
          email:       user.email,
          name:        user.companyName,
          plan:        user.plan as UserPlan,
        };
      },
    }),
  ],

  callbacks: {
    // JWTにカスタムフィールドを追加
    async jwt({ token, user }) {
      if (user) {
        token.id   = user.id;
        token.plan = (user as { plan?: UserPlan }).plan ?? 'free';
      }
      return token;
    },

    // セッションにJWTのカスタムフィールドを含める
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id   = token.id as string;
        session.user.plan = token.plan as UserPlan;
      }
      return session;
    },
  },

  pages: {
    signIn:  '/auth/login',
    signOut: '/auth/login',
    error:   '/auth/login',
  },

  session: {
    strategy: 'jwt',
    maxAge:   30 * 24 * 60 * 60,  // 30日
  },
});

// NextAuth型拡張
declare module 'next-auth' {
  interface Session {
    user: {
      id:    string;
      email: string;
      name:  string;
      plan:  UserPlan;
    };
  }
  interface User {
    plan?: UserPlan;
  }
}
declare module 'next-auth/jwt' {
  interface JWT {
    id?:   string;
    plan?: UserPlan;
  }
}
