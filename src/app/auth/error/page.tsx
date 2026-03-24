import Link from "next/link"

const errorMessages: Record<string, { title: string; description: string }> = {
  AccountTooNew: {
    title: "Account Too New",
    description:
      "Your GitHub account must be at least 3 months old to use the faucet. This helps us prevent abuse.",
  },
  InsufficientRepos: {
    title: "No Public Repositories",
    description:
      "Your GitHub account needs at least 1 public repository to use the faucet. This helps us verify you are a real developer.",
  },
  OAuthCallbackError: {
    title: "GitHub Sign-In Failed",
    description:
      "GitHub was unable to complete the sign-in process. This can happen if you denied access or if there was a temporary issue. Please try again.",
  },
}

const defaultError = {
  title: "Authentication Error",
  description:
    "Something went wrong during sign-in. Please try again.",
}

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const { title, description } = errorMessages[error ?? ""] ?? defaultError

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="card-elevated w-full max-w-md rounded-2xl p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-error-light">
          <svg
            className="h-6 w-6 text-error"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
        </div>
        <h1 className="mb-2 text-lg font-semibold text-text-primary">
          {title}
        </h1>
        <p className="mb-6 text-[14px] text-text-secondary">{description}</p>
        <Link
          href="/"
          className="inline-flex h-[40px] items-center justify-center rounded-xl bg-surface-secondary/80 px-6 text-[13px] font-medium text-text-secondary ring-1 ring-black/[0.04] transition-all hover:bg-surface-secondary hover:text-text-primary"
        >
          Back to Faucet
        </Link>
      </div>
    </div>
  )
}
