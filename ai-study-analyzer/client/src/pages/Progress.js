import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

const Progress = () => {
  const { user } = useAuth();
  const [progressData, setProgressData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProgress();
  }, [user]);

  const fetchProgress = async () => {
    try {
      const response = await axios.get('/api/progress', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setProgressData(response.data);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching progress:', error);
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Your Progress</h1>
      {progressData ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Overall Progress</h2>
            <p className="text-gray-600">Completion: {progressData.completion}%</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <h2 className="text-xl font-semibold mb-4">Tests Completed</h2>
            <p className="text-gray-600">Tests: {progressData.testsCompleted}</p>
          </div>
        </div>
      ) : (
        <p>No progress data available</p>
      )}
    </div>
  );
};

export default Progress;
