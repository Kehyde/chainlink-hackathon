import {
  cre,
  ok,
  consensusIdenticalAggregation,
  type Runtime,
  type HTTPSendRequester,
} from "@chainlink/cre-sdk";

type Config = {
  evms: Array<{
    oracleAddress: string;
    chainSelectorName: string;
    gasLimit: string;
  }>;
  tokenAddress: string;
};

// --- Interface for api response ---
interface DexScreenerResponse {
  schemaVersion: string;
  pairs: DexPair[];
}

// --- Interface for the JSON of DexPair ---
interface DexPair {
  chainId: string;
  dexId: string;
  baseToken: {
    address: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    symbol: string;
  };
  priceUsd: string;
  priceChange?: {
    h1?: number;
    h24?: number;
  };
  liquidity?: {
    usd?: number;
  };
}

//Defining Dexdata the internal type this workflow will use
interface DexData {
  liquidityUSD: number;
  priceChange24h: number;
}

// --- Fetching Function To Obtain Dexscreener Data on USDC ---
export function fetchDexData(runtime: Runtime<Config>): DexData {
  runtime.log("[DexScreener] Fetching Current Market Data...");

  const httpClient = new cre.capabilities.HTTPClient();

  const result = httpClient
    .sendRequest(runtime, buildFetch(), consensusIdenticalAggregation<DexData>())(
      runtime.config,
    )
    .result();

  runtime.log(`[DexScreener] Liquidity: ${result.liquidityUSD}`);
  runtime.log(`[DexScreener] 24h Change: ${result.priceChange24h}`);

  return result;
}

// --- Builder Function to structure the request ---
const buildFetch =
  () =>
  (sendRequester: HTTPSendRequester, config: Config): DexData => {
    const req = {
      url: "https://api.dexscreener.com/latest/dex/tokens/0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
      method: "GET" as const,
      cacheSettings: {
        store: true,
        maxAge: "30s",
      },
      // ^^^cacheSettings is ensuring the first node stores the response in community cache,
      //  all other nodes in the DON are checking the cache.
    };

    const resp = sendRequester.sendRequest(req).result();
    const bodyText = new TextDecoder().decode(resp.body);

    if (!ok(resp)) {
      throw new Error(`Dex API error: ${resp.statusCode} - ${bodyText}`);
    }

    const data = JSON.parse(bodyText) as DexScreenerResponse;

    const pair = data.pairs.find(
      (p) =>
        p.chainId === "ethereum" &&
        p.baseToken.symbol === "USDC" &&
        p.quoteToken.symbol === "USDT",
    );

    if (!pair) {
      throw new Error("USDC/USDT pair not found on Ethereum");
    }

    return {
      liquidityUSD: pair.liquidity?.usd ?? 0,
      priceChange24h: Math.abs(pair.priceChange?.h24 ?? 0) / 100,
    };
  };
