/**
 * AutoSlice Export Engine
 * Handles slicing audio into tracks, format conversion, and metadata tagging.
 */

const ffmpeg = require('../utils/ffmpeg');
const path = require('path');
const fs = require('fs');
const NodeID3 = require('node-id3');

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
        excludedRegions = [],
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

        // Determine overlapping excluded regions
        const exclusions = [];
        for (const reg of excludedRegions) {
            // Check overlap
            const segEnd = end !== null ? end : Number.MAX_VALUE;
            if (reg.start < segEnd && reg.end > start) {
                // Clamp exclusion to segment bounds
                exclusions.push({
                    start: Math.max(start, reg.start),
                    end: Math.min(segEnd, reg.end)
                });
            }
        }

        // Sort exclusions
        exclusions.sort((a, b) => a.start - b.start);

        segments.push({
            start,
            end,
            exclusions,
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
        const { start, end, filePath, exclusions } = segment;
        const { format, artist, album, year, mp3Bitrate } = meta;

        let cmd = ffmpeg(inputFile);

        if (!exclusions || exclusions.length === 0) {
            // Standard export (no exclusions)
            cmd = cmd.seekInput(start);
            if (end !== null) {
                cmd = cmd.duration(end - start);
            }
        } else {
            // Complex filter export (stitching around exclusions)
            // We need to build a filterchain that takes the segment from 'start' to 'end'
            // and cuts out the 'exclusions'.
            // Actually, it's easier to build valid "kept" chunks.
            const keptChunks = [];
            let current = start;

            for (const excl of exclusions) {
                if (excl.start > current) {
                    keptChunks.push({ start: current, end: excl.start });
                }
                current = excl.end;
            }

            // Add final chunk if applicable
            const segEnd = end !== null ? end : null; // If null, we don't have a defined end (till EOF)
            // For complex filter, atrim needs an end. If end is null, we just omit the end property for the last chunk.
            if (segEnd === null || current < segEnd) {
                keptChunks.push({ start: current, end: segEnd });
            }

            // Build filter string
            // Example for 2 chunks: [0:a]atrim=start=0:end=10,asetpts=PTS-STARTPTS[a1]; [0:a]atrim=start=15:end=20,asetpts=PTS-STARTPTS[a2]; [a1][a2]concat=n=2:v=0:a=1[outa]
            const filterSpecs = [];
            const concatInputs = [];

            keptChunks.forEach((chunk, i) => {
                const label = `a${i}`;
                let trim = `atrim=start=${chunk.start}`;
                if (chunk.end !== null) {
                    trim += `:end=${chunk.end}`;
                }
                filterSpecs.push(`[0:a]${trim},asetpts=PTS-STARTPTS[${label}]`);
                concatInputs.push(`[${label}]`);
            });

            if (keptChunks.length > 1) {
                const concatFilter = `${concatInputs.join('')}concat=n=${keptChunks.length}:v=0:a=1[outa]`;
                filterSpecs.push(concatFilter);
                cmd = cmd.complexFilter(filterSpecs, ['outa']);
            } else if (keptChunks.length === 1) {
                // Only one chunk (e.g. exclusion was exactly at the end/start, resulting in 1 kept chunk)
                // Just use the single trim
                cmd = cmd.complexFilter(filterSpecs, [`a0`]);
            } else {
                // 0 chunks? The entire track was excluded!
                // ffmpeg will error if there's no output.
                return reject(new Error('Track is completely excluded. Cannot export empty track.'));
            }
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
