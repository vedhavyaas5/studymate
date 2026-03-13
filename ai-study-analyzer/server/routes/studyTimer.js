const express = require('express');
const jwt = require('jsonwebtoken');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { StudySession, StudyGoal, User } = require('../models');

const router = express.Router();

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

// Auth middleware
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

// @route   POST /api/study-timer/session
// @desc    Save a completed study session
router.post('/session', auth, async (req, res) => {
  try {
    const { subject, duration, sessionType, pomodoroSessions } = req.body;

    if (!subject || duration == null) {
      return res.status(400).json({ error: 'Subject and duration are required' });
    }

    const session = new StudySession({
      userId: req.userId,
      subject: subject.trim(),
      duration: Math.max(0, Number(duration)),
      sessionType: sessionType || 'study',
      pomodoroSessions: pomodoroSessions || 1,
      date: new Date()
    });

    await session.save();

    // Update user's total study hours
    const totalSeconds = Math.max(0, Number(duration));
    await User.findByIdAndUpdate(req.userId, {
      $inc: { 'stats.studyHours': totalSeconds / 3600 },
      $set: { 'stats.lastActive': new Date() }
    });

    res.status(201).json({ message: 'Session saved', session });
  } catch (error) {
    console.error('Save session error:', error);
    res.status(500).json({ error: 'Failed to save session' });
  }
});

// @route   GET /api/study-timer/today
// @desc    Get today's study data
router.get('/today', auth, async (req, res) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const sessions = await StudySession.find({
      userId: req.userId,
      date: { $gte: startOfDay, $lte: endOfDay },
      sessionType: 'study'
    });

    const totalSeconds = sessions.reduce((sum, s) => sum + s.duration, 0);

    // Get daily goal
    let goal = await StudyGoal.findOne({ userId: req.userId });
    if (!goal) {
      goal = { dailyGoalMinutes: 240 };
    }

    res.json({
      totalSeconds,
      totalMinutes: Math.round(totalSeconds / 60),
      sessions: sessions.length,
      goalMinutes: goal.dailyGoalMinutes,
      goalReached: (totalSeconds / 60) >= goal.dailyGoalMinutes
    });
  } catch (error) {
    console.error('Get today error:', error);
    res.status(500).json({ error: 'Failed to fetch today data' });
  }
});

// @route   GET /api/study-timer/analytics
// @desc    Get study analytics (daily, weekly, subject distribution)
router.get('/analytics', auth, async (req, res) => {
  try {
    const now = new Date();

    // Last 7 days daily breakdown
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const dailyData = await StudySession.aggregate([
      {
        $match: {
          userId: req.userId,
          sessionType: 'study',
          date: { $gte: sevenDaysAgo }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          totalSeconds: { $sum: '$duration' },
          sessions: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Fill in missing days
    const dailyStudy = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(sevenDaysAgo);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      const found = dailyData.find(dd => dd._id === dateStr);
      dailyStudy.push({
        date: dateStr,
        day: d.toLocaleDateString('en-US', { weekday: 'short' }),
        hours: found ? +(found.totalSeconds / 3600).toFixed(2) : 0,
        sessions: found ? found.sessions : 0
      });
    }

    // Last 4 weeks weekly breakdown
    const fourWeeksAgo = new Date(now);
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 27);
    fourWeeksAgo.setHours(0, 0, 0, 0);

    const weeklyData = await StudySession.aggregate([
      {
        $match: {
          userId: req.userId,
          sessionType: 'study',
          date: { $gte: fourWeeksAgo }
        }
      },
      {
        $group: {
          _id: { $isoWeek: '$date' },
          totalSeconds: { $sum: '$duration' },
          sessions: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const weeklyStudy = weeklyData.map((w, i) => ({
      week: `Week ${i + 1}`,
      hours: +(w.totalSeconds / 3600).toFixed(2),
      sessions: w.sessions
    }));

    // Subject-wise distribution (all time)
    const subjectData = await StudySession.aggregate([
      {
        $match: {
          userId: req.userId,
          sessionType: 'study'
        }
      },
      {
        $group: {
          _id: '$subject',
          totalSeconds: { $sum: '$duration' },
          sessions: { $sum: 1 }
        }
      },
      { $sort: { totalSeconds: -1 } }
    ]);

    const subjectDistribution = subjectData.map(s => ({
      subject: s._id,
      hours: +(s.totalSeconds / 3600).toFixed(2),
      sessions: s.sessions
    }));

    res.json({ dailyStudy, weeklyStudy, subjectDistribution });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// @route   GET /api/study-timer/streak
// @desc    Get study streak data
router.get('/streak', auth, async (req, res) => {
  try {
    // Get all unique study days (at least 30 min)
    const studyDays = await StudySession.aggregate([
      {
        $match: { userId: req.userId, sessionType: 'study' }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          totalSeconds: { $sum: '$duration' }
        }
      },
      {
        $match: { totalSeconds: { $gte: 1800 } } // at least 30 minutes
      },
      { $sort: { _id: -1 } }
    ]);

    const dayStrings = studyDays.map(d => d._id);

    // Calculate current streak
    let currentStreak = 0;
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    // Check if today or yesterday is in the list (streak can still be active)
    let checkDate = dayStrings.includes(today) ? today : (dayStrings.includes(yesterday) ? yesterday : null);

    if (checkDate) {
      let d = new Date(checkDate);
      while (true) {
        const dStr = d.toISOString().slice(0, 10);
        if (dayStrings.includes(dStr)) {
          currentStreak++;
          d.setDate(d.getDate() - 1);
        } else {
          break;
        }
      }
    }

    // Calculate longest streak
    let longestStreak = 0;
    if (dayStrings.length > 0) {
      const sortedDays = [...dayStrings].sort();
      let tempStreak = 1;
      for (let i = 1; i < sortedDays.length; i++) {
        const prev = new Date(sortedDays[i - 1]);
        const curr = new Date(sortedDays[i]);
        const diffDays = (curr - prev) / 86400000;
        if (diffDays === 1) {
          tempStreak++;
        } else {
          longestStreak = Math.max(longestStreak, tempStreak);
          tempStreak = 1;
        }
      }
      longestStreak = Math.max(longestStreak, tempStreak);
    }

    res.json({
      currentStreak,
      longestStreak,
      totalStudyDays: dayStrings.length
    });
  } catch (error) {
    console.error('Streak error:', error);
    res.status(500).json({ error: 'Failed to fetch streak' });
  }
});

// @route   PUT /api/study-timer/goal
// @desc    Set daily study goal
router.put('/goal', auth, async (req, res) => {
  try {
    const { dailyGoalMinutes } = req.body;
    if (!dailyGoalMinutes || dailyGoalMinutes < 1) {
      return res.status(400).json({ error: 'Goal must be at least 1 minute' });
    }

    const goal = await StudyGoal.findOneAndUpdate(
      { userId: req.userId },
      { dailyGoalMinutes: Math.min(Number(dailyGoalMinutes), 1440) },
      { upsert: true, new: true }
    );

    res.json({ message: 'Goal updated', goal });
  } catch (error) {
    console.error('Set goal error:', error);
    res.status(500).json({ error: 'Failed to set goal' });
  }
});

// @route   POST /api/study-timer/ai-recommendation
// @desc    Get AI study recommendation after a session
router.post('/ai-recommendation', auth, async (req, res) => {
  try {
    const { subject, duration, todayTotal } = req.body;

    const prompt = `You are a study advisor for a student using a Pomodoro study app. 
The student just finished studying "${subject}" for ${Math.round(duration / 60)} minutes.
Their total study time today is ${Math.round((todayTotal || 0) / 60)} minutes.

Give ONE short, encouraging, actionable study recommendation (2 sentences max). 
Suggest what topic to study next or a study strategy tip related to "${subject}".
Keep it motivational and concise. Do not use markdown formatting.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    res.json({ recommendation: text.trim() });
  } catch (error) {
    console.error('AI recommendation error:', error);
    res.json({
      recommendation: `Great session studying ${req.body.subject || 'your subject'}! Consider reviewing your notes and attempting practice problems next.`
    });
  }
});

module.exports = router;
