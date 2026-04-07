from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
import jwt
import os
from dotenv import load_dotenv
import math
import json
import requests
import PyPDF2
import io
from werkzeug.utils import secure_filename

load_dotenv()

app = Flask(__name__)
CORS(app)

# Configuration
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'your-secret-key-change-in-production')
MONGO_URI = os.getenv('MONGO_URI', 'mongodb://localhost:27017/study_system')

# MongoDB Connection
try:
    client = MongoClient(MONGO_URI)
    db = client['study_system']
    users_collection = db['users']
    sessions_collection = db['sessions']
    recommendations_collection = db['recommendations']
    tutor_subjects_collection = db['tutor_subjects']
    tutor_topics_collection = db['tutor_topics']
    notes_collection = db['notes']
    gamification_logs_collection = db['gamification_logs']
    daily_challenges_collection = db['daily_challenges']
    weekly_missions_collection = db['weekly_missions']
    questions_collection = db['questions']
    test_results_collection = db['test_results']
    print("[OK] Connected to MongoDB")
except Exception as e:
    print(f"[ERROR] MongoDB connection failed: {e}")

# ==================== GAMIFICATION CONSTANTS ====================

LEVEL_THRESHOLDS = [
    {'level': 1, 'name': 'Beginner Scholar', 'xp': 0},
    {'level': 2, 'name': 'Active Learner', 'xp': 100},
    {'level': 3, 'name': 'Knowledge Builder', 'xp': 250},
    {'level': 4, 'name': 'Study Expert', 'xp': 500},
    {'level': 5, 'name': 'Master Scholar', 'xp': 1000},
    {'level': 6, 'name': 'Grand Scholar', 'xp': 2000},
    {'level': 7, 'name': 'Legendary Learner', 'xp': 3500},
]

BADGE_DEFINITIONS = {
    'first_step': {'name': 'First Step', 'icon': 'fa-shoe-prints', 'desc': 'Complete your first study session', 'color': '#6366f1'},
    'quiz_master': {'name': 'Quiz Master', 'icon': 'fa-trophy', 'desc': 'Complete 10 mock tests', 'color': '#f59e0b'},
    'focus_warrior': {'name': 'Focus Warrior', 'icon': 'fa-fire', 'desc': 'Study 5 hours total', 'color': '#ef4444'},
    'consistency_king': {'name': 'Consistency King', 'icon': 'fa-crown', 'desc': '7 day study streak', 'color': '#8b5cf6'},
    'ai_explorer': {'name': 'AI Explorer', 'icon': 'fa-robot', 'desc': 'Use AI tutor 5 times', 'color': '#06b6d4'},
    'century_club': {'name': 'Century Club', 'icon': 'fa-star', 'desc': 'Reach 100 XP', 'color': '#eab308'},
    'knowledge_seeker': {'name': 'Knowledge Seeker', 'icon': 'fa-book', 'desc': 'Study 5 different subjects', 'color': '#22c55e'},
    'streak_master': {'name': 'Streak Master', 'icon': 'fa-bolt', 'desc': '30 day study streak', 'color': '#f97316'},
    'half_millennium': {'name': 'Half Millennium', 'icon': 'fa-gem', 'desc': 'Reach 500 XP', 'color': '#ec4899'},
    'perfectionist': {'name': 'Perfectionist', 'icon': 'fa-bullseye', 'desc': 'Score 100% on a mock test', 'color': '#14b8a6'},
}

REWARDS = [
    {'id': 'dark_theme', 'name': 'Dark Theme', 'icon': 'fa-moon', 'level': 3, 'desc': 'Unlock dark mode theme'},
    {'id': 'custom_avatar', 'name': 'Custom Avatar', 'icon': 'fa-user-astronaut', 'level': 5, 'desc': 'Unlock custom profile avatars'},
    {'id': 'premium_planner', 'name': 'Premium Planner', 'icon': 'fa-calendar-check', 'level': 7, 'desc': 'Unlock premium study planner'},
]

STREAK_REWARDS = {3: 50, 7: 75, 15: 100, 30: 150}

# Gemini API Configuration
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
GEMINI_MODEL = os.getenv('GEMINI_MODEL', 'gemini-2.5-flash')
GEMINI_FALLBACK_MODELS = ['gemini-2.0-flash', 'gemini-2.0-flash-lite']
GEMINI_API_URL_TEMPLATE = 'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent'

if GEMINI_API_KEY:
    print(f"[OK] Gemini API key configured (key: {GEMINI_API_KEY[:10]}...)")
else:
    print("[WARNING] GEMINI_API_KEY not set - AI features will be unavailable")


def generate_gemini_text(prompt):
    """Generate text from Gemini using REST API to avoid SDK import issues."""
    if not GEMINI_API_KEY:
        raise RuntimeError('GEMINI_API_KEY is not configured')

    global GEMINI_MODEL
    models_to_try = [GEMINI_MODEL] + [m for m in GEMINI_FALLBACK_MODELS if m != GEMINI_MODEL]
    last_error = None

    for model_name in models_to_try:
        try:
            response = requests.post(
                GEMINI_API_URL_TEMPLATE.format(model=model_name),
                params={'key': GEMINI_API_KEY},
                json={'contents': [{'parts': [{'text': prompt}]}]},
                timeout=45
            )
            response.raise_for_status()
            payload = response.json()

            candidates = payload.get('candidates', [])
            if not candidates:
                raise RuntimeError(f"No candidates returned by Gemini model '{model_name}'")

            parts = candidates[0].get('content', {}).get('parts', [])
            text_parts = [
                part.get('text', '')
                for part in parts
                if isinstance(part, dict) and part.get('text')
            ]
            generated_text = '\n'.join(text_parts).strip()
            if not generated_text:
                raise RuntimeError(f"Empty response returned by Gemini model '{model_name}'")

            if model_name != GEMINI_MODEL:
                GEMINI_MODEL = model_name
                print(f"[OK] Switched Gemini model to fallback '{GEMINI_MODEL}'")
            return generated_text
        except (requests.RequestException, ValueError, RuntimeError) as exc:
            last_error = exc
            continue

    raise RuntimeError(f'All Gemini models failed: {last_error}')

# Helper Functions
def generate_token(user_id):
    """Generate JWT token for user"""
    payload = {
        'user_id': str(user_id),
        'exp': datetime.utcnow() + timedelta(hours=24)
    }
    return jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')

def verify_token(token):
    """Verify JWT token"""
    try:
        payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
        return payload['user_id']
    except:
        return None

def get_auth_user():
    """Extract user from request header"""
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        return None
    
    try:
        token = auth_header.split(' ')[1]
        return verify_token(token)
    except:
        return None

def calculate_weak_areas(sessions):
    """Calculate weak areas from study sessions"""
    subject_scores = {}
    subject_counts = {}
    
    for session in sessions:
        subject = session.get('subject', 'General')
        score = session.get('score', 0)
        
        if subject not in subject_scores:
            subject_scores[subject] = 0
            subject_counts[subject] = 0
        
        subject_scores[subject] += score
        subject_counts[subject] += 1
    
    weak_areas = []
    for subject in subject_scores:
        avg_score = subject_scores[subject] / subject_counts[subject]
        weak_areas.append({
            'subject': subject,
            'average_score': round(avg_score, 2),
            'is_weak': avg_score < 70,
            'session_count': subject_counts[subject]
        })
    
    return sorted(weak_areas, key=lambda x: x['average_score'])

def generate_recommendations(user_data):
    """Generate AI-based study recommendations"""
    sessions = list(sessions_collection.find({'user_id': user_data['_id']}))
    
    if not sessions:
        return {
            'message': 'No study sessions recorded yet. Start adding sessions!',
            'recommendations': [],
            'study_schedule': [],
            'total_recommended_hours': 0
        }
    
    weak_areas = calculate_weak_areas(sessions)
    weak_subjects = [area for area in weak_areas if area['is_weak']]
    
    # Calculate study time needed
    total_recommended_hours = 0
    study_schedule = []
    
    for weak_area in weak_subjects:
        avg_score = weak_area['average_score']
        gap = 70 - avg_score  # Gap to reach 70%
        
        # Formula: (gap/10) * 5 hours per 10% gap
        hours_needed = max(2, (gap / 10) * 5)
        total_recommended_hours += hours_needed
        
        study_schedule.append({
            'subject': weak_area['subject'],
            'recommended_hours_per_week': round(hours_needed, 1),
            'priority': 'High' if avg_score < 50 else 'Medium',
            'current_average': weak_area['average_score'],
            'sessions': weak_area['session_count']
        })
    
    # Generate weekly schedule
    recommendations = []
    if weak_subjects:
        recommendations.append(f"Focus on {len(weak_subjects)} weak area(s) that need improvement")
        recommendations.append(f"Total recommended study: {round(total_recommended_hours, 1)} hours per week")
        recommendations.append("Distribute study sessions across 5-6 days per week")
        recommendations.append("Take 10-15 minute breaks after every 45 minutes of study")
        recommendations.append("Review weak topics every 2-3 days for better retention")
    else:
        recommendations.append("Great! All subjects are above 70% average. Focus on maintaining consistency.")
        recommendations.append("Continue regular practice with 5-7 hours per week")
    
    return {
        'message': 'Weekly study recommendations generated',
        'recommendations': recommendations,
        'study_schedule': study_schedule,
        'total_recommended_hours': round(total_recommended_hours, 1),
        'weak_areas_count': len(weak_subjects)
    }

# ==================== GAMIFICATION HELPERS ====================

def calculate_level(xp):
    """Calculate level from XP"""
    current = LEVEL_THRESHOLDS[0]
    for threshold in LEVEL_THRESHOLDS:
        if xp >= threshold['xp']:
            current = threshold
        else:
            break
    # Find next level
    idx = LEVEL_THRESHOLDS.index(current)
    if idx < len(LEVEL_THRESHOLDS) - 1:
        next_level = LEVEL_THRESHOLDS[idx + 1]
        xp_for_next = next_level['xp'] - xp
        xp_progress = xp - current['xp']
        xp_needed = next_level['xp'] - current['xp']
    else:
        xp_for_next = 0
        xp_progress = 0
        xp_needed = 1  # prevent division by zero
    return {
        'level': current['level'],
        'level_name': current['name'],
        'xp_for_next': max(0, xp_for_next),
        'xp_progress': xp_progress,
        'xp_needed': xp_needed,
        'progress_pct': min(100, round((xp_progress / xp_needed) * 100)) if xp_needed > 0 else 100
    }

def award_xp(user_id, points, activity):
    """Award XP to user, recalculate level, log activity"""
    from bson import ObjectId
    if points <= 0:
        return
    user = users_collection.find_one({'_id': ObjectId(user_id)})
    if not user:
        return
    old_xp = user.get('xp', 0)
    new_xp = old_xp + points
    level_info = calculate_level(new_xp)
    users_collection.update_one(
        {'_id': ObjectId(user_id)},
        {'$set': {
            'xp': new_xp,
            'level': level_info['level'],
            'level_name': level_info['level_name']
        }}
    )
    gamification_logs_collection.insert_one({
        'user_id': ObjectId(user_id),
        'points': points,
        'activity': activity,
        'new_total': new_xp,
        'timestamp': datetime.utcnow()
    })
    check_badges(user_id)

def check_and_update_streak(user_id):
    """Update study streak for user"""
    from bson import ObjectId
    user = users_collection.find_one({'_id': ObjectId(user_id)})
    if not user:
        return
    today = datetime.utcnow().strftime('%Y-%m-%d')
    last_study = user.get('last_study_date')
    streak = user.get('streak_count', 0)
    longest = user.get('longest_streak', 0)

    if last_study == today:
        return  # Already studied today

    yesterday = (datetime.utcnow() - timedelta(days=1)).strftime('%Y-%m-%d')
    if last_study == yesterday:
        streak += 1
    else:
        streak = 1

    longest = max(longest, streak)
    users_collection.update_one(
        {'_id': ObjectId(user_id)},
        {'$set': {
            'last_study_date': today,
            'streak_count': streak,
            'longest_streak': longest
        }}
    )
    # Award streak milestone XP
    if streak in STREAK_REWARDS:
        award_xp(user_id, STREAK_REWARDS[streak], f'{streak}-day streak bonus')

def check_badges(user_id):
    """Check and award badges"""
    from bson import ObjectId
    user = users_collection.find_one({'_id': ObjectId(user_id)})
    if not user:
        return
    earned = user.get('badges', [])
    new_badges = []

    # First Step - at least 1 session
    if 'first_step' not in earned and user.get('total_sessions', 0) >= 1:
        new_badges.append('first_step')

    # Quiz Master - 10 mock tests
    test_count = test_results_collection.count_documents({'user_id': ObjectId(user_id)})
    if 'quiz_master' not in earned and test_count >= 10:
        new_badges.append('quiz_master')

    # Focus Warrior - 5 hours total
    if 'focus_warrior' not in earned and user.get('total_study_hours', 0) >= 5:
        new_badges.append('focus_warrior')

    # Consistency King - 7 day streak
    if 'consistency_king' not in earned and user.get('streak_count', 0) >= 7:
        new_badges.append('consistency_king')

    # AI Explorer - 5 AI tutor uses
    if 'ai_explorer' not in earned and user.get('ai_tutor_uses', 0) >= 5:
        new_badges.append('ai_explorer')

    # Century Club - 100 XP
    if 'century_club' not in earned and user.get('xp', 0) >= 100:
        new_badges.append('century_club')

    # Knowledge Seeker - 5 different subjects
    distinct_subjects = sessions_collection.distinct('subject', {'user_id': ObjectId(user_id)})
    if 'knowledge_seeker' not in earned and len(distinct_subjects) >= 5:
        new_badges.append('knowledge_seeker')

    # Streak Master - 30 day streak
    if 'streak_master' not in earned and user.get('streak_count', 0) >= 30:
        new_badges.append('streak_master')

    # Half Millennium - 500 XP
    if 'half_millennium' not in earned and user.get('xp', 0) >= 500:
        new_badges.append('half_millennium')

    # Perfectionist - 100% on a test
    perfect = test_results_collection.find_one({'user_id': ObjectId(user_id), 'percentage': 100})
    if 'perfectionist' not in earned and perfect:
        new_badges.append('perfectionist')

    if new_badges:
        users_collection.update_one(
            {'_id': ObjectId(user_id)},
            {'$addToSet': {'badges': {'$each': new_badges}}}
        )

def calculate_focus_score(user_id):
    """Calculate focus score (0-100)"""
    from bson import ObjectId
    user = users_collection.find_one({'_id': ObjectId(user_id)})
    if not user:
        return 0

    # Study time factor (max 40 points) - based on hours, capped at 50 hours
    hours = min(user.get('total_study_hours', 0), 50)
    time_score = (hours / 50) * 40

    # Quiz accuracy factor (max 35 points)
    results = list(test_results_collection.find({'user_id': ObjectId(user_id)}))
    if results:
        avg_pct = sum(r.get('percentage', 0) for r in results) / len(results)
        accuracy_score = (avg_pct / 100) * 35
    else:
        accuracy_score = 0

    # Streak factor (max 25 points) - capped at 30 days
    streak = min(user.get('streak_count', 0), 30)
    streak_score = (streak / 30) * 25

    return min(100, round(time_score + accuracy_score + streak_score))

def get_or_create_daily_challenge(user_id):
    """Get today's daily challenge or create one"""
    from bson import ObjectId
    today = datetime.utcnow().strftime('%Y-%m-%d')
    existing = daily_challenges_collection.find_one({
        'user_id': ObjectId(user_id),
        'date': today
    })
    if existing:
        existing['_id'] = str(existing['_id'])
        existing['user_id'] = str(existing['user_id'])
        return existing

    import random
    tasks = [
        {'type': 'study_time', 'desc': 'Study for 2 hours', 'target': 120, 'unit': 'minutes'},
        {'type': 'mcq_count', 'desc': 'Answer 10 MCQs', 'target': 10, 'unit': 'questions'},
        {'type': 'session_count', 'desc': 'Complete 3 study sessions', 'target': 3, 'unit': 'sessions'},
    ]
    challenge = {
        'user_id': ObjectId(user_id),
        'date': today,
        'tasks': tasks,
        'reward_xp': 40,
        'completed': False,
        'progress': {t['type']: 0 for t in tasks},
        'created_at': datetime.utcnow()
    }
    result = daily_challenges_collection.insert_one(challenge)
    challenge['_id'] = str(result.inserted_id)
    challenge['user_id'] = str(challenge['user_id'])
    return challenge

def get_or_create_weekly_mission(user_id):
    """Get this week's mission or create one"""
    from bson import ObjectId
    now = datetime.utcnow()
    week_start = (now - timedelta(days=now.weekday())).strftime('%Y-%m-%d')
    existing = weekly_missions_collection.find_one({
        'user_id': ObjectId(user_id),
        'week_start': week_start
    })
    if existing:
        existing['_id'] = str(existing['_id'])
        existing['user_id'] = str(existing['user_id'])
        return existing

    tasks = [
        {'type': 'study_hours', 'desc': 'Study 10 hours this week', 'target': 600, 'unit': 'minutes'},
        {'type': 'mock_tests', 'desc': 'Complete 3 mock tests', 'target': 3, 'unit': 'tests'},
        {'type': 'subjects', 'desc': 'Study 5 different subjects', 'target': 5, 'unit': 'subjects'},
    ]
    mission = {
        'user_id': ObjectId(user_id),
        'week_start': week_start,
        'tasks': tasks,
        'reward_xp': 150,
        'completed': False,
        'progress': {t['type']: 0 for t in tasks},
        'created_at': datetime.utcnow()
    }
    result = weekly_missions_collection.insert_one(mission)
    mission['_id'] = str(result.inserted_id)
    mission['user_id'] = str(mission['user_id'])
    return mission

def update_challenge_progress(user_id, task_type, increment=1):
    """Update daily challenge progress"""
    from bson import ObjectId
    today = datetime.utcnow().strftime('%Y-%m-%d')
    daily_challenges_collection.update_one(
        {'user_id': ObjectId(user_id), 'date': today, 'completed': False},
        {'$inc': {f'progress.{task_type}': increment}}
    )
    # Check if all tasks are complete
    challenge = daily_challenges_collection.find_one({
        'user_id': ObjectId(user_id), 'date': today, 'completed': False
    })
    if challenge:
        all_done = True
        for task in challenge['tasks']:
            if challenge['progress'].get(task['type'], 0) < task['target']:
                all_done = False
                break
        if all_done:
            daily_challenges_collection.update_one(
                {'_id': challenge['_id']},
                {'$set': {'completed': True}}
            )
            award_xp(user_id, challenge['reward_xp'], 'Daily challenge completed')

def update_mission_progress(user_id, task_type, increment=1):
    """Update weekly mission progress"""
    from bson import ObjectId
    now = datetime.utcnow()
    week_start = (now - timedelta(days=now.weekday())).strftime('%Y-%m-%d')
    weekly_missions_collection.update_one(
        {'user_id': ObjectId(user_id), 'week_start': week_start, 'completed': False},
        {'$inc': {f'progress.{task_type}': increment}}
    )
    mission = weekly_missions_collection.find_one({
        'user_id': ObjectId(user_id), 'week_start': week_start, 'completed': False
    })
    if mission:
        all_done = True
        for task in mission['tasks']:
            if mission['progress'].get(task['type'], 0) < task['target']:
                all_done = False
                break
        if all_done:
            weekly_missions_collection.update_one(
                {'_id': mission['_id']},
                {'$set': {'completed': True}}
            )
            award_xp(user_id, mission['reward_xp'], 'Weekly mission completed')

def ensure_gamification_fields(user_id):
    """Ensure user has gamification fields (migration for existing users)"""
    from bson import ObjectId
    users_collection.update_one(
        {'_id': ObjectId(user_id), 'xp': {'$exists': False}},
        {'$set': {
            'xp': 0, 'level': 1, 'level_name': 'Beginner Scholar',
            'streak_count': 0, 'last_study_date': None,
            'longest_streak': 0, 'badges': [],
            'rewards_unlocked': [], 'ai_tutor_uses': 0
        }}
    )

# ==================== ENDPOINTS ====================

# 1. REGISTER Endpoint
@app.route('/register', methods=['POST'])
def register():
    """User Registration"""
    try:
        data = request.json
        email = data.get('email')
        password = data.get('password')
        name = data.get('name')
        
        if not all([email, password, name]):
            return jsonify({'error': 'Missing required fields'}), 400
        
        # Check if user exists
        if users_collection.find_one({'email': email}):
            return jsonify({'error': 'User already exists'}), 409
        
        # Create user
        user = {
            'name': name,
            'email': email,
            'password': generate_password_hash(password),
            'created_at': datetime.utcnow(),
            'total_sessions': 0,
            'total_study_hours': 0,
            # Gamification fields
            'xp': 0,
            'level': 1,
            'level_name': 'Beginner Scholar',
            'streak_count': 0,
            'last_study_date': None,
            'longest_streak': 0,
            'badges': [],
            'rewards_unlocked': [],
            'ai_tutor_uses': 0
        }
        
        result = users_collection.insert_one(user)
        
        return jsonify({
            'message': 'Registration successful',
            'user_id': str(result.inserted_id),
            'token': generate_token(result.inserted_id)
        }), 201
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# 2. LOGIN Endpoint
@app.route('/login', methods=['POST'])
def login():
    """User Login"""
    try:
        data = request.json
        email = data.get('email')
        password = data.get('password')
        
        if not email or not password:
            return jsonify({'error': 'Email and password required'}), 400
        
        user = users_collection.find_one({'email': email})
        
        if not user or not check_password_hash(user['password'], password):
            return jsonify({'error': 'Invalid credentials'}), 401
        
        token = generate_token(user['_id'])
        
        return jsonify({
            'message': 'Login successful',
            'user_id': str(user['_id']),
            'name': user['name'],
            'token': token
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# 3. ADD STUDY SESSION Endpoint
@app.route('/sessions', methods=['POST'])
def add_session():
    """Add a new study session"""
    try:
        user_id = get_auth_user()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        
        data = request.json
        subject = data.get('subject')
        score = data.get('score')
        duration = data.get('duration')  # in minutes
        session_date = data.get('date')
        
        # Validation
        if not all([subject, score is not None, duration]):
            return jsonify({'error': 'Missing required fields'}), 400
        
        try:
            score = int(score)
            duration = int(duration)
        except ValueError:
            return jsonify({'error': 'Score and duration must be numbers'}), 400
        
        if not (0 <= score <= 100):
            return jsonify({'error': 'Score must be between 0 and 100'}), 400
        
        if duration <= 0:
            return jsonify({'error': 'Duration must be positive'}), 400
        
        # Create session
        from bson import ObjectId
        session = {
            'user_id': ObjectId(user_id),
            'subject': subject,
            'score': score,
            'duration': duration,
            'session_date': session_date or datetime.utcnow().isoformat(),
            'created_at': datetime.utcnow()
        }
        
        result = sessions_collection.insert_one(session)

        # Update user stats
        users_collection.update_one(
            {'_id': ObjectId(user_id)},
            {
                '$inc': {
                    'total_sessions': 1,
                    'total_study_hours': duration / 60
                }
            }
        )

        # Gamification: Award XP for study session (+10 per 25 min)
        ensure_gamification_fields(user_id)
        xp_earned = max(1, (duration // 25)) * 10
        award_xp(user_id, xp_earned, f'Study session: {subject} ({duration} min)')
        check_and_update_streak(user_id)
        update_challenge_progress(user_id, 'study_time', duration)
        update_challenge_progress(user_id, 'session_count', 1)
        update_mission_progress(user_id, 'study_hours', duration)
        # Track distinct subjects for weekly mission
        from bson import ObjectId as OId
        now = datetime.utcnow()
        week_start_dt = now - timedelta(days=now.weekday())
        week_start_dt = week_start_dt.replace(hour=0, minute=0, second=0, microsecond=0)
        week_subjects = sessions_collection.distinct('subject', {
            'user_id': ObjectId(user_id),
            'created_at': {'$gte': week_start_dt}
        })
        weekly_missions_collection.update_one(
            {'user_id': ObjectId(user_id), 'week_start': (now - timedelta(days=now.weekday())).strftime('%Y-%m-%d'), 'completed': False},
            {'$set': {'progress.subjects': len(week_subjects)}}
        )

        return jsonify({
            'message': 'Session added successfully',
            'session_id': str(result.inserted_id),
            'xp_earned': xp_earned
        }), 201
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# 4. DELETE STUDY SESSION Endpoint
@app.route('/sessions/<session_id>', methods=['DELETE'])
def delete_session(session_id):
    """Delete a study session"""
    try:
        user_id = get_auth_user()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        
        from bson import ObjectId
        
        # Find the session first to get its details
        session = sessions_collection.find_one({
            '_id': ObjectId(session_id),
            'user_id': ObjectId(user_id)
        })
        
        if not session:
            return jsonify({'error': 'Session not found'}), 404
        
        # Delete the session
        sessions_collection.delete_one({'_id': ObjectId(session_id)})
        
        # Update user stats
        users_collection.update_one(
            {'_id': ObjectId(user_id)},
            {
                '$inc': {
                    'total_sessions': -1,
                    'total_study_hours': -(session['duration'] / 60)
                }
            }
        )
        
        return jsonify({'message': 'Session deleted successfully'}), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# 5. GET DASHBOARD Endpoint
@app.route('/dashboard', methods=['GET'])
def dashboard():
    """Get dashboard data"""
    try:
        user_id = get_auth_user()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        
        from bson import ObjectId
        user = users_collection.find_one({'_id': ObjectId(user_id)})
        sessions = list(sessions_collection.find({'user_id': ObjectId(user_id)}))
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        weak_areas = calculate_weak_areas(sessions)
        
        # Calculate from actual sessions (not stored counters which can go stale)
        actual_total_sessions = len(sessions)
        actual_total_hours = round(sum(s.get('duration', 0) for s in sessions) / 60, 2)
        
        # Calculate average score
        total_score = sum(s['score'] for s in sessions) if sessions else 0
        avg_score = total_score / len(sessions) if sessions else 0
        
        # Get last 7 days sessions
        seven_days_ago = datetime.utcnow() - timedelta(days=7)
        recent_sessions = [s for s in sessions if datetime.fromisoformat(s.get('session_date', '')) >= seven_days_ago]
        
        # Sync stored counters with actual data
        users_collection.update_one(
            {'_id': ObjectId(user_id)},
            {'$set': {'total_sessions': actual_total_sessions, 'total_study_hours': actual_total_hours}}
        )

        # Gamification data for dashboard
        ensure_gamification_fields(user_id)
        user = users_collection.find_one({'_id': ObjectId(user_id)})  # re-fetch after update
        xp = user.get('xp', 0)
        level_info = calculate_level(xp)

        return jsonify({
            'message': 'Dashboard data retrieved',
            'user': {
                'name': user['name'],
                'email': user['email'],
                'total_sessions': actual_total_sessions,
                'total_study_hours': actual_total_hours,
                'created_at': user.get('created_at', datetime.utcnow()).isoformat()
            },
            'statistics': {
                'average_score': round(avg_score, 2),
                'total_sessions': len(sessions),
                'recent_sessions_7_days': len(recent_sessions)
            },
            'gamification': {
                'xp': xp,
                'level': level_info['level'],
                'level_name': level_info['level_name'],
                'progress_pct': level_info['progress_pct'],
                'xp_for_next': level_info['xp_for_next'],
                'streak_count': user.get('streak_count', 0),
                'badges_count': len(user.get('badges', [])),
                'focus_score': calculate_focus_score(user_id)
            },
            'weak_areas': weak_areas,
            'recent_sessions': [
                {
                    'id': str(s['_id']),
                    'subject': s['subject'],
                    'score': s['score'],
                    'duration': s['duration'],
                    'date': s.get('session_date', s['created_at'].isoformat())
                } for s in sorted(sessions, key=lambda x: x['created_at'], reverse=True)[:10]
            ]
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# 5. GET RECOMMENDATIONS Endpoint
@app.route('/recommendations', methods=['GET'])
def recommendations():
    """Get AI-based study recommendations"""
    try:
        user_id = get_auth_user()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        
        from bson import ObjectId
        user = users_collection.find_one({'_id': ObjectId(user_id)})
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        recs = generate_recommendations(user)
        
        return jsonify({
            'message': 'Recommendations generated',
            **recs
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# 6. GET PROGRESS Endpoint
@app.route('/progress', methods=['GET'])
def progress():
    """Get detailed progress analytics"""
    try:
        user_id = get_auth_user()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        
        from bson import ObjectId
        user = users_collection.find_one({'_id': ObjectId(user_id)})
        sessions = list(sessions_collection.find({'user_id': ObjectId(user_id)}))
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Group by subject
        subject_data = {}
        for session in sessions:
            subject = session['subject']
            if subject not in subject_data:
                subject_data[subject] = {'scores': [], 'durations': []}
            subject_data[subject]['scores'].append(session['score'])
            subject_data[subject]['durations'].append(session['duration'])
        
        # Calculate progress for each subject
        subject_progress = []
        for subject, data in subject_data.items():
            avg_score = sum(data['scores']) / len(data['scores'])
            total_hours = sum(data['durations']) / 60

            subject_progress.append({
                'subject': subject,
                'average_score': round(avg_score, 2),
                'sessions': len(data['scores']),
                'total_hours': round(total_hours, 2),
                'latest_score': data['scores'][-1],
                'trend': 'improving' if len(data['scores']) > 1 and data['scores'][-1] > data['scores'][0] else 'stable'
            })

        # Mock test history - search with both ObjectId and string user_id for compatibility
        test_results = []
        try:
            test_results = list(test_results_collection.find(
                {'$or': [{'user_id': ObjectId(user_id)}, {'user_id': user_id}]},
                {'details': 0}
            ).sort('created_at', -1))
        except Exception as e1:
            print(f"[DEBUG] test_results query with sort failed: {e1}")
            try:
                test_results = list(test_results_collection.find(
                    {'$or': [{'user_id': ObjectId(user_id)}, {'user_id': user_id}]},
                    {'details': 0}
                ))
            except Exception as e2:
                print(f"[DEBUG] test_results query without sort also failed: {e2}")
                test_results = []

        print(f"[DEBUG] Progress: user_id={user_id}, type={type(user_id)}, sessions={len(sessions)}, test_results={len(test_results)}")

        # Also try querying without $or to debug
        if len(test_results) == 0:
            try:
                count_oid = test_results_collection.count_documents({'user_id': ObjectId(user_id)})
                count_str = test_results_collection.count_documents({'user_id': user_id})
                total_all = test_results_collection.count_documents({})
                print(f"[DEBUG] test_results counts: ObjectId={count_oid}, string={count_str}, total_in_collection={total_all}")
                # If there are results with ObjectId match, fetch them directly
                if count_oid > 0:
                    test_results = list(test_results_collection.find(
                        {'user_id': ObjectId(user_id)},
                        {'details': 0}
                    ))
                    print(f"[DEBUG] Fetched {len(test_results)} via direct ObjectId query")
                elif count_str > 0:
                    test_results = list(test_results_collection.find(
                        {'user_id': user_id},
                        {'details': 0}
                    ))
                    print(f"[DEBUG] Fetched {len(test_results)} via direct string query")
            except Exception as e3:
                print(f"[DEBUG] Fallback query also failed: {e3}")

        mock_tests = []
        mock_subject_stats = {}
        for r in test_results:
            try:
                date_val = r.get('date', '')
                if not date_val:
                    ca = r.get('created_at')
                    date_val = ca.isoformat() if ca else datetime.utcnow().isoformat()
                mock_tests.append({
                    'id': str(r['_id']),
                    'subject': r.get('subject', 'Unknown'),
                    'score': r.get('score', 0),
                    'total': r.get('total', 0),
                    'percentage': r.get('percentage', 0),
                    'student_level': r.get('student_level', 'N/A'),
                    'is_weak': r.get('is_weak', False),
                    'date': str(date_val),
                    'xp_earned': 30 + (r.get('score', 0) * 2)
                })
                subj = r.get('subject', 'Unknown')
                if subj not in mock_subject_stats:
                    mock_subject_stats[subj] = {'percentages': [], 'count': 0}
                mock_subject_stats[subj]['percentages'].append(float(r.get('percentage', 0)))
                mock_subject_stats[subj]['count'] += 1
            except Exception as parse_err:
                print(f"[DEBUG] Error parsing test result: {parse_err}")
                continue

        mock_summary = []
        for subj, stats in mock_subject_stats.items():
            try:
                avg_pct = round(sum(stats['percentages']) / len(stats['percentages']), 1) if stats['percentages'] else 0
                best_pct = round(max(stats['percentages']), 1) if stats['percentages'] else 0
                latest_pct = round(stats['percentages'][0], 1) if stats['percentages'] else 0
                mock_summary.append({
                    'subject': subj,
                    'tests_taken': stats['count'],
                    'average_percentage': avg_pct,
                    'best_percentage': best_pct,
                    'latest_percentage': latest_pct,
                    'level': determine_student_level(avg_pct),
                    'trend': 'improving' if stats['count'] > 1 and stats['percentages'][0] > stats['percentages'][-1] else 'stable'
                })
            except Exception as sum_err:
                print(f"[DEBUG] Error building summary for {subj}: {sum_err}")
                continue

        return jsonify({
            'message': 'Progress analytics retrieved',
            'total_sessions': len(sessions),
            'subjects': sorted(subject_progress, key=lambda x: x['average_score']),
            'overall_average': round(sum(s['average_score'] for s in subject_progress) / len(subject_progress), 2) if subject_progress else 0,
            'mock_tests': mock_tests[:20],
            'mock_summary': sorted(mock_summary, key=lambda x: x['average_percentage']),
            'total_mock_tests': len(test_results)
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# 7. GET WEEKLY STATS Endpoint
@app.route('/weekly-stats', methods=['GET'])
def weekly_stats():
    """Get weekly statistics"""
    try:
        user_id = get_auth_user()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        
        from bson import ObjectId
        sessions = list(sessions_collection.find({'user_id': ObjectId(user_id)}))
        
        # Get last 4 weeks data
        stats_by_week = {}
        for session in sessions:
            session_date = datetime.fromisoformat(session.get('session_date', session['created_at'].isoformat()))
            week_start = session_date - timedelta(days=session_date.weekday())
            week_key = week_start.strftime('%Y-%m-%d')
            
            if week_key not in stats_by_week:
                stats_by_week[week_key] = {
                    'total_sessions': 0,
                    'total_hours': 0,
                    'average_score': 0,
                    'scores': []
                }
            
            stats_by_week[week_key]['total_sessions'] += 1
            stats_by_week[week_key]['total_hours'] += session['duration'] / 60
            stats_by_week[week_key]['scores'].append(session['score'])
        
        # Calculate averages
        weekly_data = []
        for week, data in sorted(stats_by_week.items()):
            avg_score = sum(data['scores']) / len(data['scores']) if data['scores'] else 0
            weekly_data.append({
                'week': week,
                'sessions': data['total_sessions'],
                'hours': round(data['total_hours'], 2),
                'average_score': round(avg_score, 2)
            })
        
        return jsonify({
            'message': 'Weekly statistics retrieved',
            'weekly_stats': weekly_data[-4:]  # Last 4 weeks
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==================== SETTINGS ENDPOINTS ====================
from bson import ObjectId as _ObjectId  # ensure available for settings endpoints

@app.route('/update-profile', methods=['PUT'])
def update_profile():
    """Update user profile (name)"""
    from bson import ObjectId
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    if not token:
        return jsonify({'error': 'Token required'}), 401
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        user_id = payload['user_id']
    except:
        return jsonify({'error': 'Invalid token'}), 401

    data = request.json
    name = data.get('name', '').strip()
    if not name:
        return jsonify({'error': 'Name is required'}), 400

    users_collection.update_one(
        {'_id': ObjectId(user_id)},
        {'$set': {'name': name}}
    )
    return jsonify({'message': 'Profile updated successfully'}), 200


@app.route('/change-password', methods=['PUT'])
def change_password():
    """Change user password"""
    from bson import ObjectId
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    if not token:
        return jsonify({'error': 'Token required'}), 401
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        user_id = payload['user_id']
    except:
        return jsonify({'error': 'Invalid token'}), 401

    data = request.json
    current_password = data.get('current_password', '')
    new_password = data.get('new_password', '')

    if not current_password or not new_password:
        return jsonify({'error': 'Both current and new password are required'}), 400
    if len(new_password) < 6:
        return jsonify({'error': 'New password must be at least 6 characters'}), 400

    user = users_collection.find_one({'_id': ObjectId(user_id)})
    if not user:
        return jsonify({'error': 'User not found'}), 404

    if not check_password_hash(user['password'], current_password):
        return jsonify({'error': 'Current password is incorrect'}), 403

    hashed = generate_password_hash(new_password)
    users_collection.update_one(
        {'_id': ObjectId(user_id)},
        {'$set': {'password': hashed}}
    )
    return jsonify({'message': 'Password changed successfully'}), 200


@app.route('/sessions/all', methods=['DELETE'])
def delete_all_sessions():
    """Delete ALL sessions for the authenticated user"""
    from bson import ObjectId
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    if not token:
        return jsonify({'error': 'Token required'}), 401
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=['HS256'])
        user_id = payload['user_id']
    except:
        return jsonify({'error': 'Invalid token'}), 401

    result = sessions_collection.delete_many({'user_id': ObjectId(user_id)})
    users_collection.update_one(
        {'_id': ObjectId(user_id)},
        {'$set': {'total_sessions': 0, 'total_study_hours': 0}}
    )
    return jsonify({
        'message': f'{result.deleted_count} sessions deleted',
        'deleted_count': result.deleted_count
    }), 200


# Serve Frontend
from flask import send_from_directory

@app.route('/')
def serve_homepage():
    """Serve the homepage"""
    frontend_path = os.path.join(os.path.dirname(__file__), '..', 'frontend')
    return send_from_directory(frontend_path, 'homepage.html')

@app.route('/index.html')
def index_html_page():
    """Serve the main app page (frontend/index.html)"""
    frontend_path = os.path.join(os.path.dirname(__file__), '..', 'frontend')
    return send_from_directory(frontend_path, 'index.html')

@app.route('/homepage.html')
def homepage_html_page():
    """Serve the homepage HTML"""
    frontend_path = os.path.join(os.path.dirname(__file__), '..', 'frontend')
    return send_from_directory(frontend_path, 'homepage.html')

@app.route('/static/<path:filename>')
def serve_static_assets(filename):
    """Serve static files from frontend directory"""
    frontend_path = os.path.join(os.path.dirname(__file__), '..', 'frontend')
    return send_from_directory(frontend_path, filename)

@app.route('/<path:filename>')
def serve_static(filename):
    """Serve static files (CSS, JS, images, etc.)"""
    # Try frontend directory first for known frontend assets
    frontend_path = os.path.join(os.path.dirname(__file__), '..', 'frontend')
    if os.path.exists(os.path.join(frontend_path, filename)):
        return send_from_directory(frontend_path, filename)
    # Fall back to root directory (for homepage assets)
    root_path = os.path.join(os.path.dirname(__file__), '..')
    return send_from_directory(root_path, filename)

# ==================== TOPIC TEST MODULE ====================

def determine_student_level(percentage):
    """Determine student learning level based on percentage"""
    if percentage >= 90:
        return 'Expert'
    elif percentage >= 75:
        return 'Advanced'
    elif percentage >= 60:
        return 'Intermediate'
    elif percentage >= 40:
        return 'Beginner'
    else:
        return 'Critical'

def seed_questions_if_empty():
    """Seed the questions collection with sample MCQs if it's empty"""
    if questions_collection.count_documents({}) > 0:
        return

    subjects = {
        'Mathematics': [
            {'question': 'What is the derivative of x²?', 'options': ['x', '2x', '2', 'x²'], 'answer': 1},
            {'question': 'What is the integral of 2x dx?', 'options': ['x²', 'x² + C', '2x² + C', 'x + C'], 'answer': 1},
            {'question': 'What is the value of sin(90°)?', 'options': ['0', '1', '-1', '0.5'], 'answer': 1},
            {'question': 'What is the determinant of a 2x2 identity matrix?', 'options': ['0', '1', '2', '-1'], 'answer': 1},
            {'question': 'What is the limit of (1 + 1/n)^n as n approaches infinity?', 'options': ['1', 'π', 'e', '∞'], 'answer': 2},
            {'question': 'What is the Laplace transform of 1?', 'options': ['s', '1/s', '1/s²', 's²'], 'answer': 1},
            {'question': 'Which of the following is a vector quantity?', 'options': ['Speed', 'Temperature', 'Velocity', 'Mass'], 'answer': 2},
            {'question': 'What is the rank of a 3x3 zero matrix?', 'options': ['3', '1', '0', '2'], 'answer': 2},
            {'question': 'What is log₂(8)?', 'options': ['2', '3', '4', '8'], 'answer': 1},
            {'question': 'What is the value of cos(0°)?', 'options': ['0', '1', '-1', '0.5'], 'answer': 1},
            {'question': 'What is 5! (5 factorial)?', 'options': ['60', '100', '120', '24'], 'answer': 2},
            {'question': 'The sum of angles in a triangle is?', 'options': ['360°', '180°', '90°', '270°'], 'answer': 1},
            {'question': 'What is the Euler number e approximately?', 'options': ['2.414', '3.14', '2.718', '1.618'], 'answer': 2},
            {'question': 'What is the cross product of two parallel vectors?', 'options': ['1', '0', 'Undefined', '∞'], 'answer': 1},
            {'question': 'What is d/dx(e^x)?', 'options': ['xe^(x-1)', 'e^x', 'e^(x+1)', 'x·e^x'], 'answer': 1},
            {'question': 'What is the eigenvalue of an identity matrix?', 'options': ['0', '1', '-1', 'Undefined'], 'answer': 1},
            {'question': 'What is the Taylor series expansion of e^x at x=0, first term?', 'options': ['0', '1', 'x', 'x²'], 'answer': 1},
            {'question': 'What is ∫sin(x)dx?', 'options': ['cos(x)+C', '-cos(x)+C', 'sin(x)+C', '-sin(x)+C'], 'answer': 1},
            {'question': 'What is the value of tan(45°)?', 'options': ['0', '1', '√2', '1/√2'], 'answer': 1},
            {'question': 'How many solutions does a consistent system of equations have?', 'options': ['None', 'One or infinite', 'Exactly two', 'Only one'], 'answer': 1},
            {'question': 'What is the area of a circle with radius r?', 'options': ['2πr', 'πr²', 'πd', '2πr²'], 'answer': 1},
            {'question': 'What is the formula for permutation nPr?', 'options': ['n!/(n-r)!', 'n!/r!', 'n!/(r!(n-r)!)', '(n-r)!/n!'], 'answer': 0},
            {'question': 'What is the inverse of matrix A if A is orthogonal?', 'options': ['A', 'A^T', '-A', 'I'], 'answer': 1},
            {'question': 'What is the divergence of a curl of a vector field?', 'options': ['1', '0', 'Undefined', '∞'], 'answer': 1},
            {'question': 'The Fourier series represents a function as a sum of?', 'options': ['Polynomials', 'Exponentials', 'Sinusoids', 'Logarithms'], 'answer': 2},
        ],
        'Physics': [
            {'question': 'What is the SI unit of force?', 'options': ['Joule', 'Watt', 'Newton', 'Pascal'], 'answer': 2},
            {'question': 'What is Newton\'s second law?', 'options': ['F = mv', 'F = ma', 'F = mg', 'F = mv²'], 'answer': 1},
            {'question': 'Speed of light in vacuum is approximately?', 'options': ['3×10⁶ m/s', '3×10⁸ m/s', '3×10¹⁰ m/s', '3×10⁴ m/s'], 'answer': 1},
            {'question': 'What is the unit of electric resistance?', 'options': ['Volt', 'Ampere', 'Ohm', 'Coulomb'], 'answer': 2},
            {'question': 'Ohm\'s law states that V = ?', 'options': ['IR', 'I/R', 'R/I', 'I²R'], 'answer': 0},
            {'question': 'What is the acceleration due to gravity on Earth?', 'options': ['8.9 m/s²', '9.8 m/s²', '10.8 m/s²', '7.8 m/s²'], 'answer': 1},
            {'question': 'Which particle has no electric charge?', 'options': ['Proton', 'Electron', 'Neutron', 'Positron'], 'answer': 2},
            {'question': 'What type of lens is used to correct myopia?', 'options': ['Convex', 'Concave', 'Bifocal', 'Cylindrical'], 'answer': 1},
            {'question': 'What is the SI unit of power?', 'options': ['Joule', 'Newton', 'Watt', 'Pascal'], 'answer': 2},
            {'question': 'Which law states energy cannot be created or destroyed?', 'options': ['Newton\'s 1st', 'Ohm\'s Law', 'Thermodynamics 1st Law', 'Hooke\'s Law'], 'answer': 2},
            {'question': 'What is the formula for kinetic energy?', 'options': ['mgh', '½mv²', 'mv', 'Fd'], 'answer': 1},
            {'question': 'What is the SI unit of frequency?', 'options': ['Hertz', 'Decibel', 'Watt', 'Lumen'], 'answer': 0},
            {'question': 'What is the wavelength-frequency relationship?', 'options': ['v = fλ', 'v = f/λ', 'v = λ/f', 'f = vλ'], 'answer': 0},
            {'question': 'What causes a rainbow?', 'options': ['Reflection', 'Refraction', 'Dispersion', 'Diffraction'], 'answer': 2},
            {'question': 'Which electromagnetic wave has the shortest wavelength?', 'options': ['Radio', 'Microwave', 'X-rays', 'Gamma rays'], 'answer': 3},
            {'question': 'What is the unit of magnetic flux?', 'options': ['Tesla', 'Weber', 'Henry', 'Gauss'], 'answer': 1},
            {'question': 'Bernoulli\'s principle is related to?', 'options': ['Heat', 'Fluid dynamics', 'Optics', 'Magnetism'], 'answer': 1},
            {'question': 'What is Planck\'s constant approximately?', 'options': ['6.626×10⁻³⁴ Js', '6.626×10⁻²⁴ Js', '3.14×10⁻³⁴ Js', '9.8×10⁻³⁴ Js'], 'answer': 0},
            {'question': 'In which medium does sound travel fastest?', 'options': ['Air', 'Water', 'Steel', 'Vacuum'], 'answer': 2},
            {'question': 'What does E=mc² represent?', 'options': ['Force-mass', 'Energy-mass equivalence', 'Momentum', 'Power'], 'answer': 1},
            {'question': 'What is the SI unit of capacitance?', 'options': ['Ohm', 'Henry', 'Farad', 'Coulomb'], 'answer': 2},
            {'question': 'Total internal reflection occurs when light travels from?', 'options': ['Rarer to denser', 'Denser to rarer', 'Same medium', 'Vacuum'], 'answer': 1},
            {'question': 'What is the principle of a transformer?', 'options': ['Coulomb\'s law', 'Electromagnetic induction', 'Ohm\'s law', 'Photoelectric effect'], 'answer': 1},
            {'question': 'What is the escape velocity from Earth?', 'options': ['7.9 km/s', '11.2 km/s', '15.0 km/s', '3.0 km/s'], 'answer': 1},
            {'question': 'What is the Doppler effect related to?', 'options': ['Color of light', 'Change in frequency', 'Magnetic fields', 'Gravity'], 'answer': 1},
        ],
        'Data Structures': [
            {'question': 'What is the time complexity of binary search?', 'options': ['O(n)', 'O(log n)', 'O(n²)', 'O(1)'], 'answer': 1},
            {'question': 'Which data structure uses FIFO?', 'options': ['Stack', 'Queue', 'Tree', 'Graph'], 'answer': 1},
            {'question': 'Which data structure uses LIFO?', 'options': ['Queue', 'Stack', 'Array', 'Linked List'], 'answer': 1},
            {'question': 'What is the worst-case time complexity of quicksort?', 'options': ['O(n log n)', 'O(n²)', 'O(n)', 'O(log n)'], 'answer': 1},
            {'question': 'Which traversal visits the root first?', 'options': ['Inorder', 'Preorder', 'Postorder', 'Level order'], 'answer': 1},
            {'question': 'A binary tree with n nodes has how many edges?', 'options': ['n', 'n-1', 'n+1', '2n'], 'answer': 1},
            {'question': 'What is the height of a balanced BST with n nodes?', 'options': ['O(n)', 'O(log n)', 'O(n²)', 'O(1)'], 'answer': 1},
            {'question': 'Which algorithm is used to find shortest path in a graph?', 'options': ['DFS', 'BFS', 'Dijkstra', 'Kruskal'], 'answer': 2},
            {'question': 'Hash table average case lookup time is?', 'options': ['O(n)', 'O(log n)', 'O(1)', 'O(n²)'], 'answer': 2},
            {'question': 'Which sorting algorithm is stable?', 'options': ['Quicksort', 'Heapsort', 'Merge Sort', 'Selection Sort'], 'answer': 2},
            {'question': 'What data structure is used in BFS?', 'options': ['Stack', 'Queue', 'Heap', 'Array'], 'answer': 1},
            {'question': 'What data structure is used in DFS?', 'options': ['Queue', 'Stack', 'Heap', 'Hash'], 'answer': 1},
            {'question': 'A complete binary tree with height h has at most how many nodes?', 'options': ['2^h', '2^(h+1) - 1', 'h²', '2h'], 'answer': 1},
            {'question': 'Which data structure is best for implementing a priority queue?', 'options': ['Array', 'Linked List', 'Heap', 'Stack'], 'answer': 2},
            {'question': 'What is the space complexity of merge sort?', 'options': ['O(1)', 'O(log n)', 'O(n)', 'O(n²)'], 'answer': 2},
            {'question': 'In a max-heap, the root element is?', 'options': ['Smallest', 'Largest', 'Median', 'Random'], 'answer': 1},
            {'question': 'Which graph algorithm finds minimum spanning tree?', 'options': ['Dijkstra', 'Bellman-Ford', 'Kruskal', 'Floyd-Warshall'], 'answer': 2},
            {'question': 'What is an AVL tree?', 'options': ['Binary tree', 'Self-balancing BST', 'B-tree', 'Red-black tree'], 'answer': 1},
            {'question': 'Time complexity of inserting at the beginning of a linked list?', 'options': ['O(n)', 'O(log n)', 'O(1)', 'O(n²)'], 'answer': 2},
            {'question': 'What is a deque?', 'options': ['Single-ended queue', 'Double-ended queue', 'Priority queue', 'Circular queue'], 'answer': 1},
            {'question': 'Topological sort is applicable to?', 'options': ['Undirected graphs', 'DAGs', 'Cyclic graphs', 'All graphs'], 'answer': 1},
            {'question': 'What is the auxiliary space of heapsort?', 'options': ['O(n)', 'O(log n)', 'O(1)', 'O(n²)'], 'answer': 2},
            {'question': 'Which collision resolution uses linked lists?', 'options': ['Open addressing', 'Chaining', 'Linear probing', 'Rehashing'], 'answer': 1},
            {'question': 'Inorder traversal of a BST gives?', 'options': ['Random order', 'Sorted order', 'Reverse order', 'Level order'], 'answer': 1},
            {'question': 'What is the best-case time complexity of bubble sort?', 'options': ['O(n²)', 'O(n log n)', 'O(n)', 'O(1)'], 'answer': 2},
        ],
        'Computer Networks': [
            {'question': 'Which layer of the OSI model handles routing?', 'options': ['Data Link', 'Network', 'Transport', 'Session'], 'answer': 1},
            {'question': 'What protocol is used for web browsing?', 'options': ['FTP', 'SMTP', 'HTTP', 'SSH'], 'answer': 2},
            {'question': 'What is the default port number for HTTP?', 'options': ['21', '25', '80', '443'], 'answer': 2},
            {'question': 'TCP is a _____ protocol?', 'options': ['Connectionless', 'Connection-oriented', 'Stateless', 'Broadcast'], 'answer': 1},
            {'question': 'UDP is used for?', 'options': ['Reliable transfer', 'Streaming', 'Email', 'File transfer'], 'answer': 1},
            {'question': 'How many layers are in the OSI model?', 'options': ['5', '6', '7', '4'], 'answer': 2},
            {'question': 'What device operates at Layer 2?', 'options': ['Router', 'Switch', 'Hub', 'Modem'], 'answer': 1},
            {'question': 'What is the purpose of DNS?', 'options': ['Encrypt data', 'Resolve domain names to IPs', 'Route packets', 'Filter traffic'], 'answer': 1},
            {'question': 'Which protocol is used for email sending?', 'options': ['POP3', 'IMAP', 'SMTP', 'HTTP'], 'answer': 2},
            {'question': 'What is a subnet mask used for?', 'options': ['Encryption', 'Dividing networks', 'Routing', 'Authentication'], 'answer': 1},
            {'question': 'What is the maximum size of an IPv4 address?', 'options': ['16 bits', '32 bits', '64 bits', '128 bits'], 'answer': 1},
            {'question': 'IPv6 address is how many bits?', 'options': ['32', '64', '128', '256'], 'answer': 2},
            {'question': 'What does ARP stand for?', 'options': ['Address Resolution Protocol', 'Application Router Protocol', 'Auto Routing Protocol', 'Address Relay Protocol'], 'answer': 0},
            {'question': 'Which topology has a single point of failure at center?', 'options': ['Bus', 'Ring', 'Star', 'Mesh'], 'answer': 2},
            {'question': 'What is the transport layer protocol for reliable delivery?', 'options': ['UDP', 'IP', 'TCP', 'ICMP'], 'answer': 2},
            {'question': 'HTTPS uses which port by default?', 'options': ['80', '8080', '443', '22'], 'answer': 2},
            {'question': 'What does DHCP do?', 'options': ['Resolves domains', 'Assigns IP addresses', 'Routes packets', 'Encrypts data'], 'answer': 1},
            {'question': 'Which protocol is used for secure shell access?', 'options': ['Telnet', 'FTP', 'SSH', 'HTTP'], 'answer': 2},
            {'question': 'What is a MAC address?', 'options': ['Network layer address', 'Physical hardware address', 'Logical address', 'Port number'], 'answer': 1},
            {'question': 'What layer does TCP operate at?', 'options': ['Application', 'Network', 'Transport', 'Data Link'], 'answer': 2},
            {'question': 'What is NAT used for?', 'options': ['Encrypting traffic', 'Translating private to public IPs', 'DNS resolution', 'Routing'], 'answer': 1},
            {'question': 'What is the purpose of ICMP?', 'options': ['File transfer', 'Error reporting', 'Routing', 'Email'], 'answer': 1},
            {'question': 'Which class of IP address supports 16 million hosts?', 'options': ['Class A', 'Class B', 'Class C', 'Class D'], 'answer': 0},
            {'question': 'What is a firewall?', 'options': ['Router', 'Network security device', 'Switch', 'Hub'], 'answer': 1},
            {'question': 'What does VPN stand for?', 'options': ['Virtual Private Network', 'Virtual Public Network', 'Verified Private Network', 'Visual Packet Network'], 'answer': 0},
        ],
        'Database Management': [
            {'question': 'What does SQL stand for?', 'options': ['Structured Question Language', 'Structured Query Language', 'Simple Query Language', 'Standard Query Language'], 'answer': 1},
            {'question': 'Which command is used to retrieve data from a database?', 'options': ['INSERT', 'UPDATE', 'SELECT', 'DELETE'], 'answer': 2},
            {'question': 'What is a primary key?', 'options': ['Foreign key', 'Unique identifier for a row', 'Index', 'Constraint'], 'answer': 1},
            {'question': 'Which normal form removes partial dependency?', 'options': ['1NF', '2NF', '3NF', 'BCNF'], 'answer': 1},
            {'question': 'What is a foreign key?', 'options': ['Primary key of same table', 'Reference to another table\'s primary key', 'Unique key', 'Index key'], 'answer': 1},
            {'question': 'ACID properties ensure?', 'options': ['Speed', 'Transaction reliability', 'Data compression', 'Indexing'], 'answer': 1},
            {'question': 'What does the "A" in ACID stand for?', 'options': ['Association', 'Atomicity', 'Availability', 'Authentication'], 'answer': 1},
            {'question': 'Which join returns all rows from both tables?', 'options': ['INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'FULL OUTER JOIN'], 'answer': 3},
            {'question': 'What is normalization?', 'options': ['Adding redundancy', 'Removing redundancy', 'Creating indexes', 'Backing up data'], 'answer': 1},
            {'question': 'Which SQL clause is used for filtering?', 'options': ['ORDER BY', 'GROUP BY', 'WHERE', 'HAVING'], 'answer': 2},
            {'question': 'What is a view in SQL?', 'options': ['A table', 'A virtual table', 'An index', 'A stored procedure'], 'answer': 1},
            {'question': 'Which command removes all rows from a table?', 'options': ['DELETE', 'DROP', 'TRUNCATE', 'REMOVE'], 'answer': 2},
            {'question': 'What is a deadlock?', 'options': ['Fast query', 'Circular wait condition', 'Index failure', 'Backup issue'], 'answer': 1},
            {'question': 'B-tree is used for?', 'options': ['Sorting', 'Indexing', 'Hashing', 'Caching'], 'answer': 1},
            {'question': 'What does DDL stand for?', 'options': ['Data Definition Language', 'Data Description Language', 'Database Design Language', 'Data Development Language'], 'answer': 0},
            {'question': 'Which command modifies existing data?', 'options': ['INSERT', 'UPDATE', 'ALTER', 'CREATE'], 'answer': 1},
            {'question': 'What is a stored procedure?', 'options': ['A query', 'Precompiled SQL statements', 'A table', 'An index'], 'answer': 1},
            {'question': 'What is referential integrity?', 'options': ['Primary key constraint', 'Foreign key constraint', 'Check constraint', 'Default constraint'], 'answer': 1},
            {'question': 'Which type of database is MongoDB?', 'options': ['Relational', 'NoSQL', 'Graph', 'Columnar'], 'answer': 1},
            {'question': 'What is sharding?', 'options': ['Replication', 'Horizontal partitioning', 'Vertical partitioning', 'Caching'], 'answer': 1},
            {'question': 'What does DML stand for?', 'options': ['Data Management Language', 'Data Manipulation Language', 'Database Modification Language', 'Data Model Language'], 'answer': 1},
            {'question': 'What is an ER diagram?', 'options': ['Error Report', 'Entity-Relationship diagram', 'Execution Report', 'Encryption Record'], 'answer': 1},
            {'question': 'What is the purpose of GROUP BY?', 'options': ['Sorting', 'Filtering', 'Aggregating rows', 'Joining tables'], 'answer': 2},
            {'question': 'What is a trigger in SQL?', 'options': ['A query', 'Automatic action on event', 'An index', 'A view'], 'answer': 1},
            {'question': 'Which isolation level prevents dirty reads?', 'options': ['Read Uncommitted', 'Read Committed', 'Serializable', 'Repeatable Read'], 'answer': 1},
        ],
        'Operating Systems': [
            {'question': 'What is a process?', 'options': ['A file', 'A program in execution', 'A thread', 'A device'], 'answer': 1},
            {'question': 'Which scheduling algorithm is non-preemptive?', 'options': ['Round Robin', 'FCFS', 'SJF Preemptive', 'Priority Preemptive'], 'answer': 1},
            {'question': 'What is a deadlock?', 'options': ['Process completion', 'Circular wait among processes', 'Memory leak', 'CPU idle'], 'answer': 1},
            {'question': 'What is virtual memory?', 'options': ['RAM extension using disk', 'Cache memory', 'ROM', 'Flash memory'], 'answer': 0},
            {'question': 'Which page replacement algorithm is optimal?', 'options': ['FIFO', 'LRU', 'Optimal', 'Random'], 'answer': 2},
            {'question': 'What is thrashing?', 'options': ['Fast execution', 'Excessive paging activity', 'Memory overflow', 'CPU overload'], 'answer': 1},
            {'question': 'What does a semaphore do?', 'options': ['Allocate memory', 'Synchronize processes', 'Schedule CPU', 'Manage files'], 'answer': 1},
            {'question': 'What is the purpose of a file system?', 'options': ['CPU management', 'Organize and store data', 'Network routing', 'Process scheduling'], 'answer': 1},
            {'question': 'What is a context switch?', 'options': ['Changing user', 'Saving/loading process state', 'Swapping memory', 'File access'], 'answer': 1},
            {'question': 'Which memory allocation strategy has external fragmentation?', 'options': ['Paging', 'Segmentation', 'Both', 'Neither'], 'answer': 1},
            {'question': 'What is a thread?', 'options': ['Lightweight process', 'Heavy process', 'A file', 'A device'], 'answer': 0},
            {'question': 'What is mutual exclusion?', 'options': ['Shared access', 'Only one process in critical section', 'Deadlock', 'Starvation'], 'answer': 1},
            {'question': 'Round Robin scheduling uses?', 'options': ['Priority', 'Time quantum', 'Shortest job', 'First come'], 'answer': 1},
            {'question': 'What is a system call?', 'options': ['User function', 'Interface to OS services', 'Hardware interrupt', 'Driver call'], 'answer': 1},
            {'question': 'What is paging?', 'options': ['Dividing memory into fixed-size blocks', 'Variable-size blocks', 'Continuous allocation', 'Compaction'], 'answer': 0},
            {'question': 'What does the kernel do?', 'options': ['User interface', 'Core OS functionality', 'Application logic', 'Network routing'], 'answer': 1},
            {'question': 'What is a race condition?', 'options': ['Fast execution', 'Outcome depends on timing of processes', 'Deadlock', 'Memory leak'], 'answer': 1},
            {'question': 'Which is NOT a necessary condition for deadlock?', 'options': ['Mutual Exclusion', 'Hold and Wait', 'Preemption', 'Circular Wait'], 'answer': 2},
            {'question': 'What is demand paging?', 'options': ['Load all pages', 'Load page only when needed', 'Swap pages randomly', 'Pre-load pages'], 'answer': 1},
            {'question': 'What is the Banker\'s algorithm used for?', 'options': ['Scheduling', 'Deadlock avoidance', 'Memory allocation', 'File management'], 'answer': 1},
            {'question': 'What is an interrupt?', 'options': ['Error', 'Signal to CPU for attention', 'Process termination', 'Memory access'], 'answer': 1},
            {'question': 'What is spooling?', 'options': ['Process scheduling', 'Buffering I/O data', 'Memory management', 'CPU allocation'], 'answer': 1},
            {'question': 'What is the producer-consumer problem?', 'options': ['Routing issue', 'Synchronization problem', 'Memory issue', 'File access issue'], 'answer': 1},
            {'question': 'What is fork() in Unix?', 'options': ['Delete process', 'Create child process', 'Terminate process', 'Pause process'], 'answer': 1},
            {'question': 'What is a zombie process?', 'options': ['Active process', 'Terminated but not reaped', 'Sleeping process', 'Idle process'], 'answer': 1},
        ],
        'Chemistry': [
            {'question': 'What is the atomic number of Carbon?', 'options': ['4', '6', '8', '12'], 'answer': 1},
            {'question': 'What is the pH of pure water?', 'options': ['0', '7', '14', '1'], 'answer': 1},
            {'question': 'Which gas is most abundant in Earth\'s atmosphere?', 'options': ['Oxygen', 'Carbon dioxide', 'Nitrogen', 'Argon'], 'answer': 2},
            {'question': 'What is the chemical formula of water?', 'options': ['H2O2', 'H2O', 'HO', 'OH2'], 'answer': 1},
            {'question': 'What type of bond is formed between Na and Cl?', 'options': ['Covalent', 'Ionic', 'Metallic', 'Hydrogen'], 'answer': 1},
            {'question': 'What is Avogadro\'s number?', 'options': ['6.022×10²³', '3.14×10²³', '1.6×10⁻¹⁹', '9.8'], 'answer': 0},
            {'question': 'Which element has the symbol Fe?', 'options': ['Fluorine', 'Iron', 'Francium', 'Fermium'], 'answer': 1},
            {'question': 'What is the molecular formula of glucose?', 'options': ['C6H12O6', 'C12H22O11', 'CH4', 'C2H5OH'], 'answer': 0},
            {'question': 'What is the valency of oxygen?', 'options': ['1', '2', '3', '4'], 'answer': 1},
            {'question': 'Which acid is found in vinegar?', 'options': ['Sulfuric acid', 'Hydrochloric acid', 'Acetic acid', 'Nitric acid'], 'answer': 2},
            {'question': 'What is an exothermic reaction?', 'options': ['Absorbs heat', 'Releases heat', 'No heat change', 'Absorbs light'], 'answer': 1},
            {'question': 'What is the noble gas in period 2?', 'options': ['Helium', 'Neon', 'Argon', 'Krypton'], 'answer': 1},
            {'question': 'What is the functional group of alcohols?', 'options': ['-COOH', '-OH', '-CHO', '-NH2'], 'answer': 1},
            {'question': 'Combustion of methane produces?', 'options': ['CO + H2', 'CO2 + H2O', 'C + H2O', 'CO2 + H2'], 'answer': 1},
            {'question': 'What does a catalyst do?', 'options': ['Increases products', 'Speeds up reaction', 'Changes products', 'Increases temperature'], 'answer': 1},
            {'question': 'What is the electron configuration of Sodium (Na)?', 'options': ['2,8,1', '2,8,2', '2,8,8', '2,1'], 'answer': 0},
            {'question': 'What is oxidation?', 'options': ['Gain of electrons', 'Loss of electrons', 'Gain of protons', 'Loss of protons'], 'answer': 1},
            {'question': 'What type of reaction is rusting?', 'options': ['Reduction', 'Oxidation', 'Decomposition', 'Neutralization'], 'answer': 1},
            {'question': 'What is the molar mass of NaCl?', 'options': ['40 g/mol', '58.5 g/mol', '35.5 g/mol', '23 g/mol'], 'answer': 1},
            {'question': 'Which gas is produced during photosynthesis?', 'options': ['CO2', 'O2', 'N2', 'H2'], 'answer': 1},
            {'question': 'What is an isotope?', 'options': ['Same protons, different neutrons', 'Same neutrons, different protons', 'Same electrons, different protons', 'Same mass number'], 'answer': 0},
            {'question': 'What is Le Chatelier\'s principle about?', 'options': ['Thermodynamics', 'Chemical equilibrium', 'Kinetics', 'Stoichiometry'], 'answer': 1},
            {'question': 'What is the shape of methane (CH4)?', 'options': ['Linear', 'Trigonal', 'Tetrahedral', 'Octahedral'], 'answer': 2},
            {'question': 'What is a buffer solution?', 'options': ['Strong acid', 'Resists pH change', 'Pure water', 'Strong base'], 'answer': 1},
            {'question': 'Which bond is the strongest?', 'options': ['Ionic', 'Covalent', 'Hydrogen', 'Van der Waals'], 'answer': 1},
        ],
    }

    questions_to_insert = []
    for subject, questions in subjects.items():
        for q in questions:
            questions_to_insert.append({
                'subject': subject,
                'question': q['question'],
                'options': q['options'],
                'answer': q['answer'],
            })

    if questions_to_insert:
        questions_collection.insert_many(questions_to_insert)
        print(f"[OK] Seeded {len(questions_to_insert)} questions across {len(subjects)} subjects")

# Seed questions on startup
try:
    seed_questions_if_empty()
except Exception as e:
    print(f"[WARN] Question seeding skipped: {e}")

# Create index for efficient random sampling
try:
    questions_collection.create_index('subject')
    test_results_collection.create_index([('user_id', 1), ('subject', 1)])
except Exception as e:
    print(f"[WARN] Index creation skipped: {e}")


@app.route('/generate-topic-test', methods=['POST'])
def generate_topic_test():
    """Generate a random 20-question MCQ test for a given subject/topic"""
    try:
        user_id = get_auth_user()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401

        data = request.json
        subject = data.get('subject', '').strip()

        if not subject:
            return jsonify({'error': 'Subject/topic is required'}), 400

        # Count available questions for this subject (case-insensitive)
        import re
        regex_pattern = re.compile(f'^{re.escape(subject)}$', re.IGNORECASE)
        total_questions = questions_collection.count_documents({'subject': regex_pattern})

        if total_questions == 0:
            # Try partial match
            regex_pattern = re.compile(re.escape(subject), re.IGNORECASE)
            total_questions = questions_collection.count_documents({'subject': regex_pattern})

        if total_questions == 0:
            available_subjects = questions_collection.distinct('subject')
            return jsonify({
                'error': f'No questions found for "{subject}"',
                'available_subjects': available_subjects
            }), 404

        # Use MongoDB $sample for random question selection
        sample_size = min(20, total_questions)
        pipeline = [
            {'$match': {'subject': regex_pattern}},
            {'$sample': {'size': sample_size}},
            {'$project': {
                '_id': {'$toString': '$_id'},
                'question': 1,
                'options': 1,
                'subject': 1
            }}
        ]

        questions = list(questions_collection.aggregate(pipeline))

        return jsonify({
            'message': f'Test generated with {len(questions)} questions',
            'subject': subject,
            'total_questions': len(questions),
            'questions': questions
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/submit-topic-test', methods=['POST'])
def submit_topic_test():
    """Submit test answers and calculate score, percentage, and student level"""
    try:
        user_id = get_auth_user()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401

        from bson import ObjectId

        data = request.json
        subject = data.get('subject', '').strip()
        answers = data.get('answers', {})  # { question_id: selected_option_index }

        if not subject:
            return jsonify({'error': 'Subject is required'}), 400

        if not answers or len(answers) == 0:
            return jsonify({'error': 'No answers submitted'}), 400

        # Validate and score answers
        correct = 0
        total = len(answers)
        details = []

        for q_id, selected in answers.items():
            try:
                question = questions_collection.find_one({'_id': ObjectId(q_id)})
            except Exception:
                continue

            if not question:
                continue

            is_correct = int(selected) == question['answer']
            if is_correct:
                correct += 1

            details.append({
                'question': question['question'],
                'selected': int(selected),
                'correct_answer': question['answer'],
                'options': question['options'],
                'is_correct': is_correct
            })

        # Calculate percentage and level
        percentage = round((correct / total) * 100, 2) if total > 0 else 0
        student_level = determine_student_level(percentage)
        is_weak = percentage < 60

        # Save result to test_results collection
        test_result = {
            'user_id': ObjectId(user_id),
            'subject': subject,
            'score': correct,
            'total': total,
            'percentage': percentage,
            'student_level': student_level,
            'is_weak': is_weak,
            'details': details,
            'date': datetime.utcnow().isoformat(),
            'created_at': datetime.utcnow()
        }

        result = test_results_collection.insert_one(test_result)

        # Gamification: Award XP for mock test completion + correct answers
        ensure_gamification_fields(user_id)
        xp_earned = 30 + (correct * 2)
        award_xp(user_id, xp_earned, f'Mock test: {subject} ({correct}/{total})')
        update_challenge_progress(user_id, 'mcq_count', total)
        update_mission_progress(user_id, 'mock_tests', 1)

        return jsonify({
            'message': 'Test submitted successfully',
            'result_id': str(result.inserted_id),
            'subject': subject,
            'score': correct,
            'total': total,
            'percentage': percentage,
            'student_level': student_level,
            'is_weak': is_weak,
            'details': details,
            'xp_earned': xp_earned,
            'level_info': {
                'Expert': '90-100%',
                'Advanced': '75-89%',
                'Intermediate': '60-74%',
                'Beginner': '40-59%',
                'Critical': 'Below 40%'
            }
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/topic-performance', methods=['GET'])
def topic_performance():
    """Get topic test performance data for the authenticated user"""
    try:
        user_id = get_auth_user()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401

        from bson import ObjectId

        results = list(test_results_collection.find(
            {'user_id': ObjectId(user_id)},
            {'details': 0}  # Exclude detailed answers for performance
        ).sort('created_at', -1))

        if not results:
            return jsonify({
                'message': 'No test results yet',
                'tests_taken': 0,
                'subject_performance': [],
                'recent_tests': [],
                'weak_topics': [],
                'overall_stats': {
                    'average_percentage': 0,
                    'tests_taken': 0,
                    'dominant_level': 'N/A'
                }
            }), 200

        # Group by subject
        subject_data = {}
        for r in results:
            subj = r['subject']
            if subj not in subject_data:
                subject_data[subj] = {
                    'percentages': [],
                    'levels': [],
                    'scores': [],
                    'totals': []
                }
            subject_data[subj]['percentages'].append(r['percentage'])
            subject_data[subj]['levels'].append(r['student_level'])
            subject_data[subj]['scores'].append(r['score'])
            subject_data[subj]['totals'].append(r['total'])

        # Build subject performance
        subject_performance = []
        weak_topics = []
        for subj, data in subject_data.items():
            avg_pct = round(sum(data['percentages']) / len(data['percentages']), 2)
            latest_pct = data['percentages'][0]
            latest_level = data['levels'][0]
            tests_count = len(data['percentages'])
            trend = 'improving' if tests_count > 1 and data['percentages'][0] > data['percentages'][-1] else 'stable'

            perf = {
                'subject': subj,
                'average_percentage': avg_pct,
                'latest_percentage': latest_pct,
                'latest_level': latest_level,
                'tests_taken': tests_count,
                'trend': trend,
                'is_weak': avg_pct < 60
            }
            subject_performance.append(perf)

            if avg_pct < 60:
                weak_topics.append({
                    'subject': subj,
                    'average_percentage': avg_pct,
                    'level': determine_student_level(avg_pct),
                    'tests_taken': tests_count
                })

        # Recent tests (last 10)
        recent_tests = []
        for r in results[:10]:
            recent_tests.append({
                'id': str(r['_id']),
                'subject': r['subject'],
                'score': r['score'],
                'total': r['total'],
                'percentage': r['percentage'],
                'student_level': r['student_level'],
                'is_weak': r.get('is_weak', False),
                'date': r.get('date', r['created_at'].isoformat())
            })

        # Overall stats
        all_percentages = [r['percentage'] for r in results]
        all_levels = [r['student_level'] for r in results]
        level_counts = {}
        for l in all_levels:
            level_counts[l] = level_counts.get(l, 0) + 1
        dominant_level = max(level_counts, key=level_counts.get) if level_counts else 'N/A'

        return jsonify({
            'message': 'Topic performance retrieved',
            'tests_taken': len(results),
            'subject_performance': sorted(subject_performance, key=lambda x: x['average_percentage']),
            'recent_tests': recent_tests,
            'weak_topics': sorted(weak_topics, key=lambda x: x['average_percentage']),
            'overall_stats': {
                'average_percentage': round(sum(all_percentages) / len(all_percentages), 2),
                'tests_taken': len(results),
                'dominant_level': dominant_level,
                'level_distribution': level_counts
            }
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ==================== AI ENDPOINTS ====================

# Syllabus Data Structure (flat list for gamified quiz)
SYLLABUS = {
    "Database Systems": ["ER Modeling", "SQL", "Normalization", "Transactions", "Indices"],
    "Data Structures": ["Arrays & Lists", "Trees", "Graphs", "Hashing", "Stacks & Queues"],
    "Computer Organization": ["CPU Architecture", "Memory Hierarchy", "Instruction Sets", "I/O Systems"],
    "Machine Learning": ["ML Basics", "Supervised Learning", "Unsupervised Learning", "Model Evaluation", "Deep Learning"]
}

# Detailed Syllabus for Mock Test & Roadmap (nested: Subject -> Unit -> Subtopics)
DETAILED_SYLLABUS = {
    "Data Structures": {
        "Basics": ["Arrays", "Time complexity", "Space complexity", "Big-O notation"],
        "Linked Lists": ["Singly linked list", "Doubly linked list", "Circular list"],
        "Stack": ["Implementation", "Applications", "Expression evaluation"],
        "Queue": ["Simple queue", "Circular queue", "Priority queue", "Deque"],
        "Trees": ["Binary tree", "Binary search tree", "AVL tree", "Heap"],
        "Hashing": ["Hash tables", "Collision handling", "Hash functions"],
        "Graphs": ["Graph representation", "BFS", "DFS"]
    },
    "Database Systems": {
        "DBMS Basics": ["Data models", "Database architecture", "Schema vs Instance"],
        "ER Model": ["Entities", "Attributes", "Relationships", "ER diagrams"],
        "Relational Model": ["Tables", "Keys", "Primary key", "Foreign key", "Candidate key"],
        "SQL": ["DDL (CREATE, ALTER, DROP)", "DML (SELECT, INSERT, UPDATE, DELETE)"],
        "Normalization": ["1NF", "2NF", "3NF", "BCNF"],
        "Transactions": ["ACID properties", "Concurrency control"]
    },
    "Computer Organization": {
        "Number Systems": ["Binary", "Octal", "Hexadecimal"],
        "Digital Logic": ["Logic gates", "Boolean algebra", "Karnaugh maps"],
        "CPU Architecture": ["Registers", "ALU", "Control unit"],
        "Instruction Set": ["Instruction cycle", "Addressing modes"],
        "Memory": ["Cache", "RAM", "Virtual memory"],
        "I/O Systems": ["Interrupts", "DMA"]
    },
    "Machine Learning": {
        "ML Basics": ["Definition and types", "Training and testing", "Features and labels"],
        "Supervised Learning": ["Classification", "Regression"],
        "Unsupervised Learning": ["Clustering", "Dimensionality reduction"],
        "Model Evaluation": ["Metrics", "Overfitting and underfitting"],
        "Deep Learning & Reinforcement": ["Neural networks", "Reinforcement learning"]
    }
}

# Subject metadata for frontend cards
SUBJECT_META = {
    "Database Systems": {"icon": "fa-database", "desc": "25 questions covering SQL, normalization, and database design"},
    "Data Structures": {"icon": "fa-project-diagram", "desc": "25 questions on arrays, trees, graphs, and algorithms"},
    "Computer Organization": {"icon": "fa-microchip", "desc": "25 questions on CPU architecture, memory, and instruction sets"},
    "Machine Learning": {"icon": "fa-robot", "desc": "25 questions on supervised/unsupervised learning and model evaluation"}
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

        # Static quiz questions per subject (no API key needed)
        quiz_banks = {
            "Database Systems": [
                {"id": 1, "question": "What is a primary key in a relational database?", "type": "mcq", "options": ["A) A key used to encrypt data", "B) A unique identifier for each record in a table", "C) A foreign key reference", "D) An index for faster queries"], "correct_answer": "B", "explanation": "A primary key uniquely identifies each row/record in a table.", "points": 50},
                {"id": 2, "question": "Which normal form eliminates partial dependencies?", "type": "mcq", "options": ["A) 1NF", "B) 2NF", "C) 3NF", "D) BCNF"], "correct_answer": "B", "explanation": "Second Normal Form (2NF) removes partial dependencies on the primary key.", "points": 50},
                {"id": 3, "question": "What does ACID stand for in database transactions?", "type": "mcq", "options": ["A) Atomicity, Consistency, Isolation, Durability", "B) Access, Control, Integrity, Data", "C) Automatic, Concurrent, Independent, Durable", "D) Atomic, Complete, Isolated, Dependent"], "correct_answer": "A", "explanation": "ACID ensures reliable database transactions.", "points": 50},
                {"id": 4, "question": "Which SQL command is used to remove a table from the database?", "type": "mcq", "options": ["A) DELETE TABLE", "B) REMOVE TABLE", "C) DROP TABLE", "D) ERASE TABLE"], "correct_answer": "C", "explanation": "DROP TABLE permanently removes the table structure and data.", "points": 50},
                {"id": 5, "question": "What is a foreign key?", "type": "mcq", "options": ["A) A key from another country's database", "B) A field that links to the primary key of another table", "C) A unique constraint on a column", "D) An auto-incrementing field"], "correct_answer": "B", "explanation": "A foreign key establishes a relationship between two tables.", "points": 50}
            ],
            "Data Structures": [
                {"id": 1, "question": "What is the time complexity of binary search?", "type": "mcq", "options": ["A) O(n)", "B) O(n log n)", "C) O(log n)", "D) O(1)"], "correct_answer": "C", "explanation": "Binary search halves the search space each step, giving O(log n).", "points": 50},
                {"id": 2, "question": "Which data structure uses LIFO (Last In First Out)?", "type": "mcq", "options": ["A) Queue", "B) Stack", "C) Linked List", "D) Tree"], "correct_answer": "B", "explanation": "A stack follows LIFO — the last element pushed is the first to be popped.", "points": 50},
                {"id": 3, "question": "What is the worst-case time complexity of quicksort?", "type": "mcq", "options": ["A) O(n log n)", "B) O(n)", "C) O(n^2)", "D) O(log n)"], "correct_answer": "C", "explanation": "Quicksort degrades to O(n^2) when the pivot selection is poor.", "points": 50},
                {"id": 4, "question": "Which traversal visits the root node first in a binary tree?", "type": "mcq", "options": ["A) Inorder", "B) Postorder", "C) Preorder", "D) Level order"], "correct_answer": "C", "explanation": "Preorder traversal visits Root → Left → Right.", "points": 50},
                {"id": 5, "question": "What is the space complexity of a hash table?", "type": "mcq", "options": ["A) O(1)", "B) O(log n)", "C) O(n)", "D) O(n^2)"], "correct_answer": "C", "explanation": "A hash table stores n key-value pairs, requiring O(n) space.", "points": 50}
            ],
            "Computer Organization": [
                {"id": 1, "question": "What is the main function of the ALU?", "type": "mcq", "options": ["A) Store data", "B) Perform arithmetic and logic operations", "C) Control I/O devices", "D) Manage memory"], "correct_answer": "B", "explanation": "The ALU (Arithmetic Logic Unit) performs calculations and logical operations.", "points": 50},
                {"id": 2, "question": "Which memory is the fastest in the memory hierarchy?", "type": "mcq", "options": ["A) Main memory (RAM)", "B) Hard disk", "C) Cache memory", "D) Registers"], "correct_answer": "D", "explanation": "Registers are the fastest memory, located inside the CPU.", "points": 50},
                {"id": 3, "question": "What does DMA stand for?", "type": "mcq", "options": ["A) Direct Memory Access", "B) Data Memory Allocation", "C) Dynamic Memory Architecture", "D) Dual Mode Access"], "correct_answer": "A", "explanation": "DMA allows devices to transfer data to memory without CPU intervention.", "points": 50},
                {"id": 4, "question": "In pipelining, what is a hazard?", "type": "mcq", "options": ["A) A type of instruction", "B) A situation that prevents the next instruction from executing", "C) A memory error", "D) An I/O device"], "correct_answer": "B", "explanation": "Pipeline hazards (data, control, structural) stall instruction execution.", "points": 50},
                {"id": 5, "question": "What is the purpose of an instruction register (IR)?", "type": "mcq", "options": ["A) Store the result of operations", "B) Hold the currently executing instruction", "C) Point to the next instruction", "D) Store memory addresses"], "correct_answer": "B", "explanation": "The IR holds the instruction currently being decoded and executed.", "points": 50}
            ],
            "Machine Learning": [
                {"id": 1, "question": "What type of learning uses labeled data?", "type": "mcq", "options": ["A) Unsupervised Learning", "B) Supervised Learning", "C) Reinforcement Learning", "D) Transfer Learning"], "correct_answer": "B", "explanation": "Supervised learning trains on labeled input-output pairs.", "points": 50},
                {"id": 2, "question": "Which algorithm is used for classification?", "type": "mcq", "options": ["A) Linear Regression", "B) K-Means", "C) Decision Tree", "D) PCA"], "correct_answer": "C", "explanation": "Decision Trees can classify data by learning decision rules from features.", "points": 50},
                {"id": 3, "question": "What is overfitting?", "type": "mcq", "options": ["A) Model performs well on training and test data", "B) Model performs well on training but poorly on test data", "C) Model performs poorly on all data", "D) Model ignores all features"], "correct_answer": "B", "explanation": "Overfitting means the model memorizes training data but fails to generalize.", "points": 50},
                {"id": 4, "question": "What does K-Means algorithm do?", "type": "mcq", "options": ["A) Classification", "B) Regression", "C) Clustering", "D) Dimensionality Reduction"], "correct_answer": "C", "explanation": "K-Means partitions data into K clusters based on similarity.", "points": 50},
                {"id": 5, "question": "Which metric is used for regression problems?", "type": "mcq", "options": ["A) Accuracy", "B) F1 Score", "C) Mean Squared Error", "D) Precision"], "correct_answer": "C", "explanation": "MSE measures average squared difference between predicted and actual values.", "points": 50}
            ]
        }

        import random
        questions = quiz_banks.get(subject, quiz_banks["Database Systems"])
        random.shuffle(questions)
        for i, q in enumerate(questions):
            q['id'] = i + 1

        boss_names = {
            "Database Systems": "The SQL Sorcerer",
            "Data Structures": "The Algorithm Dragon",
            "Computer Organization": "The Binary Beast",
            "Machine Learning": "The Neural Overlord"
        }

        quiz_data = {
            "world": subject,
            "boss_name": boss_names.get(subject, f"The {subject} Guardian"),
            "level_difficulty": difficulty,
            "questions": questions,
            "total_questions": len(questions),
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
        
        weak_areas = data.get('weak_areas', [])
        study_pattern = data.get('study_pattern', 'Evening study sessions')

        # Static recommendations (no AI needed)
        all_tips = [
            {"category": "Motivation", "tip": "Start with the weakest subject first when your mind is fresh", "emoji": "💪"},
            {"category": "Strategy", "tip": "Use the Pomodoro technique: 25 min study + 5 min break", "emoji": "⏱️"},
            {"category": "Focus", "tip": "Turn off phone notifications during study sessions", "emoji": "📵"},
            {"category": "Time Management", "tip": "Plan your study schedule the night before — wake up with a clear plan", "emoji": "📅"},
            {"category": "Concept Mastery", "tip": "Use active recall: close the book and test yourself on what you just read", "emoji": "🧠"},
            {"category": "Strategy", "tip": "Teach what you learn to someone else or a rubber duck to find gaps", "emoji": "🎓"},
            {"category": "Focus", "tip": "Study in 90-minute blocks with 15-minute breaks for optimal focus", "emoji": "🎯"},
            {"category": "Motivation", "tip": "Track your daily progress — seeing improvement is the best motivator", "emoji": "📈"},
            {"category": "Concept Mastery", "tip": "Create mind maps to connect key concepts across topics", "emoji": "🗺️"},
            {"category": "Time Management", "tip": "Use spaced repetition: review after 1 day, 3 days, 1 week, 1 month", "emoji": "🔄"},
        ]

        import random
        random.shuffle(all_tips)
        selected_tips = all_tips[:6]

        study_schedule = []
        if weak_areas:
            priorities = ["High", "High", "Medium", "Medium", "Low"]
            hours = [6, 5, 4, 3, 3]
            for i, s in enumerate(weak_areas[:5]):
                study_schedule.append({
                    "subject": s,
                    "recommended_hours_per_week": hours[i] if i < len(hours) else 3,
                    "priority": priorities[i] if i < len(priorities) else "Low",
                    "reason": f"Identified as a weak area — consistent practice will build confidence"
                })

        motivational_messages = [
            "Every small step forward is progress! You've got this! 🎯",
            "Consistency beats intensity — 30 minutes daily beats 5 hours once a week! 💪",
            "You're investing in your future — keep going, success is a marathon not a sprint! 🏃",
            "The best time to study was yesterday, the next best time is right now! 🚀",
            "Progress, not perfection. Every session makes you stronger! 🌟"
        ]

        recommendations = {
            "recommendations": selected_tips,
            "study_schedule": study_schedule,
            "motivational_message": random.choice(motivational_messages)
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
        user_id = get_auth_user()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        
        subject = data.get('subject', 'General')
        question = data.get('question', 'Give me study tips')
        study_level = data.get('study_level', 'intermediate')
        mode = data.get('mode', 'question')  # 'question', 'subject_advice', 'topic'

        # Static tutor responses (no AI needed)
        if mode == 'subject_advice':
            help_data = {
                "title": f"Study Guide: {subject}",
                "sections": [
                    {"heading": "Stress Management", "icon": "fa-brain", "tips": [
                        f"Break {subject} study into 25-minute focused sessions with 5-minute breaks",
                        "Practice deep breathing before starting difficult topics",
                        "Keep a progress journal to track what you've mastered",
                        "Reward yourself after completing challenging study goals"
                    ]},
                    {"heading": "Focus Techniques", "icon": "fa-crosshairs", "tips": [
                        "Remove phone and social media distractions while studying",
                        f"Start with the most challenging {subject} topics when your energy is highest",
                        "Use active recall — close the book and try to explain concepts aloud",
                        "Study in a consistent, dedicated space free from distractions"
                    ]},
                    {"heading": "Study Strategy", "icon": "fa-chess", "tips": [
                        "Use spaced repetition: review after 1 day, 3 days, 1 week",
                        f"Create mind maps connecting key {subject} concepts",
                        "Teach concepts to a friend or rubber duck to find gaps",
                        "Practice with past exam papers and timed mock tests"
                    ]},
                    {"heading": "Key Resources", "icon": "fa-link", "tips": [
                        f"Search for '{subject} lecture notes PDF' for concise summaries",
                        f"Watch YouTube tutorials on difficult {subject} topics",
                        "Use flashcard apps like Anki for memorization-heavy content",
                        "Join study groups or online forums for peer discussion"
                    ]}
                ],
                "highlight": f"Consistency beats intensity — 30 minutes daily of {subject} is better than 5 hours once a week!"
            }
        elif mode == 'topic':
            help_data = {
                "title": question,
                "sections": [
                    {"heading": "Quick Techniques", "icon": "fa-bolt", "tips": [
                        "Practice the 4-7-8 breathing technique: inhale 4s, hold 7s, exhale 8s",
                        "Use the Pomodoro Technique: 25 min work, 5 min rest",
                        "Write down your worries before studying to clear your mind",
                        "Start with a 2-minute easy task to build momentum"
                    ]},
                    {"heading": "Long-term Habits", "icon": "fa-calendar", "tips": [
                        "Maintain a consistent sleep schedule of 7-8 hours",
                        "Exercise for at least 20 minutes daily",
                        "Practice mindfulness or meditation for 10 minutes each morning",
                        "Set realistic daily goals and celebrate small wins"
                    ]},
                    {"heading": "Study Environment", "icon": "fa-home", "tips": [
                        "Create a dedicated study space with good lighting",
                        "Keep your desk organized — a clean space helps a clean mind",
                        "Use background white noise or lo-fi music if it helps focus",
                        "Study at the same time each day to build a routine"
                    ]}
                ],
                "highlight": "Small daily habits compound into big results over time!"
            }
        else:
            help_data = {
                "title": question[:80],
                "explanation": f"Here's some guidance on your {subject} question! Break down complex problems into smaller parts, review fundamental concepts first, and practice with examples. Understanding the 'why' behind concepts is more powerful than memorizing the 'what'.",
                "key_points": [
                    "Break the problem into smaller, manageable parts",
                    "Review the fundamental concepts involved",
                    "Practice with similar examples to build understanding",
                    "Try to connect this concept to real-world applications"
                ],
                "example": "Try working through a simpler version of this problem first, then build up to the full complexity. Write out each step to identify where you get stuck.",
                "common_mistakes": [
                    "Skipping fundamentals and jumping to advanced topics",
                    "Not practicing enough with hands-on examples",
                    "Relying only on reading without active problem-solving"
                ],
                "practice_tip": f"Search for '{subject} {question} practice problems' online and work through 3-5 examples.",
                "difficulty": study_level
            }
        
        # Gamification: Track AI tutor usage
        from bson import ObjectId
        ensure_gamification_fields(user_id)
        users_collection.update_one(
            {'_id': ObjectId(user_id)},
            {'$inc': {'ai_tutor_uses': 1}}
        )
        check_badges(user_id)

        return jsonify({
            'success': True,
            'data': help_data,
            'mode': mode
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ==================== MOCK TEST ENDPOINTS ====================

@app.route('/api/mock-test/upload-syllabus', methods=['POST'])
def upload_syllabus_and_generate():
    """Upload a syllabus (PDF/DOCX/TXT file or pasted text) and generate 10 MCQs via Gemini"""
    try:
        user_id = get_auth_user()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401

        syllabus_text = ''

        # Check if file was uploaded (multipart form)
        if 'file' in request.files:
            file = request.files['file']
            if not file or not file.filename:
                return jsonify({'error': 'No file selected'}), 400

            filename = file.filename.lower()
            allowed_ext = ('.pdf', '.docx', '.txt')
            if not filename.endswith(allowed_ext):
                return jsonify({'error': f'Invalid file type. Allowed: {", ".join(allowed_ext)}'}), 400

            # Check file size (10MB limit)
            file.seek(0, 2)
            size = file.tell()
            file.seek(0)
            if size > 10 * 1024 * 1024:
                return jsonify({'error': 'File too large. Maximum size: 10MB'}), 400

            if filename.endswith('.pdf'):
                try:
                    from PyPDF2 import PdfReader
                    reader = PdfReader(file)
                    for page in reader.pages:
                        page_text = page.extract_text()
                        if page_text:
                            syllabus_text += page_text + '\n'
                except Exception as e:
                    return jsonify({'error': f'Failed to read PDF: {str(e)}'}), 400

            elif filename.endswith('.docx'):
                try:
                    import docx
                    import io
                    doc = docx.Document(io.BytesIO(file.read()))
                    for para in doc.paragraphs:
                        if para.text.strip():
                            syllabus_text += para.text + '\n'
                except Exception as e:
                    return jsonify({'error': f'Failed to read DOCX: {str(e)}'}), 400

            elif filename.endswith('.txt'):
                syllabus_text = file.read().decode('utf-8', errors='ignore')

        else:
            # JSON body with pasted text
            data = request.json or {}
            syllabus_text = data.get('text', '').strip()

        if not syllabus_text or len(syllabus_text.strip()) < 20:
            return jsonify({'error': 'Syllabus content is too short. Please provide more detail.'}), 400

        # Truncate very long text to avoid token limits
        syllabus_text = syllabus_text[:8000]

        if not GEMINI_API_KEY:
            return jsonify({'error': 'AI features are unavailable. Please use preloaded subjects instead.'}), 503

        # Step 1: Ask Gemini to parse syllabus and generate questions
        prompt = f"""You are a Computer Science exam question generator and syllabus analyzer.

TASK: Analyze the following syllabus content, identify the subject name, key units, and subtopics, then generate exactly 10 multiple-choice questions.

SYLLABUS CONTENT:
{syllabus_text}

IMPORTANT RULES:
- First identify the subject name from the syllabus
- Identify 4-6 major units/chapters
- Generate exactly 10 MCQ questions spread across all units
- Each question must have exactly 4 options with ONE correct answer
- Tag each question with its unit and subtopic
- Vary difficulty: mix easy, medium, and hard questions

Return ONLY valid JSON in this exact format:
{{
  "subject": "Identified Subject Name",
  "units": {{
    "Unit 1 Name": ["Subtopic A", "Subtopic B"],
    "Unit 2 Name": ["Subtopic C", "Subtopic D"]
  }},
  "questions": [
    {{
      "text": "Question text here?",
      "type": "mcq",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct": 0,
      "unit": "Unit Name",
      "subtopic": "Subtopic Name"
    }}
  ]
}}

The "correct" field is the 0-based index (0, 1, 2, or 3).
Generate exactly 10 questions. Return ONLY valid JSON, no markdown."""

        try:
            text = generate_gemini_text(prompt).strip()
            # Strip markdown code fences
            if text.startswith('```'):
                text = text.split('\n', 1)[1] if '\n' in text else text[3:]
            if text.endswith('```'):
                text = text[:-3]
            text = text.strip()
            if text.startswith('json'):
                text = text[4:].strip()

            result = json.loads(text)
            # Handle both dict and list responses from Gemini
            if isinstance(result, list):
                subject_name = 'Custom Subject'
                units = {}
                questions = result
            else:
                subject_name = result.get('subject', 'Custom Subject')
                units = result.get('units', {})
                questions = result.get('questions', [])

            # Validate questions
            valid_questions = []
            for q in questions:
                if all(k in q for k in ('text', 'options', 'correct')) and len(q.get('options', [])) == 4:
                    q.setdefault('type', 'mcq')
                    q.setdefault('unit', 'General')
                    q.setdefault('subtopic', 'General')
                    q['correct'] = int(q['correct'])
                    if 0 <= q['correct'] <= 3:
                        valid_questions.append(q)

            if len(valid_questions) < 3:
                return jsonify({'error': 'AI could not generate enough questions from this syllabus. Try providing more detailed content.'}), 422

            return jsonify({
                'success': True,
                'subject': subject_name,
                'units': units,
                'questions': valid_questions,
                'total': len(valid_questions)
            }), 200

        except json.JSONDecodeError:
            return jsonify({'error': 'AI returned invalid response. Please try again.'}), 500
        except Exception as e:
            err_str = str(e)
            if '429' in err_str or 'quota' in err_str.lower():
                return jsonify({'error': 'AI service is temporarily busy. Please wait a moment and try again.'}), 429
            return jsonify({'error': f'Question generation failed. Please try again.'}), 500

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/mock-test/subjects', methods=['GET'])
def get_mock_test_subjects():
    """Get available mock test subjects with metadata"""
    subjects = []
    for name, units in DETAILED_SYLLABUS.items():
        meta = SUBJECT_META.get(name, {})
        subjects.append({
            'name': name,
            'icon': meta.get('icon', 'fa-book'),
            'description': meta.get('desc', f'25 questions on {name}'),
            'units': list(units.keys()),
            'total_subtopics': sum(len(st) for st in units.values())
        })
    return jsonify({'success': True, 'subjects': subjects}), 200


@app.route('/api/mock-test/generate', methods=['POST'])
def generate_mock_test():
    """Generate 25 AI-powered MCQ questions for a subject, tagged by unit/subtopic"""
    try:
        user_id = get_auth_user()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401

        data = request.json
        subject = data.get('subject', '').strip()
        difficulty = data.get('difficulty', 'mixed')

        if subject not in DETAILED_SYLLABUS:
            return jsonify({'error': f'Invalid subject. Valid: {list(DETAILED_SYLLABUS.keys())}'}), 400

        units = DETAILED_SYLLABUS[subject]
        unit_list = []
        for unit_name, subtopics in units.items():
            unit_list.append(f"  {unit_name}: {', '.join(subtopics)}")
        units_text = '\n'.join(unit_list)

        if not GEMINI_API_KEY:
            # Return fallback questions
            return jsonify({
                'success': True,
                'questions': _generate_fallback_questions(subject),
                'subject': subject
            }), 200

        prompt = f"""You are a Computer Science exam question generator.
Generate exactly 25 multiple-choice questions for a B.Tech mock test.

SUBJECT: {subject}
DIFFICULTY: {difficulty}
UNITS AND SUBTOPICS:
{units_text}

IMPORTANT RULES:
- Generate questions spread across ALL units (at least 3 questions per unit)
- Each question must be tagged with its unit and subtopic
- Provide 4 options for each question
- Only ONE correct answer per question
- Vary difficulty across questions

Return ONLY valid JSON in this exact format:
{{
  "questions": [
    {{
      "text": "What is ...?",
      "type": "mcq",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct": 0,
      "unit": "Unit Name",
      "subtopic": "Subtopic Name"
    }}
  ]
}}

The "correct" field is the 0-based index of the correct option (0, 1, 2, or 3).
Generate exactly 25 questions. Return ONLY valid JSON, no markdown."""

        try:
            # Clean response text
            text = generate_gemini_text(prompt).strip()
            if text.startswith('```'):
                text = text.split('\n', 1)[1] if '\n' in text else text[3:]
            if text.endswith('```'):
                text = text[:-3]
            text = text.strip()
            if text.startswith('json'):
                text = text[4:].strip()

            result = json.loads(text)
            # Handle both dict and list responses from Gemini
            if isinstance(result, list):
                questions = result
            else:
                questions = result.get('questions', [])

            # Validate questions
            valid_questions = []
            for q in questions:
                if all(k in q for k in ('text', 'options', 'correct')) and len(q['options']) == 4:
                    q.setdefault('type', 'mcq')
                    q.setdefault('unit', 'General')
                    q.setdefault('subtopic', 'General')
                    q['correct'] = int(q['correct'])
                    if 0 <= q['correct'] <= 3:
                        valid_questions.append(q)

            if len(valid_questions) >= 10:
                return jsonify({'success': True, 'questions': valid_questions, 'subject': subject}), 200
        except Exception:
            pass

        # Fallback if AI failed or response was invalid
        return jsonify({
            'success': True,
            'questions': _generate_fallback_questions(subject),
            'subject': subject
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


def _generate_fallback_questions(subject):
    """Generate fallback questions when Gemini is unavailable"""
    fallback = {
        "Database Systems": [
            {"text": "What does SQL stand for?", "options": ["Structured Query Language", "Simple Query Language", "Standard Query Logic", "System Query Language"], "correct": 0, "unit": "SQL", "subtopic": "DDL (CREATE, ALTER, DROP)"},
            {"text": "Which normal form eliminates partial dependencies?", "options": ["1NF", "2NF", "3NF", "BCNF"], "correct": 1, "unit": "Normalization", "subtopic": "2NF"},
            {"text": "What is a primary key?", "options": ["A foreign reference", "A unique identifier for each row", "An index", "A table name"], "correct": 1, "unit": "Relational Model", "subtopic": "Primary key"},
            {"text": "ACID stands for?", "options": ["Atomicity, Consistency, Isolation, Durability", "Access, Control, Identity, Data", "Atomic, Controlled, Indexed, Distributed", "None of the above"], "correct": 0, "unit": "Transactions", "subtopic": "ACID properties"},
            {"text": "An ER diagram represents?", "options": ["Data flow", "Entity relationships", "Network topology", "File structure"], "correct": 1, "unit": "ER Model", "subtopic": "ER diagrams"},
        ],
        "Data Structures": [
            {"text": "What is the time complexity of binary search?", "options": ["O(n)", "O(log n)", "O(n²)", "O(1)"], "correct": 1, "unit": "Basics", "subtopic": "Time complexity"},
            {"text": "Which data structure uses LIFO?", "options": ["Queue", "Stack", "Array", "Linked List"], "correct": 1, "unit": "Stack", "subtopic": "Implementation"},
            {"text": "A binary tree has at most how many children per node?", "options": ["1", "2", "3", "4"], "correct": 1, "unit": "Trees", "subtopic": "Binary tree"},
            {"text": "BFS uses which data structure?", "options": ["Stack", "Queue", "Heap", "Array"], "correct": 1, "unit": "Graphs", "subtopic": "BFS"},
            {"text": "Hash collision can be resolved by?", "options": ["Chaining", "Deletion", "Sorting", "Recursion"], "correct": 0, "unit": "Hashing", "subtopic": "Collision handling"},
        ],
        "Computer Organization": [
            {"text": "ALU stands for?", "options": ["Arithmetic Logic Unit", "Array Logic Unit", "Advanced Logic Unit", "Analog Logic Unit"], "correct": 0, "unit": "CPU Architecture", "subtopic": "ALU"},
            {"text": "Binary of decimal 10 is?", "options": ["1010", "1001", "1100", "1110"], "correct": 0, "unit": "Number Systems", "subtopic": "Binary"},
            {"text": "Cache memory is?", "options": ["Slowest", "Fastest", "Largest", "Cheapest"], "correct": 1, "unit": "Memory", "subtopic": "Cache"},
            {"text": "DMA stands for?", "options": ["Direct Memory Access", "Data Memory Allocation", "Digital Memory Array", "Dynamic Memory Access"], "correct": 0, "unit": "I/O Systems", "subtopic": "DMA"},
            {"text": "Karnaugh maps simplify?", "options": ["Circuits", "Boolean expressions", "Programs", "Networks"], "correct": 1, "unit": "Digital Logic", "subtopic": "Karnaugh maps"},
        ],
        "Machine Learning": [
            {"text": "Machine Learning is a subset of?", "options": ["Data Science", "Artificial Intelligence", "Cloud Computing", "Networking"], "correct": 1, "unit": "ML Basics", "subtopic": "Definition and types"},
            {"text": "Which type of learning uses labeled data?", "options": ["Unsupervised", "Reinforcement", "Supervised", "Semi-supervised"], "correct": 2, "unit": "Supervised Learning", "subtopic": "Classification"},
            {"text": "K-Means is used for?", "options": ["Regression", "Classification", "Clustering", "Dimensionality Reduction"], "correct": 2, "unit": "Unsupervised Learning", "subtopic": "Clustering"},
            {"text": "Overfitting means?", "options": ["Model performs well on all data", "Model performs well on training but poorly on new data", "Model ignores data", "Model has too few parameters"], "correct": 1, "unit": "Model Evaluation", "subtopic": "Overfitting and underfitting"},
            {"text": "A Neural Network is a type of?", "options": ["Supervised Learning only", "Deep Learning model", "Clustering algorithm", "Data preprocessing"], "correct": 1, "unit": "Deep Learning & Reinforcement", "subtopic": "Neural networks"},
        ]
    }
    questions = fallback.get(subject, fallback["Database Systems"])
    for q in questions:
        q['type'] = 'mcq'
    return questions


@app.route('/api/mock-test/submit', methods=['POST'])
def submit_mock_test():
    """Submit mock test answers, calculate score, categorize user, generate roadmap"""
    try:
        user_id = get_auth_user()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401

        from bson import ObjectId

        data = request.json
        subject = data.get('subject', '').strip()
        answers = data.get('answers', {})
        questions = data.get('questions', [])
        time_taken = data.get('time_taken', 0)

        if not subject:
            return jsonify({'error': 'Invalid subject'}), 400
        if not answers:
            return jsonify({'error': 'No answers submitted'}), 400

        is_custom_subject = subject not in DETAILED_SYLLABUS

        # Score answers and build per-unit breakdown
        correct = 0
        total = len(questions)
        unit_stats = {}
        details = []

        for idx, q in enumerate(questions):
            idx_str = str(idx)
            user_answer = answers.get(idx_str)
            is_correct = user_answer is not None and int(user_answer) == q.get('correct', -1)
            if is_correct:
                correct += 1

            unit = q.get('unit', 'General')
            subtopic = q.get('subtopic', 'General')

            if unit not in unit_stats:
                unit_stats[unit] = {'correct': 0, 'total': 0, 'subtopics_tested': set()}
            unit_stats[unit]['total'] += 1
            if is_correct:
                unit_stats[unit]['correct'] += 1
            unit_stats[unit]['subtopics_tested'].add(subtopic)

            details.append({
                'question': q.get('text', ''),
                'unit': unit,
                'subtopic': subtopic,
                'selected': int(user_answer) if user_answer is not None else -1,
                'correct_answer': q.get('correct', 0),
                'is_correct': is_correct
            })

        # Calculate percentage and student level
        percentage = round((correct / total) * 100, 2) if total > 0 else 0
        student_level = determine_student_level(percentage)

        # Build per-unit breakdown with status
        per_unit_breakdown = []
        for unit_name, stats in unit_stats.items():
            accuracy = round((stats['correct'] / stats['total']) * 100, 1) if stats['total'] > 0 else 0
            if accuracy >= 75:
                status = 'mastered'
            elif accuracy >= 40:
                status = 'needs-work'
            else:
                status = 'weak'
            per_unit_breakdown.append({
                'unit': unit_name,
                'correct': stats['correct'],
                'total': stats['total'],
                'accuracy': accuracy,
                'status': status,
                'subtopics_tested': list(stats['subtopics_tested'])
            })

        per_unit_breakdown.sort(key=lambda x: x['accuracy'])

        # Build roadmap
        roadmap = []
        priority_order = {'weak': 0, 'needs-work': 1, 'untested': 2, 'mastered': 3}

        if is_custom_subject:
            # For uploaded-syllabus tests, build roadmap from question data directly
            for ub in per_unit_breakdown:
                unit_name = ub['unit']
                hours_map = {'weak': 8, 'needs-work': 5, 'mastered': 1}
                hours = hours_map.get(ub['status'], 4)
                subtopic_list = [{'name': st, 'status': ub['status']} for st in ub['subtopics_tested']]
                roadmap.append({
                    'unit': unit_name,
                    'status': ub['status'],
                    'accuracy': ub['accuracy'],
                    'subtopics': subtopic_list,
                    'recommended_hours': hours,
                    'priority': priority_order.get(ub['status'], 2)
                })
        else:
            # For preloaded subjects, use DETAILED_SYLLABUS for full roadmap
            syllabus_units = DETAILED_SYLLABUS.get(subject, {})
            for unit_name, subtopics in syllabus_units.items():
                unit_stat = next((u for u in per_unit_breakdown if u['unit'] == unit_name), None)
                if unit_stat:
                    status = unit_stat['status']
                    accuracy = unit_stat['accuracy']
                    tested_subtopics = set(unit_stat['subtopics_tested'])
                else:
                    status = 'untested'
                    accuracy = 0
                    tested_subtopics = set()

                hours_map = {'weak': 8, 'needs-work': 5, 'untested': 6, 'mastered': 1}
                hours = hours_map.get(status, 4)

                subtopic_list = []
                for st in subtopics:
                    if st in tested_subtopics:
                        st_status = 'mastered' if status == 'mastered' else ('weak' if status == 'weak' else 'needs-work')
                    else:
                        st_status = 'untested'
                    subtopic_list.append({'name': st, 'status': st_status})

                roadmap.append({
                    'unit': unit_name,
                    'status': status,
                    'accuracy': accuracy,
                    'subtopics': subtopic_list,
                    'recommended_hours': hours,
                    'priority': priority_order.get(status, 2)
                })

        roadmap.sort(key=lambda x: x['priority'])

        # Save to database
        test_result = {
            'user_id': ObjectId(user_id),
            'subject': subject,
            'score': correct,
            'total': total,
            'percentage': percentage,
            'student_level': student_level,
            'is_weak': percentage < 60,
            'per_unit_breakdown': per_unit_breakdown,
            'roadmap': roadmap,
            'time_taken': time_taken,
            'details': details,
            'date': datetime.utcnow().isoformat(),
            'created_at': datetime.utcnow()
        }
        result = test_results_collection.insert_one(test_result)

        # Gamification: Award XP for detailed mock test
        ensure_gamification_fields(user_id)
        xp_earned = 30 + (correct * 2)
        award_xp(user_id, xp_earned, f'Detailed test: {subject} ({correct}/{total})')
        update_challenge_progress(user_id, 'mcq_count', total)
        update_mission_progress(user_id, 'mock_tests', 1)

        return jsonify({
            'success': True,
            'result_id': str(result.inserted_id),
            'subject': subject,
            'score': correct,
            'total': total,
            'percentage': percentage,
            'student_level': student_level,
            'per_unit_breakdown': per_unit_breakdown,
            'roadmap': roadmap,
            'time_taken': time_taken,
            'xp_earned': xp_earned,
            'level_info': {
                'Expert': '90-100%',
                'Advanced': '75-89%',
                'Intermediate': '60-74%',
                'Beginner': '40-59%',
                'Critical': 'Below 40%'
            }
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/mock-test/roadmap', methods=['POST'])
def get_mock_test_roadmap():
    """Get AI-enhanced personalized roadmap with study tips"""
    try:
        user_id = get_auth_user()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401

        data = request.json
        subject = data.get('subject', '')
        student_level = data.get('student_level', 'Intermediate')
        per_unit_breakdown = data.get('per_unit_breakdown', [])

        weak_units = [u['unit'] for u in per_unit_breakdown if u.get('status') in ('weak', 'needs-work')]
        mastered_units = [u['unit'] for u in per_unit_breakdown if u.get('status') == 'mastered']

        if not GEMINI_API_KEY or not weak_units:
            return jsonify({
                'success': True,
                'tips': {u: f'Review all subtopics in {u} thoroughly. Practice with examples.' for u in weak_units},
                'study_order': weak_units,
                'motivation': 'Keep practicing! Every attempt makes you stronger.'
            }), 200

        prompt = f"""You are an expert CS study coach. A student just completed a {subject} mock test.

Student Level: {student_level}
Weak Units: {', '.join(weak_units)}
Mastered Units: {', '.join(mastered_units)}

Provide personalized study tips for each weak unit. Return ONLY valid JSON:
{{
  "tips": {{
    "{weak_units[0] if weak_units else 'General'}": "Specific actionable study advice..."
  }},
  "study_order": ["unit1", "unit2"],
  "motivation": "Encouraging message",
  "estimated_days": 14
}}

Be specific, practical. Return ONLY valid JSON, no markdown."""

        try:
            text = generate_gemini_text(prompt).strip()
            if text.startswith('```'):
                text = text.split('\n', 1)[1] if '\n' in text else text[3:]
            if text.endswith('```'):
                text = text[:-3]
            text = text.strip()
            if text.startswith('json'):
                text = text[4:].strip()
            tips_data = json.loads(text)
            return jsonify({'success': True, **tips_data}), 200
        except Exception:
            pass

        return jsonify({
            'success': True,
            'tips': {u: f'Focus on understanding core concepts in {u}. Practice problems daily.' for u in weak_units},
            'study_order': weak_units,
            'motivation': 'You are making progress! Keep going!'
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
            'detailed_syllabus': DETAILED_SYLLABUS,
            'subjects': list(SYLLABUS.keys())
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Health Check
# ==================== NOTES ENDPOINTS ====================

@app.route('/notes', methods=['GET'])
def get_notes():
    """Get all notes for the authenticated user"""
    try:
        user_id = get_auth_user()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401

        from bson import ObjectId
        notes = list(notes_collection.find(
            {'user_id': ObjectId(user_id)}
        ).sort('updated_at', -1))

        for note in notes:
            note['_id'] = str(note['_id'])
            note['user_id'] = str(note['user_id'])

        return jsonify({'notes': notes}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/notes', methods=['POST'])
def create_note():
    """Create a new note"""
    try:
        user_id = get_auth_user()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401

        data = request.json
        title = data.get('title', '').strip()
        content = data.get('content', '').strip()
        subject = data.get('subject', '').strip()
        color = data.get('color', '#6366f1')

        if not title:
            return jsonify({'error': 'Title is required'}), 400

        from bson import ObjectId
        note = {
            'user_id': ObjectId(user_id),
            'title': title,
            'content': content,
            'subject': subject,
            'color': color,
            'pinned': False,
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat()
        }

        result = notes_collection.insert_one(note)
        return jsonify({
            'message': 'Note created successfully',
            'note_id': str(result.inserted_id)
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/notes/upload-pdf', methods=['POST'])
def upload_pdf_note():
    """Upload a PDF file and extract text as a note"""
    try:
        user_id = get_auth_user()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401

        if 'file' not in request.files:
            return jsonify({'error': 'No file uploaded'}), 400

        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        filename = secure_filename(file.filename)
        if not filename.lower().endswith('.pdf'):
            return jsonify({'error': 'Only PDF files are allowed'}), 400

        # Read and extract text from PDF
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(file.read()))
        extracted_text = ''
        for page in pdf_reader.pages:
            page_text = page.extract_text()
            if page_text:
                extracted_text += page_text + '\n\n'

        extracted_text = extracted_text.strip()
        if not extracted_text:
            return jsonify({'error': 'Could not extract text from this PDF. The file may be scanned or image-based.'}), 400

        title = request.form.get('title', '').strip()
        if not title:
            title = filename.replace('.pdf', '').replace('_', ' ').replace('-', ' ')

        subject = request.form.get('subject', '').strip()
        color = request.form.get('color', '#3b82f6')

        from bson import ObjectId
        note = {
            'user_id': ObjectId(user_id),
            'title': title,
            'content': extracted_text,
            'subject': subject,
            'color': color,
            'pinned': False,
            'source': 'pdf',
            'original_filename': filename,
            'page_count': len(pdf_reader.pages),
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat()
        }

        result = notes_collection.insert_one(note)
        return jsonify({
            'message': f'PDF uploaded successfully! Extracted {len(pdf_reader.pages)} pages.',
            'note_id': str(result.inserted_id),
            'page_count': len(pdf_reader.pages),
            'text_length': len(extracted_text)
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/notes/<note_id>', methods=['PUT'])
def update_note(note_id):
    """Update an existing note"""
    try:
        user_id = get_auth_user()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401

        data = request.json
        from bson import ObjectId

        note = notes_collection.find_one({
            '_id': ObjectId(note_id),
            'user_id': ObjectId(user_id)
        })
        if not note:
            return jsonify({'error': 'Note not found'}), 404

        update_fields = {'updated_at': datetime.utcnow().isoformat()}
        if 'title' in data:
            update_fields['title'] = data['title'].strip()
        if 'content' in data:
            update_fields['content'] = data['content'].strip()
        if 'subject' in data:
            update_fields['subject'] = data['subject'].strip()
        if 'color' in data:
            update_fields['color'] = data['color']
        if 'pinned' in data:
            update_fields['pinned'] = bool(data['pinned'])

        notes_collection.update_one(
            {'_id': ObjectId(note_id)},
            {'$set': update_fields}
        )
        return jsonify({'message': 'Note updated successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/notes/<note_id>', methods=['DELETE'])
def delete_note(note_id):
    """Delete a note"""
    try:
        user_id = get_auth_user()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401

        from bson import ObjectId
        result = notes_collection.delete_one({
            '_id': ObjectId(note_id),
            'user_id': ObjectId(user_id)
        })

        if result.deleted_count == 0:
            return jsonify({'error': 'Note not found'}), 404

        return jsonify({'message': 'Note deleted successfully'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ==================== GAMIFICATION ENDPOINTS ====================

@app.route('/gamification/profile', methods=['GET'])
def gamification_profile():
    """Get full gamification profile"""
    try:
        user_id = get_auth_user()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        from bson import ObjectId
        ensure_gamification_fields(user_id)
        user = users_collection.find_one({'_id': ObjectId(user_id)})
        if not user:
            return jsonify({'error': 'User not found'}), 404

        xp = user.get('xp', 0)
        level_info = calculate_level(xp)
        focus_score = calculate_focus_score(user_id)

        # Build badge details
        earned_badges = user.get('badges', [])
        badges = []
        for badge_id, badge_def in BADGE_DEFINITIONS.items():
            badges.append({
                'id': badge_id,
                'name': badge_def['name'],
                'icon': badge_def['icon'],
                'desc': badge_def['desc'],
                'color': badge_def['color'],
                'earned': badge_id in earned_badges
            })

        # Build rewards
        user_level = level_info['level']
        unlocked_rewards = user.get('rewards_unlocked', [])
        rewards = []
        for r in REWARDS:
            rewards.append({
                **r,
                'unlocked': user_level >= r['level'],
                'claimed': r['id'] in unlocked_rewards
            })

        return jsonify({
            'xp': xp,
            'level': level_info['level'],
            'level_name': level_info['level_name'],
            'xp_for_next': level_info['xp_for_next'],
            'progress_pct': level_info['progress_pct'],
            'xp_progress': level_info['xp_progress'],
            'xp_needed': level_info['xp_needed'],
            'streak_count': user.get('streak_count', 0),
            'longest_streak': user.get('longest_streak', 0),
            'focus_score': focus_score,
            'badges': badges,
            'rewards': rewards,
            'total_sessions': user.get('total_sessions', 0),
            'total_study_hours': round(user.get('total_study_hours', 0), 1),
            'name': user.get('name', 'Student')
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/gamification/leaderboard', methods=['GET'])
def gamification_leaderboard():
    """Get top 20 users by XP"""
    try:
        user_id = get_auth_user()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        from bson import ObjectId

        top_users = list(users_collection.find(
            {'xp': {'$exists': True}},
            {'name': 1, 'xp': 1, 'level': 1, 'level_name': 1}
        ).sort('xp', -1).limit(20))

        leaderboard = []
        for i, u in enumerate(top_users):
            leaderboard.append({
                'rank': i + 1,
                'name': u.get('name', 'Student'),
                'xp': u.get('xp', 0),
                'level': u.get('level', 1),
                'level_name': u.get('level_name', 'Beginner Scholar'),
                'is_current_user': str(u['_id']) == user_id
            })

        return jsonify({'leaderboard': leaderboard}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/gamification/daily-challenge', methods=['GET'])
def get_daily_challenge():
    """Get today's daily challenge"""
    try:
        user_id = get_auth_user()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        challenge = get_or_create_daily_challenge(user_id)
        return jsonify({'challenge': challenge}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/gamification/weekly-mission', methods=['GET'])
def get_weekly_mission():
    """Get this week's mission"""
    try:
        user_id = get_auth_user()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        mission = get_or_create_weekly_mission(user_id)
        return jsonify({'mission': mission}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/gamification/activity-log', methods=['GET'])
def gamification_activity_log():
    """Get recent XP activity log"""
    try:
        user_id = get_auth_user()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        from bson import ObjectId

        logs = list(gamification_logs_collection.find(
            {'user_id': ObjectId(user_id)}
        ).sort('timestamp', -1).limit(20))

        activity = []
        for log in logs:
            activity.append({
                'points': log['points'],
                'activity': log['activity'],
                'new_total': log['new_total'],
                'timestamp': log['timestamp'].isoformat()
            })

        return jsonify({'activity': activity}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/gamification/claim-reward', methods=['POST'])
def claim_reward():
    """Claim a level-based reward"""
    try:
        user_id = get_auth_user()
        if not user_id:
            return jsonify({'error': 'Unauthorized'}), 401
        from bson import ObjectId

        data = request.json
        reward_id = data.get('reward_id')
        if not reward_id:
            return jsonify({'error': 'Reward ID required'}), 400

        user = users_collection.find_one({'_id': ObjectId(user_id)})
        if not user:
            return jsonify({'error': 'User not found'}), 404

        reward = next((r for r in REWARDS if r['id'] == reward_id), None)
        if not reward:
            return jsonify({'error': 'Invalid reward'}), 404

        user_level = calculate_level(user.get('xp', 0))['level']
        if user_level < reward['level']:
            return jsonify({'error': f'You need level {reward["level"]} to claim this reward'}), 403

        users_collection.update_one(
            {'_id': ObjectId(user_id)},
            {'$addToSet': {'rewards_unlocked': reward_id}}
        )
        return jsonify({'message': f'Reward "{reward["name"]}" claimed!'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({'status': 'Server is running'}), 200

# Error Handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Endpoint not found'}), 404

@app.errorhandler(500)
def server_error(error):
    return jsonify({'error': 'Internal server error'}), 500

if __name__ == '__main__':
    app.run(debug=True, use_reloader=False)
