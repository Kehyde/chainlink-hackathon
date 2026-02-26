import {
  cre,
  type Runtime,
  type HTTPPayload,
  decodeJson,
  getNetwork,
  bytesToHex,
  hexToBase64,
  TxStatus,
} from "@chainlink/cre-sdk";
import { fetchDexData } from "./httpFetch";
import { encodeAbiParameters, parseAbi, parseAbiParameters } from "viem";

// Simple interface for our HTTP payload
interface RiskPayLoad {
  mode?: string;

  pegDeviation?: number;
  tbillYieldDelta?: number;
  liquidityUSD?: number;
  priceChange24h?: number;
  custodianConcentration?: number;
}

//Defining types from either config.staging or config.production
type Config = {
  evms: Array<{
    oracleAddress: string;
    chainSelectorName: string;
    gasLimit: string;
  }>;
  tokenAddress: string;
};

// --- Simulation Presets ---
const scenarios = {
  normal: {
    pegDeviation: 0.001,
    tbillYieldDelta: 0.005,
    custodianConcentration: 0.3,
  },
  mild_stress: {
    pegDeviation: 0.03,
    tbillYieldDelta: 0.02,
    custodianConcentration: 0.5,
  },
  bank_run: {
    pegDeviation: 0.08,
    tbillYieldDelta: 0.04,
    custodianConcentration: 0.8,
  },
};

// --- Normalized Risk Engine ---
function computeRiskScore(input: Required<Omit<RiskPayLoad, "mode">>): number {
  const pegRisk = Math.min((input.pegDeviation / 0.05) ** 1.5 * 100, 100); //non linear
  const yieldRisk = Math.min((input.tbillYieldDelta / 0.05) * 100, 100);

  const liquidityRisk = Math.min(
    (5_000_000 / Math.max(input.liquidityUSD, 1)) * 100,
    100,
  );

  // Volatility Risk (24h price change, assumed decimal format)
  const volatilityRisk = Math.min(
    (Math.abs(input.priceChange24h) / 0.05) * 100,
    100,
  );

  const concentrationRisk = Math.min(input.custodianConcentration * 100, 100);

  const riskScore =
    pegRisk * 0.45 +
    yieldRisk * 0.2 +
    liquidityRisk * 0.15 +
    volatilityRisk * 0.1 +
    concentrationRisk * 0.1;

  return Math.round(riskScore);
}

//ABI parameters for tokenData
const ORACLE_PARAMS = parseAbiParameters("address token, uint8 score");

export function onHttpTrigger(
  runtime: Runtime<Config>,
  payload: HTTPPayload,
): string {
  runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  runtime.log("CRE Workflow: HTTP Trigger - Risk Analysis");
  runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // Step 1: Parse and validate the incoming payload
  if (!payload.input || payload.input.length === 0) {
    runtime.log("[ERROR] Empty request payload");
    return "Error: Empty request";
  }

  const inputData = decodeJson(payload.input) as RiskPayLoad;
  runtime.log("[Step 1] Received risk inputs");
  runtime.log(JSON.stringify(inputData));

  let finalInputs;

  // --- Mode Handling ---
  if (inputData.mode && inputData.mode !== "manual") {
    const scenario = scenarios[inputData.mode as keyof typeof scenarios];

    if (!scenario) {
      runtime.log("[ERROR] Invalid simulation mode");
      return "Error: Invalid simulation mode";
    }

    runtime.log(`[Mode] Simulation: ${inputData.mode}`);
    finalInputs = scenario;
  } else {
    runtime.log("[Mode] Manual input");

    if (
      inputData.pegDeviation === undefined ||
      inputData.tbillYieldDelta === undefined ||
      inputData.custodianConcentration === undefined
    ) {
      runtime.log("[ERROR] Missing required risk parameters");
      return "Error: Missing risk parameters";
    }

    finalInputs = {
      pegDeviation: inputData.pegDeviation,
      tbillYieldDelta: inputData.tbillYieldDelta,
      custodianConcentration: inputData.custodianConcentration,
    };
  }

  runtime.log("[Base Inputs Used]");
  runtime.log(JSON.stringify(finalInputs));

  // --- Fetch live liquidity + price data
  const dexData = fetchDexData(runtime);

  runtime.log("[DEX DATA]");
  runtime.log(JSON.stringify(dexData));

  // Merge market data into risk inputs
  const enrichedInputs = {
    ...finalInputs,
    liquidityUSD: dexData.liquidityUSD,
    priceChange24h: dexData.priceChange24h,
  };

  runtime.log("[Calculating Risk Score...]");

  const riskScore = computeRiskScore(enrichedInputs);
  runtime.log(`[Step 2] Computed Risk Score: ${riskScore}`);

  //get network and create EVM client
  const evmConfig = runtime.config.evms[0];
  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: evmConfig.chainSelectorName,
    isTestnet: true,
  });

  if (!network) {
    throw new Error(`unkown chain: ${evmConfig.chainSelectorName}`);
  }

  runtime.log("[Selecting Chain]");
  runtime.log(`[Target chain]: ${evmConfig.chainSelectorName}`);
  runtime.log(`[Contract address]: ${evmConfig.oracleAddress}`);

  const evmClient = new cre.capabilities.EVMClient(
    network.chainSelector.selector,
  );

  //encode the token data for the smart contract
  runtime.log("Encoding token data...");
  const tokenAddress = runtime.config.tokenAddress;
  const reportData = encodeAbiParameters(ORACLE_PARAMS, [
    tokenAddress as `0x${string}`,
    riskScore,
  ]);

  //generate signed cre report
  const reportResponse = runtime
    .report({
      encodedPayload: hexToBase64(reportData),
      encoderName: "evm",
      signingAlgo: "ecdsa",
      hashingAlgo: "keccak256",
    })
    .result();

  //write report to contract
  const writeResult = evmClient
    .writeReport(runtime, {
      receiver: evmConfig.oracleAddress,
      report: reportResponse,
      gasConfig: {
        gasLimit: evmConfig.gasLimit,
      },
    })
    .result();

  if (writeResult.txStatus === TxStatus.SUCCESS) {
    const txHash = bytesToHex(writeResult.txHash || new Uint8Array(32));
    runtime.log(`✓ Transaction successful: ${txHash}`);
    return txHash;
  }

  throw new Error(`Transaction failed: ${writeResult.txStatus}`);
}
