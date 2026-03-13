# Mock Test Setup Guide

## Overview
Mock test data has been created to test the TestInterface component without requiring a backend server.

## Files Created

### 1. **mockTestData.js** 
Location: `ai-study-analyzer/client/src/mockTestData.js`

Contains three sample tests:
- **test-001**: Biology: Cell Structure and Function (Medium difficulty, 10 questions)
- **test-002**: Mathematics: Algebra Fundamentals (Easy difficulty, 3 questions)
- **test-003**: History: World War II (Hard difficulty, 3 questions)

Each test includes:
- MCQ questions with 4 options
- Short answer questions
- Long answer questions
- Detailed explanations and correct answers

### 2. **testService.js**
Location: `ai-study-analyzer/client/src/services/testService.js`

Wrapper service that allows switching between real API and mock data.

## How to Use Mock Tests

### Option 1: Using testService (Recommended)

In your components, import and use the test service:

```javascript
import testService from '../services/testService';

// Fetch a test
const response = await testService.fetchTest('test-001');
const test = response.data.test;

// Submit test answers
const response = await testService.submitTest('test-001', answers, timeTaken);
const results = response.data.results;
```

### Option 2: Direct Import

Import mock data directly in your component:

```javascript
import { mockTests, getMockTest } from '../mockTestData';

// Get a specific test
const test = getMockTest('test-001');

// Get all tests
const allTests = Object.values(mockTests);
```

## Enabling Mock Mode

### Method 1: Environment Variable
Set `REACT_APP_USE_MOCK_DATA=true` in your `.env` file:

```
REACT_APP_USE_MOCK_DATA=true
```

Then use testService as usual. It will automatically use mock data.

### Method 2: Runtime Toggle
```javascript
import { setMockMode, isMockMode } from '../services/testService';

// Enable mock mode
setMockMode(true);

// Check if mock mode is enabled
if (isMockMode()) {
  console.log('Using mock data');
}
```

### Method 3: Manual Integration in TestInterface

Update `TestInterface.js` to use mock data:

```javascript
import { getMockTest } from '../mockTestData';

// In the fetchTest function, replace the axios call with:
try {
  const mockTest = getMockTest(testId || 'test-001');
  if (mockTest) {
    setTest(mockTest);
    setStartTime(new Date());
    const testDuration = 30 * 60;
    setTimeLeft(testDuration);
    setLoading(false);
  }
} catch (error) {
  console.error('Error loading test:', error);
  navigate('/dashboard');
}
```

## Available Test IDs

Use these IDs when retrieving tests:

| Test ID | Subject | Topic | Difficulty | Duration | Questions |
|---------|---------|-------|------------|----------|-----------|
| test-001 | Biology | Cell Structure and Function | Medium | 30 min | 10 |
| test-002 | Mathematics | Algebra Fundamentals | Easy | 20 min | 3 |
| test-003 | History | World War II | Hard | 40 min | 3 |

## Question Types

### MCQ
```javascript
{
  type: 'mcq',
  marks: 1,
  question: 'Question text?',
  options: ['A. Option 1', 'B. Option 2', 'C. Option 3', 'D. Option 4'],
  correctAnswer: 'B',
  explanation: 'Explanation text'
}
```

### Short Answer
```javascript
{
  type: 'shortAnswer',
  marks: 3,
  question: 'Question text?',
  correctAnswer: 'Expected answer',
  explanation: 'Explanation text'
}
```

### Long Answer
```javascript
{
  type: 'longAnswer',
  marks: 5,
  question: 'Question text?',
  correctAnswer: 'Detailed expected answer',
  explanation: 'Explanation text'
}
```

## Testing Workflow

1. **Enable mock mode** in your environment or application
2. **Start the React development server**: `npm start` in the client directory
3. **Navigate to the test interface** with a test ID like `/test/test-001`
4. **Take the test** and verify:
   - Questions load correctly
   - Timer counts down
   - Navigation between questions works
   - Answer storage works
   - Submission returns evaluation results

## Sample Evaluation Results

The `mockEvaluationResult` object shows the expected format for test results:

```javascript
{
  testId: 'test-001',
  studentId: 'student-001',
  timeTaken: 28,
  evaluations: [
    {
      questionIndex: 0,
      score: 1,
      isCorrect: true,
      feedback: 'Feedback text',
      suggestions: 'Improvement suggestions'
    }
  ],
  overallFeedback: 'Overall performance summary',
  weakAreas: ['Area 1', 'Area 2'],
  recommendations: ['Recommendation 1'],
  performanceMetrics: {
    totalScore: 4,
    maxScore: 5,
    percentage: 80,
    performanceLevel: 'strong',
    correctAnswers: 4,
    totalQuestions: 5
  }
}
```

## Next Steps

1. Update `TestInterface.js` to use mock data for testing
2. Test the interface with different test IDs
3. Verify answer submission and result display
4. Once backend is ready, remove mock mode and use real API
5. Consider keeping mock data for end-to-end testing

## Switching Back to Real API

Simply remove the mock mode configuration:
- Delete `REACT_APP_USE_MOCK_DATA=true` from `.env`
- Or call `setMockMode(false)` in your code
- The testService will automatically use real API endpoints
