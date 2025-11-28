import { ethers } from "hardhat";

async function main() {
  console.log("Deploying FairGradeForge contract...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  const FairGradeForge = await ethers.getContractFactory("FairGradeForge");
  const contract = await FairGradeForge.deploy();

  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("FairGradeForge deployed to:", address);
  console.log("\nPlease update frontend/src/config/contracts.ts with this address:");
  console.log(`31337: '${address}' as Address,`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

