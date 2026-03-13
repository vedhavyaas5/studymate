const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  profile: {
    avatar: String,
    educationLevel: {
      type: String,
      enum: ['CBSE', 'IGCSE', 'Matriculation', 'State Board', 'College'],
      default: 'College'
    },
    department: String,
    year: Number,
    institution: String
  },
  stats: {
    totalTests: { type: Number, default: 0 },
    averageScore: { type: Number, default: 0 },
    studyHours: { type: Number, default: 0 },
    lastActive: { type: Date, default: Date.now }
  }
}, {
  timestamps: true
});

const syllabusSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  fileName: {
    type: String,
    required: true
  },
  fileType: {
    type: String,
    enum: ['pdf', 'docx', 'txt', 'jpg', 'jpeg', 'png'],
    required: true
  },
  originalContent: {
    type: String,
    required: true
  },
  structuredData: {
    subject: String,
    educationLevel: String,
    chapters: [{
      title: String,
      topics: [{
        title: String,
        difficulty: {
          type: String,
          enum: ['easy', 'medium', 'hard'],
          default: 'medium'
        }
      }]
    }]
  },
  aiAnalysis: {
    totalTopics: { type: Number, default: 0 },
    difficultyDistribution: {
      easy: { type: Number, default: 0 },
      medium: { type: Number, default: 0 },
      hard: { type: Number, default: 0 }
    },
    estimatedStudyHours: { type: Number, default: 0 }
  },
  status: {
    type: String,
    enum: ['uploaded', 'processing', 'analyzed', 'ready'],
    default: 'uploaded'
  }
}, {
  timestamps: true
});

const testSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  syllabusId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Syllabus',
    required: true
  },
  topic: {
    type: String,
    required: true
  },
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  },
  questions: [{
    type: {
      type: String,
      enum: ['mcq', 'short_answer', 'long_answer'],
      required: true
    },
    question: {
      type: String,
      required: true
    },
    options: [String], // For MCQ only
    correctAnswer: String,
    explanation: String,
    marks: {
      type: Number,
      default: 1
    }
  }],
  studentAnswers: [{
    questionIndex: Number,
    answer: String,
    isCorrect: Boolean,
    score: Number,
    feedback: String
  }],
  totalScore: {
    type: Number,
    default: 0
  },
  maxScore: {
    type: Number,
    default: 0
  },
  percentage: {
    type: Number,
    default: 0
  },
  timeTaken: Number, // in minutes
  status: {
    type: String,
    enum: ['in_progress', 'completed', 'submitted'],
    default: 'in_progress'
  },
  aiFeedback: {
    overallFeedback: String,
    weakAreas: [String],
    recommendations: [String]
  }
}, {
  timestamps: true
});

const progressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  syllabusId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Syllabus',
    required: true
  },
  topic: {
    type: String,
    required: true
  },
  totalAttempts: {
    type: Number,
    default: 0
  },
  correctAnswers: {
    type: Number,
    default: 0
  },
  totalQuestions: {
    type: Number,
    default: 0
  },
  accuracy: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  performanceLevel: {
    type: String,
    enum: ['weak', 'moderate', 'strong'],
    default: 'moderate'
  },
  lastTestDate: Date,
  studyTimeSpent: {
    type: Number,
    default: 0 // in minutes
  },
  improvementTrend: [{
    date: Date,
    accuracy: Number
  }]
}, {
  timestamps: true
});

// Study Session Schema for Study Timer module
const studySessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  duration: {
    type: Number,
    required: true,
    min: 0 // in seconds
  },
  sessionType: {
    type: String,
    enum: ['study', 'break'],
    default: 'study'
  },
  pomodoroSessions: {
    type: Number,
    default: 1
  },
  date: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Study Goal Schema
const studyGoalSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  dailyGoalMinutes: {
    type: Number,
    default: 240 // 4 hours in minutes
  }
}, {
  timestamps: true
});

// Indexes for better performance
userSchema.index({ email: 1 });
syllabusSchema.index({ userId: 1, createdAt: -1 });
testSchema.index({ userId: 1, createdAt: -1 });
progressSchema.index({ userId: 1, topic: 1 });
studySessionSchema.index({ userId: 1, date: -1 });
studySessionSchema.index({ userId: 1, subject: 1 });
studyGoalSchema.index({ userId: 1 }, { unique: true });

// Models
const User = mongoose.model('User', userSchema);
const Syllabus = mongoose.model('Syllabus', syllabusSchema);
const Test = mongoose.model('Test', testSchema);
const Progress = mongoose.model('Progress', progressSchema);
const StudySession = mongoose.model('StudySession', studySessionSchema);
const StudyGoal = mongoose.model('StudyGoal', studyGoalSchema);

module.exports = {
  User,
  Syllabus,
  Test,
  Progress,
  StudySession,
  StudyGoal
};
