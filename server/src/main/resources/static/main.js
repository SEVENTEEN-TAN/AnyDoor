// AnyDoor 官网主要交互脚本

// ============== 组件加载函数 ==============
async function loadComponent(id, url) {
    const placeholder = document.getElementById(id);
    if (!placeholder) return;
    try {
        const res = await fetch(url);
        if (res.ok) {
            placeholder.innerHTML = await res.text();
        }
    } catch (e) {
        console.error(`Failed to load component ${url}:`, e);
    }
}

async function loadAllComponents() {
    await Promise.all([
        loadComponent('header-placeholder', 'components/header.html'),
        loadComponent('footer-placeholder', 'components/footer.html'),
        loadComponent('modal-placeholder', 'components/register_modal.html')
    ]);
}

// ============== 主 UI 初始化函数 ==============
function initUI() {
    // 导航栏滚动效果
    const navbar = document.getElementById('navbar');
    if (navbar) {
        window.addEventListener('scroll', () => {
            const currentScroll = window.pageYOffset;
            if (currentScroll > 50) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        });
    }

    // 移动端导航菜单
    const navToggle = document.getElementById('navToggle');
    const navLinks = document.querySelector('.nav-links');

    if (navToggle && navLinks) {
        navToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            const active = navToggle.classList.toggle('active');
            navToggle.setAttribute('aria-expanded', active ? 'true' : 'false');
        });

        document.querySelectorAll('.nav-links a').forEach(link => {
            link.addEventListener('click', () => {
                if (navLinks.classList.contains('active')) {
                    navLinks.classList.remove('active');
                    navToggle.classList.remove('active');
                    navToggle.setAttribute('aria-expanded', 'false');
                }
            });
        });
    }

    // 高亮当前导航
    highlightCurrentNav();

    // 粒子背景
    initParticles();

    // 懒加载
    initLazyLoad();

    // 注册模态框
    initRegisterModal();

    // 功能卡片鼠标跟踪
    initFeatureCards();

    // 3D 倾斜效果
    initTiltEffect();
}


// ============== 鼠标跟踪光标效果 ==============
function initFeatureCards() {
    const featureCards = document.querySelectorAll('.feature-card');
    featureCards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            card.style.setProperty('--mouse-x', `${x}px`);
            card.style.setProperty('--mouse-y', `${y}px`);
        });
    });
}

// ============== 3D 倾斜效果 ==============
function initTiltEffect() {
    const tiltElements = document.querySelectorAll('[data-tilt]');
    tiltElements.forEach(element => {
        element.addEventListener('mousemove', handleTilt);
        element.addEventListener('mouseleave', resetTilt);
    });
}

function handleTilt(e) {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = (y - centerY) / 10;
    const rotateY = (centerX - x) / 10;

    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
}

function resetTilt(e) {
    const card = e.currentTarget;
    card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) scale3d(1, 1, 1)';
}

function highlightCurrentNav() {
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-links .nav-link');

    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        // Simple check: if current path ends with the href (e.g. index.html)
        if (href && href !== '#' && currentPath.endsWith(href)) {
            link.classList.add('active');
        }
    });
}

function initParticles() {
    const canvas = document.getElementById('particles-canvas');
    if (!canvas) return;

    // Check if already initialized to avoid multiple contexts if called repeatedly
    if (canvas.dataset.initialized) return;
    canvas.dataset.initialized = 'true';

    const ctx = canvas.getContext('2d');
    let particles = [];
    const particleCount = 100;
    const connectionDistance = 150;

    const resizeCanvas = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        // Reinitialize particles on resize to distribute them correctly
        initParticlesArray();
    };

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas(); // Initial resize

    function initParticlesArray() {
        particles = [];
        for (let i = 0; i < particleCount; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                radius: Math.random() * 2 + 1
            });
        }
    }
    initParticlesArray(); // Initial particle setup

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        particles.forEach((particle, i) => {
            // Update position
            particle.x += particle.vx;
            particle.y += particle.vy;

            // Boundary bounce
            if (particle.x < 0 || particle.x > canvas.width) particle.vx *= -1;
            if (particle.y < 0 || particle.y > canvas.height) particle.vy *= -1;

            // Draw particle
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(59, 130, 246, 0.5)';
            ctx.fill();

            // Connection lines
            for (let j = i + 1; j < particles.length; j++) {
                const other = particles[j];
                const dx = particle.x - other.x;
                const dy = particle.y - other.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < connectionDistance) {
                    ctx.beginPath();
                    ctx.moveTo(particle.x, particle.y);
                    ctx.lineTo(other.x, other.y);
                    ctx.strokeStyle = `rgba(59, 130, 246, ${0.2 * (1 - distance / connectionDistance)})`;
                    ctx.stroke();
                }
            }
        });

        requestAnimationFrame(animate);
    }

    animate();
}

function initLazyLoad() {
    const lazyImages = document.querySelectorAll('img[data-src]');
    if (lazyImages.length === 0) return;

    const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.classList.add('loaded');
                imageObserver.unobserve(img);
            }
        });
    });

    lazyImages.forEach(img => imageObserver.observe(img));
}

function initRegisterModal() {
    const registerBtn = document.getElementById('registerBtn');
    const registerModal = document.getElementById('registerModal');
    const closeModal = document.getElementById('closeModal');
    const registerForm = document.getElementById('registerForm');

    if (!registerModal) return;

    let currentCaptchaUuid = '';

    const loadCaptcha = async () => {
        try {
            const img = document.getElementById('captchaImage');
            if (!img) return;

            img.style.opacity = '0.5';

            const res = await fetch('/api/auth/captcha');
            if (res.ok) {
                const data = await res.json();
                if (data.uuid && data.imageBase64) {
                    currentCaptchaUuid = data.uuid;
                    img.src = 'data:image/jpeg;base64,' + data.imageBase64;
                }
            }
        } catch (e) {
            console.error('Failed to load captcha', e);
        } finally {
            const img = document.getElementById('captchaImage');
            if (img) img.style.opacity = '1';
        }
    };

    // Open Modal logic
    if (registerBtn) {
        // Clone to remove old listeners
        const newRegisterBtn = registerBtn.cloneNode(true);
        registerBtn.parentNode.replaceChild(newRegisterBtn, registerBtn);

        newRegisterBtn.addEventListener('click', (e) => {
            e.preventDefault();
            registerModal.classList.add('active');
            document.body.style.overflow = 'hidden';
            loadCaptcha();
        });
    }

    // Refresh Captcha
    const captchaImage = document.getElementById('captchaImage');
    if (captchaImage) {
        // Avoid duplicate listeners by checking property or just adding (it's fine if idempotent or replaced)
        captchaImage.onclick = loadCaptcha;
    }

    // Close Modal
    const closeModalFunc = () => {
        registerModal.classList.remove('active');
        document.body.style.overflow = '';
        if (registerForm) registerForm.reset();
        currentCaptchaUuid = '';
    };

    if (closeModal) {
        closeModal.onclick = closeModalFunc;
    }

    registerModal.onclick = (e) => {
        if (e.target === registerModal) {
            closeModalFunc();
        }
    };

    // Submit
    if (registerForm) {
        registerForm.onsubmit = async (e) => {
            e.preventDefault();
            const submitBtn = registerForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.textContent = '注册中...';

            const username = document.getElementById('username').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const captchaCode = document.getElementById('captcha').value;

            try {
                const response = await fetch('/api/auth/register-main', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username,
                        password,
                        email,
                        captchaUuid: currentCaptchaUuid,
                        captchaCode: captchaCode
                    })
                });

                const data = await response.json();

                if (response.ok && data.ok) {
                    alert('注册成功！请使用新账号登录。');
                    closeModalFunc();
                } else {
                    alert('注册失败: ' + (data.error || data.message || '未知错误'));
                    loadCaptcha();
                    document.getElementById('captcha').value = '';
                }
            } catch (error) {
                console.error('Registration failed:', error);
                alert('注册请求失败，请稍后重试。');
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        };
    }

    // Auto-open modal if hash is #register
    if (window.location.hash === '#register') {
        registerModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        loadCaptcha();
    }
}

// ============== 数字递增动画 ==============
function animateNumber(element, target, duration = 2000) {
    const start = 0;
    const increment = target / (duration / 16);
    let current = start;

    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            element.textContent = formatNumber(target);
            clearInterval(timer);
        } else {
            element.textContent = formatNumber(Math.floor(current));
        }
    }, 16);
}

function formatNumber(num) {
    if (num >= 10000) {
        return (num / 1000).toFixed(1) + 'k+';
    }
    return num.toString();
}

// ============== 防抖函数 ==============
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ============== 节流函数 ==============
function throttle(func, limit) {
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// 启动入口
document.addEventListener('DOMContentLoaded', async () => {
    await loadAllComponents();
    initUI();
});

// ============== 导出到全局 ==============
window.AnyDoor = {
    animateNumber,
    debounce,
    throttle,
    initUI // Export for debugging
};

console.log('%c🚪 AnyDoor Website', 'color: #3b82f6; font-size: 20px; font-weight: bold;');
