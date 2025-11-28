import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm, deployments } from "hardhat";
import { FairGradeForge } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  teacher: HardhatEthersSigner;
  student1: HardhatEthersSigner;
};

describe("FairGradeForgeSepolia", function () {
  let signers: Signers;
  let contract: FairGradeForge;
  let contractAddress: string;
  let step: number;
  let steps: number;

  function progress(message: string) {
    console.log(`${++step}/${steps} ${message}`);
  }

  before(async function () {
    if (fhevm.isMock) {
      console.warn(`This hardhat test suite can only run on Sepolia Testnet`);
      this.skip();
    }

    try {
      const FairGradeForgeDeployment = await deployments.get("FairGradeForge");
      contractAddress = FairGradeForgeDeployment.address;
      contract = await ethers.getContractAt("FairGradeForge", FairGradeForgeDeployment.address);
    } catch (e) {
      (e as Error).message += ". Call 'npx hardhat deploy --network sepolia'";
      throw e;
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = {
      teacher: ethSigners[0],
      student1: ethSigners[1],
    };
  });

  beforeEach(async () => {
    step = 0;
    steps = 0;
  });

  it("should create assignment and allow student submission", async function () {
    steps = 15;
    this.timeout(4 * 40000);

    progress("Creating assignment...");
    const deadline = Math.floor(Date.now() / 1000) + 86400; // 1 day from now
    let tx = await contract
      .connect(signers.teacher)
      .createAssignment("Sepolia Test Assignment", "Test requirements", deadline);
    await tx.wait();

    progress("Verifying assignment created...");
    const assignment = await contract.getAssignment(0);
    expect(assignment.title).to.eq("Sepolia Test Assignment");

    progress("Encrypting student answer...");
    const answer = 42;
    const encryptedAnswer = await fhevm
      .createEncryptedInput(contractAddress, signers.student1.address)
      .add32(answer)
      .encrypt();

    progress(`Submitting assignment...`);
    tx = await contract
      .connect(signers.student1)
      .submitAssignment(0, encryptedAnswer.handles[0], encryptedAnswer.inputProof);
    await tx.wait();

    progress("Verifying submission...");
    const hasSubmitted = await contract.hasSubmitted(0, signers.student1.address);
    expect(hasSubmitted).to.be.true;

    progress("Test completed successfully");
  });
});

