# ==================== AI RECOMMENDATION & QUIZ ENDPOINTS ====================
# Place this in your app.py before the Health Check section

import google.generativeai as genai
import json

# Configure Gemini API
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
if GEMINI_API_KEY:
    try:
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel('gemini-pro')
        print("[OK] Gemini API configured")
    except Exception as e:
        print(f"[ERROR] Gemini API configuration failed: {e}")
        model = None
else:
    print("[WARNING] GEMINI_API_KEY not set in .env")
    model = None

SYLLABUS = {
    "Database Systems": ["ER Modeling", "SQL", "Normalization", "Transactions", "Indices"],
    "Data Structures": ["Arrays & Lists", "Trees", "Graphs", "Hashing", "Stacks & Queues"],
    "Algorithms": ["Complexity Analysis", "Sorting", "Searching", "Dynamic Programming", "Graph Algorithms"],
    "Computer Networks": ["OSI Model", "TCP/IP", "Routing", "DNS", "Network Security"],
    "Computer Organization": ["CPU Architecture", "Memory Hierarchy", "Instruction Sets", "I/O Systems"],
    "Operating Systems": ["Process Management", "Scheduling", "Memory Management", "File Systems"],
    "Discrete Mathematics": ["Logic", "Sets & Relations", "Combinatorics", "Graph Theory"]
}

@app.route('/api/ai/quiz', methods=['POST'])
def generate_quiz():
    """Generate AI-powered gamified quiz"""
    try:
        data = request.json
        auth_header = request.headers.get('Authorization')
        
        if not auth_header:
            return jsonify({'error': 'Missing authorization header'}), 401
        
        try:
            token = auth_header.split(' ')[1]
            user_id = verify_token(token)
        except:
            user_id = None
        
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        
        subject = data.get('subject', 'Database Systems')
        difficulty = data.get('difficulty', 'Medium')
        
        if subject not in SYLLABUS:
            return jsonify({'error': f'Invalid subject. Valid subjects: {list(SYLLABUS.keys())}'}), 400
        
        if not model:
            return jsonify({'error': 'AI service not available. Please set GEMINI_API_KEY'}), 503
        
        topics = ', '.join(SYLLABUS[subject][:3])
        
        prompt = f"""You are the "StudyMate Game Master" - an RPG-style AI tutor.
Generate a gamified mock test for Computer Science students.

SUBJECT: {subject}
DIFFICULTY: {difficulty}
TOPICS: {topics}

Create exactly 5 questions in this JSON format:
{{
  "world": "{subject}",
  "boss_name": "[Creative name for this challenge]",
  "level_difficulty": "{difficulty}",
  "questions": [
    {{
      "id": 1,
      "question": "[Question text]",
      "type": "mcq",
      "options": ["A) [option]", "B) [option]", "C) [option]", "D) [option]"],
      "correct_answer": "A",
      "explanation": "[Why this is correct]",
      "points": 50
    }}
  ],
  "total_questions": 5,
  "player_hp": 100,
  "xp_per_correct": 50,
  "hp_penalty_per_wrong": 20
}}

Make questions progressively harder. Include mix of conceptual and practical questions. Use gaming language (HP, XP, Boss, Level). Return ONLY valid JSON."""

        response = model.generate_content(prompt)
        
        try:
            quiz_data = json.loads(response.text)
        except:
            quiz_data = {
                "world": subject,
                "boss_name": f"The {subject} Guardian",
                "level_difficulty": difficulty,
                "questions": [
                    {
                        "id": 1,
                        "question": "What is the primary key in a database?",
                        "type": "mcq",
                        "options": ["A) Foreign key", "B) Unique identifier for each record", "C) Index", "D) None of above"],
                        "correct_answer": "B",
                        "explanation": "A primary key uniquely identifies each record in a table.",
                        "points": 50
                    }
                ],
                "total_questions": 1,
                "player_hp": 100,
                "xp_per_correct": 50,
                "hp_penalty_per_wrong": 20
            }
        
        return jsonify({
            'success': True,
            'quiz': quiz_data,
            'user_id': user_id
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/ai/recommendations', methods=['POST'])
def get_ai_recommendations():
    """Get AI-powered study recommendations based on weak areas"""
    try:
        data = request.json
        auth_header = request.headers.get('Authorization')
        
        if not auth_header:
            return jsonify({'error': 'Missing authorization header'}), 401
        
        try:
            token = auth_header.split(' ')[1]
            user_id = verify_token(token)
        except:
            user_id = None
        
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        
        if not model:
            return jsonify({'error': 'AI service not available'}), 503
        
        weak_areas = data.get('weak_areas', [])
        study_pattern = data.get('study_pattern', 'Evening study sessions')
        
        weak_areas_str = ', '.join(weak_areas) if weak_areas else 'General studying'
        
        prompt = f"""You are an AI study coach for a B.Tech Computer Science student using StudyMate.

Weak Areas: {weak_areas_str}
Study Pattern: {study_pattern}

Provide 5-7 personalized study recommendations as actionable tips. Format as JSON:
{{
  "recommendations": [
    {{
      "category": "[Motivation|Strategy|Focus|Time Management|Concept Mastery]",
      "tip": "[Specific, actionable advice]",
      "emoji": "[Relevant emoji]"
    }}
  ],
  "study_schedule": [
    {{
      "subject": "[Subject name]",
      "recommended_hours_per_week": [Number],
      "priority": "[High|Medium|Low]",
      "reason": "[Why this subject needs focus]"
    }}
  ],
  "motivational_message": "[Encouraging message]"
}}

Be specific, practical, and encouraging. Return ONLY valid JSON."""

        response = model.generate_content(prompt)
        
        try:
            recommendations = json.loads(response.text)
        except:
            recommendations = {
                "recommendations": [
                    {"category": "Motivation", "tip": "Start with the weakest subject first when your mind is fresh", "emoji": "💪"},
                    {"category": "Strategy", "tip": "Use the Pomodoro technique: 25 min study + 5 min break", "emoji": "⏱️"},
                    {"category": "Focus", "tip": "Turn off phone notifications during study sessions", "emoji": "📵"}
                ],
                "study_schedule": [
                    {"subject": s, "recommended_hours_per_week": 5, "priority": "High", "reason": "Weak area - needs focus"} 
                    for s in weak_areas[:3]
                ] if weak_areas else [],
                "motivational_message": "Every small step forward is progress! You've got this! 🎯"
            }
        
        return jsonify({
            'success': True,
            'data': recommendations,
            'user_id': user_id
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/ai/tutor', methods=['POST'])
def ai_tutor_help():
    """Get help from AI tutor on specific topics"""
    try:
        data = request.json
        auth_header = request.headers.get('Authorization')
        
        if not auth_header:
            return jsonify({'error': 'Missing authorization header'}), 401
        
        try:
            token = auth_header.split(' ')[1]
            user_id = verify_token(token)
        except:
            user_id = None
        
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        
        if not model:
            return jsonify({'error': 'AI service not available'}), 503
        
        subject = data.get('subject', 'Computer Science')
        question = data.get('question', 'General concept')
        study_level = data.get('study_level', 'intermediate')
        
        prompt = f"""You are an expert CS tutor for B.Tech students using StudyMate.

SUBJECT: {subject}
STUDENT QUESTION/TOPIC: {question}
STUDY LEVEL: {study_level}

Provide helpful explanation in this JSON format:
{{
  "title": "[Brief title for the concept]",
  "explanation": "[Clear, step-by-step explanation - 2-3 paragraphs]",
  "key_points": ["Point 1", "Point 2", "Point 3"],
  "example": "[Practical example or code snippet]",
  "common_mistakes": ["Mistake 1", "Mistake 2"],
  "practice_tip": "[Suggestion for practicing this concept]",
  "difficulty": "[Easy|Intermediate|Advanced]"
}}

Be clear, engaging, and use simple language. Return ONLY valid JSON."""

        response = model.generate_content(prompt)
        
        try:
            help_data = json.loads(response.text)
        except:
            help_data = {
                "title": question,
                "explanation": response.text[:500],
                "key_points": ["Key concept 1", "Key concept 2", "Key concept 3"],
                "example": "Example code here",
                "common_mistakes": ["Common error 1", "Common error 2"],
                "practice_tip": "Practice with real examples!",
                "difficulty": study_level
            }
        
        return jsonify({
            'success': True,
            'data': help_data,
            'user_id': user_id
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/ai/syllabus', methods=['GET'])
def get_syllabus():
    """Get the complete syllabus for all subjects"""
    try:
        return jsonify({
            'success': True,
            'syllabus': SYLLABUS,
            'subjects': list(SYLLABUS.keys())
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
