import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Dashboard from './pages/Dashboard';
import UploadSyllabus from './pages/UploadSyllabus';
import TestInterface from './pages/TestInterface';
import Progress from './pages/Progress';
import StudyTimer from './pages/StudyTimer';
import Navbar from './components/Navbar';
import LoadingSpinner from './components/LoadingSpinner';

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {user && <Navbar />}
      <main className={user ? 'pt-16' : ''}>
        <Routes>
          {/* Routes */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/upload" element={<UploadSyllabus />} />
          <Route path="/test/:testId" element={<TestInterface />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/study-timer" element={<StudyTimer />} />

          {/* Redirect root and everything else to dashboard */}
          <Route path="/" element={<Navigate to="/dashboard" />} />
          <Route path="/login" element={<Navigate to="/dashboard" />} />
          <Route path="/signup" element={<Navigate to="/dashboard" />} />
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
