import NextAuth from "next-auth"
import GitHub from "next-auth/providers/github"

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  useSecureCookies: true,
  providers: [
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    }),
  ],
  session: { strategy: "jwt" },
  pages: {
    error: "/auth/error",
  },
  logger: {
    error: (error: any) => {
      const cause = error.cause
      console.error("[auth] Error:", {
        type: error.type,
        message: error.message,
        causeErr: cause?.err?.message,
        causeErrType: cause?.err?.type,
        causeMessage: cause?.message,
        cause: JSON.stringify(cause, Object.getOwnPropertyNames(cause ?? {})),
      })
    },
    warn: (code) => {
      console.warn("[auth] Warning:", code)
    },
  },
  callbacks: {
    async signIn({ profile }) {
      if (!profile) return false

      // Reject accounts younger than 3 months
      if (profile.created_at) {
        const createdAt = new Date(profile.created_at as string)
        const threeMonthsAgo = new Date()
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)
        if (createdAt > threeMonthsAgo) {
          return "/auth/error?error=AccountTooNew"
        }
      }

      // Reject accounts with no public repos
      if (
        typeof profile.public_repos === "number" &&
        profile.public_repos < 1
      ) {
        return "/auth/error?error=InsufficientRepos"
      }

      return true
    },

    async jwt({ token, profile }) {
      // On initial sign-in, persist GitHub profile data into the JWT
      if (profile) {
        token.githubId = String(profile.id)
        token.githubLogin = profile.login as string
        token.githubAvatar = profile.avatar_url as string
      }
      return token
    },

    async session({ session, token }) {
      session.user.githubId = token.githubId as string
      session.user.githubLogin = token.githubLogin as string
      session.user.githubAvatar = token.githubAvatar as string
      return session
    },
  },
})
