const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Test, Progress, Syllabus } = require('../models');

const router = express.Router();

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

// Middleware to verify JWT
const auth = (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Generate test questions with Gemini AI
const generateTestQuestions = async (topic, subject, educationLevel, difficulty = 'medium') => {
  try {
    const prompt = `
Generate exam questions for the following topic.

Subject: ${subject}
Education level: ${educationLevel}
Topic: ${topic}
Difficulty: ${difficulty}

Generate exactly:
5 Multiple Choice Questions (MCQ) - each with 4 options, one correct answer
3 Short Answer Questions
2 Long Answer Questions

For each question include:
- The question text
- For MCQ: 4 options (A, B, C, D) and the correct answer letter
- For all questions: Answer key and detailed explanation

Format the response as a valid JSON object:

{
  "mcq": [
    {
      "question": "Question text?",
      "options": ["A. Option 1", "B. Option 2", "C. Option 3", "D. Option 4"],
      "correctAnswer": "A",
      "explanation": "Detailed explanation"
    }
  ],
  "shortAnswer": [
    {
      "question": "Question text?",
      "correctAnswer": "Expected answer",
      "explanation": "Detailed explanation"
    }
  ],
  "longAnswer": [
    {
      "question": "Question text?",
      "correctAnswer": "Expected detailed answer",
      "explanation": "Detailed explanation"
    }
  ]
}

Ensure questions are appropriate for the education level and difficulty.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const textResponse = response.text();

    // Clean up the response to get valid JSON
    const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('Invalid AI response format');
    }

  } catch (error) {
    console.error('Test generation error:', error);
    throw error;
  }
};

// Evaluate student answers with Gemini AI
const evaluateAnswers = async (questions, studentAnswers) => {
  try {
    const evaluationPrompt = `
Evaluate the following student answers and provide detailed feedback.

Questions and student responses:
${questions.map((q, index) => `
Question ${index + 1} (${q.type}):
Question: ${q.question}
Correct Answer: ${q.correctAnswer}
Student Answer: ${studentAnswers[index] || 'No answer provided'}
`).join('\n')}

For each question, provide:
- Score (0-1 for MCQ, 0-5 for short answer, 0-10 for long answer)
- Whether the answer is correct (true/false)
- Detailed feedback explaining what was right/wrong
- Suggestions for improvement

Format as JSON:
{
  "evaluations": [
    {
      "questionIndex": 0,
      "score": 1,
      "isCorrect": true,
      "feedback": "Detailed feedback",
      "suggestions": "Improvement suggestions"
    }
  ],
  "overallFeedback": "Overall performance summary",
  "weakAreas": ["Area 1", "Area 2"],
  "recommendations": ["Recommendation 1", "Recommendation 2"]
}
    `;

    const result = await model.generateContent(evaluationPrompt);
    const response = await result.response;
    const textResponse = response.text();

    const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('Invalid AI evaluation response');
    }

  } catch (error) {
    console.error('Answer evaluation error:', error);
    throw error;
  }
};

// Calculate performance metrics
const calculatePerformanceMetrics = (questions, evaluations) => {
  const totalQuestions = questions.length;
  const totalMaxScore = questions.reduce((sum, q) => sum + (q.marks || 1), 0);
  const totalScore = evaluations.reduce((sum, eval) => sum + eval.score, 0);
  const percentage = Math.round((totalScore / totalMaxScore) * 100);

  let performanceLevel = 'moderate';
  if (percentage >= 80) performanceLevel = 'strong';
  else if (percentage < 50) performanceLevel = 'weak';

  return {
    totalScore,
    maxScore: totalMaxScore,
    percentage,
    performanceLevel,
    correctAnswers: evaluations.filter(e => e.isCorrect).length,
    totalQuestions
  };
};

// @route   POST /api/tests/generate
// @desc    Generate test for a topic
// @access  Private
router.post('/generate', auth, async (req, res) => {
  try {
    const { syllabusId, topic, difficulty = 'medium' } = req.body;

    if (!syllabusId || !topic) {
      return res.status(400).json({ error: 'Syllabus ID and topic are required' });
    }

    // Get syllabus to get subject and education level
    const syllabus = await Syllabus.findOne({
      _id: syllabusId,
      userId: req.userId
    });

    if (!syllabus) {
      return res.status(404).json({ error: 'Syllabus not found' });
    }

    // Generate questions with AI
    const aiQuestions = await generateTestQuestions(
      topic,
      syllabus.structuredData.subject,
      syllabus.structuredData.educationLevel,
      difficulty
    );

    // Convert AI response to our format
    const questions = [
      ...aiQuestions.mcq.map(q => ({
        type: 'mcq',
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        marks: 1
      })),
      ...aiQuestions.shortAnswer.map(q => ({
        type: 'short_answer',
        question: q.question,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        marks: 5
      })),
      ...aiQuestions.longAnswer.map(q => ({
        type: 'long_answer',
        question: q.question,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        marks: 10
      }))
    ];

    // Create test
    const test = new Test({
      userId: req.userId,
      syllabusId,
      topic,
      difficulty,
      questions,
      maxScore: questions.reduce((sum, q) => sum + q.marks, 0),
      status: 'in_progress'
    });

    await test.save();

    // Return test without answers
    const testResponse = {
      id: test._id,
      topic: test.topic,
      difficulty: test.difficulty,
      questions: test.questions.map(q => ({
        type: q.type,
        question: q.question,
        options: q.options, // Include options for MCQ
        marks: q.marks
      })),
      maxScore: test.maxScore
    };

    res.status(201).json({
      message: 'Test generated successfully',
      test: testResponse
    });

  } catch (error) {
    console.error('Test generation error:', error);
    res.status(500).json({ error: 'Failed to generate test' });
  }
});

// @route   POST /api/tests/:id/submit
// @desc    Submit test answers
// @access  Private
router.post('/:id/submit', auth, async (req, res) => {
  try {
    const { answers, timeTaken } = req.body;

    const test = await Test.findOne({
      _id: req.params.id,
      userId: req.userId
    });

    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }

    if (test.status === 'completed') {
      return res.status(400).json({ error: 'Test already completed' });
    }

    // Evaluate answers with AI
    const evaluations = await evaluateAnswers(test.questions, answers);

    // Calculate performance
    const performance = calculatePerformanceMetrics(test.questions, evaluations.evaluations);

    // Update test with results
    test.studentAnswers = evaluations.evaluations.map((eval, index) => ({
      questionIndex: index,
      answer: answers[index] || '',
      isCorrect: eval.isCorrect,
      score: eval.score,
      feedback: eval.feedback
    }));

    test.totalScore = performance.totalScore;
    test.percentage = performance.percentage;
    test.timeTaken = timeTaken;
    test.status = 'completed';
    test.aiFeedback = {
      overallFeedback: evaluations.overallFeedback,
      weakAreas: evaluations.weakAreas,
      recommendations: evaluations.recommendations
    };

    await test.save();

    // Update progress tracking
    let progress = await Progress.findOne({
      userId: req.userId,
      syllabusId: test.syllabusId,
      topic: test.topic
    });

    if (!progress) {
      progress = new Progress({
        userId: req.userId,
        syllabusId: test.syllabusId,
        topic: test.topic
      });
    }

    progress.totalAttempts += 1;
    progress.correctAnswers += performance.correctAnswers;
    progress.totalQuestions += performance.totalQuestions;
    progress.accuracy = Math.round((progress.correctAnswers / progress.totalQuestions) * 100);
    progress.performanceLevel = performance.performanceLevel;
    progress.lastTestDate = new Date();
    progress.studyTimeSpent += (timeTaken || 0);

    // Add to improvement trend
    progress.improvementTrend.push({
      date: new Date(),
      accuracy: performance.percentage
    });

    await progress.save();

    res.json({
      message: 'Test submitted successfully',
      results: {
        totalScore: test.totalScore,
        maxScore: test.maxScore,
        percentage: test.percentage,
        performanceLevel: performance.performanceLevel,
        correctAnswers: performance.correctAnswers,
        totalQuestions: performance.totalQuestions,
        aiFeedback: test.aiFeedback,
        evaluations: evaluations.evaluations
      }
    });

  } catch (error) {
    console.error('Test submission error:', error);
    res.status(500).json({ error: 'Failed to submit test' });
  }
});

// @route   GET /api/tests
// @desc    Get user's tests
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const tests = await Test.find({ userId: req.userId })
      .populate('syllabusId', 'structuredData.subject fileName')
      .sort({ createdAt: -1 })
      .select('topic difficulty totalScore maxScore percentage status createdAt syllabusId');

    res.json({ tests });

  } catch (error) {
    console.error('Get tests error:', error);
    res.status(500).json({ error: 'Failed to fetch tests' });
  }
});

// @route   GET /api/tests/:id
// @desc    Get specific test with results
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const test = await Test.findOne({
      _id: req.params.id,
      userId: req.userId
    });

    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }

    res.json({ test });

  } catch (error) {
    console.error('Get test error:', error);
    res.status(500).json({ error: 'Failed to fetch test' });
  }
});

module.exports = router;
