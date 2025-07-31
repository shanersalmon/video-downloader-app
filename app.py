from flask import Flask, render_template, request, jsonify, send_file
import yt_dlp
import os
import tempfile
import time
from urllib.parse import urlparse
import re
from functools import wraps
from collections import defaultdict
import threading

app = Flask(__name__)

# Rate limiting storage
request_counts = defaultdict(list)
RATE_LIMIT = 5  # requests per minute
RATE_WINDOW = 60  # seconds

def rate_limit(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        client_ip = request.environ.get('HTTP_X_FORWARDED_FOR', request.environ.get('REMOTE_ADDR', 'unknown'))
        now = time.time()
        
        # Clean old requests
        request_counts[client_ip] = [req_time for req_time in request_counts[client_ip] if now - req_time < RATE_WINDOW]
        
        # Check rate limit
        if len(request_counts[client_ip]) >= RATE_LIMIT:
            return jsonify({'error': 'Rate limit exceeded. Please wait before making another request.'}), 429
        
        # Add current request
        request_counts[client_ip].append(now)
        
        return f(*args, **kwargs)
    return decorated_function

def is_valid_url(url):
    """Validate if the URL is from supported platforms"""
    try:
        parsed = urlparse(url)
        if not parsed.scheme or not parsed.netloc:
            return False
        
        # Check for supported domains
        supported_domains = [
            'youtube.com', 'youtu.be', 'tiktok.com', 'instagram.com',
            'facebook.com', 'twitter.com', 'x.com', 'vimeo.com',
            'dailymotion.com', 'twitch.tv'
        ]
        
        domain = parsed.netloc.lower()
        for supported in supported_domains:
            if supported in domain:
                return True
        return False
    except:
        return False

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/download', methods=['POST'])
@rate_limit
def download_video():
    try:
        data = request.get_json()
        url = data.get('url', '').strip()
        format_type = data.get('format', 'mp4')
        
        if not url:
            return jsonify({'error': 'Please provide a valid URL'}), 400
        
        if not is_valid_url(url):
            return jsonify({'error': 'URL not supported. Please use YouTube, TikTok, Instagram, Facebook, or other supported platforms.'}), 400
        
        # Create temporary directory for downloads
        temp_dir = tempfile.mkdtemp()
        
        # Configure yt-dlp options based on format
        base_opts = {
            'outtmpl': os.path.join(temp_dir, '%(title)s.%(ext)s'),
            'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'referer': 'https://www.google.com/',
            'headers': {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-us,en;q=0.5',
                'Accept-Encoding': 'gzip,deflate',
                'Accept-Charset': 'ISO-8859-1,utf-8;q=0.7,*;q=0.7',
                'Keep-Alive': '300',
                'Connection': 'keep-alive',
            },
            'extractor_args': {
                'youtube': {
                    'skip': ['dash', 'hls'],
                },
            },
            'no_warnings': True,
        }
        
        if format_type == 'audio':
            ydl_opts = {
                **base_opts,
                'format': 'bestaudio/best',
                'postprocessors': [{
                    'key': 'FFmpegExtractAudio',
                    'preferredcodec': 'mp3',
                    'preferredquality': '192',
                }],
            }
        else:
            ydl_opts = {
                **base_opts,
                'format': 'best[height<=720]/best',
            }
        
        # Download the video
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            title = info.get('title', 'video')
            
            # Find the downloaded file
            files = os.listdir(temp_dir)
            if not files:
                return jsonify({'error': 'Download failed. No file was created.'}), 500
            
            downloaded_file = os.path.join(temp_dir, files[0])
            
            # Clean up temp directory after sending file
            def cleanup():
                time.sleep(10)  # Wait 10 seconds before cleanup
                try:
                    os.remove(downloaded_file)
                    os.rmdir(temp_dir)
                except:
                    pass
            
            threading.Thread(target=cleanup).start()
            
            return send_file(
                downloaded_file,
                as_attachment=True,
                download_name=f"{title}.{files[0].split('.')[-1]}"
            )
    
    except yt_dlp.DownloadError as e:
        return jsonify({'error': f'Download failed: {str(e)}'}), 400
    except Exception as e:
        return jsonify({'error': f'An error occurred: {str(e)}'}), 500

@app.route('/info', methods=['POST'])
@rate_limit
def get_video_info():
    """Get video information without downloading"""
    try:
        data = request.get_json()
        url = data.get('url', '').strip()
        
        if not url:
            return jsonify({'error': 'Please provide a valid URL'}), 400
        
        if not is_valid_url(url):
            return jsonify({'error': 'URL not supported'}), 400
        
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'referer': 'https://www.google.com/',
            'headers': {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-us,en;q=0.5',
                'Accept-Encoding': 'gzip,deflate',
                'Accept-Charset': 'ISO-8859-1,utf-8;q=0.7,*;q=0.7',
                'Keep-Alive': '300',
                'Connection': 'keep-alive',
            },
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            
            return jsonify({
                'title': info.get('title', 'Unknown'),
                'duration': info.get('duration', 0),
                'uploader': info.get('uploader', 'Unknown'),
                'thumbnail': info.get('thumbnail', ''),
            })
    
    except Exception as e:
        return jsonify({'error': f'Could not fetch video info: {str(e)}'}), 400

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=8080)