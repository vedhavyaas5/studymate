/* ==================== DOM ELEMENTS ==================== */
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const loginFormElement = document.getElementById('loginFormElement');
const registerFormElement = document.getElementById('registerFormElement');

// API_BASE_URL is defined in script.js (loaded first)

/* ==================== INITIALIZATION ==================== */
document.addEventListener('DOMContentLoaded', () => {
    initializePasswordToggle();
    initializeFormSubmission();
    initializePasswordStrength();
    initializeFormValidation();
});

/* ==================== PASSWORD TOGGLE ==================== */
function initializePasswordToggle() {
    const toggleButtons = document.querySelectorAll('.toggle-password');
    
    toggleButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            e.preventDefault();
            const input = button.previousElementSibling || button.parentElement.querySelector('input[type="password"], input[type="text"]');
            
            if (input) {
                if (input.type === 'password') {
                    input.type = 'text';
                    button.innerHTML = '<i class="fas fa-eye-slash"></i>';
                } else {
                    input.type = 'password';
                    button.innerHTML = '<i class="fas fa-eye"></i>';
                }
            }
        });
    });
}

/* ==================== PASSWORD STRENGTH ==================== */
function initializePasswordStrength() {
    const passwordInput = document.getElementById('registerPassword');
    
    if (passwordInput) {
        passwordInput.addEventListener('input', (e) => {
            updatePasswordStrength(e.target.value);
        });
    }
}

function updatePasswordStrength(password) {
    const strengthFill = document.querySelector('.strength-fill');
    const strengthLabel = document.getElementById('strengthLabel');
    
    if (!strengthFill) return;
    
    let strength = 0;
    
    if (password.length >= 6) strength++;
    if (password.length >= 10) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;
    
    const percentage = (strength / 6) * 100;
    strengthFill.style.width = percentage + '%';
    
    let label = 'Weak';
    let color = '#EF4444';
    
    if (strength >= 5) {
        label = 'Strong';
        color = '#10B981';
    } else if (strength >= 4) {
        label = 'Good';
        color = '#3B82F6';
    } else if (strength >= 3) {
        label = 'Fair';
        color = '#F59E0B';
    }
    
    strengthLabel.textContent = label;
    strengthLabel.parentElement.style.color = color;
    strengthFill.style.background = color;
}

/* ==================== FORM VALIDATION ==================== */
function initializeFormValidation() {
    const inputs = document.querySelectorAll('input');
    
    inputs.forEach(input => {
        input.addEventListener('blur', () => {
            validateInput(input);
        });
        
        input.addEventListener('input', () => {
            if (input.parentElement.classList.contains('form-group')) {
                input.parentElement.classList.remove('error');
            }
        });
    });
}

function validateInput(input) {
    const formGroup = input.parentElement;
    let isValid = true;
    let errorMessage = '';
    
    if (input.hasAttribute('required') && !input.value.trim()) {
        isValid = false;
        errorMessage = 'This field is required';
    } else if (input.type === 'email') {
        isValid = validateEmail(input.value);
        errorMessage = 'Please enter a valid email';
    } else if (input.id === 'registerPassword') {
        isValid = input.value.length >= 6;
        errorMessage = 'Password must be at least 6 characters';
    } else if (input.id === 'confirmPassword') {
        const passwordInput = document.getElementById('registerPassword');
        isValid = input.value === passwordInput.value;
        errorMessage = 'Passwords do not match';
    } else if (input.id === 'phone') {
        if (input.value) {
            isValid = validatePhone(input.value);
            errorMessage = 'Please enter a valid phone number';
        }
    }
    
    if (!isValid) {
        formGroup.classList.add('error');
        let errorEl = formGroup.querySelector('.error-message');
        if (!errorEl) {
            errorEl = document.createElement('div');
            errorEl.className = 'error-message';
            formGroup.appendChild(errorEl);
        }
        errorEl.textContent = errorMessage;
    } else {
        formGroup.classList.remove('error');
        formGroup.classList.add('success');
    }
    
    return isValid;
}

/* ==================== EMAIL VALIDATION ==================== */
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

/* ==================== PHONE VALIDATION ==================== */
function validatePhone(phone) {
    const re = /^(\+\d{1,3}[- ]?)?\d{10,}$/;
    return re.test(phone.replace(/\s/g, ''));
}

/* ==================== FORM SUBMISSION ==================== */
function initializeFormSubmission() {
    if (loginFormElement) {
        loginFormElement.addEventListener('submit', handleLoginSubmit);
    }
    
    if (registerFormElement) {
        registerFormElement.addEventListener('submit', handleRegisterSubmit);
    }
}

/* ==================== LOGIN HANDLER ==================== */
async function handleLoginSubmit(e) {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    // Validate inputs
    let isValid = true;
    const inputs = loginFormElement.querySelectorAll('input[required]');
    inputs.forEach(input => {
        if (!validateInput(input)) {
            isValid = false;
        }
    });
    
    if (!isValid) return;
    
    const submitButton = loginFormElement.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = 'Signing in...';
    
    try {
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email: email,
                password: password
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Store token
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            
            // Show success message
            showAlert('Login successful! Redirecting...', 'success');
            
            // Redirect to dashboard after a short delay
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1500);
        } else {
            showAlert(data.message || 'Login failed. Please try again.', 'error');
            submitButton.disabled = false;
            submitButton.textContent = originalText;
        }
    } catch (error) {
        console.error('Login error:', error);
        showAlert('An error occurred. Please try again.', 'error');
        submitButton.disabled = false;
        submitButton.textContent = originalText;
    }
}

/* ==================== REGISTER HANDLER ==================== */
async function handleRegisterSubmit(e) {
    e.preventDefault();
    
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    
    // Validate all inputs
    let isValid = true;
    const inputs = registerFormElement.querySelectorAll('input[required]');
    inputs.forEach(input => {
        if (!validateInput(input)) {
            isValid = false;
        }
    });
    

    
    if (!isValid) return;
    
    const submitButton = registerFormElement.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    submitButton.disabled = true;
    submitButton.textContent = 'Creating account...';
    
    try {
        const response = await fetch(`${API_BASE_URL}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: name,
                email: email,
                password: password
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Store token if provided
            if (data.token) {
                localStorage.setItem('token', data.token);
            }
            localStorage.setItem('user', JSON.stringify(data.user));
            
            showAlert('Account created successfully! Redirecting...', 'success');
            
            setTimeout(() => {
                window.location.href = './index.html';
            }, 1500);
        } else {
            showAlert(data.message || 'Registration failed. Please try again.', 'error');
            submitButton.disabled = false;
            submitButton.textContent = originalText;
        }
    } catch (error) {
        console.error('Registration error:', error);
        showAlert('An error occurred. Please try again.', 'error');
        submitButton.disabled = false;
        submitButton.textContent = originalText;
    }
}

/* ==================== NOTIFICATION ==================== */
function showNotification(message, type = 'info') {
    // Remove existing notification
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create notification
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div style="position: fixed; top: 20px; right: 20px; z-index: 10000; padding: 16px 24px; border-radius: 8px; background: ${getNotificationColor(type)}; color: white; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); display: flex; align-items: center; gap: 12px; animation: slideInRight 0.3s ease;">
            <i class="fas fa-${getNotificationIcon(type)}"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    
    // Add animation styles if not present
    if (!document.querySelector('style[data-notification]')) {
        const style = document.createElement('style');
        style.setAttribute('data-notification', 'true');
        style.innerHTML = `
            @keyframes slideInRight {
                from {
                    opacity: 0;
                    transform: translateX(100px);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }
            @keyframes slideOutRight {
                from {
                    opacity: 1;
                    transform: translateX(0);
                }
                to {
                    opacity: 0;
                    transform: translateX(100px);
                }
            }
            .notification {
                animation: slideOutRight 0.3s ease 3s backwards;
            }
        `;
        document.head.appendChild(style);
    }
    
    // Remove after 3.3 seconds
    setTimeout(() => {
        notification.remove();
    }, 3300);
}

function getNotificationColor(type) {
    const colors = {
        'success': '#10B981',
        'error': '#EF4444',
        'warning': '#F59E0B',
        'info': '#3B82F6'
    };
    return colors[type] || colors['info'];
}

function getNotificationIcon(type) {
    const icons = {
        'success': 'check-circle',
        'error': 'exclamation-circle',
        'warning': 'exclamation-triangle',
        'info': 'info-circle'
    };
    return icons[type] || icons['info'];
}

/* ==================== SOCIAL LOGIN ==================== */
document.querySelectorAll('.btn-social').forEach(button => {
    button.addEventListener('click', () => {
        const provider = button.querySelector('i').className;
        
        if (provider.includes('google')) {
            redirectToNewTab('https://accounts.google.com/o/oauth2/v2/auth');
        } else if (provider.includes('github')) {
            redirectToNewTab('https://github.com/login');
        }
    });
});

function redirectToNewTab(url) {
    showAlert('Social login coming soon!', 'info');
}

/* ==================== REMEMBER ME ==================== */
document.addEventListener('DOMContentLoaded', () => {
    const rememberMeCheckbox = document.getElementById('rememberMe');
    const emailInput = document.getElementById('email');
    
    if (rememberMeCheckbox && emailInput) {
        // Load saved email
        const savedEmail = localStorage.getItem('rememberedEmail');
        if (savedEmail) {
            emailInput.value = savedEmail;
            rememberMeCheckbox.checked = true;
        }
        
        // Save email on login form submit or checkbox change
        rememberMeCheckbox.addEventListener('change', () => {
            if (rememberMeCheckbox.checked) {
                localStorage.setItem('rememberedEmail', emailInput.value);
            } else {
                localStorage.removeItem('rememberedEmail');
            }
        });
        
        emailInput.addEventListener('change', () => {
            if (rememberMeCheckbox.checked) {
                localStorage.setItem('rememberedEmail', emailInput.value);
            }
        });
    }
});

/* ==================== ACCESSIBILITY ==================== */
// Add keyboard navigation
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        if (loginFormElement && document.activeElement.form === loginFormElement) {
            loginFormElement.dispatchEvent(new Event('submit'));
        }
        if (registerFormElement && document.activeElement.form === registerFormElement) {
            registerFormElement.dispatchEvent(new Event('submit'));
        }
    }
});

/* ==================== PERFORMANCE ==================== */
// Auto-submit check
function checkAuthStatus() {
    const token = localStorage.getItem('token');
    if (token && window.location.pathname.includes('login')) {
        window.location.href = '/app';
    }
}

document.addEventListener('DOMContentLoaded', checkAuthStatus);

console.log('StudyMate Authentication Loaded Successfully');
