import { useState, useEffect } from "react";
import { useAccount, useChainId, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { getContractAddress } from "@/config/contracts";
import { Address } from "viem";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, FileText } from "lucide-react";
import { toast } from "sonner";
import { AssignmentCard } from "./AssignmentCard";

// Contract ABI for FairGradeForge
const CONTRACT_ABI = [
  {
    inputs: [],
    name: "teacher",
    outputs: [{ internalType: "address", name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "totalAssignments",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { internalType: "string", name: "title", type: "string" },
      { internalType: "string", name: "requirements", type: "string" },
      { internalType: "uint256", name: "deadline", type: "uint256" },
    ],
    name: "createAssignment",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
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
] as const;

interface Assignment {
  id: number;
}

export const TeacherDashboard = () => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newAssignment, setNewAssignment] = useState({
    title: "",
    requirements: "",
    deadline: "",
  });

  // Read total assignments count
  const { data: totalAssignments, refetch: refetchTotal } = useReadContract({
    address: contractAddress as Address,
    abi: CONTRACT_ABI,
    functionName: "totalAssignments",
    query: {
      enabled: isConnected && !!contractAddress,
    },
  });

  // Write contract for creating assignment
  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // Fetch all assignments with details
  useEffect(() => {
    if (totalAssignments !== undefined && contractAddress) {
      const fetchAssignments = async () => {
        const count = Number(totalAssignments);
        const assignmentList: Assignment[] = [];
        
        // Create list - each AssignmentCard will fetch its own details
        for (let i = 0; i < count; i++) {
          assignmentList.push({
            id: i,
          });
        }
        setAssignments(assignmentList);
      };
      fetchAssignments();
    }
  }, [totalAssignments, contractAddress]);

  // Refetch after successful creation
  useEffect(() => {
    if (isSuccess) {
      toast.success("Assignment created successfully!");
      setIsCreateDialogOpen(false);
      setNewAssignment({ title: "", requirements: "", deadline: "" });
      refetchTotal();
    }
  }, [isSuccess, refetchTotal]);

  const handleCreateAssignment = () => {
    if (!newAssignment.title || !newAssignment.requirements || !newAssignment.deadline) {
      toast.error("Please fill in all fields");
      return;
    }

    const deadlineTimestamp = Math.floor(new Date(newAssignment.deadline).getTime() / 1000);
    if (deadlineTimestamp <= Math.floor(Date.now() / 1000)) {
      toast.error("Deadline must be in the future");
      return;
    }

    writeContract({
      address: contractAddress as Address,
      abi: CONTRACT_ABI,
      functionName: "createAssignment",
      args: [newAssignment.title, newAssignment.requirements, BigInt(deadlineTimestamp)],
    });
  };


  return (
    <section className="py-20 bg-muted/30 min-h-screen">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-12">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Teacher Dashboard
              </h2>
              <p className="text-muted-foreground">
                Create assignments and grade student submissions
              </p>
            </div>
            
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Assignment
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Assignment</DialogTitle>
                  <DialogDescription>
                    Create a new assignment for students to submit.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      placeholder="Assignment title"
                      value={newAssignment.title}
                      onChange={(e) =>
                        setNewAssignment({ ...newAssignment, title: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="requirements">Requirements</Label>
                    <Textarea
                      id="requirements"
                      placeholder="Assignment requirements and description"
                      value={newAssignment.requirements}
                      onChange={(e) =>
                        setNewAssignment({ ...newAssignment, requirements: e.target.value })
                      }
                      rows={4}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="deadline">Deadline</Label>
                    <Input
                      id="deadline"
                      type="datetime-local"
                      value={newAssignment.deadline}
                      onChange={(e) =>
                        setNewAssignment({ ...newAssignment, deadline: e.target.value })
                      }
                    />
                  </div>
                  <Button
                    onClick={handleCreateAssignment}
                    disabled={isPending || isConfirming}
                    className="w-full"
                  >
                    {isPending || isConfirming ? "Creating..." : "Create Assignment"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {assignments.length === 0 ? (
            <Card className="p-8 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">No assignments yet</p>
              <p className="text-sm text-muted-foreground">
                Create your first assignment to get started
              </p>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {assignments.map((assignment) => (
                <AssignmentCard
                  key={assignment.id}
                  assignmentId={assignment.id}
                  chainId={chainId}
                  isTeacher={true}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
