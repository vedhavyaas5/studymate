import React, { useState, useEffect } from 'react';
import axios from 'axios';
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
  Filler,
} from 'chart.js';
import { Bar, Pie, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend, Filler
);

const StudyAnalytics = ({ onBack, todayStudySeconds, currentStreak, longestStreak }) => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const res = await axios.get('/study-timer/analytics');
      setAnalytics(res.data);
    } catch (err) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const { dailyStudy = [], weeklyStudy = [], subjectDistribution = [] } = analytics || {};

  // Daily bar chart
  const dailyChartData = {
    labels: dailyStudy.map(d => d.day),
    datasets: [{
      label: 'Study Hours',
      data: dailyStudy.map(d => d.hours),
      backgroundColor: dailyStudy.map((d, i) => {
        const today = new Date().toLocaleDateString('en-US', { weekday: 'short' });
        return d.day === today ? 'rgba(59, 130, 246, 0.8)' : 'rgba(59, 130, 246, 0.4)';
      }),
      borderColor: 'rgb(59, 130, 246)',
      borderWidth: 1,
      borderRadius: 6,
    }]
  };

  const dailyChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.parsed.y} hours`
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: { display: true, text: 'Hours' },
        grid: { color: 'rgba(0,0,0,0.05)' }
      },
      x: { grid: { display: false } }
    },
  };

  // Subject pie chart
  const pieColors = [
    'rgba(59, 130, 246, 0.8)',
    'rgba(16, 185, 129, 0.8)',
    'rgba(245, 158, 11, 0.8)',
    'rgba(139, 92, 246, 0.8)',
    'rgba(239, 68, 68, 0.8)',
    'rgba(236, 72, 153, 0.8)',
    'rgba(20, 184, 166, 0.8)',
    'rgba(251, 146, 60, 0.8)',
  ];

  const subjectChartData = {
    labels: subjectDistribution.map(s => s.subject),
    datasets: [{
      data: subjectDistribution.map(s => s.hours),
      backgroundColor: pieColors.slice(0, subjectDistribution.length),
      borderWidth: 2,
      borderColor: '#fff',
    }]
  };

  const pieOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { padding: 16 } },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.label}: ${ctx.parsed} hours`
        }
      }
    }
  };

  // Weekly trend line chart
  const weeklyChartData = {
    labels: weeklyStudy.map(w => w.week),
    datasets: [{
      label: 'Study Hours',
      data: weeklyStudy.map(w => w.hours),
      borderColor: 'rgb(139, 92, 246)',
      backgroundColor: 'rgba(139, 92, 246, 0.1)',
      fill: true,
      tension: 0.4,
      pointBackgroundColor: 'rgb(139, 92, 246)',
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
      pointRadius: 5,
    }]
  };

  const weeklyChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.parsed.y} hours`
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        title: { display: true, text: 'Hours' },
        grid: { color: 'rgba(0,0,0,0.05)' }
      },
      x: { grid: { display: false } }
    },
  };

  const totalHours = subjectDistribution.reduce((sum, s) => sum + s.hours, 0);
  const totalSessions = subjectDistribution.reduce((sum, s) => sum + s.sessions, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={onBack}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Study Analytics</h1>
          <p className="text-gray-500">Your study performance insights</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-md p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500">Today</p>
              <p className="text-xl font-bold text-gray-900">{formatDuration(todayStudySeconds)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Hours</p>
              <p className="text-xl font-bold text-gray-900">{totalHours.toFixed(1)}h</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Sessions</p>
              <p className="text-xl font-bold text-gray-900">{totalSessions}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
              <span className="text-lg">🔥</span>
            </div>
            <div>
              <p className="text-sm text-gray-500">Study Streak</p>
              <p className="text-xl font-bold text-gray-900">{currentStreak} days</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Daily Study Time */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Daily Study Time</h3>
          <p className="text-sm text-gray-500 mb-4">Last 7 days</p>
          {dailyStudy.length > 0 ? (
            <div className="h-64">
              <Bar data={dailyChartData} options={dailyChartOptions} />
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">
              No data yet. Start studying to see your chart!
            </div>
          )}
        </div>

        {/* Subject Distribution */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Subject Distribution</h3>
          <p className="text-sm text-gray-500 mb-4">All time study breakdown</p>
          {subjectDistribution.length > 0 ? (
            <div className="h-64">
              <Pie data={subjectChartData} options={pieOptions} />
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">
              No data yet. Study different subjects to see distribution!
            </div>
          )}
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Weekly Trend */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Weekly Study Trend</h3>
          <p className="text-sm text-gray-500 mb-4">Last 4 weeks</p>
          {weeklyStudy.length > 0 ? (
            <div className="h-64">
              <Line data={weeklyChartData} options={weeklyChartOptions} />
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">
              Study across multiple weeks to see trends!
            </div>
          )}
        </div>

        {/* Subject Breakdown Table */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">Subject Breakdown</h3>
          <p className="text-sm text-gray-500 mb-4">Detailed study hours</p>
          {subjectDistribution.length > 0 ? (
            <div className="space-y-3">
              {subjectDistribution.map((s, i) => {
                const pct = totalHours > 0 ? (s.hours / totalHours * 100) : 0;
                return (
                  <div key={s.subject}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: pieColors[i % pieColors.length] }}
                        />
                        <span className="text-sm font-medium text-gray-700">{s.subject}</span>
                      </div>
                      <span className="text-sm text-gray-500">{s.hours}h · {s.sessions} sessions</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: pieColors[i % pieColors.length]
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center h-40 text-gray-400">
              No subject data yet
            </div>
          )}
        </div>
      </div>

      {/* Streak Details */}
      <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-xl shadow-md p-6 text-white">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <span className="text-5xl">🔥</span>
            <div>
              <h3 className="text-2xl font-bold">Study Streak: {currentStreak} days</h3>
              <p className="text-white/80 mt-1">Longest streak: {longestStreak} days</p>
            </div>
          </div>
          <div className="mt-4 md:mt-0 bg-white/20 rounded-lg px-5 py-3">
            <p className="text-sm text-white/70">Streak Rule</p>
            <p className="font-medium">Study 30+ min daily to keep your streak</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudyAnalytics;
