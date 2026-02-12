// Offline Authentication Guard for Teacher and POD users
// This script checks if users can access the app offline based on cached credentials

window.offlineAuthGuard = {
    // Check if user can access the app offline
    canAccessOffline: function () {
        const authToken = localStorage.getItem('authToken');
        const userRole = localStorage.getItem('userRole');
        const userPosition = localStorage.getItem('userPosition');
        const isOnline = navigator.onLine;

        console.log('Offline Auth Guard Check:', {
            isOnline,
            authToken: authToken ? 'exists' : 'missing',
            userRole,
            userPosition
        });

        // If online, allow normal authentication flow
        if (isOnline) {
            return true;
        }

        // If offline, check if user has valid cached credentials
        // Allow access for Teacher and POD users only
        const hasValidAuth = authToken && authToken !== '';
        const isTeacher = userRole === 'teacher';
        const isPOD = userRole === 'teacher' && userPosition === 'POD';

        return hasValidAuth && (isTeacher || isPOD);
    },

    // Get cached user info
    getCachedUser: function () {
        return {
            username: localStorage.getItem('username'),
            userRole: localStorage.getItem('userRole'),
            userPosition: localStorage.getItem('userPosition'),
            teacherId: localStorage.getItem('teacherId'),
            schoolName: localStorage.getItem('schoolName'),
            division: localStorage.getItem('division')
        };
    },

    // Check if specific page is accessible offline
    canAccessPage: function (pagePath) {
        const offlinePages = [
            '/official-incident-report',
            '/pod/offline-online-rounding',
            '/adviser-dashboard',
            '/pod-dashboard'
        ];

        return offlinePages.some(page => pagePath.includes(page));
    },

    // Show offline indicator
    showOfflineIndicator: function () {
        const existingBanner = document.querySelector('.offline-mode-banner');
        if (existingBanner) return; // Already showing

        const banner = document.createElement('div');
        banner.className = 'offline-mode-banner';
        banner.innerHTML = `
            <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); 
                        color: white; 
                        padding: 12px 20px; 
                        text-align: center; 
                        font-weight: 600; 
                        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        z-index: 9999;
                        animation: slideDown 0.3s ease-out;">
                ⚠️ You're offline - Using cached data. Changes will sync when online.
            </div>
        `;
        document.body.prepend(banner);
    },

    // Hide offline indicator
    hideOfflineIndicator: function () {
        const banner = document.querySelector('.offline-mode-banner');
        if (banner) {
            banner.remove();
        }
    }
};

// Monitor online/offline status
window.addEventListener('online', function () {
    console.log('Connection restored - Online mode');
    window.offlineAuthGuard.hideOfflineIndicator();
});

window.addEventListener('offline', function () {
    console.log('Connection lost - Offline mode');
    if (window.offlineAuthGuard.canAccessOffline()) {
        window.offlineAuthGuard.showOfflineIndicator();
    }
});

// Initialize on load
if (!navigator.onLine && window.offlineAuthGuard.canAccessOffline()) {
    window.offlineAuthGuard.showOfflineIndicator();
}

console.log('Offline Auth Guard loaded successfully');
