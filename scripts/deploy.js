const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
  if (hre.network.name !== "sepolia") {
    throw new Error("This deployment script only targets Ethereum Sepolia. Select --network sepolia.");
  }
  if (!process.env.QUICKNODE_SEPOLIA_URL) {
    throw new Error("Set QUICKNODE_SEPOLIA_URL in your ignored .env file.");
  }
  if (!process.env.PRIVATE_KEY) {
    throw new Error("Set PRIVATE_KEY for a funded burner wallet in your ignored .env file.");
  }

  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();
  if (network.chainId !== 11155111n) {
    throw new Error(`Refusing deployment on unexpected chain ${network.chainId}.`);
  }

  const PraiseBoard = await hre.ethers.getContractFactory("PraiseBoard");
  const board = await PraiseBoard.deploy();
  const deploymentTransaction = board.deploymentTransaction();
  await board.waitForDeployment();
  const address = await board.getAddress();
  const artifact = await hre.artifacts.readArtifact("PraiseBoard");
  const outputPath = path.join(__dirname, "..", "frontend", "deployment.json");
  fs.writeFileSync(
    outputPath,
    `${JSON.stringify({
      address,
      chainId: Number(network.chainId),
      network: hre.network.name,
      deploymentBlock: await hre.ethers.provider.getBlockNumber(),
      deploymentTransactionHash: deploymentTransaction.hash,
      abi: artifact.abi,
    }, null, 2)}\n`,
  );

  console.log(`Network: ${hre.network.name} (chain ${network.chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Contract: ${address}`);
  console.log(`Deployment transaction: ${deploymentTransaction.hash}`);
  console.log(`Frontend deployment artifact: ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
