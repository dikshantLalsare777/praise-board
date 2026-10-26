const SEPOLIA_CHAIN_ID = 11155111n;
const SEPOLIA_HEX_CHAIN_ID = "0xaa36a7";
const EXPLORER = "https://sepolia.etherscan.io";
const CHUNK_SIZE = 5000;

const ui = {
  connect: document.getElementById("connectButton"),
  address: document.getElementById("walletAddress"),
  networkLabel: document.getElementById("networkLabel"),
  networkDot: document.getElementById("networkDot"),
  form: document.getElementById("tipForm"),
  amount: document.getElementById("amount"),
  note: document.getElementById("note"),
  byteCount: document.getElementById("byteCount"),
  send: document.getElementById("sendButton"),
  notice: document.getElementById("notice"),
  totalTips: document.getElementById("totalTips"),
  totalAmount: document.getElementById("totalAmount"),
  status: document.getElementById("wallStatus"),
  list: document.getElementById("supporterList"),
  refresh: document.getElementById("refreshButton"),
};

let deployment;
let readProvider;
let signer;
let connectedAddress;
let readContract;

function showNotice(message, kind = "info") {
  ui.notice.textContent = message;
  ui.notice.className = `notice ${kind}`;
  ui.notice.hidden = false;
}

function friendlyError(error) {
  const code = error?.code ?? error?.info?.error?.code;
  if (code === 4001 || code === "ACTION_REJECTED") return "The wallet request was cancelled. Nothing was sent.";
  const text = `${error?.shortMessage || error?.reason || error?.message || ""}`.toLowerCase();
  if (text.includes("metamask")) return "MetaMask was not detected. Install or enable MetaMask to use the Sepolia supporter wall.";
  if (text.includes("not been deployed")) return "The contract address is still pending. Deploy the contract to Sepolia, then refresh this page.";
  if (text.includes("deployment artifact")) return "Could not load deployment.json. Serve frontend/ over HTTP and check the deployment artifact.";
  if (text.includes("not configured in metamask")) return "Sepolia is not configured in MetaMask. Add Ethereum Sepolia (chain ID 11155111) manually, then reconnect.";
  if (text.includes("sepolia")) return error.message || error.shortMessage;
  if (text.includes("insufficient funds")) return "Not enough Sepolia ETH for this tip and its gas fee. Get test ETH from a Sepolia faucet.";
  if (text.includes("user rejected") || text.includes("rejected the request")) return "The wallet request was cancelled. Nothing was sent.";
  if (text.includes("network") || text.includes("fetch") || text.includes("timeout")) return "Could not reach the Sepolia RPC. Check your connection and try again.";
  if (text.includes("missing revert data") || text.includes("execution reverted")) return "The contract rejected the transaction. Check the tip amount and note.";
  return error?.shortMessage || error?.reason || error?.message || "Something went wrong. Please try again.";
}

async function loadDeployment() {
  try {
    const response = await fetch("./deployment.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Deployment artifact request failed (${response.status}).`);
    deployment = await response.json();
    if (!Array.isArray(deployment.abi) || deployment.abi.length === 0) {
      throw new Error("Deployment artifact does not include the contract ABI.");
    }
    if (deployment.chainId !== Number(SEPOLIA_CHAIN_ID)) {
      throw new Error("The deployment artifact is not configured for Sepolia.");
    }
  } catch (error) {
    ui.status.textContent = "Could not load deployment details. Serve frontend/ over HTTP and check deployment.json.";
    showNotice(friendlyError(error), "error");
  }
}

function contractAddress() {
  if (!deployment?.address || !/^0x[0-9a-fA-F]{40}$/.test(deployment.address)) {
    throw new Error("The contract has not been deployed yet. Deploy it to Sepolia and refresh this page.");
  }
  return deployment.address;
}

function abbreviate(address) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function bytesLength(value) {
  return new TextEncoder().encode(value).length;
}

function updateNoteCount() {
  const count = bytesLength(ui.note.value);
  ui.byteCount.textContent = `${count} / 280 bytes`;
  ui.byteCount.style.color = count > 280 ? "#a34636" : "";
}

async function verifySepolia(provider) {
  const network = await provider.getNetwork();
  if (network.chainId !== SEPOLIA_CHAIN_ID) throw new Error("Switch MetaMask to Ethereum Sepolia before continuing.");
}

async function updateNetworkStatus() {
  if (!window.ethereum) {
    ui.networkLabel.textContent = "MetaMask not detected";
    ui.networkDot.classList.add("is-unknown");
    ui.networkDot.classList.remove("is-wrong");
    return;
  }
  try {
    const chainId = await window.ethereum.request({ method: "eth_chainId" });
    const isSepolia = BigInt(chainId) === SEPOLIA_CHAIN_ID;
    ui.networkLabel.textContent = isSepolia ? "Sepolia testnet" : "Wrong network";
    ui.networkDot.classList.toggle("is-wrong", !isSepolia);
    ui.networkDot.classList.toggle("is-unknown", false);
  } catch {
    ui.networkLabel.textContent = "Network unavailable";
    ui.networkDot.classList.add("is-unknown");
    ui.networkDot.classList.remove("is-wrong");
  }
}

async function verifyDeployedContract(provider) {
  await verifySepolia(provider);
  const address = contractAddress();
  const code = await provider.getCode(address);
  if (code === "0x" || /^0x0*$/i.test(code)) {
    throw new Error("No contract code was found at the configured address on Sepolia. Check deployment.json.");
  }
}

async function ensureSepolia() {
  if (!window.ethereum) throw new Error("MetaMask was not detected. Install MetaMask to connect a wallet.");
  const provider = new ethers.BrowserProvider(window.ethereum);
  const network = await provider.getNetwork();
  if (network.chainId === SEPOLIA_CHAIN_ID) return provider;
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: SEPOLIA_HEX_CHAIN_ID }],
    });
  } catch (error) {
    if (error.code === 4902) {
      throw new Error("Sepolia is not configured in MetaMask. Add the Ethereum Sepolia test network in MetaMask, then reconnect.");
    }
    throw error;
  }
  const updated = new ethers.BrowserProvider(window.ethereum);
  await verifySepolia(updated);
  return updated;
}

async function connectWallet() {
  try {
    if (!window.ethereum) throw new Error("MetaMask was not detected. Install MetaMask to connect a wallet.");
    contractAddress();
    const provider = await ensureSepolia();
    await updateNetworkStatus();
    await verifyDeployedContract(provider);
    const accounts = await provider.send("eth_requestAccounts", []);
    if (!accounts.length) throw new Error("MetaMask did not return an account.");
    signer = await provider.getSigner(accounts[0]);
    connectedAddress = accounts[0];
    ui.address.textContent = abbreviate(connectedAddress);
    ui.address.hidden = false;
    ui.connect.hidden = true;
    showNotice("Wallet connected to Sepolia. Tips use test ETH only.", "success");
  } catch (error) {
    showNotice(friendlyError(error), "error");
  }
}

function appendTip(event, timestamp) {
  const item = document.createElement("article");
  item.className = "supporter";
  const top = document.createElement("div");
  top.className = "supporter-top";
  const address = document.createElement("span");
  address.className = "supporter-address";
  address.textContent = abbreviate(event.args.supporter);
  const amount = document.createElement("span");
  amount.className = "supporter-amount";
  amount.textContent = `${ethers.formatEther(event.args.amount)} ETH`;
  top.append(address, amount);

  const note = document.createElement("p");
  note.className = "supporter-note";
  note.textContent = event.args.note;
  const meta = document.createElement("div");
  meta.className = "supporter-meta";
  const date = document.createElement("span");
  date.textContent = new Date(Number(timestamp) * 1000).toLocaleString();
  const tx = document.createElement("a");
  tx.href = `${EXPLORER}/tx/${event.transactionHash}`;
  tx.target = "_blank";
  tx.rel = "noopener noreferrer";
  tx.textContent = "View transaction ↗";
  meta.append(date, tx);
  item.append(top, note, meta);
  ui.list.append(item);
}

async function refreshWall() {
  ui.status.hidden = false;
  ui.status.textContent = "Loading verified Sepolia tips…";
  ui.list.replaceChildren();
  try {
    contractAddress();
    if (!window.ethereum) throw new Error("Install MetaMask to read the Sepolia supporter wall.");
    readProvider = new ethers.BrowserProvider(window.ethereum);
    await verifyDeployedContract(readProvider);
    readContract = new ethers.Contract(deployment.address, deployment.abi, readProvider);

    const [count, total, latestBlock] = await Promise.all([
      readContract.getTotalTipCount(),
      readContract.totalAmountReceived(),
      readProvider.getBlockNumber(),
    ]);
    ui.totalTips.textContent = count.toString();
    ui.totalAmount.textContent = Number(ethers.formatEther(total)).toFixed(4);

    const events = [];
    const fromBlock = Number.isSafeInteger(deployment.deploymentBlock) ? deployment.deploymentBlock : 0;
    for (let start = fromBlock; start <= latestBlock; start += CHUNK_SIZE) {
      const end = Math.min(start + CHUNK_SIZE - 1, latestBlock);
      events.push(...await readContract.queryFilter(readContract.filters.TipReceived(), start, end));
    }

    for (const event of events.reverse()) {
      const block = await readProvider.getBlock(event.blockNumber);
      appendTip(event, block.timestamp);
    }
    ui.status.textContent = events.length === 0
      ? "No tips yet. Be the first to leave a little praise."
      : `${events.length} on-chain ${events.length === 1 ? "tip" : "tips"} shown — verify any entry on Sepolia Etherscan.`;
  } catch (error) {
    ui.status.textContent = friendlyError(error);
    if (error.message?.includes("contract has not been deployed")) {
      ui.totalTips.textContent = "—";
      ui.totalAmount.textContent = "—";
    }
  }
}

async function submitTip(event) {
  event.preventDefault();
  try {
    contractAddress();
    const rawAmount = ui.amount.value.trim();
    const note = ui.note.value;
    const noteBytes = bytesLength(note);
    if (!rawAmount || !Number.isFinite(Number(rawAmount)) || Number(rawAmount) <= 0) {
      throw new Error("Enter a tip amount greater than zero.");
    }
    if (!note.trim()) throw new Error("Write a note before sending your tip.");
    if (noteBytes > 280) throw new Error("Your note is longer than the 280-byte limit.");
    if (!window.ethereum) throw new Error("MetaMask was not detected. Install MetaMask to send a tip.");

    const provider = await ensureSepolia();
    if (!signer || (await signer.getAddress()).toLowerCase() !== connectedAddress?.toLowerCase()) {
      const accounts = await provider.send("eth_accounts", []);
      if (!accounts.length) throw new Error("Connect your MetaMask wallet first.");
      signer = await provider.getSigner(accounts[0]);
      connectedAddress = accounts[0];
    }
    await verifyDeployedContract(provider);
    const contract = new ethers.Contract(deployment.address, deployment.abi, signer);
    const value = ethers.parseEther(rawAmount);
    ui.send.disabled = true;
    ui.send.textContent = "Confirm in MetaMask…";
    const tx = await contract.tip(note, { value });
    showNotice(`Transaction submitted: ${tx.hash}. Waiting for Sepolia confirmation…`, "info");
    ui.send.textContent = "Waiting for confirmation…";
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) throw new Error("The transaction reverted on Sepolia.");
    showNotice(`Tip confirmed on Sepolia. Transaction: ${tx.hash}`, "success");
    ui.form.reset();
    updateNoteCount();
    await refreshWall();
  } catch (error) {
    showNotice(friendlyError(error), "error");
  } finally {
    ui.send.disabled = false;
    ui.send.innerHTML = 'Send tip <span>↗</span>';
  }
}

ui.connect.addEventListener("click", connectWallet);
ui.form.addEventListener("submit", submitTip);
ui.note.addEventListener("input", updateNoteCount);
ui.refresh.addEventListener("click", refreshWall);
document.querySelectorAll("[data-amount]").forEach((button) => {
  button.addEventListener("click", () => { ui.amount.value = button.dataset.amount; });
});

if (window.ethereum?.on) {
  window.ethereum.on("chainChanged", () => {
    signer = undefined;
    updateNetworkStatus();
    refreshWall();
  });
  window.ethereum.on("accountsChanged", (accounts) => {
    if (!accounts.length) {
      connectedAddress = undefined;
      signer = undefined;
      ui.address.hidden = true;
      ui.connect.hidden = false;
      showNotice("Wallet disconnected.", "info");
    } else {
      connectedAddress = accounts[0];
      ui.address.textContent = abbreviate(accounts[0]);
      ui.address.hidden = false;
      ui.connect.hidden = true;
      signer = undefined;
    }
  });
}

updateNetworkStatus();
loadDeployment().then(refreshWall);
