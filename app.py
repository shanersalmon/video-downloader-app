from flask import Flask, request, jsonify, render_template, send_file
import yt_dlp
import os
import tempfile
import threading
import time
from urllib.parse import urlparse
import re
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

app = Flask(__name__)

# Rate limiting
limiter = Limiter(
    app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)

# Global variables for cleanup
download_files = {}
cleanup_lock = threading.Lock()

def is_valid_url(url):
    """Validate if the URL is from a supported platform"""
    try:
        parsed = urlparse(url)
        if not parsed.scheme or not parsed.netloc:
            return False
        
        # List of supported domains
        supported_domains = [
            'youtube.com', 'youtu.be', 'www.youtube.com',
            'vimeo.com', 'www.vimeo.com',
            'dailymotion.com', 'www.dailymotion.com',
            'twitch.tv', 'www.twitch.tv',
            'facebook.com', 'www.facebook.com',
            'instagram.com', 'www.instagram.com',
            'tiktok.com', 'www.tiktok.com'
        ]
        
        domain = parsed.netloc.lower()
        return any(domain.endswith(supported) for supported in supported_domains)
    except:
        return False

def cleanup_old_files():
    """Clean up files older than 1 hour"""
    current_time = time.time()
    with cleanup_lock:
        files_to_remove = []
        for file_id, file_info in download_files.items():
            if current_time - file_info['timestamp'] > 3600:  # 1 hour
                try:
                    if os.path.exists(file_info['path']):
                        os.remove(file_info['path'])
                    files_to_remove.append(file_id)
                except:
                    pass
        
        for file_id in files_to_remove:
            del download_files[file_id]

# Start cleanup thread
def start_cleanup_thread():
    def cleanup_worker():
        while True:
            time.sleep(1800)  # Run every 30 minutes
            cleanup_old_files()
    
    cleanup_thread = threading.Thread(target=cleanup_worker, daemon=True)
    cleanup_thread.start()

start_cleanup_thread()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/download', methods=['POST'])
@limiter.limit("10 per minute")
def download_video():
    try:
        data = request.get_json()
        url = data.get('url')
        format_type = data.get('format', 'mp4')
        quality = data.get('quality', 'best')
        
        if not url:
            return jsonify({'error': 'URL is required'}), 400
        
        if not is_valid_url(url):
            return jsonify({'error': 'Invalid or unsupported URL'}), 400
        
        # Create temporary directory
        temp_dir = tempfile.mkdtemp()
        
        # Base yt-dlp options with enhanced authentication handling
        base_opts = {
            'outtmpl': os.path.join(temp_dir, '%(title)s.%(ext)s'),
            'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'referer': 'https://www.youtube.com/',
            'headers': {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Cache-Control': 'max-age=0'
            },
            'extractor_args': {
                'youtube': {
                    'player_skip': ['configs', 'webpage'],
                    'player_client': ['mweb', 'web']
                }
            },
            'sleep_interval': 1,
            'max_sleep_interval': 5
        }
        
        # Configure format based on user selection
        if format_type == 'mp3':
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
            if quality == 'best':
                format_selector = 'best[ext=mp4]/best'
            elif quality == 'worst':
                format_selector = 'worst[ext=mp4]/worst'
            else:
                format_selector = f'best[height<={quality}][ext=mp4]/best[height<={quality}]/best[ext=mp4]/best'
            
            ydl_opts = {
                **base_opts,
                'format': format_selector,
            }
        
        # Download the video
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            try:
                ydl.download([url])
            except yt_dlp.DownloadError as e:
                error_msg = str(e).lower()
                if 'sign in to confirm' in error_msg or 'bot' in error_msg:
                    return jsonify({
                        'error': 'YouTube is asking for bot verification',
                        'suggestion': 'This video may be restricted. Try again later or use a different video.'
                    }), 429
                elif 'private' in error_msg or 'members-only' in error_msg:
                    return jsonify({
                        'error': 'This video is private or members-only',
                        'suggestion': 'You need special access to download this video.'
                    }), 403
                elif 'not available' in error_msg or 'unavailable' in error_msg:
                    return jsonify({
                        'error': 'Video is not available',
                        'suggestion': 'The video may have been removed or is not accessible in your region.'
                    }), 404
                else:
                    raise e
        
        # Find the downloaded file
        files = os.listdir(temp_dir)
        if not files:
            return jsonify({'error': 'Download failed - no file created'}), 500
        
        downloaded_file = os.path.join(temp_dir, files[0])
        
        # Generate unique file ID
        file_id = str(int(time.time() * 1000))
        
        # Store file info for later cleanup
        with cleanup_lock:
            download_files[file_id] = {
                'path': downloaded_file,
                'filename': files[0],
                'timestamp': time.time()
            }
        
        return jsonify({
            'success': True,
            'file_id': file_id,
            'filename': files[0]
        })
        
    except Exception as e:
        return jsonify({'error': f'Download failed: {str(e)}'}), 500

@app.route('/file/<file_id>')
def get_file(file_id):
    with cleanup_lock:
        if file_id not in download_files:
            return jsonify({'error': 'File not found or expired'}), 404
        
        file_info = download_files[file_id]
        file_path = file_info['path']
        filename = file_info['filename']
    
    if not os.path.exists(file_path):
        return jsonify({'error': 'File not found'}), 404
    
    return send_file(file_path, as_attachment=True, download_name=filename)

@app.route('/info', methods=['POST'])
@limiter.limit("20 per minute")
def get_video_info():
    try:
        data = request.get_json()
        url = data.get('url')
        
        if not url:
            return jsonify({'error': 'URL is required'}), 400
        
        if not is_valid_url(url):
            return jsonify({'error': 'Invalid or unsupported URL'}), 400
        
        # yt-dlp options for info extraction with enhanced authentication
        ydl_opts = {
            'quiet': True,
            'no_warnings': True,
            'user_agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'referer': 'https://www.youtube.com/',
            'headers': {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Accept-Encoding': 'gzip, deflate, br',
                'DNT': '1',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Sec-Fetch-Dest': 'document',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-User': '?1',
                'Cache-Control': 'max-age=0'
            },
            'extractor_args': {
                'youtube': {
                    'player_skip': ['configs', 'webpage'],
                    'player_client': ['mweb', 'web']
                }
            },
            'sleep_interval': 1,
            'max_sleep_interval': 5
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            try:
                info = ydl.extract_info(url, download=False)
            except yt_dlp.DownloadError as e:
                error_msg = str(e).lower()
                if 'sign in to confirm' in error_msg or 'bot' in error_msg:
                    return jsonify({
                        'error': 'YouTube is asking for bot verification',
                        'suggestion': 'This video may be restricted. Try again later or use a different video.'
                    }), 429
                elif 'private' in error_msg or 'members-only' in error_msg:
                    return jsonify({
                        'error': 'This video is private or members-only',
                        'suggestion': 'You need special access to view this video.'
                    }), 403
                elif 'not available' in error_msg or 'unavailable' in error_msg:
                    return jsonify({
                        'error': 'Video is not available',
                        'suggestion': 'The video may have been removed or is not accessible in your region.'
                    }), 404
                else:
                    raise e
        
        # Extract relevant information
        video_info = {
            'title': info.get('title', 'Unknown'),
            'duration': info.get('duration', 0),
            'uploader': info.get('uploader', 'Unknown'),
            'view_count': info.get('view_count', 0),
            'upload_date': info.get('upload_date', ''),
            'description': info.get('description', '')[:500] + '...' if info.get('description', '') else '',
            'thumbnail': info.get('thumbnail', ''),
            'formats': []
        }
        
        # Extract available formats
        if 'formats' in info:
            seen_qualities = set()
            for fmt in info['formats']:
                if fmt.get('vcodec') != 'none' and fmt.get('height'):
                    quality = f"{fmt['height']}p"
                    if quality not in seen_qualities:
                        video_info['formats'].append({
                            'quality': quality,
                            'ext': fmt.get('ext', 'mp4'),
                            'filesize': fmt.get('filesize')
                        })
                        seen_qualities.add(quality)
        
        return jsonify(video_info)
        
    except Exception as e:
        return jsonify({'error': f'Failed to get video info: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080, debug=True)