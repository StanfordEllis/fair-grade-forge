import { Header } from "@/components/Header";
import { TeacherDashboard } from "@/components/TeacherDashboard";
import { Footer } from "@/components/Footer";
import { useAccount, useChainId } from "wagmi";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { getContractAddress } from "@/config/contracts";
import { useReadContract } from "wagmi";
import { Address } from "viem";

const TeacherPage = () => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const navigate = useNavigate();
  
  // Check if connected address is the teacher (deployer)
  const contractAddress = getContractAddress(chainId);
  
  // Debug logging
  useEffect(() => {
    console.log('=== TeacherPage Debug Info ===');
    console.log('Chain ID:', chainId);
    console.log('Contract Address:', contractAddress);
    console.log('Is Connected:', isConnected);
    console.log('User Address:', address);
  }, [chainId, contractAddress, isConnected, address]);

  const { data: teacherAddress, isLoading, isError, error } = useReadContract({
    address: contractAddress !== '0x0000000000000000000000000000000000000000' ? contractAddress as Address : undefined,
    abi: [
      {
        inputs: [],
        name: 'teacher',
        outputs: [{ internalType: 'address', name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function',
      },
    ] as const,
    functionName: 'teacher',
    query: {
      enabled: isConnected && !!contractAddress && contractAddress !== '0x0000000000000000000000000000000000000000',
    },
  });

  // Debug logging for contract read
  useEffect(() => {
    console.log('=== Contract Read Status ===');
    console.log('Is Loading:', isLoading);
    console.log('Is Error:', isError);
    if (error) {
      console.error('Contract Read Error:', error);
    }
    if (teacherAddress) {
      console.log('✅ Teacher Address from Contract:', teacherAddress);
      console.log('✅ Your Address:', address);
      console.log('✅ Address Match:', address?.toLowerCase() === teacherAddress.toLowerCase());
    }
  }, [teacherAddress, isLoading, isError, error, address]);

  useEffect(() => {
    if (isConnected && address && teacherAddress && !isLoading) {
      if (address.toLowerCase() !== teacherAddress.toLowerCase()) {
        console.log('❌ Address mismatch - redirecting to student page');
        // Not the teacher, redirect to student page
        navigate('/');
      } else {
        console.log('✅ Address match - showing teacher dashboard');
      }
    }
  }, [address, teacherAddress, isConnected, isLoading, navigate]);

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-20 text-center">
          <p className="text-muted-foreground">Please connect your wallet</p>
        </div>
        <Footer />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-20 text-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
        <Footer />
      </div>
    );
  }

  if (isError || !teacherAddress) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-20 text-center">
          <p className="text-muted-foreground">Error loading contract. Please ensure the contract is deployed.</p>
          <p className="text-sm text-muted-foreground mt-2">Contract address: {contractAddress}</p>
        </div>
        <Footer />
      </div>
    );
  }

  if (address && teacherAddress && address.toLowerCase() !== teacherAddress.toLowerCase()) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-20 text-center">
          <p className="text-muted-foreground">Access denied. Only the teacher can access this page.</p>
          <p className="text-sm text-muted-foreground mt-2">
            Your address: {address}<br />
            Teacher address: {teacherAddress}
          </p>
        </div>
        <Footer />
      </div>
    );
  }

  // User is the teacher, show dashboard
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <TeacherDashboard />
      <Footer />
    </div>
  );
};

export default TeacherPage;

