import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { FairGradeForge, FairGradeForge__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  teacher: HardhatEthersSigner;
  student1: HardhatEthersSigner;
  student2: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("FairGradeForge")) as FairGradeForge__factory;
  const contract = (await factory.deploy()) as FairGradeForge;
  const contractAddress = await contract.getAddress();

  return { contract, contractAddress };
}

describe("FairGradeForge", function () {
  let signers: Signers;
  let contract: FairGradeForge;
  let contractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = {
      teacher: ethSigners[0],
      student1: ethSigners[1],
      student2: ethSigners[2],
    };
  });

  beforeEach(async function () {
    // Check whether the tests are running against an FHEVM mock environment
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ contract, contractAddress } = await deployFixture());
  });

  it("should set teacher as deployer", async function () {
    const teacherAddress = await contract.teacher();
    expect(teacherAddress).to.eq(signers.teacher.address);
  });

  it("should create an assignment", async function () {
    const deadline = Math.floor(Date.now() / 1000) + 86400; // 1 day from now
    
    const tx = await contract
      .connect(signers.teacher)
      .createAssignment("Test Assignment", "Answer the question", deadline);
    await tx.wait();

    const assignment = await contract.getAssignment(0);
    expect(assignment.title).to.eq("Test Assignment");
    expect(assignment.requirements).to.eq("Answer the question");
    expect(assignment.deadline).to.eq(deadline);
    expect(assignment.submissionCount).to.eq(0);
  });

  it("should prevent teacher from submitting", async function () {
    const deadline = Math.floor(Date.now() / 1000) + 86400;
    
    await contract
      .connect(signers.teacher)
      .createAssignment("Test Assignment", "Answer the question", deadline);

    // Encrypt answer
    const answer = 42; // Simple answer value
    const encryptedAnswer = await fhevm
      .createEncryptedInput(contractAddress, signers.teacher.address)
      .add32(answer)
      .encrypt();

    // Teacher should not be able to submit
    await expect(
      contract
        .connect(signers.teacher)
        .submitAssignment(0, encryptedAnswer.handles[0], encryptedAnswer.inputProof)
    ).to.be.revertedWith("Teacher cannot submit assignments");
  });

  it("should allow student to submit encrypted answer", async function () {
    const deadline = Math.floor(Date.now() / 1000) + 86400;
    
    await contract
      .connect(signers.teacher)
      .createAssignment("Test Assignment", "Answer the question", deadline);

    // Encrypt answer
    const answer = 42;
    const encryptedAnswer = await fhevm
      .createEncryptedInput(contractAddress, signers.student1.address)
      .add32(answer)
      .encrypt();

    const tx = await contract
      .connect(signers.student1)
      .submitAssignment(0, encryptedAnswer.handles[0], encryptedAnswer.inputProof);
    await tx.wait();

    const hasSubmitted = await contract.hasSubmitted(0, signers.student1.address);
    expect(hasSubmitted).to.be.true;

    const assignment = await contract.getAssignment(0);
    expect(assignment.submissionCount).to.eq(1);
  });

  it("should prevent duplicate submissions", async function () {
    const deadline = Math.floor(Date.now() / 1000) + 86400;
    
    await contract
      .connect(signers.teacher)
      .createAssignment("Test Assignment", "Answer the question", deadline);

    const answer = 42;
    const encryptedAnswer = await fhevm
      .createEncryptedInput(contractAddress, signers.student1.address)
      .add32(answer)
      .encrypt();

    await contract
      .connect(signers.student1)
      .submitAssignment(0, encryptedAnswer.handles[0], encryptedAnswer.inputProof);

    // Try to submit again
    await expect(
      contract
        .connect(signers.student1)
        .submitAssignment(0, encryptedAnswer.handles[0], encryptedAnswer.inputProof)
    ).to.be.revertedWith("Already submitted");
  });

  it("should allow teacher to grade after deadline", async function () {
    const deadline = Math.floor(Date.now() / 1000) - 1; // Past deadline
    
    await contract
      .connect(signers.teacher)
      .createAssignment("Test Assignment", "Answer the question", deadline);

    // Student submits
    const answer = 42;
    const encryptedAnswer = await fhevm
      .createEncryptedInput(contractAddress, signers.student1.address)
      .add32(answer)
      .encrypt();

    await contract
      .connect(signers.student1)
      .submitAssignment(0, encryptedAnswer.handles[0], encryptedAnswer.inputProof);

    // Start grading
    await contract.connect(signers.teacher).startGrading(0);

    // Teacher grades
    const score = 85;
    const encryptedScore = await fhevm
      .createEncryptedInput(contractAddress, signers.teacher.address)
      .add32(score)
      .encrypt();

    const tx = await contract
      .connect(signers.teacher)
      .gradeSubmission(0, signers.student1.address, encryptedScore.handles[0], encryptedScore.inputProof);
    await tx.wait();

    const hasGrade = await contract.hasGrade(0, signers.student1.address);
    expect(hasGrade).to.be.true;
  });

  it("should allow student to decrypt their grade", async function () {
    const deadline = Math.floor(Date.now() / 1000) - 1;
    
    await contract
      .connect(signers.teacher)
      .createAssignment("Test Assignment", "Answer the question", deadline);

    // Student submits
    const answer = 42;
    const encryptedAnswer = await fhevm
      .createEncryptedInput(contractAddress, signers.student1.address)
      .add32(answer)
      .encrypt();

    await contract
      .connect(signers.student1)
      .submitAssignment(0, encryptedAnswer.handles[0], encryptedAnswer.inputProof);

    // Teacher grades
    await contract.connect(signers.teacher).startGrading(0);

    const score = 85;
    const encryptedScore = await fhevm
      .createEncryptedInput(contractAddress, signers.teacher.address)
      .add32(score)
      .encrypt();

    await contract
      .connect(signers.teacher)
      .gradeSubmission(0, signers.student1.address, encryptedScore.handles[0], encryptedScore.inputProof);

    // Student decrypts grade
    const grade = await contract.getGrade(0, signers.student1.address);
    const decryptedScore = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      grade.encryptedScore,
      contractAddress,
      signers.student1,
    );

    expect(decryptedScore).to.eq(score);
  });

  it("should allow multiple students to submit", async function () {
    const deadline = Math.floor(Date.now() / 1000) + 86400;
    
    await contract
      .connect(signers.teacher)
      .createAssignment("Test Assignment", "Answer the question", deadline);

    // Student 1 submits
    const answer1 = 42;
    const encryptedAnswer1 = await fhevm
      .createEncryptedInput(contractAddress, signers.student1.address)
      .add32(answer1)
      .encrypt();

    await contract
      .connect(signers.student1)
      .submitAssignment(0, encryptedAnswer1.handles[0], encryptedAnswer1.inputProof);

    // Student 2 submits
    const answer2 = 100;
    const encryptedAnswer2 = await fhevm
      .createEncryptedInput(contractAddress, signers.student2.address)
      .add32(answer2)
      .encrypt();

    await contract
      .connect(signers.student2)
      .submitAssignment(0, encryptedAnswer2.handles[0], encryptedAnswer2.inputProof);

    const assignment = await contract.getAssignment(0);
    expect(assignment.submissionCount).to.eq(2);
  });
});

