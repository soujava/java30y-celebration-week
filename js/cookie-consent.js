/**
 * Simple Cookie Consent for Java 30Y Event
 * GDPR/LGPD Compliant
 */

const CookieConsent = {
    hasConsent: false,
    consentKey: 'java30y_analytics_consent',
    
    init() {
        // Check if user already gave consent
        const savedConsent = localStorage.getItem(this.consentKey);
        
        if (savedConsent === 'accepted') {
            this.hasConsent = true;
            this.enableAnalytics();
        } else if (savedConsent === null) {
            // First visit - show banner
            this.showBanner();
        }
        // If rejected, do nothing (analytics stays disabled)
    },
    
    showBanner() {
        const banner = document.createElement('div');
        banner.id = 'cookie-consent-banner';
        banner.innerHTML = `
            <div class="consent-content">
                <div class="consent-text">
                    <p><strong>We use cookies to improve your experience</strong></p>
                    <p>We use analytics cookies to understand how you use our site.
                    <a href="https://policies.google.com/technologies/cookies" target="_blank" rel="noopener">Learn more</a></p>
                    <p class="consent-legal">By clicking "Accept", you consent to our use of analytics cookies.</p>
                </div>
                <div class="consent-buttons">
                    <button class="consent-button consent-reject" onclick="CookieConsent.reject()">Reject</button>
                    <button class="consent-button consent-accept" onclick="CookieConsent.accept()">Accept</button>
                </div>
            </div>
        `;
        
        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            #cookie-consent-banner {
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: rgba(43, 76, 111, 0.95);
                color: white;
                padding: 1rem 1.5rem;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
                z-index: 10000;
                border-radius: 0.75rem;
                max-width: 400px;
                animation: slideUp 0.3s ease-out;
            }
            
            @keyframes slideUp {
                from { transform: translateY(100%); }
                to { transform: translateY(0); }
            }
            
            .consent-content {
                display: flex;
                flex-direction: column;
                gap: 1rem;
            }
            
            .consent-text {
                font-size: 0.875rem;
                line-height: 1.4;
            }
            
            .consent-text p {
                margin: 0 0 0.5rem 0;
                font-size: 0.875rem;
                line-height: 1.4;
            }
            
            .consent-text p:first-child {
                display: none;
            }
            
            .consent-text a {
                color: #5cb6fa;
                text-decoration: underline;
                font-size: 0.75rem;
            }
            
            .consent-legal {
                font-size: 0.75rem;
                opacity: 0.8;
                display: none;
            }
            
            .consent-buttons {
                display: flex;
                gap: 0.75rem;
                justify-content: flex-end;
            }
            
            .consent-button {
                padding: 0.5rem 1.25rem;
                border: none;
                border-radius: 0.375rem;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
                font-size: 0.875rem;
                min-width: 70px;
            }
            
            .consent-accept {
                background: #F77347;
                color: white;
            }
            
            .consent-accept:hover {
                background: #f78128;
                transform: translateY(-1px);
            }
            
            .consent-reject {
                background: transparent;
                color: rgba(255, 255, 255, 0.8);
                padding: 0.5rem 0.75rem;
                min-width: auto;
            }
            
            .consent-reject:hover {
                color: white;
                text-decoration: underline;
            }
            
            @media (max-width: 768px) {
                #cookie-consent-banner {
                    bottom: 10px;
                    right: 10px;
                    left: 10px;
                    max-width: none;
                }
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(banner);
    },
    
    accept() {
        this.hasConsent = true;
        localStorage.setItem(this.consentKey, 'accepted');
        this.removeBanner();
        this.enableAnalytics();
        
        // Track consent given
        if (typeof gtag !== 'undefined') {
            gtag('consent', 'update', {
                'analytics_storage': 'granted'
            });
            
            gtag('event', 'consent_given', {
                event_category: 'Privacy',
                consent_type: 'analytics'
            });
        }
    },
    
    reject() {
        this.hasConsent = false;
        localStorage.setItem(this.consentKey, 'rejected');
        this.removeBanner();
        
        // Ensure analytics stays disabled
        if (typeof gtag !== 'undefined') {
            gtag('consent', 'update', {
                'analytics_storage': 'denied'
            });
        }
    },
    
    removeBanner() {
        const banner = document.getElementById('cookie-consent-banner');
        if (banner) {
            banner.style.animation = 'slideDown 0.3s ease-out';
            banner.style.animationFillMode = 'forwards';
            setTimeout(() => banner.remove(), 300);
        }
    },
    
    enableAnalytics() {
        // Initialize analytics only after consent
        if (window.EventAnalytics && typeof window.EventAnalytics.init === 'function') {
            window.EventAnalytics.init();
        }
        
        // Fire page view if it hasn't been sent
        if (typeof gtag !== 'undefined') {
            gtag('event', 'page_view', {
                page_location: window.location.href,
                page_title: document.title
            });
        }
    },
    
    // Check if user has consented (for use in other scripts)
    canTrack() {
        return this.hasConsent;
    }
};

// Wait for DOM to be ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => CookieConsent.init());
} else {
    CookieConsent.init();
}

// Make it globally available
window.CookieConsent = CookieConsent;