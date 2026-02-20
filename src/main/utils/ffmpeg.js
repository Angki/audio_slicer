const ffmpeg = require('fluent-ffmpeg');
let ffmpegPath = require('ffmpeg-static');
let ffprobePath = require('ffprobe-static').path;

// Fix absolute paths for production (asar unpacked)
if (ffmpegPath.includes('app.asar')) {
    ffmpegPath = ffmpegPath.replace('app.asar', 'app.asar.unpacked');
}
if (ffprobePath.includes('app.asar')) {
    ffprobePath = ffprobePath.replace('app.asar', 'app.asar.unpacked');
}

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath);

module.exports = ffmpeg;
