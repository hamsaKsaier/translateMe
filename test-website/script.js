// Navigation functionality
document.addEventListener('DOMContentLoaded', function () {
    const navLinks = document.querySelectorAll('.nav-link');
    const contentSections = document.querySelectorAll('.content-section');

    // Handle navigation clicks
    navLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();

            // Remove active class from all links and sections
            navLinks.forEach(l => l.classList.remove('active'));
            contentSections.forEach(s => s.classList.remove('active'));

            // Add active class to clicked link
            this.classList.add('active');

            // Show corresponding section
            const targetId = this.getAttribute('href').substring(1);
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                targetSection.classList.add('active');

                // Trigger a custom event for the extension to detect
                const event = new CustomEvent('contentSectionChanged', {
                    detail: { sectionId: targetId, section: targetSection }
                });
                document.dispatchEvent(event);

                console.log(`📱 Navigation: Switched to section "${targetId}"`);
            }
        });
    });

    // Set default active section
    const defaultSection = document.getElementById('home');
    if (defaultSection) {
        defaultSection.classList.add('active');
    }

    // Handle form submissions
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        form.addEventListener('submit', function (e) {
            e.preventDefault();

            // Get form data
            const formData = new FormData(this);
            const data = Object.fromEntries(formData);

            // Show success message
            showNotification('Formulaire envoyé avec succès!', 'success');

            // Reset form
            this.reset();
        });
    });

    // Add smooth scrolling for internal links
    const internalLinks = document.querySelectorAll('a[href^="#"]');
    internalLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);

            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Add hover effects to cards
    const cards = document.querySelectorAll('.card, .product-card, .service-card, .news-item, .gallery-item');
    cards.forEach(card => {
        card.addEventListener('mouseenter', function () {
            this.style.transform = 'translateY(-5px)';
        });

        card.addEventListener('mouseleave', function () {
            this.style.transform = 'translateY(0)';
        });
    });

    // Add click effects to buttons
    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(button => {
        button.addEventListener('click', function () {
            this.style.transform = 'scale(0.95)';
            setTimeout(() => {
                this.style.transform = 'scale(1)';
            }, 150);
        });
    });

    // Add loading states to forms
    const submitButtons = document.querySelectorAll('button[type="submit"]');
    submitButtons.forEach(button => {
        button.addEventListener('click', function () {
            const originalText = this.textContent;
            this.textContent = 'Envoi en cours...';
            this.disabled = true;

            setTimeout(() => {
                this.textContent = originalText;
                this.disabled = false;
            }, 2000);
        });
    });

    // Add search functionality (placeholder)
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = 'Rechercher...';
    searchInput.style.cssText = `
        width: 100%;
        padding: 10px;
        margin: 20px 0;
        border: 1px solid #ddd;
        border-radius: 5px;
        font-size: 14px;
    `;

    const sidebarHeader = document.querySelector('.sidebar-header');
    if (sidebarHeader) {
        sidebarHeader.appendChild(searchInput);
    }

    // Add language toggle functionality
    const languageToggle = document.createElement('button');
    languageToggle.textContent = '🌐 Langue';
    languageToggle.style.cssText = `
        background: rgba(255,255,255,0.2);
        color: white;
        border: 1px solid rgba(255,255,255,0.3);
        padding: 8px 16px;
        border-radius: 5px;
        cursor: pointer;
        margin: 10px 0;
        font-size: 12px;
    `;

    languageToggle.addEventListener('click', function () {
        showNotification('Fonctionnalité de traduction en cours de développement', 'info');
    });

    if (sidebarHeader) {
        sidebarHeader.appendChild(languageToggle);
    }

    // Add theme toggle
    const themeToggle = document.createElement('button');
    themeToggle.textContent = '🌙 Thème';
    themeToggle.style.cssText = `
        background: rgba(255,255,255,0.2);
        color: white;
        border: 1px solid rgba(255,255,255,0.3);
        padding: 8px 16px;
        border-radius: 5px;
        cursor: pointer;
        margin: 10px 0;
        font-size: 12px;
    `;

    themeToggle.addEventListener('click', function () {
        document.body.classList.toggle('dark-theme');
        this.textContent = document.body.classList.contains('dark-theme') ? '☀️ Thème' : '🌙 Thème';
    });

    if (sidebarHeader) {
        sidebarHeader.appendChild(themeToggle);
    }
});

// Notification system
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 5px;
        color: white;
        font-weight: 600;
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
        max-width: 300px;
        word-wrap: break-word;
    `;

    // Set background color based on type
    switch (type) {
        case 'success':
            notification.style.backgroundColor = '#28a745';
            break;
        case 'error':
            notification.style.backgroundColor = '#dc3545';
            break;
        case 'warning':
            notification.style.backgroundColor = '#ffc107';
            notification.style.color = '#000';
            break;
        default:
            notification.style.backgroundColor = '#17a2b8';
    }

    document.body.appendChild(notification);

    // Remove notification after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    .dark-theme {
        background-color: #1a1a1a;
        color: #e0e0e0;
    }
    
    .dark-theme .main-content {
        background-color: #2d2d2d;
    }
    
    .dark-theme .card,
    .dark-theme .product-card,
    .dark-theme .service-card,
    .dark-theme .news-item,
    .dark-theme .gallery-item {
        background-color: #3d3d3d;
        color: #e0e0e0;
    }
    
    .dark-theme .form-group input,
    .dark-theme .form-group textarea,
    .dark-theme .form-group select {
        background-color: #4d4d4d;
        color: #e0e0e0;
        border-color: #555;
    }
`;
document.head.appendChild(style);

// Add keyboard navigation
document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
            case '1':
                e.preventDefault();
                document.querySelector('a[href="#home"]').click();
                break;
            case '2':
                e.preventDefault();
                document.querySelector('a[href="#products"]').click();
                break;
            case '3':
                e.preventDefault();
                document.querySelector('a[href="#about"]').click();
                break;
            case '4':
                e.preventDefault();
                document.querySelector('a[href="#contact"]').click();
                break;
        }
    }
});

// Add scroll to top functionality
const scrollToTopBtn = document.createElement('button');
scrollToTopBtn.innerHTML = '↑';
scrollToTopBtn.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 50px;
    height: 50px;
    border-radius: 50%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    border: none;
    cursor: pointer;
    font-size: 20px;
    z-index: 1000;
    display: none;
    transition: all 0.3s ease;
`;

scrollToTopBtn.addEventListener('click', function () {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
});

document.body.appendChild(scrollToTopBtn);

// Show/hide scroll to top button
window.addEventListener('scroll', function () {
    if (window.pageYOffset > 300) {
        scrollToTopBtn.style.display = 'block';
    } else {
        scrollToTopBtn.style.display = 'none';
    }
});

// Add loading animation for images (placeholder)
function addLoadingAnimation() {
    const images = document.querySelectorAll('img');
    images.forEach(img => {
        img.addEventListener('load', function () {
            this.style.opacity = '1';
        });

        img.style.opacity = '0';
        img.style.transition = 'opacity 0.3s ease';
    });
}

// Initialize loading animation
addLoadingAnimation();

// Add print functionality
const printBtn = document.createElement('button');
printBtn.textContent = '🖨️ Imprimer';
printBtn.style.cssText = `
    background: rgba(255,255,255,0.2);
    color: white;
    border: 1px solid rgba(255,255,255,0.3);
    padding: 8px 16px;
    border-radius: 5px;
    cursor: pointer;
    margin: 10px 0;
    font-size: 12px;
`;

printBtn.addEventListener('click', function () {
    window.print();
});

const sidebarHeader = document.querySelector('.sidebar-header');
if (sidebarHeader) {
    sidebarHeader.appendChild(printBtn);
}

// Add accessibility features
document.addEventListener('keydown', function (e) {
    if (e.key === 'Tab') {
        document.body.classList.add('keyboard-navigation');
    }
});

document.addEventListener('mousedown', function () {
    document.body.classList.remove('keyboard-navigation');
});

// Add focus styles for keyboard navigation
const focusStyle = document.createElement('style');
focusStyle.textContent = `
    .keyboard-navigation *:focus {
        outline: 2px solid #667eea !important;
        outline-offset: 2px !important;
    }
`;
document.head.appendChild(focusStyle);
