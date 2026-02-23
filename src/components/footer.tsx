export function Footer() {
  const links = [
    { label: "GenLayer", href: "https://www.genlayer.com" },
    { label: "Docs", href: "https://docs.genlayer.com" },
    { label: "Explorer", href: process.env.NEXT_PUBLIC_EXPLORER_URL || "https://explorer-asimov.genlayer.com" },
    { label: "GitHub", href: "https://github.com/genlayerlabs" },
  ];

  return (
    <footer className="border-t border-border-default px-4 py-6 sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 sm:flex-row sm:justify-between">
        <p className="text-xs tracking-[0.24px] text-text-secondary">
          Powered by GenLayer Foundation
        </p>
        <nav className="flex gap-6">
          {links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs tracking-[0.24px] text-text-secondary transition-colors hover:text-text-primary"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
