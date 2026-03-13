# StudyMate — Complete Project Documentation

**AI-Powered Study Recommendation System for B.Tech Computer Science Students**

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Setup & Installation](#4-setup--installation)
5. [Backend — Flask API](#5-backend--flask-api)
6. [Frontend — Pages & Features](#6-frontend--pages--features)
7. [Authentication System](#7-authentication-system)
8. [Dashboard & Analytics](#8-dashboard--analytics)
9. [Study Sessions](#9-study-sessions)
10. [AI-Powered Features (Gemini API)](#10-ai-powered-features-gemini-api)
11. [Mock Test Module](#11-mock-test-module)
12. [Topic Test & Student Level Analysis](#12-topic-test--student-level-analysis)
13. [Study Timer (Pomodoro)](#13-study-timer-pomodoro)
14. [Smart Study Planner (Schedule)](#14-smart-study-planner-schedule)
15. [My Routine](#15-my-routine)
16. [My Journal](#16-my-journal)
17. [My Notes & PDF Upload](#17-my-notes--pdf-upload)
18. [AI Tutor](#18-ai-tutor)
19. [Settings](#19-settings)
20. [MongoDB Collections](#20-mongodb-collections)
21. [API Endpoints Reference](#21-api-endpoints-reference)
22. [Key Concepts & Lessons](#22-key-concepts--lessons)

---

## 1. Project Overview

StudyMate is a full-stack web application that helps students:

- **Track** study sessions with subject, score, and duration
- **Analyze** weak areas and visualize progress with charts
- **Get AI recommendations** for personalized study plans
- **Take mock tests** — both pre-built MCQs and AI-generated gamified quizzes
- **Upload syllabi** (PDF/DOCX) for AI-powered test generation
- **Use a Pomodoro timer** with break reminders and daily goals
- **Write journals** with mood tracking and tags
- **Save notes** manually or by uploading PDFs
- **Ask an AI Tutor** questions on any CS topic

---

## 2. Tech Stack

### Backend
| Technology | Purpose |
|---|---|
| **Python 3.13** | Server-side language |
| **Flask 2.3** | Web framework |
| **Flask-CORS** | Cross-origin request handling |
| **MongoDB** (via PyMongo) | NoSQL database |
| **PyJWT** | JSON Web Token authentication |
| **Google Generative AI (Gemini)** | AI features — quizzes, tutoring, recommendations |
| **PyPDF2** | PDF text extraction for notes upload |
| **python-docx** | DOCX file parsing for syllabus upload |
| **Werkzeug** | Password hashing, file security |

### Frontend
| Technology | Purpose |
|---|---|
| **HTML5** | Page structure |
| **CSS3** | Styling (custom properties, gradients, grid, flexbox) |
| **Vanilla JavaScript** | All interactivity and API calls |
| **Bootstrap 5.3** | Layout grid, modals, form components |
| **Font Awesome 6.4** | Icons throughout the UI |
| **Chart.js** | Bar, line, and doughnut charts for analytics |
| **Plus Jakarta Sans** | Google Font used across the app |

### Infrastructure
| Technology | Purpose |
|---|---|
| **MongoDB** | Database (default: `mongodb://localhost:27017/study_system`) |
| **dotenv** | Environment variable management |
| **JWT (HS256)** | Stateless authentication tokens (24-hour expiry) |

---

## 3. Project Structure

```
hackthon_1/
├── backend/
│   ├── .env                  # Environment variables (MONGO_URI, SECRET_KEY, GEMINI_API_KEY)
│   ├── .env.example          # Template for .env
│   ├── app.py                # Main Flask server (~2300 lines) — ALL API endpoints
│   └── requirements.txt      # Python dependencies
│
├── frontend/
│   ├── index.html            # Single Page App — auth forms + entire dashboard
│   ├── homepage.html          # Marketing landing page
│   ├── script.js             # Main app logic — auth, dashboard, charts, CRUD, timers
│   ├── auth.js               # Login/register form handling, password strength
│   ├── ai_functions.js       # AI quiz, AI recommendations, AI tutor frontend
│   ├── homepage.js           # Landing page animations and navigation
│   ├── style.css             # Dashboard styles (~4500 lines)
│   ├── auth.css              # Auth form styles
│   ├── homepage.css          # Landing page styles
│   ├── ai-quiz.css           # Gamified RPG quiz styles
│   └── images/               # Team member photos
│
├── homepage.html             # Copy of frontend/homepage.html (root access)
├── index.html                # Copy of frontend/index.html (root access)
└── STUDYMATE_PROJECT.md      # This file
```

---

## 4. Setup & Installation

### Prerequisites
- Python 3.10+
- MongoDB running on `localhost:27017`
- A Google Gemini API key (for AI features)

### Steps

```bash
# 1. Clone or navigate to the project
cd hackthon_1/backend

# 2. Install Python dependencies
pip install -r requirements.txt

# 3. Create .env file
cp .env.example .env
# Edit .env and add:
#   MONGO_URI=mongodb://localhost:27017/study_system
#   SECRET_KEY=your-random-secret-key
#   GEMINI_API_KEY=your-google-gemini-api-key

# 4. Start the server
python app.py
# Server runs at http://localhost:5000

# 5. Open in browser
# Go to http://localhost:5000 (loads frontend/index.html)
# Or http://localhost:5000/homepage.html for the landing page
```

---

## 5. Backend — Flask API

### How the Server Works

`app.py` is a single-file Flask application that handles everything:

```python
from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient

app = Flask(__name__)
CORS(app)                              # Allow cross-origin requests

# MongoDB connection
client = MongoClient(MONGO_URI)
db = client['study_system']
users_collection = db['users']
sessions_collection = db['sessions']
# ... more collections
```

### Authentication Flow

```
Client                          Server
  |                               |
  |-- POST /register ------------>|  Hash password, store in MongoDB
  |<--------- { token } ---------|  Return JWT token
  |                               |
  |-- POST /login --------------->|  Verify password hash
  |<--------- { token } ---------|  Return JWT token
  |                               |
  |-- GET /dashboard ------------>|  Header: Authorization: Bearer <token>
  |   (token verified via JWT)    |  Decode token → get user_id
  |<--------- { data } ----------|  Return user's dashboard data
```

### Helper Functions

```python
def generate_token(user_id):
    """Create a JWT token that expires in 24 hours"""
    payload = {
        'user_id': str(user_id),
        'exp': datetime.utcnow() + timedelta(hours=24)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm='HS256')

def get_auth_user():
    """Extract user_id from the Authorization header"""
    auth_header = request.headers.get('Authorization')
    token = auth_header.split(' ')[1]       # "Bearer <token>" → "<token>"
    return verify_token(token)              # Returns user_id or None

def calculate_weak_areas(sessions):
    """Find subjects where average score is below 70%"""
    # Groups sessions by subject, calculates averages
    # Returns sorted list with is_weak=True for < 70%
```

---

## 6. Frontend — Pages & Features

The frontend is a **Single Page Application (SPA)** built with vanilla JS. All pages live inside `index.html` as hidden `<div>` sections. Navigation works by toggling CSS classes:

```css
.page-content { display: none; }          /* All pages hidden by default */
.page-content.active { display: block; }  /* Only active page visible */
```

```javascript
function switchPage(pageName) {
    // 1. Hide all pages
    document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
    // 2. Show target page
    document.getElementById('page-' + pageName).classList.add('active');
    // 3. Highlight sidebar link
    // 4. Call page init function (e.g., initNotesPage())
}
```

### All Pages

| Page | Sidebar Name | ID | Description |
|---|---|---|---|
| Dashboard | Dashboard | `page-dashboard` | Overview stats, charts, quick actions |
| Mock Test | Mock Test | `page-mocktest` | AI-generated tests from syllabi |
| Sessions | Sessions | `page-sessions` | Add/view/delete study sessions |
| Tips | Tips to Know | `page-recommendations` | AI study recommendations |
| Progress | Progress | `page-progress` | Score charts and subject breakdown |
| Schedule | Schedule | `page-schedule` | Calendar view and study planner |
| Timer | Study Timer | `page-timer` | Pomodoro timer with settings |
| Guide | Help & Guide | `page-guide` | How-to tutorials for each feature |
| Routine | My Routine | `page-routine` | Daily routine planner |
| Journal | My Journal | `page-journal` | Mood tracking and diary entries |
| Notes | My Notes | `page-notes` | Save notes and upload PDFs |
| AI Tutor | AI Tutor | `page-aitutor` | Ask AI questions on CS topics |
| About Us | About Us | `page-aboutus` | Team member profiles |
| Settings | Settings | `page-settings` | Profile, password, preferences |

---

## 7. Authentication System

### Registration (POST /register)

```javascript
// Frontend (auth.js)
const res = await fetch(`${API_BASE_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password })
});
```

```python
# Backend (app.py)
@app.route('/register', methods=['POST'])
def register():
    data = request.json
    # Check if email already exists
    if users_collection.find_one({'email': data['email']}):
        return jsonify({'error': 'Email already registered'}), 400
    # Hash password and store
    user = {
        'name': data['name'],
        'email': data['email'],
        'password': generate_password_hash(data['password']),
        'created_at': datetime.utcnow().isoformat()
    }
    result = users_collection.insert_one(user)
    token = generate_token(result.inserted_id)
    return jsonify({'token': token, 'name': user['name']}), 201
```

### Login (POST /login)

```python
@app.route('/login', methods=['POST'])
def login():
    user = users_collection.find_one({'email': data['email']})
    if not user or not check_password_hash(user['password'], data['password']):
        return jsonify({'error': 'Invalid credentials'}), 401
    token = generate_token(user['_id'])
    return jsonify({'token': token, 'name': user['name']}), 200
```

### Password Strength Meter (Frontend)

```javascript
function updatePasswordStrength(password) {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    // Updates visual strength bar and color
}
```

---

## 8. Dashboard & Analytics

### What the Dashboard Shows

- **Welcome Banner** — greeting with user's name, quick action buttons
- **Stat Cards** — Total Sessions, Total Hours, Average Score, Weak Areas count
- **Charts** (via Chart.js):
  - **Bar Chart** — scores per subject
  - **Line Chart** — score trend over time
  - **Doughnut Chart** — study time distribution by subject
- **Quick Actions** — Add Session, Write Journal, Start Timer

### Dashboard API (GET /dashboard)

```python
@app.route('/dashboard', methods=['GET'])
def dashboard():
    user_id = get_auth_user()
    sessions = list(sessions_collection.find({'user_id': ObjectId(user_id)}))

    total_sessions = len(sessions)
    total_hours = sum(s.get('duration', 0) for s in sessions) / 60
    avg_score = sum(s.get('score', 0) for s in sessions) / total_sessions
    weak_areas = calculate_weak_areas(sessions)

    return jsonify({
        'stats': {
            'total_sessions': total_sessions,
            'total_hours': round(total_hours, 1),
            'average_score': round(avg_score, 1),
            'weak_areas_count': len([w for w in weak_areas if w['is_weak']])
        },
        'sessions': sessions,
        'weak_areas': weak_areas
    })
```

### Chart Rendering (Frontend)

```javascript
// Bar chart for subject scores
new Chart(document.getElementById('scoresChart'), {
    type: 'bar',
    data: {
        labels: subjects,       // ['Math', 'DSA', 'Networks', ...]
        datasets: [{
            label: 'Average Score',
            data: averages,     // [85, 62, 78, ...]
            backgroundColor: colors
        }]
    }
});
```

---

## 9. Study Sessions

### Adding a Session (POST /sessions)

Users log each study session with:
- **Subject** — e.g., Data Structures, Operating Systems
- **Score** — 0 to 100
- **Duration** — minutes spent studying
- **Notes** — optional comments

```python
@app.route('/sessions', methods=['POST'])
def add_session():
    session = {
        'user_id': ObjectId(user_id),
        'subject': data['subject'],
        'score': data['score'],           # 0-100
        'duration': data['duration'],     # minutes
        'notes': data.get('notes', ''),
        'date': datetime.utcnow().isoformat()
    }
    sessions_collection.insert_one(session)
```

### Deleting a Session (DELETE /sessions/<id>)

```python
@app.route('/sessions/<session_id>', methods=['DELETE'])
def delete_session(session_id):
    sessions_collection.delete_one({
        '_id': ObjectId(session_id),
        'user_id': ObjectId(user_id)
    })
```

---

## 10. AI-Powered Features (Gemini API)

All AI features use Google's **Gemini generative AI model**. The backend sends structured prompts and parses JSON responses.

### Configuration

```python
import google.generativeai as genai

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
genai.configure(api_key=GEMINI_API_KEY)
```

### 10.1 AI Recommendations (POST /api/ai/recommendations)

Analyzes user's weak subjects and generates personalized study tips.

```python
prompt = f"""Analyze this student's performance and provide recommendations.
Weak Areas: {weak_areas}
Generate a study plan with priorities and time allocation."""

model = genai.GenerativeModel('gemini-pro')
response = model.generate_content(prompt)
```

### 10.2 Gamified AI Quiz (POST /api/ai/quiz)

Generates RPG-style quizzes ("Boss Battles") with HP, XP, and difficulty levels.

**7 Supported subjects:**
1. Database Systems
2. Data Structures
3. Algorithms
4. Computer Networks
5. Computer Organization
6. Operating Systems
7. Discrete Mathematics

Each quiz has:
- 5 MCQ questions
- A creative "Boss Name"
- XP rewards per correct answer
- Explanations for each answer
- Difficulty progression (Easy → Medium → Hard → Boss)

### 10.3 AI Tutor (POST /api/ai/tutor)

Students ask any CS question and get structured responses:

```python
prompt = f"""You are StudyMate AI Tutor for B.Tech Computer Science.
Question: {question}
Provide:
1. Step-by-step explanation
2. Key points to remember
3. Real-world examples
4. Practice tips"""
```

---

## 11. Mock Test Module

### Syllabus Upload (POST /api/mock-test/upload-syllabus)

Students upload PDF/DOCX/image files. The backend:
1. Parses text from the file (PyPDF2 for PDF, python-docx for DOCX)
2. Sends text to Gemini AI for structured analysis
3. Returns subjects, topics, and a study plan

### Test Generation (POST /api/mock-test/generate)

AI generates a full test from uploaded syllabus content:
- **MCQ questions** — 4 options, 1 correct
- **Short answer questions**
- **Long answer questions**
- Each with marks, difficulty level, and model answers

### Test Submission (POST /api/mock-test/submit)

Submits answers, calculates scores, and returns:
- Total score and percentage
- Per-question feedback
- Student level (Expert/Advanced/Intermediate/Beginner/Critical)

### Learning Roadmap (POST /api/mock-test/roadmap)

AI generates a personalized roadmap based on test performance:
- Weeks of study planned
- Topics per week
- Resources and practice tasks

---

## 12. Topic Test & Student Level Analysis

A pre-built test system with seed questions in 5 subjects:

| Subject | Example Topics |
|---|---|
| Mathematics | Derivatives, integrals, matrices, Laplace transforms |
| Data Structures | Trees, graphs, stacks, queues, complexity |
| Computer Networks | OSI model, TCP/UDP, subnetting, protocols |
| DBMS | Normalization, SQL, ACID, transactions |
| Operating Systems | Scheduling, deadlocks, paging, processes |

### Student Levels

| Score Range | Level |
|---|---|
| 90%+ | Expert |
| 75-89% | Advanced |
| 60-74% | Intermediate |
| 40-59% | Beginner |
| Below 40% | Critical |

```python
def determine_student_level(percentage):
    if percentage >= 90: return 'Expert'
    elif percentage >= 75: return 'Advanced'
    elif percentage >= 60: return 'Intermediate'
    elif percentage >= 40: return 'Beginner'
    else: return 'Critical'
```

---

## 13. Study Timer (Pomodoro)

A configurable Pomodoro timer with:

| Setting | Default | Adjustable |
|---|---|---|
| Focus duration | 25 min | Yes (5 min steps) |
| Short break | 5 min | Yes (1 min steps) |
| Long break | 15 min | Yes (1 min steps) |
| Countdown sound | 30 sec | Yes (5 sec steps) |

### Features
- Start / Pause / Reset controls
- Subject tagging during study
- Daily study goal tracking
- Session counter (auto long break every 4 sessions)
- Break tips and wellness suggestions
- Sound alerts when timer ends
- Visual progress ring

### How It Works (Frontend JS)

```javascript
let timerInterval;
let timeLeft = 25 * 60;    // seconds

function startTimer() {
    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            playSound();
            // Switch to break mode
        }
    }, 1000);
}
```

---

## 14. Smart Study Planner (Schedule)

A calendar-based study planner that:
- Shows a monthly calendar grid
- Lets users add study events to specific dates
- Color-codes events by subject
- Stores events in localStorage

---

## 15. My Routine

A daily routine planner where students:
- Define time blocks (morning, afternoon, evening)
- Assign activities to each block
- Track free time vs. study time
- Plan personalized weekly schedules

---

## 16. My Journal

A mood-tracking diary with:

### Mood Selection
8 mood options: Happy, Confident, Calm, Tired, Stressed, Sad, Anxious, Motivated

### Tags
Productive, Creative, Social, Learning, Exercise, Rest Day, Exam Prep, Breakthrough

### Features
- Write daily journal entries with mood + tags
- Filter entries by mood
- View mood trend chart over time
- Entries stored in localStorage

---

## 17. My Notes & PDF Upload

### Manual Notes
- Create notes with title, content, subject, and color
- Pin important notes to the top
- Search and filter by subject
- Edit and delete notes

### PDF Upload
- Upload PDF files → text is extracted using PyPDF2
- Extracted text is saved as a note with a "PDF" badge
- Supports multi-page PDFs
- Shows page count and upload progress

### Cloud Sync
- "Save Notes to Cloud" toggle in Settings
- When ON: notes sync to MongoDB via API
- When OFF: notes save to localStorage only
- Automatic sync when switching from local to cloud

### API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/notes` | Fetch all user's notes |
| POST | `/notes` | Create a new note |
| POST | `/notes/upload-pdf` | Upload PDF and extract text |
| PUT | `/notes/<id>` | Update a note |
| DELETE | `/notes/<id>` | Delete a note |

---

## 18. AI Tutor

An interactive AI assistant powered by Gemini:

- Students type any CS question
- AI responds with structured explanations
- Includes key points, examples, and practice tips
- Supports follow-up questions
- Covers all B.Tech CS subjects

---

## 19. Settings

### Profile Management
- Update display name
- View email and User ID
- View "Member Since" date

### Security
- Change password (requires current password)

### Preferences
| Toggle | Description |
|---|---|
| Dark Mode | Switch between light and dark theme |
| Sound Effects | Enable/disable timer sounds |
| Desktop Notifications | Browser notifications for timer alerts |
| Save Notes to Cloud | Sync notes to MongoDB or keep in localStorage |

### Data Management
- View storage usage
- Export all data
- Clear all sessions

---

## 20. MongoDB Collections

| Collection | Purpose | Key Fields |
|---|---|---|
| `users` | User accounts | name, email, password (hashed), created_at |
| `sessions` | Study session logs | user_id, subject, score, duration, notes, date |
| `recommendations` | Cached AI recommendations | user_id, recommendations, created_at |
| `tutor_subjects` | AI tutor subject data | subject, topics |
| `tutor_topics` | AI tutor topic details | topic, content |
| `questions` | Pre-built MCQ seed questions | subject, question, options, answer |
| `test_results` | Topic test submissions | user_id, subject, score, level, answers |
| `notes` | User's saved notes | user_id, title, content, subject, color, pinned, source |

### Notes Document Schema

```json
{
    "_id": "ObjectId",
    "user_id": "ObjectId (ref: users)",
    "title": "String (required)",
    "content": "String (note body)",
    "subject": "String (optional)",
    "color": "#hex color code",
    "pinned": false,
    "source": "pdf | null",
    "original_filename": "String (PDF uploads only)",
    "page_count": 3,
    "created_at": "2026-03-13T08:30:00.000Z",
    "updated_at": "2026-03-13T08:30:00.000Z"
}
```

---

## 21. API Endpoints Reference

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| POST | `/register` | Create a new account |
| POST | `/login` | Login and get JWT token |

### Study Sessions
| Method | Endpoint | Description |
|---|---|---|
| POST | `/sessions` | Add a study session |
| DELETE | `/sessions/<id>` | Delete a session |
| DELETE | `/sessions/all` | Delete all sessions |

### Dashboard & Analytics
| Method | Endpoint | Description |
|---|---|---|
| GET | `/dashboard` | Get stats, sessions, weak areas |
| GET | `/recommendations` | Get AI study recommendations |
| GET | `/progress` | Get progress data and charts |
| GET | `/weekly-stats` | Get weekly breakdown by day |

### Profile & Settings
| Method | Endpoint | Description |
|---|---|---|
| PUT | `/update-profile` | Update name |
| PUT | `/change-password` | Change password |

### Topic Tests
| Method | Endpoint | Description |
|---|---|---|
| POST | `/generate-topic-test` | Generate MCQ test for a subject |
| POST | `/submit-topic-test` | Submit test and get results |
| GET | `/topic-performance` | Get performance history |

### AI Features
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/ai/quiz` | Generate gamified AI quiz |
| POST | `/api/ai/recommendations` | Get AI study recommendations |
| POST | `/api/ai/tutor` | Ask AI tutor a question |
| GET | `/api/ai/syllabus` | Get uploaded syllabi list |

### Mock Tests
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/mock-test/upload-syllabus` | Upload syllabus file |
| GET | `/api/mock-test/subjects` | List uploaded subjects |
| POST | `/api/mock-test/generate` | Generate test from syllabus |
| POST | `/api/mock-test/submit` | Submit test answers |
| POST | `/api/mock-test/roadmap` | Generate learning roadmap |

### Notes
| Method | Endpoint | Description |
|---|---|---|
| GET | `/notes` | Get all notes |
| POST | `/notes` | Create a note |
| POST | `/notes/upload-pdf` | Upload PDF as note |
| PUT | `/notes/<id>` | Update a note |
| DELETE | `/notes/<id>` | Delete a note |

### Misc
| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Server health check |
| GET | `/` | Serve frontend index.html |
| GET | `/homepage.html` | Serve landing page |

---

## 22. Key Concepts & Lessons

### 22.1 SPA Architecture (Single Page Application)

All pages live in one HTML file. JavaScript toggles visibility:

```
User clicks sidebar link → switchPage('notes')
  → Hide all .page-content divs
  → Show #page-notes
  → Call initNotesPage()
  → Fetch data from API
  → Render into DOM
```

**Benefit:** No page reloads, fast navigation, smooth UX.

### 22.2 JWT Authentication

```
Register/Login → Server creates JWT token → Client stores in localStorage
Every API call → Client sends: Authorization: Bearer <token>
Server → Decodes token → Gets user_id → Returns user's data only
Token expires after 24 hours → User must login again
```

### 22.3 Flask Route Ordering

Static routes MUST come before wildcard routes:

```python
# CORRECT ORDER:
@app.route('/notes/upload-pdf')    # exact match — checked first
@app.route('/notes/<note_id>')     # wildcard — checked second

# WRONG ORDER:
@app.route('/notes/<note_id>')     # wildcard catches "upload-pdf" as note_id!
@app.route('/notes/upload-pdf')    # never reached
```

### 22.4 File Upload with FormData

When uploading files, **never set Content-Type manually**. The browser must auto-set it with the multipart boundary:

```javascript
// CORRECT — browser sets Content-Type automatically
const formData = new FormData();
formData.append('file', fileInput.files[0]);
fetch('/upload', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token },   // NO Content-Type!
    body: formData
});

// WRONG — breaks the file upload
headers: { 'Content-Type': 'application/json' }   // never do this with FormData
```

### 22.5 Password Security

Passwords are NEVER stored as plain text:

```python
# Hashing (during registration)
hashed = generate_password_hash('MyPassword123')
# Stored: 'pbkdf2:sha256:...$salt$hash' — irreversible

# Verification (during login)
check_password_hash(stored_hash, 'MyPassword123')  # Returns True/False
```

### 22.6 MongoDB with PyMongo

```python
# Insert
result = collection.insert_one({'key': 'value'})
new_id = result.inserted_id

# Find
doc = collection.find_one({'_id': ObjectId(id_string)})
docs = list(collection.find({'user_id': ObjectId(uid)}).sort('date', -1))

# Update
collection.update_one({'_id': ObjectId(id)}, {'$set': {'title': 'New Title'}})

# Delete
collection.delete_one({'_id': ObjectId(id)})
```

### 22.7 Dark Mode

Implemented with CSS custom properties and a body class:

```css
:root {
    --bg-primary: #f8fafc;
    --text-primary: #1e293b;
    --card-bg: #ffffff;
}

body.dark-mode {
    --bg-primary: #0f172a;
    --text-primary: #e2e8f0;
    --card-bg: #1e293b;
}
```

```javascript
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
}
```

### 22.8 Chart.js for Data Visualization

```javascript
new Chart(canvas, {
    type: 'bar',           // 'line', 'doughnut', 'pie', etc.
    data: {
        labels: ['Math', 'DSA', 'OS'],
        datasets: [{
            data: [85, 62, 78],
            backgroundColor: ['#6366f1', '#ec4899', '#f59e0b']
        }]
    },
    options: { responsive: true }
});
```

---

## Team

Built by B.Tech Computer Science students:
- Arjun
- Keshav
- Nandan
- Vedha
- Yashwanth
