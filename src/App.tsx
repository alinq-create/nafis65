import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";

import Login from "./pages/Login";
import AdminDashboard from "./pages/admin/AdminDashboard";
import ManageTeachers from "./pages/admin/ManageTeachers";
import AdminAttempts from "./pages/admin/AdminAttempts";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import QuestionBank from "./pages/teacher/QuestionBank";
import CreateExam from "./pages/teacher/CreateExam";
import ReviewAttempts from "./pages/teacher/ReviewAttempts";
import TeacherAnalytics from "./pages/teacher/TeacherAnalytics";
import StudentEntry from "./pages/student/StudentEntry";
import TakeExam from "./pages/student/TakeExam";
import SubmissionConfirmation from "./pages/student/SubmissionConfirmation";
import SystemDashboard from "./pages/system/SystemDashboard";
import ImportQuestionBank from "./pages/system/ImportQuestionBank";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/student" replace />} />
            <Route path="/login" element={<Login />} />
            
            {/* Admin Routes */}
            <Route path="/admin" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/teachers" element={<ProtectedRoute requiredRole="admin"><ManageTeachers /></ProtectedRoute>} />
            <Route path="/admin/attempts" element={<ProtectedRoute requiredRole="admin"><AdminAttempts /></ProtectedRoute>} />
            <Route path="/admin/analytics" element={<ProtectedRoute requiredRole="admin"><AdminAnalytics /></ProtectedRoute>} />
            
            {/* Teacher Routes */}
            <Route path="/teacher" element={<ProtectedRoute requiredRole="teacher"><TeacherDashboard /></ProtectedRoute>} />
            <Route path="/teacher/questions" element={<ProtectedRoute requiredRole="teacher"><QuestionBank /></ProtectedRoute>} />
            <Route path="/teacher/exams" element={<ProtectedRoute requiredRole="teacher"><CreateExam /></ProtectedRoute>} />
            <Route path="/teacher/attempts" element={<ProtectedRoute requiredRole="teacher"><ReviewAttempts /></ProtectedRoute>} />
            <Route path="/teacher/analytics" element={<ProtectedRoute requiredRole="teacher"><TeacherAnalytics /></ProtectedRoute>} />
            
            {/* System Admin Routes */}
            <Route path="/system" element={<ProtectedRoute requiredRole="system_admin"><SystemDashboard /></ProtectedRoute>} />
            <Route path="/system/import" element={<ProtectedRoute requiredRole="system_admin"><ImportQuestionBank /></ProtectedRoute>} />
            
            {/* Student Routes (no auth needed) */}
            <Route path="/student" element={<StudentEntry />} />
            <Route path="/student/exam" element={<TakeExam />} />
            <Route path="/student/confirmation" element={<SubmissionConfirmation />} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
