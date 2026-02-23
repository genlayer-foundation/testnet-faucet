import Link from "next/link";

export function Header() {
  return (
    <header className="border-b border-border-default px-4 py-3 sm:px-6">
      <div className="mx-auto flex max-w-5xl items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <svg
            width="32"
            height="32"
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M16 2L3 9.5V22.5L16 30L29 22.5V9.5L16 2Z"
              fill="#131214"
            />
            <path
              d="M16 7L8 11.5V20.5L16 25L24 20.5V11.5L16 7Z"
              fill="white"
            />
            <path d="M16 12L12 14.5V19.5L16 22L20 19.5V14.5L16 12Z" fill="#131214" />
          </svg>
          <span className="text-xl font-medium tracking-[-0.64px] text-text-primary">
            GenLayer
          </span>
        </Link>
        <span className="rounded-full bg-brand-purple-light px-3 py-1.5 text-xs font-medium tracking-[0.24px] text-brand-purple">
          Testnet Asimov
        </span>
      </div>
    </header>
  );
}
