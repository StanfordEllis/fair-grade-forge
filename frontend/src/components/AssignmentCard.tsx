import { useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSimulateContract, useWatchContractEvent } from "wagmi";
import { getContractAddress } from "@/config/contracts";
import { Address } from "viem";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FileText, Clock, Users, Send, CheckCircle, Loader2 } from "lucide-react";
import { useFHEVM } from "@/hooks/useFHEVM";
import { toast } from "sonner";
import { GradingDialog } from "./GradingDialog";

const CONTRACT_ABI = [
  {
    inputs: [{ internalType: "uint256", name: "assignmentId", type: "uint256" }],
    name: "getAssignment",
    outputs: [
      { internalType: "string", name: "title", type: "string" },
      { internalType: "string", name: "requirements", type: "string" },
      { internalType: "uint256", name: "deadline", type: "uint256" },
      { internalType: "uint256", name: "submissionCount", type: "uint256" },
      { internalType: "bool", name: "isGrading", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "assignmentId", type: "uint256" },
      { internalType: "address", name: "student", type: "address" },
    ],
    name: "hasSubmitted",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "assignmentId", type: "uint256" },
      {
        internalType: "externalEuint32",
        name: "encryptedAnswer",
        type: "bytes32",
      },
      { internalType: "bytes", name: "inputProof", type: "bytes" },
    ],
    name: "submitAssignment",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "assignmentId", type: "uint256" },
      { internalType: "address", name: "student", type: "address" },
    ],
    name: "hasGrade",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "assignmentId", type: "uint256" },
      { internalType: "address", name: "student", type: "address" },
    ],
    name: "getGrade",
    outputs: [
      { internalType: "euint32", name: "encryptedScore", type: "bytes32" },
      { internalType: "uint256", name: "timestamp", type: "uint256" },
      { internalType: "bool", name: "exists", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

interface AssignmentCardProps {
  assignmentId: number;
  chainId: number;
  isTeacher?: boolean;
}

export const AssignmentCard = ({ assignmentId, chainId, isTeacher = false }: AssignmentCardProps) => {
  const { address, isConnected } = useAccount();
  const contractAddress = getContractAddress(chainId);
  const { instance, encryptEuint32, decryptEuint32 } = useFHEVM();
  const [isSubmitDialogOpen, setIsSubmitDialogOpen] = useState(false);
  const [isGradingDialogOpen, setIsGradingDialogOpen] = useState(false);
  const [answerText, setAnswerText] = useState("");
  const [answerValue, setAnswerValue] = useState("");
  const [grade, setGrade] = useState<number | null>(null);
  const [isDecryptingGrade, setIsDecryptingGrade] = useState(false);
  
  const { data, isLoading, isError, refetch: refetchAssignment } = useReadContract({
    address: contractAddress as Address,
    abi: CONTRACT_ABI,
    functionName: "getAssignment",
    args: [BigInt(assignmentId)],
    query: {
      enabled: !!contractAddress && contractAddress !== '0x0000000000000000000000000000000000',
    },
  });

  // Check if student has submitted (only for students)
  const { data: hasSubmitted, refetch: refetchHasSubmitted } = useReadContract({
    address: !isTeacher && isConnected && address ? contractAddress as Address : undefined,
    abi: CONTRACT_ABI,
    functionName: "hasSubmitted",
    args: [BigInt(assignmentId), address as Address],
    query: {
      enabled: !isTeacher && isConnected && !!address && !!contractAddress,
    },
  });

  // Check if student has grade (only for students)
  const { data: hasGradeData, refetch: refetchHasGrade } = useReadContract({
    address: !isTeacher && isConnected && address ? contractAddress as Address : undefined,
    abi: CONTRACT_ABI,
    functionName: "hasGrade",
    args: [BigInt(assignmentId), address as Address],
    query: {
      enabled: !isTeacher && isConnected && !!address && !!contractAddress,
    },
  });

  // Get encrypted grade (only for students who have grade)
  const { data: gradeData } = useReadContract({
    address: !isTeacher && isConnected && address && hasGradeData ? contractAddress as Address : undefined,
    abi: CONTRACT_ABI,
    functionName: "getGrade",
    args: [BigInt(assignmentId), address as Address],
    query: {
      enabled: !isTeacher && isConnected && !!address && !!contractAddress && hasGradeData === true,
    },
  });

  // Write contract for submitting assignment
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // Handle successful submission
  useEffect(() => {
    if (isSuccess) {
      toast.success("Assignment submitted successfully!");
      setIsSubmitDialogOpen(false);
      setAnswerText("");
      setAnswerValue("");
      // Refetch submission status and assignment data
      setTimeout(() => {
        refetchHasSubmitted();
        refetchAssignment();
      }, 1000); // Wait a bit for the transaction to be mined
    }
  }, [isSuccess, refetchHasSubmitted, refetchAssignment]);

  // Reset grade when assignment changes or hasGrade changes
  useEffect(() => {
    if (!hasGradeData) {
      setGrade(null);
    }
  }, [hasGradeData, assignmentId]);

  // Watch for GradeAssigned event to automatically refresh grade status
  useWatchContractEvent({
    address: !isTeacher && isConnected && address ? contractAddress as Address : undefined,
    abi: [
      {
        anonymous: false,
        inputs: [
          { indexed: true, internalType: "uint256", name: "assignmentId", type: "uint256" },
          { indexed: true, internalType: "address", name: "student", type: "address" },
          { indexed: false, internalType: "uint256", name: "timestamp", type: "uint256" },
        ],
        name: "GradeAssigned",
        type: "event",
      },
    ] as const,
    eventName: "GradeAssigned",
    onLogs: (logs) => {
      // Check if any log is for this assignment and this student
      const relevantLog = logs.find(
        (log) =>
          log.args.assignmentId === BigInt(assignmentId) &&
          log.args.student?.toLowerCase() === address?.toLowerCase()
      );
      if (relevantLog) {
        // Refetch grade status
        setTimeout(() => {
          refetchHasGrade();
        }, 1000);
      }
    },
  });

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
          <div className="h-3 bg-muted rounded w-1/2"></div>
        </div>
      </Card>
    );
  }

  if (isError || !data) {
    return (
      <Card className="p-6">
        <p className="text-sm text-muted-foreground">Error loading assignment</p>
      </Card>
    );
  }

  const [title, requirements, deadline, submissionCount, isGrading] = data;

  const formatDeadline = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) * 1000);
    return date.toLocaleString();
  };

  const isDeadlinePassed = (timestamp: bigint) => {
    return timestamp > 0n && timestamp <= BigInt(Math.floor(Date.now() / 1000));
  };

  const deadlinePassed = isDeadlinePassed(deadline);
  const canSubmit = !isTeacher && !deadlinePassed && !hasSubmitted && isConnected;

  const handleSubmit = async () => {
    if (!answerValue || !instance || !contractAddress) {
      toast.error("Please enter an answer and ensure wallet is connected");
      return;
    }

    const numericValue = parseInt(answerValue, 10);
    if (isNaN(numericValue) || numericValue < 0 || numericValue > 100) {
      toast.error("Answer value must be a number between 0 and 100");
      return;
    }

    try {
      toast.info("Encrypting answer...");
      
      // Use instance directly to get the correct format
      if (!instance || !address) {
        toast.error("FHEVM instance or wallet not ready");
        return;
      }

      const input = instance.createEncryptedInput(contractAddress, address);
      input.add32(numericValue);
      const encrypted = await input.encrypt();

      console.log("Encrypted result:", encrypted);
      console.log("Handle:", encrypted.handles[0]);
      console.log("Handle type:", typeof encrypted.handles[0]);
      console.log("Input proof:", encrypted.inputProof);

      // The handle from encrypt() should be formatted as bytes32
      // externalEuint32 in ABI is encoded as bytes32, not tuple
      const handle = encrypted.handles[0];
      
      // Format handle as bytes32 (64 hex chars = 32 bytes)
      let handleBytes: string;
      if (handle instanceof Uint8Array) {
        handleBytes = Array.from(handle).map(b => b.toString(16).padStart(2, '0')).join('');
      } else if (typeof handle === 'string') {
        handleBytes = handle.startsWith('0x') ? handle.slice(2) : handle;
      } else if (Array.isArray(handle)) {
        handleBytes = handle.map(b => (typeof b === 'number' ? b : parseInt(String(b), 10)).toString(16).padStart(2, '0')).join('');
      } else {
        const handleStr = String(handle);
        handleBytes = handleStr.startsWith('0x') ? handleStr.slice(2) : handleStr;
      }

      // Ensure exactly 64 characters (32 bytes) for bytes32
      const paddedHandle = handleBytes.length > 64 
        ? handleBytes.slice(0, 64) 
        : handleBytes.padEnd(64, '0');
      const externalEuint32 = `0x${paddedHandle}` as `0x${string}`;

      console.log("Formatted externalEuint32:", externalEuint32);

      // Format inputProof
      let proofString: string;
      const proof = encrypted.inputProof;
      if (typeof proof === 'string') {
        proofString = proof;
      } else if (proof instanceof Uint8Array) {
        proofString = '0x' + Array.from(proof).map(b => b.toString(16).padStart(2, '0')).join('');
      } else if (Array.isArray(proof)) {
        proofString = '0x' + proof.map(b => (typeof b === 'number' ? b : parseInt(String(b), 10)).toString(16).padStart(2, '0')).join('');
      } else {
        proofString = String(proof);
      }

      console.log("Calling submitAssignment with:", {
        assignmentId,
        externalEuint32,
        inputProof: proofString,
      });

      toast.info("Submitting encrypted answer...");
      
      console.log("About to call writeContract with args:", {
        assignmentId: BigInt(assignmentId),
        externalEuint32,
        inputProof: proofString,
      });
      console.log("ExternalEuint32 (bytes32):", externalEuint32);

      // Try to simulate the contract call first to get detailed error
      // This will help us see the actual revert reason
      try {
        const { createPublicClient, http, encodeFunctionData, decodeErrorResult } = await import('viem');
        const publicClient = createPublicClient({
          transport: http('http://127.0.0.1:8545')
        });

        const encodedData = encodeFunctionData({
          abi: CONTRACT_ABI,
          functionName: "submitAssignment",
          args: [
            BigInt(assignmentId), 
            externalEuint32, 
            proofString as `0x${string}`
          ],
        });

        console.log("Encoded function data:", encodedData);

        // Try to simulate the call
        try {
          await publicClient.call({
            to: contractAddress as Address,
            data: encodedData,
            account: address as Address,
          });
          console.log("Simulation successful!");
        } catch (simError: any) {
          console.error("Simulation failed with error:", simError);
          // Try to decode the error
          if (simError?.data) {
            try {
              const decoded = decodeErrorResult({
                abi: CONTRACT_ABI,
                data: simError.data,
              });
              console.error("Decoded error:", decoded);
              toast.error(`Contract error: ${decoded.errorName}`);
              throw simError;
            } catch (decodeError) {
              console.error("Could not decode error:", decodeError);
            }
          }
          throw simError;
        }
      } catch (simError: any) {
        console.error("Simulation error:", simError);
        // Continue with writeContract anyway, but log the error
      }

      const hash = await writeContract({
        address: contractAddress as Address,
        abi: CONTRACT_ABI,
        functionName: "submitAssignment",
        args: [
          BigInt(assignmentId), 
          externalEuint32, 
          proofString as `0x${string}`
        ],
      });
      
      console.log("Transaction hash:", hash);
      if (hash) {
        toast.info("Transaction submitted, waiting for confirmation...");
      }
    } catch (writeError: any) {
      console.error("Write contract error:", writeError);
      console.error("Error object:", JSON.stringify(writeError, null, 2));
      console.error("Error details:", {
        code: writeError?.code,
        message: writeError?.message,
        data: writeError?.data,
        shortMessage: writeError?.shortMessage,
        cause: writeError?.cause,
        reason: writeError?.reason,
        error: writeError?.error,
      });
      
      // Try to extract revert reason from various error formats
      let errorMessage = 'Failed to submit assignment';
      
      // Check different error message locations
      const possibleMessages = [
        writeError?.shortMessage,
        writeError?.message,
        writeError?.data?.message,
        writeError?.cause?.message,
        writeError?.reason,
        writeError?.error?.message,
        writeError?.error?.data?.message,
      ].filter(Boolean);
      
      if (possibleMessages.length > 0) {
        errorMessage = possibleMessages[0];
      }
      
      // Check for user rejection
      if (errorMessage.includes('user rejected') || 
          errorMessage.includes('User rejected') ||
          errorMessage.includes('User denied') ||
          writeError?.code === 4001) {
        toast.info('Transaction was cancelled');
        return; // Don't show error toast for user rejection
      }
      
      // Check for common revert reasons
      if (errorMessage.includes('Teacher cannot submit') || errorMessage.includes('onlyStudent')) {
        errorMessage = 'Only students can submit assignments. Please switch to a student account.';
      } else if (errorMessage.includes('Assignment does not exist')) {
        errorMessage = 'Assignment does not exist';
      } else if (errorMessage.includes('Deadline has passed')) {
        errorMessage = 'The deadline for this assignment has passed';
      } else if (errorMessage.includes('Already submitted')) {
        errorMessage = 'You have already submitted this assignment';
      } else if (errorMessage.includes('Internal JSON-RPC error')) {
        errorMessage = 'Contract execution failed. Please check Hardhat node logs for details.';
        console.error("This is likely a contract revert. Check Hardhat node terminal for the actual revert reason.");
      }
      
      toast.error(errorMessage);
      throw writeError;
    }
  };

  // Handle viewing/decrypting grade
  const handleViewGrade = async () => {
    if (!instance || !address || !contractAddress || !gradeData) {
      toast.error("FHEVM instance not ready");
      return;
    }

    setIsDecryptingGrade(true);
    try {
      const encryptedScore = gradeData[0] as string;
      const decrypted = await decryptEuint32(contractAddress, encryptedScore);
      
      if (decrypted !== null) {
        setGrade(Number(decrypted));
        toast.success("Grade decrypted successfully!");
      } else {
        toast.error("Failed to decrypt grade");
      }
    } catch (error) {
      console.error("Error decrypting grade:", error);
      toast.error("Failed to decrypt grade");
    } finally {
      setIsDecryptingGrade(false);
    }
  };

  const hasGrade = hasGradeData === true;

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="p-2 rounded-lg bg-primary/10">
          <FileText className="h-5 w-5 text-primary" />
        </div>
        {hasSubmitted && !isTeacher && (
          <CheckCircle className="h-5 w-5 text-blue-500" />
        )}
      </div>
      <h3 className="font-semibold text-foreground mb-2">
        {title || `Assignment ${assignmentId + 1}`}
      </h3>
      <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
        {requirements || "No requirements specified"}
      </p>
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>{formatDeadline(deadline)}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Users className="h-4 w-4" />
          <span className="font-medium">
            {Number(submissionCount)} submission{Number(submissionCount) !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
      {isTeacher && deadlinePassed && (
        <>
          <Button 
            variant="outline" 
            className="w-full" 
            size="sm"
            onClick={() => setIsGradingDialogOpen(true)}
          >
            Start Grading
          </Button>
          <GradingDialog
            assignmentId={assignmentId}
            isOpen={isGradingDialogOpen}
            onClose={() => setIsGradingDialogOpen(false)}
          />
        </>
      )}
      {!isTeacher && (
        <>
          {/* Display grade section */}
          {hasGrade && (
            <div className="mb-4 p-3 bg-muted rounded-lg border">
              {grade !== null ? (
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-muted-foreground">Your Grade:</span>
                    <span className="ml-2 text-lg font-bold text-primary">{grade}/100</span>
                  </div>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleViewGrade}
                  disabled={isDecryptingGrade || !instance}
                  className="w-full"
                >
                  {isDecryptingGrade ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Decrypting Grade...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      View My Grade
                    </>
                  )}
                </Button>
              )}
            </div>
          )}
          
          {hasSubmitted ? (
            <Button variant="outline" className="w-full" size="sm" disabled>
              <CheckCircle className="h-4 w-4 mr-2" />
              Already Submitted
            </Button>
          ) : deadlinePassed ? (
            <Button variant="outline" className="w-full" size="sm" disabled>
              Deadline Passed
            </Button>
          ) : (
            <Dialog open={isSubmitDialogOpen} onOpenChange={setIsSubmitDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-full" size="sm" disabled={!isConnected}>
                  <Send className="h-4 w-4 mr-2" />
                  Submit Assignment
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Submit Assignment</DialogTitle>
                  <DialogDescription>
                    Enter your answer. The answer will be encrypted before submission.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="answer-text">Answer (Text - for reference)</Label>
                    <Textarea
                      id="answer-text"
                      placeholder="Enter your answer text..."
                      value={answerText}
                      onChange={(e) => setAnswerText(e.target.value)}
                      rows={4}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="answer-value">Answer Value (0-100)</Label>
                    <Input
                      id="answer-value"
                      type="number"
                      min="0"
                      max="100"
                      placeholder="Enter a numeric value (0-100)"
                      value={answerValue}
                      onChange={(e) => setAnswerValue(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      This value will be encrypted and submitted on-chain
                    </p>
                  </div>
                  <Button
                    onClick={handleSubmit}
                    disabled={isPending || isConfirming || !answerValue || !instance}
                    className="w-full"
                  >
                    {isPending || isConfirming ? "Submitting..." : "Submit Encrypted Answer"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </>
      )}
    </Card>
  );
};

