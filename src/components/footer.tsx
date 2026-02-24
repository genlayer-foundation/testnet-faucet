export function Footer() {
  const links = [
    { label: "Website", href: "https://www.genlayer.com" },
    { label: "Docs", href: "https://docs.genlayer.com" },
    {
      label: "Explorer",
      href:
        process.env.NEXT_PUBLIC_EXPLORER_URL ||
        "https://explorer-asimov.genlayer.com",
    },
    { label: "GitHub", href: "https://github.com/genlayerlabs" },
  ];

  return (
    <footer className="border-t border-border-default bg-surface">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-6 py-5 sm:flex-row sm:justify-between">
        <p className="text-xs tracking-[0.24px] text-text-muted">
          GenLayer Foundation
        </p>
        <nav className="flex gap-6">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs tracking-[0.24px] text-text-muted transition-colors hover:text-text-primary"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
