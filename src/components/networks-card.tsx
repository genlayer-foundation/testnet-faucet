import { deploymentNames, docsLinks, testnetDeployments } from "@/lib/networks";

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-brand-purple transition-colors hover:text-text-primary"
    >
      {children}
    </a>
  );
}

export function NetworksCard({ chainId, explorerUrl }: { chainId: number; explorerUrl: string }) {
  return (
    <section className="rounded-xl border border-black/[0.04] bg-white p-4">
      <p className="text-[11px] font-medium uppercase tracking-wider text-text-muted">
        One GEN balance, both testnets
      </p>
      <p className="mt-2 text-[13px] leading-relaxed text-text-secondary">
        {deploymentNames()} run on the same chain (ID{" "}
        {chainId}), so GEN from this faucet works on either. Pick the network in your SDK
        or node config; your wallet only needs this one chain.
      </p>

      <ul className="mt-3 divide-y divide-black/[0.04]">
        {testnetDeployments.map((d) => (
          <li key={d.name} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
            <span className="text-[13px] font-semibold text-text-primary">
              {d.name}
              <span className="ml-2 text-[12px] font-normal text-text-muted">{d.role}</span>
            </span>
            <span className="flex gap-4 text-[12px]">
              <ExternalLink href={d.networkPage}>Network</ExternalLink>
              {d.explorer ? (
                <ExternalLink href={d.explorer}>Explorer</ExternalLink>
              ) : (
                <span className="text-text-muted">Explorer soon</span>
              )}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 border-t border-black/[0.04] pt-3 text-[12px]">
        <ExternalLink href={docsLinks.developers}>Developer setup</ExternalLink>
        <ExternalLink href={docsLinks.validators}>Validator setup</ExternalLink>
        <ExternalLink href={explorerUrl}>Chain explorer</ExternalLink>
      </div>
    </section>
  );
}
