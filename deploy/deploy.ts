import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const deploy: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedContract = await deploy("FairGradeForge", {
    from: deployer,
    args: [],
    log: true,
  });

  console.log(`FairGradeForge contract: `, deployedContract.address);
};

deploy.id = "deploy_fairGradeForge"; // id required to prevent reexecution
deploy.tags = ["FairGradeForge"];

export default deploy;

