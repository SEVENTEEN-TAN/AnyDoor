// AnyDoor 官网主要交互脚本

// ============== 导航栏滚动效果 ==============
const navbar = document.getElementById('navbar');
let lastScroll = 0;

window.addEventListener('scroll', () => {
    const currentScroll = window.pageYOffset;

    // 添加滚动类
    if (currentScroll > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }

    lastScroll = currentScroll;
});

// ============== 移动端导航菜单 ==============
const navToggle = document.getElementById('navToggle');
const navLinks = document.querySelector('.nav-links');

if (navToggle) {
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

// ============== 粒子背景效果 ==============
class ParticlesBackground {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;

        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.particleCount = 100;
        this.connectionDistance = 150;

        this.resize();
        this.init();
        this.animate();

        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    init() {
        this.particles = [];
        for (let i = 0; i < this.particleCount; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                radius: Math.random() * 2 + 1
            });
        }
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 更新和绘制粒子
        this.particles.forEach((particle, i) => {
            // 更新位置
            particle.x += particle.vx;
            particle.y += particle.vy;

            // 边界反弹
            if (particle.x < 0 || particle.x > this.canvas.width) particle.vx *= -1;
            if (particle.y < 0 || particle.y > this.canvas.height) particle.vy *= -1;

            // 绘制粒子
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
            this.ctx.fillStyle = 'rgba(59, 130, 246, 0.5)';
            this.ctx.fill();

            // 连接线
            for (let j = i + 1; j < this.particles.length; j++) {
                const other = this.particles[j];
                const dx = particle.x - other.x;
                const dy = particle.y - other.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < this.connectionDistance) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(particle.x, particle.y);
                    this.ctx.lineTo(other.x, other.y);
                    this.ctx.strokeStyle = `rgba(59, 130, 246, ${0.2 * (1 - distance / this.connectionDistance)})`;
                    this.ctx.stroke();
                }
            }
        });

        requestAnimationFrame(() => this.animate());
    }
}

// 初始化粒子背景
if (document.getElementById('particles-canvas')) {
    new ParticlesBackground('particles-canvas');
}

// ============== 鼠标跟踪光标效果 ==============
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

// ============== 3D 倾斜效果 ==============
const tiltElements = document.querySelectorAll('[data-tilt]');

tiltElements.forEach(element => {
    element.addEventListener('mousemove', handleTilt);
    element.addEventListener('mouseleave', resetTilt);
});

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

// ============== 平滑滚动到锚点 ==============
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (href === '#') return;

        e.preventDefault();
        const target = document.querySelector(href);

        if (target) {
            const offsetTop = target.offsetTop - 70;
            window.scrollTo({
                top: offsetTop,
                behavior: 'smooth'
            });
        }
    });
});

// ============== 滚动动画 Observer ==============
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, observerOptions);

// 观察所有需要动画的元素
document.querySelectorAll('.fade-in, .feature-card, .step-item').forEach(el => {
    observer.observe(el);
});

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

// 当统计数字进入视口时触发动画
const statsObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const statNumbers = entry.target.querySelectorAll('.stat-number');
            statNumbers.forEach((stat, index) => {
                const text = stat.textContent.trim();
                let target = 10000;

                if (text.includes('%')) {
                    target = 99.9;
                    setTimeout(() => {
                        stat.textContent = '99.9%';
                    }, 2000);
                } else if (text.includes('ms')) {
                    target = 50;
                    setTimeout(() => {
                        stat.textContent = '50ms';
                    }, 2000);
                } else {
                    animateNumber(stat, target);
                }
            });
            statsObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.5 });

const heroStats = document.querySelector('.hero-stats');
if (heroStats) {
    statsObserver.observe(heroStats);
}

// ============== 平滑显示初始动画 ==============
window.addEventListener('load', () => {
    document.body.classList.add('loaded');

    // 触发 fade-in 动画
    setTimeout(() => {
        document.querySelectorAll('.fade-in').forEach((el, index) => {
            setTimeout(() => {
                el.style.opacity = '1';
                el.style.transform = 'translateY(0)';
            }, index * 100);
        });
    }, 100);
});

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

// ============== 性能优化：懒加载图片 ==============
const lazyImages = document.querySelectorAll('img[data-src]');
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

// ============== 导出到全局 ==============
window.AnyDoor = {
    animateNumber,
    debounce,
    throttle
};

console.log('%c🚪 AnyDoor Website', 'color: #3b82f6; font-size: 20px; font-weight: bold;');
console.log('%c欢迎访问 AnyDoor 官网！', 'color: #10b981; font-size: 14px;');

// ============== 注册模态框逻辑 ==============
const registerBtn = document.getElementById('registerBtn');
const registerModal = document.getElementById('registerModal');
const closeModal = document.getElementById('closeModal');
const registerForm = document.getElementById('registerForm');

if (registerBtn && registerModal) {
    let currentCaptchaUuid = '';

    const loadCaptcha = async () => {
        try {
            const img = document.getElementById('captchaImage');
            if (!img) return;

            // Add loading state
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

    // Open Modal
    registerBtn.addEventListener('click', (e) => {
        e.preventDefault();
        registerModal.classList.add('active');
        document.body.style.overflow = 'hidden';
        loadCaptcha(); // Load captcha when opening
    });

    // Refresh Captcha on click
    const captchaImage = document.getElementById('captchaImage');
    if (captchaImage) {
        captchaImage.addEventListener('click', loadCaptcha);
    }

    // Close Modal
    if (closeModal) {
        closeModal.addEventListener('click', closeModalFunc);
    }

    registerModal.addEventListener('click', (e) => {
        if (e.target === registerModal) {
            closeModalFunc();
        }
    });

    function closeModalFunc() {
        registerModal.classList.remove('active');
        document.body.style.overflow = '';
        registerForm.reset();
        currentCaptchaUuid = '';
    }

    // Submit
    registerForm.addEventListener('submit', async (e) => {
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
                headers: {
                    'Content-Type': 'application/json'
                },
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
                // Refresh captcha on failure
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
    });
}
