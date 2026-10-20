import assert from "node:assert/strict";
import { test } from "node:test";
import { getGenlayerChain } from "../src/lib/chain.ts";

test("network configuration follows env and never falls back to another chain", () => {
  const configuration = {
    NEXT_PUBLIC_CHAIN_ID: "12345",
    NEXT_PUBLIC_CHAIN_NAME: "Example Testnet",
    NEXT_PUBLIC_RPC_URL: "https://rpc.example.invalid",
    NEXT_PUBLIC_EXPLORER_URL: "https://explorer.example.invalid///",
    RPC_URL: "https://private.example.invalid/secret",
  };
  const previous = Object.fromEntries(
    Object.keys(configuration).map((key) => [key, process.env[key]])
  );

  try {
    Object.assign(process.env, configuration);
    const chain = getGenlayerChain();
    assert.equal(chain.id, 12345);
    assert.equal(chain.name, "Example Testnet");
    assert.equal(chain.rpcUrls.default.http[0], configuration.NEXT_PUBLIC_RPC_URL);
    assert.equal(chain.blockExplorers.default.url, "https://explorer.example.invalid");
    assert.equal(chain.nativeCurrency.symbol, "GEN");
    assert.equal(chain.nativeCurrency.decimals, 18);
    assert.ok(!JSON.stringify(chain).includes(configuration.RPC_URL));

    for (const key of Object.keys(configuration).filter((key) => key !== "RPC_URL")) {
      delete process.env[key];
      assert.throws(() => getGenlayerChain(), undefined, `${key} must be required`);
      process.env[key] = configuration[key];
    }
    for (const value of ["", "0", "-1", "1.5", "not-a-chain", "9007199254740992"]) {
      process.env.NEXT_PUBLIC_CHAIN_ID = value;
      assert.throws(() => getGenlayerChain());
    }
    process.env.NEXT_PUBLIC_CHAIN_ID = configuration.NEXT_PUBLIC_CHAIN_ID;
    for (const key of ["NEXT_PUBLIC_RPC_URL", "NEXT_PUBLIC_EXPLORER_URL"]) {
      for (const value of ["", "not-a-url", "javascript:alert(1)", "wss://rpc.example.invalid"]) {
        process.env[key] = value;
        assert.throws(() => getGenlayerChain());
      }
      process.env[key] = configuration[key];
    }
    process.env.NEXT_PUBLIC_CHAIN_NAME = " ";
    assert.throws(() => getGenlayerChain());
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
