import { useState, useEffect } from "react";
import { useAccount, useChainId, useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient, useWatchContractEvent } from "wagmi";
import { getContractAddress } from "@/config/contracts";
import { Address } from "viem";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
// import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useFHEVM } from "@/hooks/useFHEVM";
import { toast } from "sonner";

const CONTRACT_ABI = [
  {
    inputs: [],
    name: "teacher",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "uint256", name: "assignmentId", type: "uint256" },
      { internalType: "address", name: "student", type: "address" },
    ],
    name: "getSubmission",
    outputs: [
      { internalType: "euint32", name: "encryptedAnswer", type: "bytes32" },
      { internalType: "uint256", name: "timestamp", type: "uint256" },
      { internalType: "bool", name: "exists", type: "bool" },
    ],
    stateMutability: "view",
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
      {
        internalType: "externalEuint32",
        name: "encryptedScore",
        type: "bytes32",
      },
      { internalType: "bytes", name: "inputProof", type: "bytes" },
    ],
    name: "gradeSubmission",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, internalType: "uint256", name: "assignmentId", type: "uint256" },
      { indexed: true, internalType: "address", name: "student", type: "address" },
      { indexed: false, internalType: "uint256", name: "timestamp", type: "uint256" },
    ],
    name: "SubmissionCreated",
    type: "event",
  },
] as const;

interface GradingDialogProps {
  assignmentId: number;
  isOpen: boolean;
  onClose: () => void;
}

interface StudentSubmission {
  address: Address;
  encryptedAnswer: string;
  timestamp: bigint;
  decryptedAnswer: number | null;
  score: string;
  isGraded: boolean;
}

export const GradingDialog = ({ assignmentId, isOpen, onClose }: GradingDialogProps) => {
  const { address } = useAccount();
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);
  const { instance, decryptEuint32 } = useFHEVM();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  
  const [students, setStudents] = useState<StudentSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [decryptingIndex, setDecryptingIndex] = useState<number | null>(null);

  // Fetch all student submissions from events
  useEffect(() => {
    if (!isOpen || !contractAddress || !publicClient) return;

    const fetchSubmissions = async () => {
      setIsLoading(true);
      try {
        // Query SubmissionCreated events for this assignment
        const events = await publicClient.getLogs({
          address: contractAddress as Address,
          event: {
            type: "event",
            name: "SubmissionCreated",
            inputs: [
              { indexed: true, name: "assignmentId", type: "uint256" },
              { indexed: true, name: "student", type: "address" },
              { indexed: false, name: "timestamp", type: "uint256" },
            ],
          },
          args: {
            assignmentId: BigInt(assignmentId),
          },
          fromBlock: 0n,
        });

        // Get submission details for each student
        const studentList: StudentSubmission[] = [];
        for (const event of events) {
          const studentAddress = event.args.student as Address;
          
          // Get submission details
          const submission = await publicClient.readContract({
            address: contractAddress as Address,
            abi: CONTRACT_ABI,
            functionName: "getSubmission",
            args: [BigInt(assignmentId), studentAddress],
          });

          // Check if already graded
          const isGraded = await publicClient.readContract({
            address: contractAddress as Address,
            abi: CONTRACT_ABI,
            functionName: "hasGrade",
            args: [BigInt(assignmentId), studentAddress],
          });

          if (submission[2]) { // exists is true
            studentList.push({
              address: studentAddress,
              encryptedAnswer: submission[0] as string,
              timestamp: submission[1] as bigint,
              decryptedAnswer: null,
              score: "",
              isGraded: isGraded as boolean,
            });
          }
        }

        setStudents(studentList);
      } catch (error) {
        console.error("Error fetching submissions:", error);
        toast.error("Failed to fetch student submissions");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSubmissions();
  }, [isOpen, assignmentId, contractAddress, publicClient]);

  const handleDecryptAll = async () => {
    if (!instance || !address || !contractAddress) {
      toast.error("FHEVM instance not ready");
      return;
    }

    setIsDecrypting(true);
    try {
      const updatedStudents = [...students];
      
      for (let i = 0; i < updatedStudents.length; i++) {
        if (updatedStudents[i].decryptedAnswer !== null) continue;
        
        setDecryptingIndex(i);
        try {
          const decrypted = await decryptEuint32(
            contractAddress,
            updatedStudents[i].encryptedAnswer
          );
          
          if (decrypted !== null) {
            updatedStudents[i].decryptedAnswer = Number(decrypted);
            setStudents([...updatedStudents]);
          }
        } catch (error) {
          console.error(`Error decrypting answer for ${updatedStudents[i].address}:`, error);
        }
      }
      
      toast.success("All answers decrypted!");
    } catch (error) {
      console.error("Error decrypting answers:", error);
      toast.error("Failed to decrypt some answers");
    } finally {
      setIsDecrypting(false);
      setDecryptingIndex(null);
    }
  };

  const handleDecryptOne = async (index: number) => {
    if (!instance || !address || !contractAddress) {
      toast.error("FHEVM instance not ready");
      return;
    }

    const student = students[index];
    if (student.decryptedAnswer !== null) return;

    setDecryptingIndex(index);
    try {
      const decrypted = await decryptEuint32(
        contractAddress,
        student.encryptedAnswer
      );
      
      if (decrypted !== null) {
        const updated = [...students];
        updated[index].decryptedAnswer = Number(decrypted);
        setStudents(updated);
        toast.success("Answer decrypted!");
      }
    } catch (error) {
      console.error("Error decrypting answer:", error);
      toast.error("Failed to decrypt answer");
    } finally {
      setDecryptingIndex(null);
    }
  };

  const handleGrade = async (index: number) => {
    const student = students[index];
    if (!student.score || !instance || !address || !contractAddress) {
      toast.error("Please enter a score");
      return;
    }

    const score = parseInt(student.score, 10);
    if (isNaN(score) || score < 0 || score > 100) {
      toast.error("Score must be between 0 and 100");
      return;
    }

    try {
      toast.info("Encrypting score...");
      
      const input = instance.createEncryptedInput(contractAddress, address);
      input.add32(score);
      const encrypted = await input.encrypt();

      const handle = encrypted.handles[0];
      let handleBytes: string;
      if (handle instanceof Uint8Array) {
        handleBytes = Array.from(handle).map(b => b.toString(16).padStart(2, '0')).join('');
      } else if (typeof handle === 'string') {
        handleBytes = handle.startsWith('0x') ? handle.slice(2) : handle;
      } else if (Array.isArray(handle)) {
        handleBytes = handle.map(b => (typeof b === 'number' ? b : parseInt(String(b), 10)).toString(16).padStart(2, '0')).join('');
      } else {
        handleBytes = String(handle).startsWith('0x') ? String(handle).slice(2) : String(handle);
      }

      const paddedHandle = handleBytes.length > 64 
        ? handleBytes.slice(0, 64) 
        : handleBytes.padEnd(64, '0');
      const encryptedScore = `0x${paddedHandle}` as `0x${string}`;

      let proofString: string;
      const proof = encrypted.inputProof;
      if (proof instanceof Uint8Array) {
        proofString = '0x' + Array.from(proof).map(b => b.toString(16).padStart(2, '0')).join('');
      } else if (typeof proof === 'string') {
        proofString = proof.startsWith('0x') ? proof : `0x${proof}`;
      } else if (Array.isArray(proof)) {
        proofString = '0x' + proof.map(b => (typeof b === 'number' ? b : parseInt(String(b), 10)).toString(16).padStart(2, '0')).join('');
      } else {
        proofString = String(proof);
      }

      toast.info("Submitting grade...");
      await writeContractAsync({
        address: contractAddress as Address,
        abi: CONTRACT_ABI,
        functionName: "gradeSubmission",
        args: [
          BigInt(assignmentId),
          student.address,
          encryptedScore,
          proofString as `0x${string}`,
        ],
      });

      const updated = [...students];
      updated[index].isGraded = true;
      setStudents(updated);
      toast.success("Grade submitted successfully!");
    } catch (error: any) {
      console.error("Error grading submission:", error);
      toast.error(`Failed to submit grade: ${error.message || 'Unknown error'}`);
    }
  };

  const handleScoreChange = (index: number, value: string) => {
    const updated = [...students];
    updated[index].score = value;
    setStudents(updated);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Grade Submissions - Assignment {assignmentId + 1}</DialogTitle>
          <DialogDescription>
            Decrypt and grade all student submissions
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading submissions...</span>
            </div>
          ) : students.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No submissions found
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm text-muted-foreground">
                  {students.length} submission{students.length !== 1 ? "s" : ""}
                </span>
                <Button
                  onClick={handleDecryptAll}
                  disabled={isDecrypting || students.every(s => s.decryptedAnswer !== null)}
                  size="sm"
                >
                  {isDecrypting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Decrypting...
                    </>
                  ) : (
                    "Decrypt All Answers"
                  )}
                </Button>
              </div>

              <div className="h-[500px] overflow-y-auto pr-4">
                <div className="space-y-4">
                  {students.map((student, index) => (
                    <Card key={student.address} className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium text-sm">
                              Student {index + 1}
                            </span>
                            <span className="text-xs text-muted-foreground font-mono">
                              {student.address.slice(0, 6)}...{student.address.slice(-4)}
                            </span>
                            {student.isGraded && (
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                            )}
                          </div>
                          
                          {student.decryptedAnswer !== null ? (
                            <div className="mb-3">
                              <Label className="text-xs text-muted-foreground">Decrypted Answer:</Label>
                              <div className="mt-1 p-2 bg-muted rounded text-sm">
                                {student.decryptedAnswer}
                              </div>
                            </div>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDecryptOne(index)}
                              disabled={isDecrypting && decryptingIndex === index}
                              className="mb-3"
                            >
                              {isDecrypting && decryptingIndex === index ? (
                                <>
                                  <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                                  Decrypting...
                                </>
                              ) : (
                                "Decrypt Answer"
                              )}
                            </Button>
                          )}

                          {student.decryptedAnswer !== null && !student.isGraded && (
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                placeholder="Score (0-100)"
                                value={student.score}
                                onChange={(e) => handleScoreChange(index, e.target.value)}
                                className="w-32"
                              />
                              <Button
                                size="sm"
                                onClick={() => handleGrade(index)}
                                disabled={!student.score}
                              >
                                Submit Grade
                              </Button>
                            </div>
                          )}

                          {student.isGraded && (
                            <div className="text-sm text-green-600 mt-2">
                              ✓ Graded
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

