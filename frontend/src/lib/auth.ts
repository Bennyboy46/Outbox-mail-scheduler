import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      authorization: {
        params: {
          prompt: 'consent',
          access_type: 'offline',
          response_type: 'code',
        },
      },
    }),
  ],

  pages: {
    signIn: '/login',
  },

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },

  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;
      }
      if (account?.provider === 'google' && account.id_token) {
        token.idToken = account.id_token;
      }
      if (account?.provider) {
        token.provider = account.provider;
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id || token.sub;
        session.user.email = token.email || session.user.email;
        session.user.name = token.name || session.user.name;
        session.user.image = (token.picture as string) || session.user.image;
        (session.user as any).provider = token.provider;
        (session.user as any).idToken = token.idToken;
      }
      return session;
    },
  },

  logger: {
    error(code, metadata) {
      console.error('[NextAuth] OAuth error', code, metadata);
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
};
