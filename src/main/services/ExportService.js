/**
 * AutoSlice Export Engine
 * Handles slicing audio into tracks, format conversion, and metadata tagging.
 */

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

/**
 * Export tracks based on markers.
 * @param {object} options
 * @param {string} options.inputFile - Source audio file path
 * @param {Array} options.markers - Array of marker times (seconds), sorted ascending
 * @param {string} options.outputDir - Base output directory
 * @param {string} options.format - Output format: 'wav', 'flac', 'mp3'
 * @param {string} options.artist - Artist name
 * @param {string} options.album - Album name
 * @param {string} options.year - Release year
 * @param {Array} options.trackNames - Track names array (can be partial)
 * @param {number} options.mp3Bitrate - MP3 bitrate in kbps (default 320)
 * @returns {Promise<{ tracks: Array, outputPath: string }>}
 */
async function exportTracks(options) {
    const {
        inputFile,
        markers = [],
        outputDir,
        format = 'flac',
        artist = 'Unknown Artist',
        album = 'Unknown Album',
        year = '',
        trackNames = [],
        trackArtists = [],
        mp3Bitrate = 320,
    } = options;

    // Create output folder: outputDir/Artist/Album/
    // Remove illegal chars AND trailing dots (Windows issue)
    const sanitize = (str) => str.replace(/[<>:"/\\|?*]/g, '_').trim().replace(/\.+$/, '');
    const artistDir = sanitize(artist);
    const albumDir = sanitize(album);
    const outputPath = path.join(outputDir, artistDir, albumDir);
    fs.mkdirSync(outputPath, { recursive: true });

    // Build segments from markers
    // Markers are split points. Track 1: 0 → marker[0], Track 2: marker[0] → marker[1], etc.
    const sortedMarkers = [...markers].sort((a, b) => a - b);
    const segments = [];

    for (let i = 0; i <= sortedMarkers.length; i++) {
        const start = i === 0 ? 0 : sortedMarkers[i - 1];
        const end = i === sortedMarkers.length ? null : sortedMarkers[i]; // null = end of file
        const trackNum = i + 1;
        const trackNumStr = String(trackNum).padStart(2, '0');
        const trackName = trackNames[i] || `Track ${trackNumStr}`;
        const trackArtist = (trackArtists && trackArtists[i]) ? trackArtists[i] : artist;
        const fileName = `${trackNumStr} - ${sanitize(trackName)}.${format}`;

        segments.push({
            start,
            end,
            trackNum,
            trackNumStr,
            trackName,
            fileName,
            filePath: path.join(outputPath, fileName),
        });
    }

    // Export each segment
    const results = [];
    for (const seg of segments) {
        await exportSegment(inputFile, seg, { format, artist: seg.trackArtist, album, year, mp3Bitrate });
        results.push({
            trackNum: seg.trackNum,
            trackName: seg.trackName,
            fileName: seg.fileName,
            filePath: seg.filePath,
            start: seg.start,
            end: seg.end,
        });
    }

    return { tracks: results, outputPath };
}

/**
 * Export a single segment.
 */
function exportSegment(inputFile, segment, meta) {
    return new Promise((resolve, reject) => {
        const { start, end, filePath } = segment;
        const { format, artist, album, year, mp3Bitrate } = meta;

        let cmd = ffmpeg(inputFile)
            .seekInput(start);

        if (end !== null) {
            cmd = cmd.duration(end - start);
        }

        // Set codec based on format
        switch (format) {
            case 'wav':
                cmd = cmd.audioCodec('pcm_s16le').format('wav');
                break;
            case 'flac':
                cmd = cmd.audioCodec('flac').format('flac');
                break;
            case 'mp3':
                cmd = cmd.audioCodec('libmp3lame').audioBitrate(mp3Bitrate).format('mp3');
                break;
            default:
                cmd = cmd.audioCodec('flac').format('flac');
        }

        // Add metadata
        cmd = cmd
            .outputOptions('-metadata', `artist=${artist}`)
            .outputOptions('-metadata', `album=${album}`)
            .outputOptions('-metadata', `title=${segment.trackName}`)
            .outputOptions('-metadata', `track=${segment.trackNum}`)

        if (year) {
            cmd = cmd.outputOptions('-metadata', `date=${year}`);
        }

        cmd
            .on('end', () => {
                // For MP3, also write ID3 tags with node-id3 for compatibility
                if (format === 'mp3') {
                    try {
                        const tags = {
                            title: segment.trackName,
                            artist: artist,
                            album: album,
                            trackNumber: String(segment.trackNum),
                        };
                        if (year) tags.year = year;
                        NodeID3.update(tags, filePath);
                    } catch (e) {
                        console.warn('ID3 tag write warning:', e.message);
                    }
                }
                resolve(filePath);
            })
            .on('error', (err) => reject(err))
            .save(filePath);
    });
}

module.exports = { exportTracks };
