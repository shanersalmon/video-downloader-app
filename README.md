# Video Downloader

A modern web application for downloading videos from YouTube, TikTok, Instagram, Facebook, and other popular platforms. Built with Flask and yt-dlp.

## Features

- **Multi-Platform Support**: Download from YouTube, TikTok, Instagram, Facebook, Twitter, Vimeo, and more
- **Multiple Formats**: Download as MP4 video or MP3 audio
- **Real-time Preview**: See video information before downloading
- **Modern UI**: Clean, responsive design that works on all devices
- **Fast & Secure**: High-speed downloads with no data storage
- **Rate Limiting**: Built-in protection against abuse
- **URL Validation**: Smart validation for supported platforms

## Installation

1. Clone the repository:
```bash
git clone https://github.com/shanersalmon/video-downloader-app.git
cd video-downloader-app
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Run the application:
```bash
python app.py
```

4. Open your browser and navigate to `http://localhost:8080`

## Usage

1. Paste a video URL from any supported platform
2. Choose your preferred format (MP4 video or MP3 audio)
3. Click "Download Video" to start the download
4. The file will be automatically saved to your downloads folder

## Supported Platforms

- YouTube
- TikTok
- Instagram
- Facebook
- Twitter/X
- Vimeo
- Dailymotion
- Twitch
- And many more!

## Technical Details

- **Backend**: Flask (Python)
- **Video Processing**: yt-dlp
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Styling**: Modern CSS with gradients and animations
- **Responsive**: Mobile-first design

## Configuration

The application includes several configuration options:

- **Rate Limiting**: 5 requests per minute per IP
- **Video Quality**: Best available quality up to 720p
- **Audio Quality**: 192kbps MP3
- **Timeout**: 30 seconds for downloads

## Security Features

- Rate limiting to prevent abuse
- URL validation for supported platforms
- No data storage or logging
- Secure headers and CORS protection

## Troubleshooting

### Common Issues

1. **403 Forbidden Error**: The application includes updated headers and user agents to bypass most restrictions
2. **Slow Downloads**: Large files may take time depending on your internet connection
3. **Unsupported URL**: Make sure the URL is from a supported platform

### Error Messages

- "URL not supported": The platform is not supported by yt-dlp
- "Rate limit exceeded": Wait a minute before making another request
- "Download failed": The video may be private or unavailable

## Development

### Project Structure
```
video-downloader-app/
├── app.py              # Main Flask application
├── requirements.txt    # Python dependencies
├── templates/
│   └── index.html     # Main HTML template
└── static/
    ├── style.css      # CSS styles
    └── script.js      # JavaScript functionality
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

### Development Setup

```bash
# Install development dependencies
pip install -r requirements.txt

# Run in debug mode
export FLASK_ENV=development
python app.py
```

## License

This project is open source and available under the MIT License.

## Disclaimer

This tool is for personal use only. Please respect copyright laws and the terms of service of the platforms you're downloading from. The developers are not responsible for any misuse of this application.

## Support

If you encounter any issues or have questions, please open an issue on GitHub.

---

Built with ❤️ using Flask and yt-dlp