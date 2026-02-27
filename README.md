# Custos | Chainlink Hackathon Project

This repository contains the Solidity smart contracts for the **Custos** project, built using [Foundry](https://github.com/foundry-rs/foundry) and [Forge](https://book.getfoundry.sh/forge/overview).

## Overview

### Purpose
This **Chainlink Hackathon Project** implements a **Risk Oracle** system that automates the retrieval and updating of risk scores for tokens on-chain. This project was built to explore **Chainlink Runtime Environment (CRE)** workflows while demonstrating how off-chain data can be securely ingested and verified before being recorded on Ethereum-based smart contracts.  

The goal was to create a **trustworthy, automated infrastructure layer** that can power on-chain risk evaluation, lending protocols, insurance systems, or any DeFi application that relies on external data.


## Project Structure
```bash
chainlink-hackathon/
├── contracts/                    # Solidity smart contract code
│   ├── RiskOracle.sol
│   ├── interfaces/               # Interfaces for your contracts to communicate with the KeystoneForwarder
│       ├── IReceiver.sol
│       └── ReceiverTemplate.sol
├── custos_workflow/              # CRE workflow project
│   ├── main.ts
│   ├── httpCallback.ts
│   ├── project.yaml
│   ├── secrets.yaml
│   ├── config.staging.json
│   ├── package.json
│   ├── tsconfig.json
│   └── README (optional tutorial / notes)
├── .gitignore                   # Git ignore rules
├── foundry.lock                 # Foundry dependencies lockfile
├── JSON-inputs.txt              # Example inputs for simulation
├── project.yaml                 # CRE workflow root config
├── secrets.yaml                 # Secrets mapping for CRE
└── README.md                   # Project documentation

```
## Architecture & Flow
This project is composed of two main layers:

1. **CRE Workflow Layer (`custos_workflow/`)**
2. **On-chain Oracle Layer (`contracts/`)**

Here's how data flows end-to-end:
#### 1. Off-chain Data Collection
- The CRE workflow, written in **TypeScript**, gathers off-chain data from external sources (eventually POR supplied by banking API) Currently off-chain data stems from CLI input.  
- The workflow is configured to trigger via an HTTP request.  
- Collected data includes a token pairs **liquidity** and is provided a corresponding **risk score** (0–100). Based on liquidity from DEX's and CLI input (simulating POR data)

#### 2. Chainlink CRE Processing
- Once the workflow calculates the risk data, it encodes the report in **ABI format** and sends it to a **Chainlink Keystone Forwarder**.  
- The forwarder acts as a trusted bridge, ensuring the report originates from the expected workflow and preventing unauthorized updates.

#### 3. On-chain RiskOracle Contract
- The `riskOracle` contract inherits from `ReceiverTemplate`, which enforces **security checks**:
  - Only allows calls from the trusted forwarder address.
  - Optional checks for workflow author, workflow name, or workflow ID.
- The contract receives the encoded report via `onReport()`, decodes it, and updates the mapping:

```solidity
mapping(address => RiskData) public risks;
struct RiskData {
    uint8 riskScore;
    uint256 lastUpdated;
}
```
- Finally, it emits a RiskUpdated event for transparency and easy tracking. The event allows future infrastructure to read the contract with ease.

## Security Features
- `Forwarder Verification`: Only the configured Chainlink forwarder can submit reports.
- `Workflow Validation`: Optionally verifies the workflow’s author, name, and ID to prevent malicious or misconfigured reports.
- `Immutable Data Storage`: Risk scores and timestamps are stored on-chain, providing a tamper-proof record.

## Why I built Custos
- To experiment with CRE workflows and learn the full lifecycle of off-chain → on-chain data pipelines.
- To provide a trustworthy risk layer for DeFi or any application needing validated risk metrics.
- To demonstrate how a CRE + Oracle integration can become a reusable infrastructure layer for the broader ecosystem.

## Infrastructure layer potential
This project is more than a hackathon demo. Custos represents a blueprint for a modular, secure data pipeline:

- Automated Risk Layer: Other smart contracts can query the `riskOracle` for live risk scores without building their own oracle infrastructure.
- Composable Data Feeds: Multiple CRE workflows could feed the same contract, enabling multi-source verification and improved reliability.
- Cross-Chain Readiness: With Chainlink CRE, the same pattern could be extended to multiple chains or Layer 2 networks, providing a unified risk scoring system across ecosystems.

In short, this project demonstrates a decentralized, secure, and extensible infrastructure layer that connects off-chain intelligence to on-chain applications, paving the way for more robust DeFi systems.

## Setup & Installation
To run the workflow natively on your machine please follow along.
```bash
git clone https://github.com/Kehyde/chainlink-hackathon
```
### Install Dependencies
```bash
cd custos_workflow
npm install
cd ../
forge install
```
### Compile Contracts
```bash
cd contracts
forge build
```
### **Usage / How to Run the CRE Workflow**
Trigger the CRE workflow using the HTTP callback or CLI simulation:

```bash
cd custos
cre workflow simulate custos_workflow --broadcast
```
CRE Inputs:
- High risk
```bash
{"mode": "manual", "pegDeviation": 0.04, "tbillYieldDelta": 0.08, "custodianConcentration": 0.6}
```
- Mild risk
```bash
{"mode": "manual", "pegDeviation": 0.02, "tbillYieldDelta": 0.05, "custodianConcentration": 0.5}
```
- Low risk
```bash
{"mode": "manual", "pegDeviation": 0.01, "tbillYieldDelta": 0.01, "custodianConcentration": 0.4}
```
### CRE output
The CRE will output steps informing the user of the current process the CRE is executing. 
```bash
2026-02-26T19:43:44Z [SIMULATION] Simulator Initialized

2026-02-26T19:43:44Z [SIMULATION] Running trigger trigger=http-trigger@1.0.0-alpha
2026-02-26T19:43:44Z [USER LOG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2026-02-26T19:43:44Z [USER LOG] CRE Workflow: HTTP Trigger - Risk Analysis
2026-02-26T19:43:44Z [USER LOG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2026-02-26T19:43:44Z [USER LOG] [Step 1] Received risk inputs
2026-02-26T19:43:44Z [USER LOG] {"custodianConcentration":0.8,"mode":"manual","pegDeviation":0.05,"tbillYieldDelta":0.1}
2026-02-26T19:43:44Z [USER LOG] [Mode] Manual input
2026-02-26T19:43:44Z [USER LOG] [Base Inputs Used]
2026-02-26T19:43:44Z [USER LOG] {"pegDeviation":0.05,"tbillYieldDelta":0.1,"custodianConcentration":0.8}
2026-02-26T19:43:44Z [USER LOG] [DexScreener] Fetching Current Market Data...
2026-02-26T19:43:44Z [USER LOG] [DexScreener] Liquidity: 2650209.07
2026-02-26T19:43:44Z [USER LOG] [DexScreener] 24h Change: 0
2026-02-26T19:43:44Z [USER LOG] [DEX DATA]
2026-02-26T19:43:44Z [USER LOG] {"liquidityUSD":2650209.07,"priceChange24h":0}
2026-02-26T19:43:44Z [USER LOG] [Calculating Risk Score...]
2026-02-26T19:43:44Z [USER LOG] [Step 2] Computed Risk Score: 88
2026-02-26T19:43:44Z [USER LOG] [Selecting Chain]
2026-02-26T19:43:44Z [USER LOG] [Target chain]: ethereum-testnet-sepolia
2026-02-26T19:43:44Z [USER LOG] [Contract address]: 0x54A0174D161F0555632279bc15Fee63ECe511bbd
2026-02-26T19:43:44Z [USER LOG] Encoding token data...
2026-02-26T19:43:49Z [USER LOG] ✓ Transaction successful: 0xfa797608b36f5dce08827b9a812f442912b0c55187a7aa8ad7b111f8b16568ef

Workflow Simulation Result:
 "0xfa797608b36f5dce08827b9a812f442912b0c55187a7aa8ad7b111f8b16568ef"
```
- After completing the workflow the CRE will output the contract address `0x54A0174D161F0555632279bc15Fee63ECe511bbd`, as well as a trarsaction hash `0xfa797608b36f5dce08827b9a812f442912b0c55187a7aa8ad7b111f8b16568ef`. 
- Feel free to verify transactions on Seploia-Etherscan (in order to see the transactions, you must select internal-transactions tab and toggle `advanced mode`.

## Media
Media coming soon.

## Roadmap
- Integrate with live external Proof of Reserves (POR) APIs for real-time risk scoring.
- Extend RiskOracle to support multiple chains, other DEX's, and multiple token pairs (cross-chain CRE reporting).
- Build front-end dashboard to visualize on-chain risk data.

## License
The license to this code is MIT.

### Credit
- Built during the Chainlink CRE Hackathon.
- Powered by Chainlink, Foundry, and OpenZeppelin.
