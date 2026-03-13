const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const { createWorker } = require('tesseract.js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Syllabus } = require('../models');

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

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = (process.env.ALLOWED_FILE_TYPES || 'pdf,docx,txt,jpg,jpeg,png').split(',');
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
});

// Extract text from different file types
const extractText = async (filePath, fileType) => {
  try {
    switch (fileType) {
      case 'pdf':
        const dataBuffer = fs.readFileSync(filePath);
        const pdfData = await pdfParse(dataBuffer);
        return pdfData.text;

      case 'docx':
        const result = await mammoth.extractRawText({ path: filePath });
        return result.value;

      case 'txt':
        return fs.readFileSync(filePath, 'utf8');

      case 'jpg':
      case 'jpeg':
      case 'png':
        const worker = await createWorker();
        await worker.loadLanguage('eng');
        await worker.initialize('eng');
        const { data: { text } } = await worker.recognize(filePath);
        await worker.terminate();
        return text;

      default:
        throw new Error('Unsupported file type');
    }
  } catch (error) {
    console.error('Text extraction error:', error);
    throw error;
  }
};

// Analyze syllabus with Gemini AI
const analyzeSyllabus = async (text) => {
  try {
    const prompt = `
Analyze this syllabus content and return a structured JSON response with the following format:

{
  "subject": "Main subject name",
  "educationLevel": "CBSE/IGCSE/Matriculation/State Board/College level",
  "chapters": [
    {
      "title": "Chapter Name",
      "topics": [
        {
          "title": "Topic Name",
          "difficulty": "easy|medium|hard"
        }
      ]
    }
  ]
}

Syllabus content:
${text.substring(0, 10000)} // Limit text length

Please provide accurate analysis based on the content.
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
    console.error('AI analysis error:', error);
    throw error;
  }
};

// @route   POST /api/syllabus/upload
// @desc    Upload and analyze syllabus
// @access  Private
router.post('/upload', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { fileName, subject } = req.body;
    const fileType = path.extname(req.file.originalname).toLowerCase().replace('.', '');

    // Extract text from file
    const extractedText = await extractText(req.file.path, fileType);

    // Create syllabus entry
    const syllabus = new Syllabus({
      userId: req.userId,
      fileName: fileName || req.file.originalname,
      fileType,
      originalContent: extractedText,
      status: 'processing'
    });

    await syllabus.save();

    // Analyze with AI (run in background)
    analyzeSyllabus(extractedText)
      .then(async (analysis) => {
        syllabus.structuredData = analysis;
        syllabus.aiAnalysis = {
          totalTopics: analysis.chapters.reduce((sum, chapter) => sum + chapter.topics.length, 0),
          difficultyDistribution: {
            easy: analysis.chapters.flatMap(ch => ch.topics).filter(t => t.difficulty === 'easy').length,
            medium: analysis.chapters.flatMap(ch => ch.topics).filter(t => t.difficulty === 'medium').length,
            hard: analysis.chapters.flatMap(ch => ch.topics).filter(t => t.difficulty === 'hard').length
          },
          estimatedStudyHours: analysis.chapters.length * 2 // Rough estimate
        };
        syllabus.status = 'ready';
        await syllabus.save();
      })
      .catch(async (error) => {
        syllabus.status = 'analyzed'; // Mark as analyzed even with errors
        await syllabus.save();
        console.error('AI analysis failed:', error);
      });

    res.status(201).json({
      message: 'Syllabus uploaded successfully',
      syllabusId: syllabus._id,
      status: 'processing'
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// @route   GET /api/syllabus
// @desc    Get user's syllabi
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const syllabi = await Syllabus.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .select('-originalContent'); // Don't send full text

    res.json({ syllabi });

  } catch (error) {
    console.error('Get syllabi error:', error);
    res.status(500).json({ error: 'Failed to fetch syllabi' });
  }
});

// @route   GET /api/syllabus/:id
// @desc    Get specific syllabus
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const syllabus = await Syllabus.findOne({
      _id: req.params.id,
      userId: req.userId
    });

    if (!syllabus) {
      return res.status(404).json({ error: 'Syllabus not found' });
    }

    res.json({ syllabus });

  } catch (error) {
    console.error('Get syllabus error:', error);
    res.status(500).json({ error: 'Failed to fetch syllabus' });
  }
});

module.exports = router;
