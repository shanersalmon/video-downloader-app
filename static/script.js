class VideoDownloader {
    constructor() {
        this.initializeElements();
        this.bindEvents();
        this.loadingStates = {
            info: false,
            download: false
        };
    }

    initializeElements() {
        this.urlInput = document.getElementById('url-input');
        this.getInfoBtn = document.getElementById('get-info-btn');
        this.downloadBtn = document.getElementById('download-btn');
        this.formatSelect = document.getElementById('format-select');
        this.qualitySelect = document.getElementById('quality-select');
        this.videoInfo = document.getElementById('video-info');
        this.messageDiv = document.getElementById('message');
        this.progressDiv = document.getElementById('progress');
        this.downloadOptions = document.getElementById('download-options');
    }

    bindEvents() {
        this.getInfoBtn.addEventListener('click', () => this.getVideoInfo());
        this.downloadBtn.addEventListener('click', () => this.downloadVideo());
        this.urlInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.getVideoInfo();
            }
        });
        this.formatSelect.addEventListener('change', () => this.updateQualityOptions());
    }

    showMessage(message, type = 'info', duration = 5000) {
        this.messageDiv.textContent = message;
        this.messageDiv.className = `message ${type}`;
        this.messageDiv.style.display = 'block';
        
        setTimeout(() => {
            this.messageDiv.style.display = 'none';
        }, duration);
    }

    showError(message, suggestion = null, duration = null) {
        let fullMessage = message;
        if (suggestion) {
            fullMessage += ` ${suggestion}`;
        }
        
        // Use longer duration for messages with suggestions
        const displayDuration = duration || (suggestion ? 8000 : 5000);
        
        this.showMessage(fullMessage, 'error', displayDuration);
    }

    showProgress(show = true) {
        this.progressDiv.style.display = show ? 'block' : 'none';
    }

    setLoadingState(type, loading) {
        this.loadingStates[type] = loading;
        
        if (type === 'info') {
            this.getInfoBtn.disabled = loading;
            this.getInfoBtn.textContent = loading ? 'Getting Info...' : 'Get Video Info';
        } else if (type === 'download') {
            this.downloadBtn.disabled = loading;
            this.downloadBtn.textContent = loading ? 'Downloading...' : 'Download';
        }
    }

    validateUrl(url) {
        if (!url) {
            this.showError('Please enter a URL');
            return false;
        }

        const urlPattern = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com|twitch\.tv|facebook\.com|instagram\.com|tiktok\.com)/i;
        if (!urlPattern.test(url)) {
            this.showError('Please enter a valid URL from a supported platform (YouTube, Vimeo, etc.)');
            return false;
        }

        return true;
    }

    async getVideoInfo() {
        const url = this.urlInput.value.trim();
        
        if (!this.validateUrl(url)) {
            return;
        }

        this.setLoadingState('info', true);
        this.videoInfo.style.display = 'none';
        this.downloadOptions.style.display = 'none';

        try {
            const response = await fetch('/info', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url })
            });

            const data = await response.json();

            if (!response.ok) {
                if (response.status === 429) {
                    this.showError(data.error, data.suggestion);
                } else {
                    this.showError(data.error || 'Failed to get video information');
                }
                return;
            }

            this.displayVideoInfo(data);
            this.updateQualityOptions(data.formats);
            this.downloadOptions.style.display = 'block';
            this.showMessage('Video information loaded successfully!', 'success');

        } catch (error) {
            this.showError('Network error. Please check your connection and try again.');
        } finally {
            this.setLoadingState('info', false);
        }
    }

    displayVideoInfo(info) {
        const formatDuration = (seconds) => {
            if (!seconds) return 'Unknown';
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const secs = seconds % 60;
            
            if (hours > 0) {
                return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            }
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        };

        const formatNumber = (num) => {
            if (!num) return 'Unknown';
            return num.toLocaleString();
        };

        const formatDate = (dateStr) => {
            if (!dateStr) return 'Unknown';
            const year = dateStr.substring(0, 4);
            const month = dateStr.substring(4, 6);
            const day = dateStr.substring(6, 8);
            return `${year}-${month}-${day}`;
        };

        this.videoInfo.innerHTML = `
            <div class="info-grid">
                <div class="info-item">
                    <strong>Title:</strong>
                    <span>${info.title}</span>
                </div>
                <div class="info-item">
                    <strong>Duration:</strong>
                    <span>${formatDuration(info.duration)}</span>
                </div>
                <div class="info-item">
                    <strong>Uploader:</strong>
                    <span>${info.uploader}</span>
                </div>
                <div class="info-item">
                    <strong>Views:</strong>
                    <span>${formatNumber(info.view_count)}</span>
                </div>
                <div class="info-item">
                    <strong>Upload Date:</strong>
                    <span>${formatDate(info.upload_date)}</span>
                </div>
                ${info.thumbnail ? `
                <div class="info-item thumbnail-item">
                    <strong>Thumbnail:</strong>
                    <img src="${info.thumbnail}" alt="Video thumbnail" class="thumbnail">
                </div>
                ` : ''}
                ${info.description ? `
                <div class="info-item description-item">
                    <strong>Description:</strong>
                    <p class="description">${info.description}</p>
                </div>
                ` : ''}
            </div>
        `;
        
        this.videoInfo.style.display = 'block';
    }

    updateQualityOptions(formats = null) {
        const format = this.formatSelect.value;
        const qualitySelect = this.qualitySelect;
        
        // Clear existing options
        qualitySelect.innerHTML = '';
        
        if (format === 'mp3') {
            // For audio, only show quality option
            const option = document.createElement('option');
            option.value = '192';
            option.textContent = '192 kbps';
            qualitySelect.appendChild(option);
        } else {
            // For video, show available qualities
            const defaultQualities = ['best', '1080', '720', '480', '360', 'worst'];
            
            if (formats && formats.length > 0) {
                // Add 'best' option
                const bestOption = document.createElement('option');
                bestOption.value = 'best';
                bestOption.textContent = 'Best Available';
                qualitySelect.appendChild(bestOption);
                
                // Add available qualities from video info
                const availableQualities = formats
                    .map(f => parseInt(f.quality.replace('p', '')))
                    .sort((a, b) => b - a); // Sort descending
                
                availableQualities.forEach(quality => {
                    const option = document.createElement('option');
                    option.value = quality.toString();
                    option.textContent = `${quality}p`;
                    qualitySelect.appendChild(option);
                });
                
                // Add 'worst' option
                const worstOption = document.createElement('option');
                worstOption.value = 'worst';
                worstOption.textContent = 'Worst Available';
                qualitySelect.appendChild(worstOption);
            } else {
                // Fallback to default qualities
                defaultQualities.forEach(quality => {
                    const option = document.createElement('option');
                    option.value = quality;
                    option.textContent = quality === 'best' ? 'Best Available' : 
                                       quality === 'worst' ? 'Worst Available' : `${quality}p`;
                    qualitySelect.appendChild(option);
                });
            }
        }
    }

    async downloadVideo() {
        const url = this.urlInput.value.trim();
        
        if (!this.validateUrl(url)) {
            return;
        }

        const format = this.formatSelect.value;
        const quality = this.qualitySelect.value;

        this.setLoadingState('download', true);
        this.showProgress(true);

        try {
            const response = await fetch('/download', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    url, 
                    format, 
                    quality 
                })
            });

            const data = await response.json();

            if (!response.ok) {
                this.showError(data.error, data.suggestion);
                return;
            }

            if (data.success) {
                this.showMessage('Download completed! Starting file download...', 'success');
                
                // Create download link
                const downloadLink = document.createElement('a');
                downloadLink.href = `/file/${data.file_id}`;
                downloadLink.download = data.filename;
                document.body.appendChild(downloadLink);
                downloadLink.click();
                document.body.removeChild(downloadLink);
                
                this.showMessage('File download started!', 'success');
            }

        } catch (error) {
            this.showError('Network error. Please check your connection and try again.');
        } finally {
            this.setLoadingState('download', false);
            this.showProgress(false);
        }
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new VideoDownloader();
});