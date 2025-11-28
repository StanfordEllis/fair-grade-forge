import { useState, useEffect } from "react";
import { useAccount, useChainId, useReadContract } from "wagmi";
import { getContractAddress } from "@/config/contracts";
import { Address } from "viem";
import { Card } from "@/components/ui/card";
import { FileText } from "lucide-react";
import { AssignmentCard } from "./AssignmentCard";

const CONTRACT_ABI = [
  {
    inputs: [],
    name: "totalAssignments",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

interface Assignment {
  id: number;
}

export const StudentDashboard = () => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const contractAddress = getContractAddress(chainId);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  // Read total assignments count
  const { data: totalAssignments } = useReadContract({
    address: contractAddress as Address,
    abi: CONTRACT_ABI,
    functionName: "totalAssignments",
    query: {
      enabled: isConnected && !!contractAddress,
    },
  });

  // Fetch all assignments
  useEffect(() => {
    if (totalAssignments !== undefined) {
      const count = Number(totalAssignments);
      const assignmentList: Assignment[] = [];
      for (let i = 0; i < count; i++) {
        assignmentList.push({ id: i });
      }
      setAssignments(assignmentList);
    }
  }, [totalAssignments]);

  return (
    <section className="py-20 bg-muted/30 min-h-screen">
      <div className="container mx-auto px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Student Dashboard
            </h2>
            <p className="text-muted-foreground">
              View and submit your encrypted assignments
            </p>
          </div>

          {assignments.length === 0 ? (
            <Card className="p-8 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">No assignments available</p>
              <p className="text-sm text-muted-foreground">
                Check back later for new assignments
              </p>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {assignments.map((assignment) => (
                <AssignmentCard
                  key={assignment.id}
                  assignmentId={assignment.id}
                  chainId={chainId}
                  isTeacher={false}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
