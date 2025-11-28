# Fair Grade Forge

Fair academic evaluation system with FHE encrypted assignments and grades.

## 🌐 Live Demo

**Test the application on Vercel:** [https://fair-grade-forge.vercel.app/](https://fair-grade-forge.vercel.app/)

**Repository:** [https://github.com/StanfordEllis/fair-grade-forge.git](https://github.com/StanfordEllis/fair-grade-forge.git)

## 📹 Demo Video

Watch the demo video to see the system in action: [fair-grade-forge.mp4](./fair-grade-forge.mp4)

## Overview

Fair Grade Forge is a blockchain-powered platform that ensures fair academic evaluation through Fully Homomorphic Encryption (FHE). Students submit encrypted assignments, and teachers can only decrypt and grade them after the deadline, ensuring completely unbiased grading.

## ✨ Features

- **🔐 Encrypted Submissions**: Students submit assignments with FHE encryption
- **⏰ Deadline Protection**: Assignments remain encrypted until deadline passes
- **⚖️ Fair Grading**: Teachers decrypt and grade only after deadline
- **🔒 Encrypted Grades**: Grades are encrypted and only visible to the student
- **📝 One Submission Per Student**: Each address can only submit once per assignment
- **🛡️ Teacher Protection**: Teachers cannot submit to their own assignments
- **👁️ Grade Visibility**: Students can view and decrypt their own grades

## 🏗️ Project Structure

```
fair-grade-forge/
├── contracts/              # Smart contracts
│   └── FairGradeForge.sol  # Main contract
├── deploy/                 # Deployment scripts
│   └── deploy.ts
├── test/                   # Test files
│   ├── FairGradeForge.ts   # Local tests
│   └── FairGradeForgeSepolia.ts  # Sepolia tests
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── hooks/          # Custom hooks (useFHEVM)
│   │   ├── pages/          # Page components
│   │   └── config/         # Configuration
│   └── public/             # Static assets
└── hardhat.config.ts       # Hardhat configuration
```

## 📋 Prerequisites

- Node.js >= 20
- npm >= 7.0.0
- Hardhat node (for local development)
- MetaMask or compatible Web3 wallet
- Sepolia ETH (for testnet deployment)

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/StanfordEllis/fair-grade-forge.git
cd fair-grade-forge
```

### 2. Install Dependencies

```bash
# Install contract dependencies
npm install

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### 3. Set Up Environment Variables

```bash
# Set up Hardhat variables
npx hardhat vars set MNEMONIC
npx hardhat vars set INFURA_API_KEY
npx hardhat vars set ETHERSCAN_API_KEY  # Optional
```

### 4. Compile Contracts

```bash
npm run compile
```

## 💻 Development

### Local Development

1. **Start Hardhat Node**

```bash
# In one terminal
npm run node
```

2. **Deploy Contracts**

```bash
# In another terminal
npm run deploy:local
```

3. **Update Frontend Contract Address**

After deployment, copy the contract address and update `frontend/src/config/contracts.ts`:

```typescript
export const CONTRACT_ADDRESSES: Record<number, Address> = {
  31337: 'YOUR_DEPLOYED_ADDRESS' as Address,
  // ...
};
```

4. **Start Frontend**

```bash
cd frontend
npm run dev
```

### Testing

```bash
# Run local tests
npm run test

# Run Sepolia tests (after deployment)
npm run test:sepolia
```

## 📜 Smart Contract

### Contract Address

- **Sepolia Testnet**: `0x2180E4791CE72D837a32149F204c3059602170E5`
- **Etherscan**: [View on Sepolia Etherscan](https://sepolia.etherscan.io/address/0x2180E4791CE72D837a32149F204c3059602170E5)

### Contract Code

The main contract `FairGradeForge.sol` implements the following key features:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

contract FairGradeForge is SepoliaConfig {
    struct Assignment {
        uint256 id;
        string title;
        string requirements;
        uint256 deadline;
        address teacher;
        uint256 submissionCount;
        bool isGrading;
    }

    struct Submission {
        address student;
        euint32 encryptedAnswer;  // Encrypted answer (0-100)
        uint256 timestamp;
        bool exists;
    }

    struct Grade {
        euint32 encryptedScore;  // Encrypted score (0-100)
        uint256 timestamp;
        bool exists;
    }

    // Key mappings
    mapping(uint256 => Assignment) public assignments;
    mapping(uint256 => mapping(address => Submission)) public submissions;
    mapping(uint256 => mapping(address => Grade)) public grades;
}
```

### Key Functions

#### Teacher Functions

- `createAssignment(title, requirements, deadline)`: Create a new assignment
- `startGrading(assignmentId)`: Start grading process after deadline
- `gradeSubmission(assignmentId, student, encryptedScore, inputProof)`: Grade a student's submission

#### Student Functions

- `submitAssignment(assignmentId, encryptedAnswer, inputProof)`: Submit encrypted answer
- `getAssignment(assignmentId)`: Get assignment details
- `getGrade(assignmentId, student)`: Get encrypted grade (only student can decrypt)
- `hasSubmitted(assignmentId, student)`: Check if student has submitted
- `hasGrade(assignmentId, student)`: Check if student has been graded

## 🔐 Encryption/Decryption Logic

### Key Encryption Flow

The system uses Zama FHEVM for fully homomorphic encryption, ensuring that data remains encrypted throughout the entire process.

#### 1. Student Submission Encryption

**Frontend Implementation** (`useFHEVM.tsx`):

```typescript
const encryptEuint32 = async (
  contractAddress: string,
  value: number
): Promise<{ handle: string; inputProof: string } | null> => {
  // Create encrypted input using FHEVM instance
  const input = instance.createEncryptedInput(contractAddress, address);
  input.add32(value);  // Add the answer value (0-100)
  const encrypted = await input.encrypt();

  // Format handle as bytes32 (64 hex chars = 32 bytes)
  const handle = encrypted.handles[0];
  const handleString = formatAsBytes32(handle);
  
  // Return handle and input proof for contract submission
  return {
    handle: handleString,
    inputProof: encrypted.inputProof,
  };
};
```

**Contract Processing** (`FairGradeForge.sol`):

```solidity
function submitAssignment(
    uint256 assignmentId,
    externalEuint32 encryptedAnswer,
    bytes calldata inputProof
) external onlyStudent {
    // Convert external encrypted value to internal euint32
    euint32 encryptedEuint32 = FHE.fromExternal(encryptedAnswer, inputProof);
    
    // Allow contract to use this encrypted value
    FHE.allowThis(encryptedEuint32);
    // Allow teacher to decrypt (for grading after deadline)
    FHE.allow(encryptedEuint32, teacher);

    // Store encrypted submission
    submissions[assignmentId][msg.sender] = Submission({
        student: msg.sender,
        encryptedAnswer: encryptedEuint32,
        timestamp: block.timestamp,
        exists: true
    });
}
```

**Key Points:**
- Student encrypts answer value (0-100) using FHEVM
- Encrypted data is submitted to contract as `externalEuint32`
- Contract converts to internal `euint32` format
- Access control: Teacher can decrypt after deadline

#### 2. Teacher Decryption & Grading

**Frontend Decryption** (`GradingDialog.tsx`):

```typescript
const handleDecryptOne = async (index: number) => {
  const student = students[index];
  
  // Decrypt student's answer
  const decrypted = await decryptEuint32(
    contractAddress,
    student.encryptedAnswer
  );
  
  if (decrypted !== null) {
    // Display decrypted answer to teacher
    updated[index].decryptedAnswer = Number(decrypted);
  }
};
```

**Frontend Encryption for Grade** (`GradingDialog.tsx`):

```typescript
const handleGrade = async (index: number) => {
  const score = parseInt(student.score, 10);  // 0-100
  
  // Encrypt the grade
  const input = instance.createEncryptedInput(contractAddress, address);
  input.add32(score);
  const encrypted = await input.encrypt();
  
  // Submit encrypted grade to contract
  await writeContractAsync({
    address: contractAddress,
    abi: CONTRACT_ABI,
    functionName: "gradeSubmission",
    args: [
      BigInt(assignmentId),
      student.address,
      encryptedScore,
      proofString,
    ],
  });
};
```

**Contract Processing** (`FairGradeForge.sol`):

```solidity
function gradeSubmission(
    uint256 assignmentId,
    address student,
    externalEuint32 encryptedScore,
    bytes calldata inputProof
) external onlyTeacher {
    // Convert external encrypted score to internal euint32
    euint32 encryptedEuint32 = FHE.fromExternal(encryptedScore, inputProof);
    
    // Allow contract to use this encrypted value
    FHE.allowThis(encryptedEuint32);
    // Allow student to decrypt their own grade
    FHE.allow(encryptedEuint32, student);

    // Store encrypted grade
    grades[assignmentId][student] = Grade({
        encryptedScore: encryptedEuint32,
        timestamp: block.timestamp,
        exists: true
    });
}
```

**Key Points:**
- Teacher decrypts student answer (only after deadline)
- Teacher encrypts grade (0-100) using FHEVM
- Encrypted grade is stored on-chain
- Access control: Only the specific student can decrypt their grade

#### 3. Student Grade Decryption

**Frontend Implementation** (`AssignmentCard.tsx`):

```typescript
const handleViewGrade = async () => {
  // Get encrypted grade from contract
  const gradeData = await readContract({
    address: contractAddress,
    abi: CONTRACT_ABI,
    functionName: "getGrade",
    args: [BigInt(assignmentId), address],
  });

  // Decrypt the grade
  const encryptedScore = gradeData[0] as string;
  const decrypted = await decryptEuint32(contractAddress, encryptedScore);
  
  if (decrypted !== null) {
    // Display grade to student
    setGrade(Number(decrypted));
  }
};
```

**Decryption Function** (`useFHEVM.tsx`):

```typescript
const decryptEuint32 = async (
  contractAddress: string,
  handle: string
): Promise<bigint | null> => {
  // Generate keypair for decryption
  const keypair = instance.generateKeypair();
  
  // Create EIP-712 signature for authorization
  const eip712 = instance.createEIP712(
    keypair.publicKey,
    [contractAddress],
    start,
    durationDays
  );

  // Sign typed data with wallet
  const signature = await walletClient.signTypedData({
    account: address,
    domain: eip712.domain,
    types: eip712.types,
    primaryType: eip712.primaryType,
    message: eip712.message,
  });

  // Decrypt using FHEVM relayer
  const result = await instance.userDecrypt(
    [{ handle, contractAddress }],
    keypair.privateKey,
    keypair.publicKey,
    signatureWithoutPrefix,
    contractAddresses,
    address,
    start,
    durationDays
  );

  return result[handle];
};
```

**Key Points:**
- Student requests encrypted grade from contract
- Student signs EIP-712 message for authorization
- FHEVM relayer performs decryption
- Only the authorized student can decrypt their own grade

### Access Control Summary

| Data Type | Encrypted By | Decryptable By | Stored As |
|-----------|-------------|----------------|-----------|
| Student Answer | Student | Teacher (after deadline) | `euint32` |
| Grade | Teacher | Student (owner only) | `euint32` |

## 🎯 Business Logic Flow

1. **Teacher creates assignment** → All students can see it
2. **Students submit encrypted answers** → Submission count increases
3. **Deadline passes** → Assignment shows "Grading in progress"
4. **Teacher decrypts answers** → Grades each student
5. **Students view grades** → Only their own grade is decrypted

## 🖥️ Frontend Pages

### Student Page (`/`)

- View all assignments with title, requirements, deadline, and submission count
- Submit assignments (encrypted)
- View own grades (decrypted)
- See submission status

### Teacher Page (`/teacher`)

- Create new assignments
- View all assignments with submission counts
- Start grading after deadline
- Decrypt student answers and grade them
- Encrypt grades for students

## 🛠️ Technology Stack

- **Smart Contracts**: Solidity 0.8.27
- **FHE**: Zama FHEVM (Fully Homomorphic Encryption Virtual Machine)
- **Blockchain**: Ethereum Sepolia Testnet
- **Frontend**: React + TypeScript + Vite
- **Wallet**: RainbowKit + Wagmi
- **UI**: shadcn/ui + Tailwind CSS
- **Deployment**: Vercel (Frontend), Hardhat (Contracts)

## 📦 Deployment

### Deploy to Sepolia Testnet

```bash
# Set environment variables
export PRIVATE_KEY=your_private_key
export INFURA_API_KEY=your_infura_api_key

# Deploy contract
npx hardhat deploy --network sepolia
```

### Update Frontend Configuration

After deployment, update `frontend/src/config/contracts.ts` with the deployed contract address.

## 🔒 Security Features

- **FHE Encryption**: All sensitive data (answers, grades) remain encrypted on-chain
- **Access Control**: Role-based permissions (teacher/student)
- **Deadline Protection**: Answers cannot be decrypted before deadline
- **One Submission Rule**: Prevents duplicate submissions
- **Teacher Protection**: Teachers cannot submit to their own assignments

## 📝 License

MIT

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📧 Contact

For questions or support, please open an issue on [GitHub](https://github.com/StanfordEllis/fair-grade-forge/issues).

---

**Built with ❤️ using Zama FHEVM for privacy-preserving academic evaluation**
