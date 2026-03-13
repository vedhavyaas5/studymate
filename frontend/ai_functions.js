// ==================== AI RECOMMENDATIONS & QUIZ FRONTEND ====================
// Add these functions to your frontend/script.js

// ==================== AI RECOMMENDATIONS ====================
async function getAIRecommendations() {
    try {
        showAlert('🤖 Loading AI recommendations...', 'info');
        
        const weakAreas = cachedDashboard?.weak_areas?.map(a => a.subject) || [];
        
        const response = await fetch(`${API_BASE_URL}/ai/recommendations`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': authToken 
            },
            body: JSON.stringify({
                weak_areas: weakAreas,
                study_pattern: 'Evening study sessions'
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            displayAIRecommendations(data.data);
            showAlert('✨ AI Recommendations loaded!', 'success');
        } else {
            showAlert('Error loading recommendations', 'danger');
        }
    } catch (error) {
        showAlert('Error: ' + error.message, 'danger');
    }
}

function displayAIRecommendations(recommendations) {
    const tipsContainer = document.getElementById('tipsPageContainer');
    if (!tipsContainer) return;
    
    let html = `
        <div class="ai-recommendations-container">
            <div class="motivational-banner">
                <h4>${recommendations.motivational_message || 'Keep studying!'}</h4>
            </div>
            
            <div class="recommendations-grid">
    `;
    
    if (recommendations.recommendations) {
        recommendations.recommendations.forEach((rec, i) => {
            html += `
                <div class="rec-card">
                    <div class="rec-emoji">${rec.emoji || '📚'}</div>
                    <div class="rec-category">${rec.category}</div>
                    <p class="rec-tip">${rec.tip}</p>
                </div>
            `;
        });
    }
    
    html += `</div>`;
    
    if (recommendations.study_schedule && recommendations.study_schedule.length > 0) {
        html += `
            <div class="study-schedule-section">
                <h5>📅 Recommended Study Schedule</h5>
                <div class="schedule-grid">
        `;
        
        recommendations.study_schedule.forEach(schedule => {
            const priorityColor = schedule.priority === 'High' ? '#dc2626' : 
                                schedule.priority === 'Medium' ? '#f59e0b' : '#10b981';
            html += `
                <div class="schedule-card" style="border-left: 4px solid ${priorityColor}">
                    <h6>${schedule.subject}</h6>
                    <p><strong>${schedule.recommended_hours_per_week}h/week</strong></p>
                    <p class="priority-badge">${schedule.priority}</p>
                    <p class="reason">${schedule.reason}</p>
                </div>
            `;
        });
        
        html += `</div></div>`;
    }
    
    html += `</div>`;
    tipsContainer.innerHTML = html;
}

// ==================== GAMIFIED QUIZ ====================
async function generateGameQuiz(subject, difficulty) {
    try {
        showAlert('🎮 Generating quest...', 'info');
        
        const response = await fetch(`${API_BASE_URL}/ai/quiz`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': authToken 
            },
            body: JSON.stringify({
                subject: subject,
                difficulty: difficulty
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            displayGameQuiz(data.quiz);
            showAlert('⚔️ Boss encounter initiated!', 'success');
        } else {
            showAlert('Error generating quiz', 'danger');
        }
    } catch (error) {
        showAlert('Error: ' + error.message, 'danger');
    }
}

function displayGameQuiz(quiz) {
    const html = `
        <div class="game-quiz-container">
            <div class="game-header">
                <h2>🌍 ${quiz.world}</h2>
                <h3>⚔️ ${quiz.boss_name}</h3>
                <p class="difficulty-badge">Difficulty: <strong>${quiz.level_difficulty}</strong></p>
            </div>
            
            <div class="game-stats">
                <div class="stat">
                    <span>❤️ HP:</span>
                    <span id="playerHP" class="hp-bar"><strong>${quiz.player_hp}</strong>/100</span>
                </div>
                <div class="stat">
                    <span>⭐ XP:</span>
                    <span id="playerXP"><strong>0</strong></span>
                </div>
                <div class="stat">
                    <span>💰 Total Questions:</span>
                    <span><strong>${quiz.total_questions}</strong></span>
                </div>
            </div>
            
            <div class="game-questions" id="gameQuestionsContainer">
                ${quiz.questions.map((q, i) => `
                    <div class="game-question-card" data-qid="${q.id}">
                        <div class="question-header">
                            <span class="question-num">Q${i + 1}/${quiz.total_questions}</span>
                            <span class="question-points">+${q.points} XP</span>
                        </div>
                        <p class="question-text">${q.question}</p>
                        ${q.type === 'mcq' ? `
                            <div class="game-options">
                                ${q.options.map(opt => `
                                    <label class="game-option">
                                        <input type="radio" name="q${q.id}" value="${opt.charAt(0)}" class="answer-radio">
                                        <span>${opt}</span>
                                    </label>
                                `).join('')}
                            </div>
                        ` : `
                            <textarea class="form-control answer-text" name="q${q.id}" placeholder="Your answer..." rows="2"></textarea>
                        `}
                    </div>
                `).join('')}
            </div>
            
            <button class="btn btn-primary btn-lg game-submit-btn" onclick="submitGameQuiz('${quiz.world}', ${quiz.total_questions}, ${quiz.player_hp})">
                🗡️ Submit Answers & Fight Boss!
            </button>
        </div>
    `;
    
    const responseCard = document.getElementById('aitResponseCard');
    if (responseCard) {
        responseCard.style.display = 'block';
        document.getElementById('aitResponseBody').innerHTML = html;
    }
}

function submitGameQuiz(subject, totalQuestions, initialHP) {
    const answers = {};
    let correctCount = 0;
    let xp = 0;
    let hp = initialHP;
    
    // Collect all answers
    document.querySelectorAll('[data-qid]').forEach(card => {
        const qid = card.getAttribute('data-qid');
        const radio = card.querySelector(`input[name="q${qid}"]:checked`);
        const textarea = card.querySelector(`[name="q${qid}"]`);
        
        answers[qid] = radio ? radio.value : (textarea ? textarea.value : '');
    });
    
    // For demo: Simulate correctness
    Object.keys(answers).forEach((qid, i) => {
        // This is simplified - you would need actual correct answers from the backend
        if (i % 2 === 0) {
            correctCount++;
            xp += 50;
        } else {
            hp -= 20;
        }
    });
    
    if (hp <= 0) hp = 0;
    
    const resultHTML = `
        <div class="game-result-container">
            <h2 class="${hp > 0 ? '✨ Level Cleared!' : '💀 Game Over'}</h2>
            
            <div class="result-stats">
                <div class="result-stat">
                    <span>✓ Correct Answers:</span>
                    <strong>${correctCount}/${totalQuestions}</strong>
                </div>
                <div class="result-stat">
                    <span>⭐ Total XP Earned:</span>
                    <strong>+${xp}</strong>
                </div>
                <div class="result-stat">
                    <span>❤️ Remaining HP:</span>
                    <strong class="${hp > 50 ? 'text-success' : hp > 20 ? 'text-warning' : 'text-danger'}">${hp}/100</strong>
                </div>
                <div class="result-stat">
                    <span>Accuracy:</span>
                    <strong>${Math.round((correctCount/totalQuestions)*100)}%</strong>
                </div>
            </div>
            
            <div class="result-message">
                ${hp > 0 ? `
                    <p>🎉 Excellent! You've defeated the ${subject} Guardian!</p>
                    <button class="btn btn-success" onclick="switchPage('aitutor')">Play Again? 🔄</button>
                ` : `
                    <p>💪 You were defeated! But that's okay - practice makes perfect!</p>
                    <button class="btn btn-warning" onclick="switchPage('recommendations')">Get Study Tips 📚</button>
                `}
            </div>
        </div>
    `;
    
    document.getElementById('aitResponseBody').innerHTML = resultHTML;
}

// ==================== AI TUTOR HELP ====================
async function getAITutorHelp(subject) {
    try {
        const question = document.getElementById('aitCustomSubject')?.value || subject;
        
        const response = await fetch(`${API_BASE_URL}/ai/tutor`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': authToken 
            },
            body: JSON.stringify({
                subject: subject,
                question: question,
                study_level: 'intermediate'
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            displayAITutorHelp(data.data);
            showAlert('💡 Tutor help loaded!', 'success');
        }
    } catch (error) {
        showAlert('Tutor error: ' + error.message, 'danger');
    }
}

function displayAITutorHelp(help) {
    const html = `
        <div class="tutorhelp-container">
            <div class="help-header">
                <h3>📚 ${help.title}</h3>
                <span class="difficulty-badge">${help.difficulty}</span>
            </div>
            
            <div class="tutor-section">
                <h5>💡 Explanation</h5>
                <p>${help.explanation}</p>
            </div>
            
            ${help.key_points && help.key_points.length > 0 ? `
                <div class="tutor-section">
                    <h5>🎯 Key Points</h5>
                    <ul class="key-points-list">
                        ${help.key_points.map(p => `<li>${p}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
            
            ${help.example ? `
                <div class="tutor-section">
                    <h5>📝 Example</h5>
                    <pre><code>${help.example}</code></pre>
                </div>
            ` : ''}
            
            ${help.common_mistakes && help.common_mistakes.length > 0 ? `
                <div class="tutor-section warning">
                    <h5>⚠️ Common Mistakes</h5>
                    <ul>
                        ${help.common_mistakes.map(m => `<li>❌ ${m}</li>`).join('')}
                    </ul>
                </div>
            ` : ''}
            
            <div class="tutor-section">
                <h5>💪 Practice Tip</h5>
                <p>${help.practice_tip}</p>
            </div>
        </div>
    `;
    
    const responseCard = document.getElementById('aitResponseCard');
    if (responseCard) {
        responseCard.style.display = 'block';
        document.getElementById('aitResponseBody').innerHTML = html;
    }
}

// Subject picker for quick topics
async function getAITutorTopic(topic) {
    const topicMap = {
        'stress': 'Handle Exam Stress',
        'focus': 'Improve Focus and Concentration',
        'motivation': 'Stay Motivated',
        'memory': 'Boost Memory and Retention',
        'timemanagement': 'Time Management Tips',
        'anxiety': 'Reduce Anxiety'
    };
    
    await getAITutorHelp(topicMap[topic] || topic);
}
