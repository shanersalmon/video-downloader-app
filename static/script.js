document.addEventListener('DOMContentLoaded', function() {
    // DOM elements
    const form = document.getElementById('downloadForm');
    const urlInput = document.getElementById('videoUrl');
    const formatSelect = document.getElementById('format');
    const downloadBtn = document.getElementById('downloadBtn');
    const clearBtn = document.getElementById('clearBtn');
    const errorMessage = document.getElementById('errorMessage');
    const successMessage = document.getElementById('successMessage');
    const videoInfo = document.getElementById('videoInfo');
    const errorText = document.getElementById('errorText');

    // State management
    let isDownloading = false;
    let infoTimeout = null;

    // Initialize
    init();

    function init() {
        setupEventListeners();
        updateClearButton();
    }

    function setupEventListeners() {
        // Form submission
        form.addEventListener('submit', handleFormSubmit);
        
        // URL input events
        urlInput.addEventListener('input', handleUrlInput);
        urlInput.addEventListener('paste', handleUrlPaste);
        urlInput.addEventListener('focus', hideMessages);
        
        // Clear button
        clearBtn.addEventListener('click', clearUrl);
        
        // Format change
        formatSelect.addEventListener('change', hideMessages);
        
        // Keyboard shortcuts
        document.addEventListener('keydown', handleKeydown);
    }

    function handleFormSubmit(e) {
        e.preventDefault();
        
        if (isDownloading) return;
        
        const url = urlInput.value.trim();
        const format = formatSelect.value;
        
        if (!url) {
            showError('Please enter a video URL');
            urlInput.focus();
            return;
        }
        
        if (!isValidUrl(url)) {
            showError('Please enter a valid URL');
            urlInput.focus();
            return;
        }
        
        downloadVideo(url, format);
    }

    function handleUrlInput(e) {
        updateClearButton();
        hideMessages();
        
        // Debounced info fetching
        if (infoTimeout) {
            clearTimeout(infoTimeout);
        }
        
        const url = e.target.value.trim();
        if (url && isValidUrl(url)) {
            infoTimeout = setTimeout(() => {
                fetchVideoInfo(url);
            }, 1000);
        } else {
            hideVideoInfo();
        }
    }

    function handleUrlPaste(e) {
        // Small delay to ensure pasted content is available
        setTimeout(() => {
            updateClearButton();
            const url = urlInput.value.trim();
            if (url && isValidUrl(url)) {
                fetchVideoInfo(url);
            }
        }, 100);
    }

    function handleKeydown(e) {
        // Ctrl/Cmd + Enter to submit
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            form.dispatchEvent(new Event('submit'));
        }
        
        // Escape to clear
        if (e.key === 'Escape') {
            clearUrl();
        }
    }

    function updateClearButton() {
        if (urlInput.value.trim()) {
            clearBtn.classList.add('show');
        } else {
            clearBtn.classList.remove('show');
        }
    }

    function clearUrl() {
        urlInput.value = '';
        updateClearButton();
        hideMessages();
        hideVideoInfo();
        urlInput.focus();
    }

    function isValidUrl(string) {
        try {
            const url = new URL(string);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch (_) {
            return false;
        }
    }

    function setLoadingState(loading) {
        isDownloading = loading;
        downloadBtn.disabled = loading;
        
        if (loading) {
            downloadBtn.classList.add('loading');
        } else {
            downloadBtn.classList.remove('loading');
        }
    }

    function showError(message) {
        errorText.textContent = message;
        errorMessage.classList.remove('hidden');
        successMessage.classList.add('hidden');
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            hideMessages();
        }, 5000);
    }

    function showSuccess(message = 'Download started! Your file will be saved shortly.') {
        successMessage.querySelector('span').textContent = message;
        successMessage.classList.remove('hidden');
        errorMessage.classList.add('hidden');
        
        // Auto-hide after 3 seconds
        setTimeout(() => {
            hideMessages();
        }, 3000);
    }

    function hideMessages() {
        errorMessage.classList.add('hidden');
        successMessage.classList.add('hidden');
    }

    function showVideoInfo(info) {
        const thumbnail = document.getElementById('videoThumbnail');
        const title = document.getElementById('videoTitle');
        const uploader = document.getElementById('videoUploader');
        const duration = document.getElementById('videoDuration');
        
        thumbnail.src = info.thumbnail || '';
        thumbnail.style.display = info.thumbnail ? 'block' : 'none';
        title.textContent = info.title || 'Unknown Title';
        uploader.textContent = `By: ${info.uploader || 'Unknown'}`;
        
        if (info.duration) {
            const minutes = Math.floor(info.duration / 60);
            const seconds = info.duration % 60;
            duration.textContent = `Duration: ${minutes}:${seconds.toString().padStart(2, '0')}`;
        } else {
            duration.textContent = '';
        }
        
        videoInfo.classList.remove('hidden');
    }

    function hideVideoInfo() {
        videoInfo.classList.add('hidden');
    }

    async function fetchVideoInfo(url) {
        try {
            const response = await fetch('/info', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                showVideoInfo(data);
            } else {
                hideVideoInfo();
                // Don't show error for info fetch failures
            }
        } catch (error) {
            hideVideoInfo();
            // Silently fail for info fetching
        }
    }

    async function downloadVideo(url, format) {
        setLoadingState(true);
        hideMessages();
        
        try {
            const response = await fetch('/download', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url, format })
            });
            
            if (response.ok) {
                // Handle file download
                const blob = await response.blob();
                const downloadUrl = window.URL.createObjectURL(blob);
                
                // Get filename from Content-Disposition header or create one
                const contentDisposition = response.headers.get('Content-Disposition');
                let filename = 'video';
                
                if (contentDisposition) {
                    const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
                    if (filenameMatch) {
                        filename = filenameMatch[1];
                    }
                }
                
                // Create download link and trigger download
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                
                // Clean up
                window.URL.revokeObjectURL(downloadUrl);
                
                showSuccess();
            } else {
                const errorData = await response.json();
                showError(errorData.error || 'Download failed. Please try again.');
            }
        } catch (error) {
            console.error('Download error:', error);
            showError('Network error. Please check your connection and try again.');
        } finally {
            setLoadingState(false);
        }
    }

    // Utility functions
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

    // Analytics and user experience enhancements
    function trackEvent(eventName, properties = {}) {
        // Placeholder for analytics tracking
        console.log('Event:', eventName, properties);
    }

    // Track form interactions
    urlInput.addEventListener('focus', () => trackEvent('url_input_focus'));
    formatSelect.addEventListener('change', () => trackEvent('format_change', { format: formatSelect.value }));
    
    // Add visual feedback for supported platforms
    const platformElements = document.querySelectorAll('.platform');
    platformElements.forEach(platform => {
        platform.addEventListener('click', () => {
            const platformName = platform.querySelector('span').textContent;
            urlInput.focus();
            trackEvent('platform_click', { platform: platformName });
        });
    });

    // Add copy-paste enhancement
    urlInput.addEventListener('paste', (e) => {
        trackEvent('url_paste');
    });

    // Progressive enhancement for better UX
    if ('serviceWorker' in navigator) {
        // Could add service worker for offline functionality
    }

    // Add keyboard navigation for accessibility
    document.addEventListener('keydown', (e) => {
        if (e.altKey && e.key === 'c') {
            clearUrl();
        }
    });

    // Auto-focus URL input on page load
    setTimeout(() => {
        urlInput.focus();
    }, 100);
});