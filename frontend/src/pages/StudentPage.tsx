import { Header } from "@/components/Header";
import { StudentDashboard } from "@/components/StudentDashboard";
import { Footer } from "@/components/Footer";

const StudentPage = () => {
  return (
    <div className="min-h-screen">
      <Header />
      <StudentDashboard />
      <Footer />
    </div>
  );
};

export default StudentPage;

