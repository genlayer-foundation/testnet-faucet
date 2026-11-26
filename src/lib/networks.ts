// GenLayer testnets that run on this faucet's chain (one rollup, one GEN balance).
// They are separate consensus deployments told apart only by contract address,
// so a claim here funds a wallet on every one of them. Edit this list when a
// deployment on the chain starts or retires; the chain itself comes from env.

export type TestnetDeployment = {
  name: string;
  role: string;
  networkPage: string;
  explorer?: string;
};

const DOCS = "https://docs.genlayer.com";

export const testnetDeployments: TestnetDeployment[] = [
  {
    name: "Bradbury Phase 3",
    role: "Preview testnet",
    networkPage: `${DOCS}/developers/networks#testnet-bradbury`,
    explorer: "https://scan.bradbury.genlayer.com",
  },
  {
    name: "Clarke",
    role: "Public testnet",
    networkPage: `${DOCS}/developers/networks#testnet-clarke`,
  },
];

export const docsLinks = {
  developers: `${DOCS}/developers/intelligent-contracts/deploying/network-configuration`,
  validators: `${DOCS}/validators/setup-guide`,
};

export function deploymentNames(): string {
  const names = testnetDeployments.map((d) => d.name);
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
