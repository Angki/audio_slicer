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
 * @param {Array} options.trackNames - Track names array
 * @param {Array} options.trackArtists - Track artists array
 * @param {Array} options.excludedRegions - Array of excluded regions {start, end}
 * @param {number} options.mp3Bitrate - MP3 bitrate in kbps (default 320)
 * @param {string} options.albumArtist - Album Artist
 * @param {string} options.genre - Genre
 * @param {string} options.comment - Comment
 * @param {string} options.coverArt - Path to cover art image
 * @param {boolean} options.normalize - Apply audio normalization
 * @param {string} options.sampleRate - Output sample rate (e.g. "44100")
 * @param {object} event - IPC Event for sending progress back
 * @returns {Promise<{ tracks: Array, outputPath: string }>}
 */
async function exportTracks(options, event = null) {
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
        albumArtist = '',
        genre = '',
        comment = '',
        coverArt = null,
        normalize = false,
        sampleRate = null,
    } = options;

    // Create output folder: outputDir/Artist/Album/
    const sanitize = (str) => str.replace(/[<>:"/\\|?*]/g, '_').trim().replace(/\.+$/, '');
    const artistDir = sanitize(artist);
    const albumDir = sanitize(album);
    const outputPath = path.join(outputDir, artistDir, albumDir);

    // Validate writable before creating
    try {
        fs.accessSync(outputDir, fs.constants.W_OK);
    } catch (e) {
        throw new Error(`Output directory is not writable: ${outputDir}`);
    }

    fs.mkdirSync(outputPath, { recursive: true });

    const logFile = path.join(outputPath, 'export.log');
    const log = (msg) => {
        const time = new Date().toISOString();
        fs.appendFileSync(logFile, `[${time}] ${msg}\n`);
    };

    log(`Starting export process for ${inputFile}`);
    log(`Output Directory: ${outputPath}`);
    log(`Format: ${format}, Normalize: ${normalize}, SampleRate: ${sampleRate || 'Original'}`);

    // Build segments from markers
    const sortedMarkers = [...markers].sort((a, b) => a - b);
    const segments = [];

    for (let i = 0; i <= sortedMarkers.length; i++) {
        const start = i === 0 ? 0 : sortedMarkers[i - 1];
        const end = i === sortedMarkers.length ? null : sortedMarkers[i];
        const trackNum = i + 1;
        const trackNumStr = String(trackNum).padStart(2, '0');
        const trackName = trackNames[i] || `Track ${trackNumStr}`;
        const trackArtist = (trackArtists && trackArtists[i]) ? trackArtists[i] : artist;
        const fileName = `${trackNumStr} - ${sanitize(trackName)}.${format}`;

        // Determine overlapping excluded regions
        const exclusions = [];
        for (const reg of excludedRegions) {
            const segEnd = end !== null ? end : Number.MAX_VALUE;
            if (reg.start < segEnd && reg.end > start) {
                exclusions.push({
                    start: Math.max(start, reg.start),
                    end: Math.min(segEnd, reg.end)
                });
            }
        }
        exclusions.sort((a, b) => a.start - b.start);

        segments.push({
            start, end, exclusions, trackNum, trackNumStr, trackName, trackArtist, fileName,
            filePath: path.join(outputPath, fileName),
        });
    }

    const results = [];
    const meta = { format, artist, album, year, mp3Bitrate, albumArtist, genre, comment, coverArt, normalize, sampleRate };

    if (event) {
        event.sender.send('export:init', { totalTracks: segments.length });
    }

    for (const seg of segments) {
        let retries = 3;
        let success = false;
        let lastError = null;

        log(`Starting encoding track ${seg.trackNum}: ${seg.fileName}`);

        if (event) {
            event.sender.send('export:progress', {
                type: 'start_track',
                trackNum: seg.trackNum,
                totalTracks: segments.length,
                trackName: seg.trackName
            });
        }

        while (retries > 0 && !success) {
            try {
                await exportSegment(inputFile, seg, meta, event);
                success = true;
                log(`Successfully encoded track ${seg.trackNum}`);
            } catch (err) {
                retries--;
                lastError = err;
                log(`Error encoding track ${seg.trackNum}. Retries left: ${retries}. Error: ${err.message}`);
                if (retries > 0) {
                    log(`Retrying track ${seg.trackNum}...`);
                    await new Promise(r => setTimeout(r, 1000)); // wait 1s before retry
                }
            }
        }

        if (!success) {
            log(`FATAL: Failed to encode track ${seg.trackNum} after all retries.`);
            throw new Error(`Failed to encode track ${seg.trackNum}: ${lastError.message}`);
        }

        results.push({
            trackNum: seg.trackNum,
            trackName: seg.trackName,
            fileName: seg.fileName,
            filePath: seg.filePath,
            start: seg.start,
            end: seg.end,
        });
    }

    log(`Export process completed successfully.`);
    return { tracks: results, outputPath };
}

/**
 * Export a single segment.
 */
function exportSegment(inputFile, segment, meta, event) {
    return new Promise((resolve, reject) => {
        const { start, end, filePath, exclusions } = segment;
        const { format, album, year, mp3Bitrate, albumArtist, genre, comment, coverArt, normalize, sampleRate } = meta;
        const trackArtist = segment.trackArtist; // Segment specific artist

        let cmd = ffmpeg(inputFile);

        // Track duration estimation for progress
        let estDuration = (end !== null ? end : start + 300) - start;

        // Cover Art embedding
        const hasCover = coverArt && fs.existsSync(coverArt);
        if (hasCover) {
            cmd = cmd.input(coverArt);
        }

        if (!exclusions || exclusions.length === 0) {
            // Standard export
            cmd = cmd.seekInput(start);
            if (end !== null) {
                cmd = cmd.duration(end - start);
            }
            if (normalize) {
                cmd = cmd.audioFilter('loudnorm=I=-16:TP=-1.5:LRA=11');
            }
        } else {
            // Complex filter export (stitching around exclusions)
            const keptChunks = [];
            let current = start;

            for (const excl of exclusions) {
                if (excl.start > current) {
                    keptChunks.push({ start: current, end: excl.start });
                }
                current = excl.end;
            }

            const segEnd = end !== null ? end : null;
            if (segEnd === null || current < segEnd) {
                keptChunks.push({ start: current, end: segEnd });
            }

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

            let finalOutputLabel = 'outa';

            if (keptChunks.length > 1) {
                filterSpecs.push(`${concatInputs.join('')}concat=n=${keptChunks.length}:v=0:a=1[concatOut]`);
                if (normalize) {
                    filterSpecs.push(`[concatOut]loudnorm=I=-16:TP=-1.5:LRA=11[outa]`);
                } else {
                    finalOutputLabel = 'concatOut';
                }
                cmd = cmd.complexFilter(filterSpecs, [finalOutputLabel]);
            } else if (keptChunks.length === 1) {
                if (normalize) {
                    filterSpecs.push(`[a0]loudnorm=I=-16:TP=-1.5:LRA=11[outa]`);
                    cmd = cmd.complexFilter(filterSpecs, ['outa']);
                } else {
                    cmd = cmd.complexFilter(filterSpecs, [`a0`]);
                }
            } else {
                return reject(new Error('Track is completely excluded. Cannot export empty track.'));
            }

            // Recalculate estimated duration
            estDuration = keptChunks.reduce((acc, c) => acc + ((c.end || c.start + 300) - c.start), 0);
        }

        // Output mappings depending on cover art
        if (hasCover) {
            if (exclusions.length > 0) {
                // If complex filter is used, audio comes from filter out
                // We'll let ffmpeg map automatically or map video explicitly
                cmd = cmd.outputOptions('-map', '1:v')
                    .outputOptions('-c:v', 'copy')
                    .outputOptions('-disposition:v:0', 'attached_pic');
            } else {
                // Normal trim, just map inputs
                cmd = cmd.outputOptions('-map', '0:a')
                    .outputOptions('-map', '1:v')
                    .outputOptions('-c:v', 'copy')
                    .outputOptions('-disposition:v:0', 'attached_pic');
            }
        }

        // Sample rate
        if (sampleRate) {
            cmd = cmd.audioFrequency(sampleRate);
        }

        // Format and Codec
        switch (format) {
            case 'wav':
                cmd = cmd.audioCodec('pcm_s16le').format('wav');
                break;
            case 'flac':
                cmd = cmd.audioCodec('flac').format('flac');
                break;
            case 'mp3':
                cmd = cmd.audioCodec('libmp3lame').audioBitrate(mp3Bitrate).format('mp3');
                if (hasCover) {
                    cmd = cmd.outputOptions('-id3v2_version', '3'); // Better cover support for MP3 in some players
                }
                break;
            default:
                cmd = cmd.audioCodec('flac').format('flac');
        }

        // Metadata Tags
        cmd = cmd
            .outputOptions('-metadata', `artist=${trackArtist}`)
            .outputOptions('-metadata', `album=${album}`)
            .outputOptions('-metadata', `title=${segment.trackName}`)
            .outputOptions('-metadata', `track=${segment.trackNum}`);

        if (year) cmd = cmd.outputOptions('-metadata', `date=${year}`);
        if (albumArtist) cmd = cmd.outputOptions('-metadata', `album_artist=${albumArtist}`);
        if (genre) cmd = cmd.outputOptions('-metadata', `genre=${genre}`);
        if (comment) cmd = cmd.outputOptions('-metadata', `comment=${comment}`);

        cmd
            .on('progress', (progress) => {
                if (event) {
                    // Try to use progress.percent, or calculate it based on timemark
                    let percent = progress.percent;
                    if (!percent && progress.timemark) {
                        const parts = progress.timemark.match(/(\d{2}):(\d{2}):(\d{2}).(\d{2})/);
                        if (parts) {
                            const secs = parseInt(parts[1]) * 3600 + parseInt(parts[2]) * 60 + parseInt(parts[3]) + parseInt(parts[4]) / 100;
                            percent = (secs / estDuration) * 100;
                        }
                    }
                    if (percent !== undefined && !isNaN(percent)) {
                        event.sender.send('export:progress', {
                            type: 'encode_progress',
                            percent: Math.min(percent, 100),
                            trackNum: segment.trackNum
                        });
                    }
                }
            })
            .on('end', () => {
                // node-id3 failsafe for MP3
                if (format === 'mp3') {
                    try {
                        const tags = {
                            title: segment.trackName,
                            artist: trackArtist,
                            album: album,
                            trackNumber: String(segment.trackNum),
                        };
                        if (year) tags.year = year;
                        if (genre) tags.genre = genre;
                        if (albumArtist) tags.performerInfo = albumArtist;
                        if (comment) tags.comment = comment;
                        if (hasCover) {
                            tags.image = coverArt;
                        }
                        NodeID3.update(tags, filePath);
                    } catch (e) {
                        console.warn('ID3 tag write warning:', e.message);
                    }
                }
                resolve(filePath);
            })
            .on('error', (err, stdout, stderr) => {
                reject(new Error(stderr || err.message));
            })
            .save(filePath);
    });
}

module.exports = { exportTracks };

