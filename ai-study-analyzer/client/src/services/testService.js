// Mock Test Service - Switch between real API and mock data
// This file helps with testing the test interface without needing a backend server

import axios from 'axios';
import { mockTests, mockEvaluationResult } from './mockTestData';

// Set this to true to use mock data instead of API calls
const USE_MOCK_DATA = process.env.REACT_APP_USE_MOCK_DATA === 'true' || false;

export const testService = {
  /**
   * Fetch a test by ID
   * In mock mode: returns mock test data
   * In real mode: calls API endpoint /tests/:testId
   */
  fetchTest: async (testId) => {
    if (USE_MOCK_DATA) {
      console.log('📋 Using MOCK test data for:', testId);
      return {
        data: {
          test: mockTests[testId] || mockTests['test-001'],
          success: true
        }
      };
    }
    return axios.get(`/api/tests/${testId}`);
  },

  /**
   * Submit test answers
   * In mock mode: returns mock evaluation results
   * In real mode: calls API endpoint /tests/:testId/submit
   */
  submitTest: async (testId, answers, timeTaken) => {
    if (USE_MOCK_DATA) {
      console.log('📮 Submitting MOCK test answers for:', testId);
      // Simulate some processing delay
      await new Promise(resolve => setTimeout(resolve, 800));
      
      return {
        data: {
          results: mockEvaluationResult,
          success: true,
          message: 'Test submitted successfully (MOCK)'
        }
      };
    }
    return axios.post(`/api/tests/${testId}/submit`, {
      answers,
      timeTaken
    });
  },

  /**
   * Get all available tests
   */
  getAvailableTests: async () => {
    if (USE_MOCK_DATA) {
      console.log('📚 Using MOCK test list');
      return {
        data: {
          tests: Object.values(mockTests),
          success: true
        }
      };
    }
    return axios.get('/api/tests');
  },

  /**
   * Get test by ID for starting
   */
  getTestForStarting: async (testId) => {
    if (USE_MOCK_DATA) {
      const test = mockTests[testId];
      if (!test) {
        return {
          data: {
            success: false,
            message: 'Test not found'
          }
        };
      }
      return {
        data: {
          test: {
            ...test,
            questions: test.questions.map(q => ({
              id: q.id,
              type: q.type,
              marks: q.marks,
              question: q.question,
              options: q.options || undefined
              // Don't include correct answers in the test being taken
            }))
          },
          success: true
        }
      };
    }
    return axios.get(`/api/tests/${testId}`);
  }
};

// Utility to toggle mock mode
export const setMockMode = (enabled) => {
  process.env.REACT_APP_USE_MOCK_DATA = enabled ? 'true' : 'false';
  console.log(`🔄 Mock mode ${enabled ? 'ENABLED' : 'DISABLED'}`);
};

// Check current mode
export const isMockMode = () => USE_MOCK_DATA;

export default testService;
