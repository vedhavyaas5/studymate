/* ==================== DOM ELEMENTS ==================== */
const hamburger = document.getElementById('hamburger');
const navbarMenu = document.getElementById('navbarMenu');
const navLinks = document.querySelectorAll('.nav-links a');
const btnLogin = document.querySelector('.btn-login');
const btnRegister = document.querySelector('.btn-register');

/* ==================== DEBUG LOGGING ==================== */
console.log('✅ StudyMate Homepage JS Loaded');
console.log('CSS Status:', document.styleSheets.length > 0 ? 'Loaded' : 'Missing');
console.log('DOM Ready:', document.readyState);

/* ==================== INITIALIZATION ==================== */
document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ DOM Content Loaded');
    initializeNavigation();
    initializeAnimations();
    initializeButtons();
    initializeScrollBehavior();
    console.log('✅ All features initialized');
});

/* ==================== NAVIGATION ==================== */
function initializeNavigation() {
    if (hamburger) {
        hamburger.addEventListener('click', toggleMenu);
    }

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            closeMenu();
            // Smooth scroll is handled by CSS scroll-behavior
        });
    });
}

function toggleMenu() {
    navbarMenu.classList.toggle('active');
    hamburger.classList.toggle('active');
}

function closeMenu() {
    navbarMenu.classList.remove('active');
    hamburger.classList.remove('active');
}

/* ==================== BUTTON INTERACTIONS ==================== */
function initializeButtons() {
    if (btnLogin) {
        btnLogin.addEventListener('click', () => {
            console.log('🔗 Login button clicked - navigating to index.html');
            window.location.href = './index.html';
        });
    }

    if (btnRegister) {
        btnRegister.addEventListener('click', () => {
            console.log('🔗 Register button clicked - navigating to index.html');
            window.location.href = './index.html';
        });
    }

    // Get Started Button
    const getStartedBtn = document.querySelector('.hero-buttons .btn-primary');
    if (getStartedBtn) {
        getStartedBtn.addEventListener('click', () => {
            console.log('🔗 Get Started button clicked - navigating to index.html');
            window.location.href = './index.html';
        });
    }

    // Demo Button
    const demoBtn = document.querySelector('.hero-buttons .btn-secondary');
    if (demoBtn) {
        demoBtn.addEventListener('click', () => {
            console.log('📜 Demo button clicked - scrolling to features');
            scrollToSection('features');
        });
    }

    // CTA Button
    const ctaBtn = document.querySelector('.btn-cta');
    if (ctaBtn) {
        ctaBtn.addEventListener('click', () => {
            console.log('🔗 CTA button clicked - navigating to index.html');
            window.location.href = './index.html';
        });
    }
    console.log('✅ All buttons initialized');
}

/* ==================== SCROLL BEHAVIOR ==================== */
function scrollToSection(sectionId) {
    const element = document.getElementById(sectionId);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
    }
}

function initializeScrollBehavior() {
    const navbar = document.querySelector('.navbar');
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.1)';
        } else {
            navbar.style.boxShadow = 'none';
        }
    });
}

/* ==================== ANIMATIONS ==================== */
function initializeAnimations() {
    // Intersection Observer for fade-in animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.animation = 'fadeInUp 0.8s ease forwards';
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observe all feature cards
    document.querySelectorAll('.feature-card').forEach(card => {
        observer.observe(card);
    });

    // Observe all step cards
    document.querySelectorAll('.step-card').forEach(card => {
        observer.observe(card);
    });

    // Observe analytics cards
    document.querySelectorAll('.analytics-card').forEach(card => {
        observer.observe(card);
    });

    // Observe recommendation cards
    document.querySelectorAll('.recommendation-card').forEach(card => {
        observer.observe(card);
    });

    // Observe benefit items
    document.querySelectorAll('.benefit-item').forEach(item => {
        observer.observe(item);
    });
}

/* ==================== HOVER EFFECTS ==================== */
document.addEventListener('DOMContentLoaded', () => {
    // Card hover lift effect
    const cards = document.querySelectorAll('.feature-card, .step-card, .analytics-card, .recommendation-card');
    
    cards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-8px)';
        });
        
        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });
    });

    // Button ripple effect
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
        button.addEventListener('click', function(event) {
            createRipple(event, this);
        });
    });
});

function createRipple(event, button) {
    const ripple = document.createElement('span');
    const rect = button.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;

    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = x + 'px';
    ripple.style.top = y + 'px';
    ripple.classList.add('ripple');

    // Add ripple CSS if not already present
    if (!document.querySelector('style[data-ripple]')) {
        const style = document.createElement('style');
        style.setAttribute('data-ripple', 'true');
        style.innerHTML = `
            button {
                position: relative;
                overflow: hidden;
            }
            .ripple {
                position: absolute;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.6);
                transform: scale(0);
                animation: ripple-animation 0.6s ease-out;
                pointer-events: none;
            }
            @keyframes ripple-animation {
                to {
                    transform: scale(4);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }

    button.appendChild(ripple);
    setTimeout(() => ripple.remove(), 600);
}

/* ==================== FORM VALIDATION (for future use) ==================== */
function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

function validatePassword(password) {
    return password.length >= 6;
}

/* ==================== SMOOTH SCROLL PADDING ==================== */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

/* ==================== PERFORMANCE OPTIMIZATION ==================== */
// Lazy load images if needed
if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                if (img.dataset.src) {
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                    imageObserver.unobserve(img);
                }
            }
        });
    });

    document.querySelectorAll('img[data-src]').forEach(img => {
        imageObserver.observe(img);
    });
}

/* ==================== RESPONSIVE MENU ==================== */
window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
        closeMenu();
    }
});

/* ==================== ACCESSIBILITY ==================== */
// Add keyboard navigation
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeMenu();
    }
});

/* ==================== PARALLAX EFFECT (optional) ==================== */
function addParallaxEffect() {
    const parallaxElements = document.querySelectorAll('[data-parallax]');
    
    window.addEventListener('scroll', () => {
        parallaxElements.forEach(element => {
            const scrollPosition = window.pageYOffset;
            const speed = element.dataset.parallax || 0.5;
            element.style.transform = `translateY(${scrollPosition * speed}px)`;
        });
    });
}

// Call parallax if you have parallax elements
if (document.querySelectorAll('[data-parallax]').length > 0) {
    addParallaxEffect();
}

/* ==================== COUNTER ANIMATION ==================== */
function animateCounters() {
    const counters = document.querySelectorAll('.stat-number');
    
    const counterObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const counter = entry.target;
                const value = parseInt(counter.textContent);
                let current = 0;
                const increment = value / 30;
                
                const timer = setInterval(() => {
                    current += increment;
                    if (current >= value) {
                        counter.textContent = value;
                        clearInterval(timer);
                    } else {
                        counter.textContent = Math.floor(current);
                    }
                }, 30);
                
                counterObserver.unobserve(counter);
            }
        });
    }, { threshold: 0.5 });

    counters.forEach(counter => {
        counterObserver.observe(counter);
    });
}

document.addEventListener('DOMContentLoaded', animateCounters);

/* ==================== KEYBOARD SHORTCUTS ==================== */
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + K for quick search (future feature)
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        // Open search modal
    }
});

/* ==================== CONSENT BANNER (optional) ==================== */
function showConsentBanner() {
    const banner = document.createElement('div');
    banner.innerHTML = `
        <div style="position: fixed; bottom: 0; left: 0; right: 0; background: rgba(17, 24, 39, 0.95); color: white; padding: 20px; text-align: center; z-index: 9999; font-size: 14px;">
            This website uses cookies to enhance your experience. By using StudyMate, you consent to our use of cookies.
            <button style="margin-left: 20px; padding: 8px 16px; background: #7C3AED; color: white; border: none; border-radius: 8px; cursor: pointer;">Accept</button>
        </div>
    `;
    
    // Only show once per session
    if (!sessionStorage.getItem('consentShown')) {
        document.body.appendChild(banner);
        banner.querySelector('button').addEventListener('click', () => {
            banner.remove();
            sessionStorage.setItem('consentShown', 'true');
        });
    }
}

// Uncomment to enable consent banner
// document.addEventListener('DOMContentLoaded', showConsentBanner);

console.log('StudyMate Homepage Loaded Successfully');
