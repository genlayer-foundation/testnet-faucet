import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
  formatEther,
  type Hash,
} from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { mainnet } from "viem/chains";
import { getGenlayerChain } from "./chain";

let account: PrivateKeyAccount | null = null;
let walletClient: ReturnType<typeof createWalletClient> | null = null;
let publicClient: ReturnType<typeof createPublicClient> | null = null;

function getAccount(): PrivateKeyAccount {
  if (!account) {
    account = privateKeyToAccount(
      process.env.FAUCET_PRIVATE_KEY as `0x${string}`
    );
  }
  return account;
}

function getClients() {
  if (!walletClient || !publicClient) {
    const chain = getGenlayerChain();

    walletClient = createWalletClient({
      account: getAccount(),
      chain,
      transport: http(process.env.RPC_URL),
    });

    publicClient = createPublicClient({
      chain,
      transport: http(process.env.RPC_URL),
    });
  }
  return { walletClient: walletClient!, publicClient: publicClient! };
}

export async function sendGEN(toAddress: `0x${string}`): Promise<Hash> {
  const claimAmount = Number(process.env.CLAIM_AMOUNT) || 100;
  const { walletClient } = getClients();

  const chain = getGenlayerChain();
  const hash = await walletClient.sendTransaction({
    account: getAccount(),
    chain,
    to: toAddress,
    value: parseEther(String(claimAmount)),
  });

  return hash;
}

export async function getRecipientBalance(
  address: `0x${string}`
): Promise<bigint> {
  const { publicClient } = getClients();
  return publicClient.getBalance({ address });
}

export async function getFaucetBalance(): Promise<string> {
  const { publicClient } = getClients();
  const balance = await publicClient.getBalance({ address: getAccount().address });
  return formatEther(balance);
}

export async function isRecipientEligible(
  address: `0x${string}`
): Promise<boolean> {
  const threshold = Number(process.env.BALANCE_THRESHOLD) || 1000;
  const balance = await getRecipientBalance(address);
  return balance < parseEther(String(threshold));
}

// Ethereum mainnet client for balance verification
let mainnetPublicClient: ReturnType<typeof createPublicClient> | null = null;

function getMainnetClient() {
  if (!mainnetPublicClient) {
    const rpcUrl = process.env.ETHEREUM_RPC_URL || "https://cloudflare-eth.com";
    if (!process.env.ETHEREUM_RPC_URL) {
      console.warn("ETHEREUM_RPC_URL not set, falling back to public endpoint");
    }
    mainnetPublicClient = createPublicClient({
      chain: mainnet,
      transport: http(rpcUrl, { timeout: 5000, retryCount: 1 }),
    });
  }
  return mainnetPublicClient;
}

export async function checkMainnetEthBalance(
  address: `0x${string}`
): Promise<{ eligible: boolean; balance: string }> {
  const minBalance = Number(process.env.MIN_ETH_BALANCE ?? 0.01);
  const client = getMainnetClient();
  const balance = await client.getBalance({ address });
  const formatted = formatEther(balance);
  return {
    eligible: balance >= parseEther(String(minBalance)),
    balance: formatted,
  };
}
