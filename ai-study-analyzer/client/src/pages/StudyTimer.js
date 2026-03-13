import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { Bar, Pie, Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import FocusMode from '../components/FocusMode';
import StudyAnalytics from '../components/StudyAnalytics';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend
);

const SUBJECTS = [
  'Data Structures',
  'Database Systems',
  'Computer Organization',
  'Machine Learning',
];

const BREAK_TIPS = [
  '💧 Drink a glass of water',
  '🧘 Stretch for 2 minutes',
  '🚶 Take a short walk',
  '👀 Rest your eyes — look at something distant',
  '🍎 Grab a healthy snack',
  '🫁 Try 4-7-8 breathing technique',
  '🎵 Listen to a calming song',
  '📝 Jot down what you learned so far',
];

const StudyTimer = () => {
  // Timer config
  const [studyMinutes, setStudyMinutes] = useState(25);
  const [shortBreakMinutes, setShortBreakMinutes] = useState(5);
  const [longBreakMinutes, setLongBreakMinutes] = useState(15);

  // Timer state
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionType, setSessionType] = useState('study'); // study | shortBreak | longBreak
  const [sessionsCompleted, setSessionsCompleted] = useState(0);
  const [currentSubject, setCurrentSubject] = useState('');
  const [customSubject, setCustomSubject] = useState('');

  // Daily goal
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState(240);
  const [todayStudySeconds, setTodayStudySeconds] = useState(0);
  const [goalReached, setGoalReached] = useState(false);

  // Streak
  const [currentStreak, setCurrentStreak] = useState(0);
  const [longestStreak, setLongestStreak] = useState(0);

  // Focus mode
  const [focusMode, setFocusMode] = useState(false);

  // Analytics
  const [showAnalytics, setShowAnalytics] = useState(false);

  // AI recommendation
  const [aiRecommendation, setAiRecommendation] = useState('');
  const [showRecommendation, setShowRecommendation] = useState(false);

  // Break tip
  const [breakTip, setBreakTip] = useState('');

  // Notification
  const [notification, setNotification] = useState('');

  // Session tracking
  const sessionStartRef = useRef(null);
  const intervalRef = useRef(null);
  const audioRef = useRef(null);

  // Elapsed time in current session (for saving partial sessions)
  const elapsedRef = useRef(0);

  // Ref to always hold the latest handleSessionEnd without stale closures
  const handleSessionEndRef = useRef(null);

  const getSubject = useCallback(() => {
    return currentSubject === 'Custom' ? customSubject : currentSubject;
  }, [currentSubject, customSubject]);

  // Load today's data and streak on mount
  useEffect(() => {
    fetchTodayData();
    fetchStreak();
  }, []);

  const fetchTodayData = async () => {
    try {
      const res = await axios.get('/study-timer/today');
      setTodayStudySeconds(res.data.totalSeconds || 0);
      setDailyGoalMinutes(res.data.goalMinutes || 240);
      setGoalReached(res.data.goalReached || false);
    } catch (err) {
      console.error('Failed to fetch today data:', err);
    }
  };

  const fetchStreak = async () => {
    try {
      const res = await axios.get('/study-timer/streak');
      setCurrentStreak(res.data.currentStreak || 0);
      setLongestStreak(res.data.longestStreak || 0);
    } catch (err) {
      console.error('Failed to fetch streak:', err);
    }
  };

  // Keep handleSessionEnd ref up-to-date on every render
  useEffect(() => {
    handleSessionEndRef.current = handleSessionEnd;
  });

  // Timer logic
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current);
            handleSessionEndRef.current();
            return 0;
          }
          elapsedRef.current += 1;
          if (sessionType === 'study') {
            setTodayStudySeconds(prevToday => prevToday + 1);
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [isRunning, sessionType]);

  const showNotification = (msg) => {
    setNotification(msg);
    // Play a subtle notification sound via Web Audio API
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 830;
      osc.type = 'sine';
      gain.gain.value = 0.15;
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (e) { /* silent fallback */ }

    setTimeout(() => setNotification(''), 5000);
  };

  const handleSessionEnd = async () => {
    setIsRunning(false);
    const elapsed = elapsedRef.current;

    if (sessionType === 'study') {
      // Save study session
      const subject = getSubject();
      if (subject && elapsed > 0) {
        try {
          await axios.post('/study-timer/session', {
            subject,
            duration: elapsed,
            sessionType: 'study',
            pomodoroSessions: 1
          });
        } catch (err) {
          console.error('Failed to save session:', err);
        }
      }

      setTodayStudySeconds(prev => prev + 1); // count the final second
      const newCompleted = sessionsCompleted + 1;
      setSessionsCompleted(newCompleted);

      // Check goal
      const newTotal = todayStudySeconds + elapsed;
      if (newTotal / 60 >= dailyGoalMinutes && !goalReached) {
        setGoalReached(true);
        showNotification('🎉 Congratulations! You reached your daily study goal!');
      } else {
        showNotification('✅ Study session complete! Time for a break.');
      }

      // Fetch AI recommendation
      fetchAiRecommendation(subject, elapsed);

      // Switch to break
      if (newCompleted % 4 === 0) {
        setSessionType('longBreak');
        setTimeLeft(longBreakMinutes * 60);
        setBreakTip(BREAK_TIPS[Math.floor(Math.random() * BREAK_TIPS.length)]);
      } else {
        setSessionType('shortBreak');
        setTimeLeft(shortBreakMinutes * 60);
        setBreakTip(BREAK_TIPS[Math.floor(Math.random() * BREAK_TIPS.length)]);
      }
    } else {
      // Break ended — switch to study
      showNotification('📚 Break over! Ready for another study session?');
      setSessionType('study');
      setTimeLeft(studyMinutes * 60);
      setBreakTip('');
    }

    elapsedRef.current = 0;
    fetchStreak();
  };

  const fetchAiRecommendation = async (subject, duration) => {
    try {
      const res = await axios.post('/study-timer/ai-recommendation', {
        subject,
        duration,
        todayTotal: todayStudySeconds + duration
      });
      setAiRecommendation(res.data.recommendation);
      setShowRecommendation(true);
    } catch (err) {
      setAiRecommendation(`Great job studying ${subject}! Keep up the momentum.`);
      setShowRecommendation(true);
    }
  };

  const startTimer = () => {
    if (!getSubject() && sessionType === 'study') {
      showNotification('⚠️ Please select a subject first.');
      return;
    }
    sessionStartRef.current = Date.now();
    elapsedRef.current = 0;
    setIsRunning(true);
    setShowRecommendation(false);
  };

  const pauseTimer = () => {
    setIsRunning(false);
  };

  const resetTimer = () => {
    setIsRunning(false);
    elapsedRef.current = 0;
    if (sessionType === 'study') {
      setTimeLeft(studyMinutes * 60);
    } else if (sessionType === 'shortBreak') {
      setTimeLeft(shortBreakMinutes * 60);
    } else {
      setTimeLeft(longBreakMinutes * 60);
    }
  };

  const skipToNext = () => {
    handleSessionEnd();
  };

  const updateGoal = async (minutes) => {
    setDailyGoalMinutes(minutes);
    try {
      await axios.put('/study-timer/goal', { dailyGoalMinutes: minutes });
    } catch (err) {
      console.error('Failed to update goal:', err);
    }
  };

  // Format time as MM:SS
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Format seconds to human readable
  const formatDuration = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  // Progress percentage for daily goal
  const goalProgress = Math.min(100, (todayStudySeconds / 60 / dailyGoalMinutes) * 100);

  // Timer ring progress
  const totalSessionTime = sessionType === 'study'
    ? studyMinutes * 60
    : sessionType === 'shortBreak'
    ? shortBreakMinutes * 60
    : longBreakMinutes * 60;
  const timerProgress = ((totalSessionTime - timeLeft) / totalSessionTime) * 100;

  // Session type colors
  const sessionColors = {
    study: { bg: 'from-blue-600 to-indigo-700', ring: '#3b82f6', text: 'text-blue-600' },
    shortBreak: { bg: 'from-green-500 to-emerald-600', ring: '#10b981', text: 'text-green-600' },
    longBreak: { bg: 'from-purple-500 to-violet-600', ring: '#8b5cf6', text: 'text-purple-600' },
  };
  const colors = sessionColors[sessionType];

  if (focusMode) {
    return (
      <FocusMode
        timeLeft={timeLeft}
        formatTime={formatTime}
        sessionType={sessionType}
        subject={getSubject()}
        isRunning={isRunning}
        onStart={startTimer}
        onPause={pauseTimer}
        onReset={resetTimer}
        onExit={() => setFocusMode(false)}
        timerProgress={timerProgress}
        colors={colors}
        sessionsCompleted={sessionsCompleted}
        breakTip={breakTip}
        notification={notification}
      />
    );
  }

  if (showAnalytics) {
    return (
      <StudyAnalytics
        onBack={() => setShowAnalytics(false)}
        todayStudySeconds={todayStudySeconds}
        currentStreak={currentStreak}
        longestStreak={longestStreak}
      />
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Notification Banner */}
      {notification && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 animate-slide-down">
          <div className="bg-white border border-gray-200 rounded-xl shadow-2xl px-6 py-4 flex items-center gap-3">
            <span className="text-lg">{notification}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">Study Timer</h1>
          <p className="text-gray-500">Stay focused, track your progress, achieve your goals</p>
        </div>
        <div className="flex gap-3 mt-4 md:mt-0">
          <button
            onClick={() => setFocusMode(true)}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Focus Mode
          </button>
          <button
            onClick={() => setShowAnalytics(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Analytics
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column — Timer */}
        <div className="lg:col-span-2 space-y-6">
          {/* Main Timer Card */}
          <div className={`bg-gradient-to-br ${colors.bg} rounded-2xl shadow-xl p-8 text-white`}>
            {/* Subject Selection */}
            {sessionType === 'study' && !isRunning && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-white/80 mb-2">Select Subject</label>
                <div className="flex gap-2 flex-wrap">
                  {SUBJECTS.map(sub => (
                    <button
                      key={sub}
                      onClick={() => setCurrentSubject(sub)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        currentSubject === sub
                          ? 'bg-white text-gray-900 shadow-lg'
                          : 'bg-white/20 text-white hover:bg-white/30'
                      }`}
                    >
                      {sub}
                    </button>
                  ))}
                  <button
                    onClick={() => setCurrentSubject('Custom')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      currentSubject === 'Custom'
                        ? 'bg-white text-gray-900 shadow-lg'
                        : 'bg-white/20 text-white hover:bg-white/30'
                    }`}
                  >
                    Custom
                  </button>
                </div>
                {currentSubject === 'Custom' && (
                  <input
                    type="text"
                    value={customSubject}
                    onChange={(e) => setCustomSubject(e.target.value)}
                    placeholder="Enter subject name..."
                    className="mt-3 w-full px-4 py-2 rounded-lg bg-white/20 text-white placeholder-white/60 border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50"
                    maxLength={100}
                  />
                )}
              </div>
            )}

            {/* Current subject display when running */}
            {(isRunning || sessionType !== 'study') && getSubject() && (
              <div className="mb-4 text-center">
                <span className="text-white/70 text-sm">Studying</span>
                <p className="text-xl font-semibold">{getSubject()}</p>
              </div>
            )}

            {/* Session Type Badge */}
            <div className="text-center mb-6">
              <span className="inline-block px-4 py-1 rounded-full bg-white/20 text-sm font-medium">
                {sessionType === 'study' ? '📚 Study Session' : sessionType === 'shortBreak' ? '☕ Short Break' : '🌟 Long Break'}
              </span>
            </div>

            {/* Timer Display */}
            <div className="flex justify-center mb-8">
              <div className="relative w-64 h-64">
                {/* SVG Ring */}
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 256 256">
                  <circle
                    cx="128" cy="128" r="115"
                    fill="none"
                    stroke="rgba(255,255,255,0.2)"
                    strokeWidth="12"
                  />
                  <circle
                    cx="128" cy="128" r="115"
                    fill="none"
                    stroke="white"
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 115}`}
                    strokeDashoffset={`${2 * Math.PI * 115 * (1 - timerProgress / 100)}`}
                    className="transition-all duration-1000"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-6xl font-mono font-bold tracking-wider">
                    {formatTime(timeLeft)}
                  </span>
                  <span className="text-white/70 text-sm mt-1">
                    Session {sessionsCompleted + 1}
                  </span>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="flex justify-center gap-4">
              {!isRunning ? (
                <button
                  onClick={startTimer}
                  className="px-8 py-3 bg-white text-gray-900 rounded-xl font-semibold hover:bg-gray-100 transition-all shadow-lg hover:shadow-xl active:scale-95"
                >
                  {timeLeft === totalSessionTime ? 'Start' : 'Resume'}
                </button>
              ) : (
                <button
                  onClick={pauseTimer}
                  className="px-8 py-3 bg-white/20 text-white rounded-xl font-semibold hover:bg-white/30 transition-all border border-white/30"
                >
                  Pause
                </button>
              )}
              <button
                onClick={resetTimer}
                className="px-6 py-3 bg-white/10 text-white rounded-xl font-semibold hover:bg-white/20 transition-all border border-white/20"
              >
                Reset
              </button>
              {isRunning && (
                <button
                  onClick={skipToNext}
                  className="px-6 py-3 bg-white/10 text-white rounded-xl font-semibold hover:bg-white/20 transition-all border border-white/20"
                >
                  Skip →
                </button>
              )}
            </div>

            {/* Session dots */}
            <div className="flex justify-center gap-2 mt-6">
              {[0, 1, 2, 3].map(i => (
                <div
                  key={i}
                  className={`w-3 h-3 rounded-full transition-all ${
                    i < (sessionsCompleted % 4)
                      ? 'bg-white'
                      : 'bg-white/30'
                  }`}
                />
              ))}
            </div>
            <p className="text-center text-white/60 text-xs mt-2">
              {sessionsCompleted} sessions completed · Long break after {4 - (sessionsCompleted % 4)} more
            </p>
          </div>

          {/* Timer Settings */}
          {!isRunning && sessionType === 'study' && (
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Timer Settings</h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Study (min)</label>
                  <input
                    type="number"
                    value={studyMinutes}
                    onChange={(e) => {
                      const v = Math.max(1, Math.min(120, Number(e.target.value)));
                      setStudyMinutes(v);
                      if (sessionType === 'study') setTimeLeft(v * 60);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min="1" max="120"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Short Break (min)</label>
                  <input
                    type="number"
                    value={shortBreakMinutes}
                    onChange={(e) => {
                      const v = Math.max(1, Math.min(30, Number(e.target.value)));
                      setShortBreakMinutes(v);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min="1" max="30"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Long Break (min)</label>
                  <input
                    type="number"
                    value={longBreakMinutes}
                    onChange={(e) => {
                      const v = Math.max(1, Math.min(60, Number(e.target.value)));
                      setLongBreakMinutes(v);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    min="1" max="60"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Break Suggestion */}
          {sessionType !== 'study' && breakTip && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex items-start gap-3">
              <span className="text-2xl">🌿</span>
              <div>
                <p className="font-semibold text-green-800">Break Suggestion</p>
                <p className="text-green-700 mt-1">{breakTip}</p>
              </div>
            </div>
          )}

          {/* AI Recommendation */}
          {showRecommendation && aiRecommendation && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 flex items-start gap-3">
              <span className="text-2xl">🤖</span>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-indigo-800">AI Study Recommendation</p>
                  <button
                    onClick={() => setShowRecommendation(false)}
                    className="text-indigo-400 hover:text-indigo-600"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <p className="text-indigo-700 mt-1">{aiRecommendation}</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Column — Stats & Goal */}
        <div className="space-y-6">
          {/* Study Streak */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-3xl">🔥</span>
              <div>
                <p className="text-sm text-gray-500">Study Streak</p>
                <p className="text-3xl font-bold text-gray-900">{currentStreak} <span className="text-base font-normal text-gray-500">days</span></p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              Longest: {longestStreak} days
            </div>
            <p className="text-xs text-gray-400 mt-2">Study 30+ minutes daily to keep your streak</p>
          </div>

          {/* Daily Goal */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Daily Goal</h3>
              <div className="flex items-center gap-1">
                <select
                  value={dailyGoalMinutes}
                  onChange={(e) => updateGoal(Number(e.target.value))}
                  className="text-sm border border-gray-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500"
                >
                  <option value={60}>1 hour</option>
                  <option value={120}>2 hours</option>
                  <option value={180}>3 hours</option>
                  <option value={240}>4 hours</option>
                  <option value={300}>5 hours</option>
                  <option value={360}>6 hours</option>
                  <option value={480}>8 hours</option>
                </select>
              </div>
            </div>

            <div className="mb-3">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Today's Progress</span>
                <span className="font-medium text-gray-900">
                  {formatDuration(todayStudySeconds)} / {formatDuration(dailyGoalMinutes * 60)}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    goalReached ? 'bg-green-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${goalProgress}%` }}
                />
              </div>
            </div>

            {goalReached && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                <p className="text-green-700 font-medium">🎉 Goal Reached! Keep going!</p>
              </div>
            )}
          </div>

          {/* Today's Summary */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Today's Summary</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-600 flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Study Time
                </span>
                <span className="font-semibold text-gray-900">{formatDuration(todayStudySeconds)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Sessions
                </span>
                <span className="font-semibold text-gray-900">{sessionsCompleted}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 flex items-center gap-2">
                  <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  Subject
                </span>
                <span className="font-semibold text-gray-900">{getSubject() || '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 flex items-center gap-2">
                  <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                  </svg>
                  Mode
                </span>
                <span className="font-semibold text-gray-900">Pomodoro</span>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-xl shadow-md p-6 text-white">
            <h3 className="text-lg font-semibold mb-4">Study Snapshot</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/10 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold">{sessionsCompleted}</p>
                <p className="text-xs text-gray-300">Pomodoros</p>
              </div>
              <div className="bg-white/10 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold">{Math.round(goalProgress)}%</p>
                <p className="text-xs text-gray-300">Goal</p>
              </div>
              <div className="bg-white/10 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold">{currentStreak}</p>
                <p className="text-xs text-gray-300">Streak 🔥</p>
              </div>
              <div className="bg-white/10 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold">{formatDuration(todayStudySeconds)}</p>
                <p className="text-xs text-gray-300">Today</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudyTimer;
