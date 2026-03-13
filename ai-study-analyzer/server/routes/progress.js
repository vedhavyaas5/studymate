const express = require('express');
const { Progress, Test, Syllabus } = require('../models');

const router = express.Router();

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

// @route   GET /api/progress/dashboard
// @desc    Get comprehensive progress dashboard data
// @access  Private
router.get('/dashboard', auth, async (req, res) => {
  try {
    // Get all progress data
    const progressData = await Progress.find({ userId: req.userId })
      .populate('syllabusId', 'structuredData.subject')
      .sort({ updatedAt: -1 });

    // Get recent tests
    const recentTests = await Test.find({ userId: req.userId })
      .populate('syllabusId', 'structuredData.subject')
      .sort({ createdAt: -1 })
      .limit(10)
      .select('topic percentage totalScore maxScore createdAt syllabusId');

    // Calculate overall statistics
    const totalTests = await Test.countDocuments({ userId: req.userId });
    const completedTests = await Test.countDocuments({
      userId: req.userId,
      status: 'completed'
    });

    const averageScore = completedTests > 0 ?
      await Test.aggregate([
        { $match: { userId: req.userId, status: 'completed' } },
        { $group: { _id: null, avg: { $avg: '$percentage' } } }
      ]) : [{ avg: 0 }];

    // Subject-wise progress
    const subjectProgress = await Progress.aggregate([
      {
        $match: { userId: req.userId }
      },
      {
        $lookup: {
          from: 'syllabi',
          localField: 'syllabusId',
          foreignField: '_id',
          as: 'syllabus'
        }
      },
      {
        $unwind: '$syllabus'
      },
      {
        $group: {
          _id: '$syllabus.structuredData.subject',
          totalTopics: { $sum: 1 },
          avgAccuracy: { $avg: '$accuracy' },
          strongTopics: {
            $sum: { $cond: [{ $eq: ['$performanceLevel', 'strong'] }, 1, 0] }
          },
          moderateTopics: {
            $sum: { $cond: [{ $eq: ['$performanceLevel', 'moderate'] }, 1, 0] }
          },
          weakTopics: {
            $sum: { $cond: [{ $eq: ['$performanceLevel', 'weak'] }, 1, 0] }
          }
        }
      }
    ]);

    // Weak areas identification
    const weakAreas = progressData
      .filter(p => p.performanceLevel === 'weak')
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 5)
      .map(p => ({
        topic: p.topic,
        accuracy: p.accuracy,
        attempts: p.totalAttempts
      }));

    // Performance trend over time
    const performanceTrend = await Test.aggregate([
      { $match: { userId: req.userId, status: 'completed' } },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          averageScore: { $avg: '$percentage' },
          testCount: { $sum: 1 }
        }
      },
      { $sort: { '_id': 1 } },
      { $limit: 30 } // Last 30 days
    ]);

    res.json({
      overview: {
        totalTests,
        completedTests,
        averageScore: Math.round(averageScore[0]?.avg || 0),
        totalTopics: progressData.length
      },
      subjectProgress,
      weakAreas,
      recentTests,
      performanceTrend: performanceTrend.map(item => ({
        date: item._id,
        score: Math.round(item.averageScore),
        tests: item.testCount
      }))
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to load dashboard data' });
  }
});

// @route   GET /api/progress/topics
// @desc    Get detailed topic progress
// @access  Private
router.get('/topics', auth, async (req, res) => {
  try {
    const progress = await Progress.find({ userId: req.userId })
      .populate('syllabusId', 'structuredData.subject fileName')
      .sort({ accuracy: 1 }); // Show weakest first

    res.json({ progress });

  } catch (error) {
    console.error('Topics progress error:', error);
    res.status(500).json({ error: 'Failed to load topic progress' });
  }
});

// @route   GET /api/progress/recommendations
// @desc    Get AI-generated study recommendations
// @access  Private
router.get('/recommendations', auth, async (req, res) => {
  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    // Get recent performance data
    const recentTests = await Test.find({
      userId: req.userId,
      status: 'completed'
    })
    .sort({ createdAt: -1 })
    .limit(5)
    .populate('syllabusId', 'structuredData.subject');

    // Get weak areas
    const weakProgress = await Progress.find({
      userId: req.userId,
      performanceLevel: 'weak'
    })
    .sort({ accuracy: 1 })
    .limit(3);

    const performanceData = recentTests.map(test => ({
      subject: test.syllabusId?.structuredData?.subject,
      topic: test.topic,
      score: test.percentage,
      date: test.createdAt
    }));

    const weakAreas = weakProgress.map(p => ({
      topic: p.topic,
      accuracy: p.accuracy,
      attempts: p.totalAttempts
    }));

    const prompt = `
Based on this student performance data, generate personalized study recommendations:

Recent Test Performance:
${JSON.stringify(performanceData, null, 2)}

Weak Areas:
${JSON.stringify(weakAreas, null, 2)}

Generate a study plan with:
1. Immediate focus areas (weak topics)
2. Study schedule recommendations
3. Specific improvement strategies
4. Resource suggestions
5. Motivation tips

Format as JSON with these keys: focusAreas, studySchedule, strategies, resources, motivation
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const textResponse = response.text();

    const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
    const recommendations = jsonMatch ? JSON.parse(jsonMatch[0]) : {
      focusAreas: weakAreas.map(w => w.topic),
      studySchedule: ['Dedicate 2 hours daily to weak topics', 'Practice daily MCQs', 'Review weekly'],
      strategies: ['Focus on understanding concepts', 'Practice regularly', 'Seek help for difficult topics'],
      resources: ['Online tutorials', 'Practice question banks', 'Study groups'],
      motivation: ['Track your progress', 'Set achievable goals', 'Reward yourself for improvements']
    };

    res.json({ recommendations });

  } catch (error) {
    console.error('Recommendations error:', error);
    res.status(500).json({
      error: 'Failed to generate recommendations',
      recommendations: {
        focusAreas: ['Review weak topics regularly'],
        studySchedule: ['Create a consistent study routine'],
        strategies: ['Practice regularly', 'Focus on understanding'],
        resources: ['Online tutorials', 'Textbooks', 'Study groups'],
        motivation: ['Track progress', 'Set goals', 'Stay consistent']
      }
    });
  }
});

module.exports = router;
