# The Praise Board

A small, decentralized appreciation board for the Ethereum Sepolia testnet. Supporters connect MetaMask, send test ETH with a short note, and see confirmed tips sourced from the deployed contract's `TipReceived` events. No database or fabricated entries are used.

> **Deployment status:** Pending. No contract address has been supplied or deployed yet. The frontend deployment artifact contains the ABI and awaits an address.

## Features

- Solidity contract validates positive tips and nonempty notes of at most 280 UTF-8 bytes.
- On-chain records, totals, and `TipReceived` event for each tip.
- Owner-only, reentrancy-protected withdrawal.
- Sepolia-only deployment configuration and MetaMask network checks.
- Event-driven public supporter wall with Sepolia Etherscan transaction links.
- Plain HTML, CSS, and JavaScript frontend using ethers.js.

## Architecture

- `contracts/PraiseBoard.sol`: immutable owner and append-only public tip records.
- `scripts/deploy.js`: deploys the contract and writes its address, deployment transaction hash, chain ID, deployment block, and ABI to `frontend/deployment.json`.
- `test/PraiseBoard.js`: Hardhat tests for valid tips, event emission, input validation, totals, and withdrawals.
- `frontend/`: static UI. It reads the on-chain totals and paginates event queries in 5,000-block chunks through MetaMask's EIP-1193 provider. A connected wallet is not needed to display an account or request access for read-only calls.

## Prerequisites

- Node.js 20 or newer and npm.
- MetaMask browser extension.
- A free QuickNode Sepolia endpoint.
- A separate burner wallet, with a small amount of Sepolia test ETH for deployment.

This project is testnet-only. Do not fund the burner with real ETH or use a wallet containing valuable assets.

## Install

```powershell
npm install
Copy-Item .env.example .env
```

Edit `.env` locally and enter `QUICKNODE_SEPOLIA_URL` plus the burner wallet's `PRIVATE_KEY`. `.env` is ignored by Git. Never paste the private key or recovery phrase into chat, source code, frontend files, or a public repository.

### Get a QuickNode Sepolia RPC URL

Create a free account at [QuickNode](https://www.quicknode.com/), create an Ethereum endpoint, select **Sepolia**, and copy the HTTPS endpoint URL from its dashboard. Put it in `.env` as `QUICKNODE_SEPOLIA_URL`. Free-plan availability and quotas are controlled by QuickNode; do not publish the endpoint token.

### Get free Sepolia test ETH

Use a faucet linked from the [Sepolia network page](https://ethereum.org/en/developers/docs/networks/#sepolia) or a reputable Sepolia faucet. Request funds for the burner wallet address only. Faucet requirements and availability may change. Test ETH has no real-world value.

## Compile and test

```powershell
npm run compile
npm test
```

Tests run against Hardhat's local in-memory network; they do not spend funds or require QuickNode credentials.

## Deploy to Sepolia

1. Confirm `.env` has the QuickNode Sepolia URL and a funded burner wallet's private key.
2. Review the burner account and network settings. Never use a primary wallet.
3. Deploy:

```powershell
npm run deploy:sepolia
```

The command verifies the Sepolia chain ID, deploys `PraiseBoard`, prints network, deployer, contract address, and transaction hash, and updates `frontend/deployment.json` with the real contract ABI/address/deployment block. Deployment costs only Sepolia test ETH for gas.

After successful deployment, update the deployment status in this README with the printed contract address and link to `https://sepolia.etherscan.io/address/<ADDRESS>`. Until a deployment actually succeeds, the address is **pending**.

## Start the frontend

With dependencies installed, run:

```powershell
npm run frontend
```

Open [http://localhost:8080](http://localhost:8080). A deployment address is needed to query a deployed contract; before deployment, the page reports that the address is pending. The page fetches `deployment.json`, so do not open `index.html` directly with a `file://` URL.

## MetaMask and end-to-end test

1. In MetaMask, enable/add **Ethereum Sepolia** (chain ID `11155111`, currency `ETH`). Use MetaMask's built-in Sepolia test network option when available. If it is not listed, add it manually using Ethereum's official Sepolia network details.
2. Import or select a burner wallet, then use a faucet to get Sepolia ETH.
3. Start the frontend after deployment. Confirm the Sepolia indicator and on-chain totals load.
4. Connect the wallet. Approve the connection only in MetaMask.
5. Enter a positive test ETH amount and note (up to 280 UTF-8 bytes), submit, and approve the transaction in MetaMask.
6. The page displays the pending transaction hash, waits for a successful receipt, then refreshes the event-based supporter wall.
7. Use the transaction link or search the contract address in [Sepolia Etherscan](https://sepolia.etherscan.io/). You can independently verify the event logs and contract activity there.

Notes are public and permanently recorded on-chain. Transactions are irreversible after confirmation. Never put personal, confidential, or sensitive information in a note. If MetaMask requests a network switch, verify Sepolia before approving; the application refuses to read or send on a different chain.

## Security and limitations

- The contract has no admin path to add, edit, or delete tip records. The owner can withdraw the accumulated balance; the public historical totals/events remain.
- Withdrawals use a checks-effects-interactions pattern and a reentrancy lock. Tips and withdrawals are irreversible once confirmed.
- The frontend wall uses the connected browser's MetaMask provider to query the selected Sepolia chain. No backend, database, localStorage, mock data, or paid hosting is required. For high-volume history, an RPC provider may impose additional event-query limits.
- The deployed contract has no upgrade mechanism. Review the source before deployment.
- The included frontend ethers.js and fonts are loaded from CDNs, so initial page loading requires internet access.
- Never deploy this configuration to mainnet. The supplied private key is read only by the local deployment script; never commit `.env`.
