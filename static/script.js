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
            if (!isDownloading) {
                form.dispatchEvent(new Event('submit'));
            }
        }
        
        // Escape to clear
        if (e.key === 'Escape') {
            clearUrl();
        }
    }

    function clearUrl() {
        urlInput.value = '';
        urlInput.focus();
        hideMessages();
        hideVideoInfo();
        updateClearButton();
        
        if (infoTimeout) {
            clearTimeout(infoTimeout);
        }
    }

    function updateClearButton() {
        const hasValue = urlInput.value.trim().length > 0;
        clearBtn.style.display = hasValue ? 'flex' : 'none';
    }

    function setLoadingState(loading) {
        isDownloading = loading;
        downloadBtn.disabled = loading;
        downloadBtn.innerHTML = loading ? 
            '<span class="spinner"></span>Downloading...' : 
            'Download';
        
        if (loading) {
            downloadBtn.classList.add('loading');
        } else {
            downloadBtn.classList.remove('loading');
        }
    }

    function showError(message, suggestion = '') {
        hideMessages();
        errorText.textContent = message;
        if (suggestion) {
            errorText.innerHTML = `${message}<br><small style="opacity: 0.8; font-size: 0.9em;">${suggestion}</small>`;
        }
        errorMessage.classList.remove('hidden');
        
        // Auto-hide after delay (longer for suggestions)
        const hideDelay = suggestion ? 8000 : 5000;
        setTimeout(() => {
            hideMessages();
        }, hideDelay);
    }

    function showSuccess() {
        hideMessages();
        successMessage.classList.remove('hidden');
        
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
        const infoContent = document.getElementById('infoContent');
        const thumbnail = document.getElementById('thumbnail');
        const title = document.getElementById('title');
        const uploader = document.getElementById('uploader');
        const duration = document.getElementById('duration');
        const views = document.getElementById('views');
        
        // Update thumbnail
        if (info.thumbnail) {
            thumbnail.src = info.thumbnail;
            thumbnail.style.display = 'block';
        } else {
            thumbnail.style.display = 'none';
        }
        
        // Update text content
        title.textContent = info.title || 'Unknown Title';
        uploader.textContent = info.uploader || 'Unknown Uploader';
        
        // Format duration
        if (info.duration) {
            const minutes = Math.floor(info.duration / 60);
            const seconds = info.duration % 60;
            duration.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        } else {
            duration.textContent = 'Unknown';
        }
        
        // Format view count
        if (info.view_count) {
            views.textContent = formatNumber(info.view_count);
        } else {
            views.textContent = 'Unknown';
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
                // For authentication errors, show a subtle message
                if (response.status === 429) {
                    const errorData = await response.json();
                    showError(errorData.error || 'Unable to fetch video info.', errorData.suggestion);
                }
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
                // Check if response is a file or JSON
                const contentType = response.headers.get('Content-Type');
                
                if (contentType && contentType.includes('application/json')) {
                    // Handle JSON response (error case)
                    const errorData = await response.json();
                    showError(errorData.error || 'Download failed. Please try again.', errorData.suggestion);
                } else {
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
                }
            } else {
                // Handle error responses
                try {
                    const errorData = await response.json();
                    showError(errorData.error || 'Download failed. Please try again.', errorData.suggestion);
                } catch {
                    showError('Download failed. Please try again.');
                }
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

    function formatNumber(num) {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        }
        return num.toString();
    }

    function isValidUrl(string) {
        try {
            const url = new URL(string);
            const supportedDomains = [
                'youtube.com', 'youtu.be', 'www.youtube.com',
                'tiktok.com', 'www.tiktok.com', 'vm.tiktok.com',
                'instagram.com', 'www.instagram.com',
                'facebook.com', 'www.facebook.com', 'fb.watch',
                'twitter.com', 'www.twitter.com', 'x.com',
                'vimeo.com', 'www.vimeo.com',
                'dailymotion.com', 'www.dailymotion.com',
                'twitch.tv', 'www.twitch.tv'
            ];
            
            return supportedDomains.some(domain => 
                url.hostname === domain || url.hostname.endsWith('.' + domain)
            );
        } catch {
            return false;
        }
    }

    // Expose some functions globally for debugging
    window.videoDownloader = {
        clearUrl,
        fetchVideoInfo,
        downloadVideo
    };
});