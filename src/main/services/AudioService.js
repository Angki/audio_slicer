/**
 * AutoSlice Audio Engine
 * Handles audio decoding, RMS analysis, and gap detection.
 */

const ffmpeg = require('../utils/ffmpeg');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execSync } = require('child_process');

const TEMP_DIR = path.join(os.tmpdir(), 'autoslice');
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

// ── Get Audio Info ──────────────────────────────────────────────

function getAudioInfo(filePath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) return reject(err);
            const stream = metadata.streams.find(s => s.codec_type === 'audio');
            if (!stream) return reject(new Error('No audio stream found'));
            resolve({
                duration: parseFloat(metadata.format.duration),
                sampleRate: parseInt(stream.sample_rate),
                channels: stream.channels,
                bitRate: parseInt(metadata.format.bit_rate) || 0,
                codec: stream.codec_name,
                format: metadata.format.format_name,
                filePath,
                fileName: path.basename(filePath),
            });
        });
    });
}

// ── Decode to WAV (for WaveSurfer playback) ─────────────────────

function decodeToWav(filePath) {
    return new Promise((resolve, reject) => {
        const ext = path.extname(filePath).toLowerCase();
        // If already WAV, just return original path
        if (ext === '.wav') return resolve(filePath);

        const outName = `decoded_${Date.now()}.wav`;
        const outPath = path.join(TEMP_DIR, outName);

        ffmpeg(filePath)
            .audioCodec('pcm_s16le')
            .audioFrequency(44100)
            .format('wav')
            .on('end', () => resolve(outPath))
            .on('error', (err) => reject(err))
            .save(outPath);
    });
}

// ── Decode to raw Float32 PCM (for analysis) ────────────────────

function decodeToRawPCM(filePath) {
    return new Promise((resolve, reject) => {
        const outPath = path.join(TEMP_DIR, `raw_${Date.now()}.pcm`);

        ffmpeg(filePath)
            .audioChannels(1) // mono mixdown
            .audioFrequency(22050) // downsample for faster analysis
            .format('f32le') // 32-bit float little-endian
            .on('end', () => {
                try {
                    const buffer = fs.readFileSync(outPath);
                    const samples = new Float32Array(buffer.buffer, buffer.byteOffset, buffer.length / 4);
                    // Clean up temp file
                    try { fs.unlinkSync(outPath); } catch (e) { /* ignore */ }
                    resolve({ samples, sampleRate: 22050 });
                } catch (e) {
                    reject(e);
                }
            })
            .on('error', (err) => reject(err))
            .save(outPath);
    });
}

// ── RMS Analysis ────────────────────────────────────────────────

/**
 * Compute RMS energy per window.
 * @param {Float32Array} samples - Mono PCM samples
 * @param {number} sampleRate
 * @param {number} windowMs - Window size in ms (default 50)
 * @param {number} hopMs - Hop size in ms (default 25)
 * @returns {{ rmsDb: Float32Array, times: Float32Array }}
 */
function computeRMS(samples, sampleRate, windowMs = 50, hopMs = 25) {
    const windowSize = Math.floor((sampleRate * windowMs) / 1000);
    const hopSize = Math.floor((sampleRate * hopMs) / 1000);
    const numFrames = Math.floor((samples.length - windowSize) / hopSize) + 1;

    const rmsDb = new Float32Array(numFrames);
    const times = new Float32Array(numFrames);

    for (let i = 0; i < numFrames; i++) {
        const start = i * hopSize;
        let sum = 0;
        for (let j = start; j < start + windowSize; j++) {
            sum += samples[j] * samples[j];
        }
        const rms = Math.sqrt(sum / windowSize);
        // Convert to dB, floor at -100dB
        rmsDb[i] = rms > 0 ? Math.max(20 * Math.log10(rms), -100) : -100;
        times[i] = start / sampleRate;
    }

    return { rmsDb, times };
}

// ── Noise Floor Estimation ──────────────────────────────────────

/**
 * Estimate noise floor from the quietest 10% of the audio.
 */
function estimateNoiseFloor(rmsDb) {
    const sorted = Array.from(rmsDb).sort((a, b) => a - b);
    const percentile10 = Math.floor(sorted.length * 0.1);
    let sum = 0;
    for (let i = 0; i < percentile10; i++) {
        sum += sorted[i];
    }
    return sum / percentile10;
}

// ── Gap Detection ───────────────────────────────────────────────

/**
 * Detect silence gaps in audio.
 * @param {string} filePath - Path to audio file
 * @param {object} params
 * @param {number} params.thresholdDb - Silence threshold in dB (default -40)
 * @param {number} params.minDurationMs - Minimum silence duration in ms (default 1500)
 * @param {number} params.sensitivity - 0.0 to 1.0, adjusts threshold relative to noise floor (default 0.5)
 * @param {boolean} params.autoThreshold - Auto-calibrate threshold from noise floor (default true)
 * @returns {Promise<{ gaps: Array, markers: Array, trackCount: number }>}
 */
async function detectGaps(filePath, params = {}) {
    const {
        thresholdDb = -40,
        minDurationMs = 1500,
        sensitivity = 0.5,
        autoThreshold = true,
        windowMs = 50,
        hopMs = 25,
    } = params;

    // Decode to mono PCM
    const { samples, sampleRate } = await decodeToRawPCM(filePath);

    // Compute RMS
    const { rmsDb, times } = computeRMS(samples, sampleRate, windowMs, hopMs);

    // Determine effective threshold
    let effectiveThreshold = thresholdDb;
    if (autoThreshold) {
        const noiseFloor = estimateNoiseFloor(rmsDb);
        // Position threshold between noise floor and a reasonable signal level
        // sensitivity=0 → close to noiseFloor, sensitivity=1 → closer to -20dB
        const ceiling = -20;
        effectiveThreshold = noiseFloor + (ceiling - noiseFloor) * sensitivity * 0.3;
        // Don't go above the manual threshold
        effectiveThreshold = Math.min(effectiveThreshold, thresholdDb);
    }

    // Find silence regions
    const hopMs_ = hopMs;
    const minFrames = Math.ceil(minDurationMs / hopMs_);
    const silenceRegions = [];
    let silenceStart = -1;

    for (let i = 0; i < rmsDb.length; i++) {
        if (rmsDb[i] < effectiveThreshold) {
            if (silenceStart === -1) silenceStart = i;
        } else {
            if (silenceStart !== -1) {
                const length = i - silenceStart;
                if (length >= minFrames) {
                    silenceRegions.push({
                        startFrame: silenceStart,
                        endFrame: i,
                        startTime: times[silenceStart],
                        endTime: times[i],
                        duration: times[i] - times[silenceStart],
                    });
                }
                silenceStart = -1;
            }
        }
    }
    // Handle trailing silence
    if (silenceStart !== -1) {
        const length = rmsDb.length - silenceStart;
        if (length >= minFrames) {
            silenceRegions.push({
                startFrame: silenceStart,
                endFrame: rmsDb.length - 1,
                startTime: times[silenceStart],
                endTime: times[rmsDb.length - 1],
                duration: times[rmsDb.length - 1] - times[silenceStart],
            });
        }
    }

    // Compute markers (midpoints of silence regions)
    const markers = silenceRegions.map((region, idx) => ({
        id: `auto_${idx}`,
        time: (region.startTime + region.endTime) / 2,
        silenceStart: region.startTime,
        silenceEnd: region.endTime,
        silenceDuration: region.duration,
    }));

    // Filter out markers too close to start/end (within 5 seconds)
    const audioInfo = await getAudioInfo(filePath);
    const totalDuration = audioInfo.duration;
    const filteredMarkers = markers.filter(
        m => m.time > 5 && m.time < totalDuration - 5
    );

    // Fallback: if no gaps found, try progressively higher thresholds
    if (filteredMarkers.length === 0 && effectiveThreshold < -25) {
        console.log('No gaps detected, retrying with higher threshold...');
        return detectGaps(filePath, {
            ...params,
            thresholdDb: effectiveThreshold + 5,
            autoThreshold: false,
        });
    }

    return {
        gaps: silenceRegions,
        markers: filteredMarkers,
        trackCount: filteredMarkers.length + 1,
        effectiveThreshold,
        noiseFloor: autoThreshold ? estimateNoiseFloor(rmsDb) : null,
    };
}

// ── RMS Data for Visualization ──────────────────────────────────

async function analyzeRMSFromFile(filePath, windowMs = 50) {
    const { samples, sampleRate } = await decodeToRawPCM(filePath);
    const { rmsDb, times } = computeRMS(samples, sampleRate, windowMs);

    // Downsample for transfer (max ~50000 points for UI)
    const maxPoints = 50000;
    if (rmsDb.length <= maxPoints) {
        return {
            rmsDb: Array.from(rmsDb),
            times: Array.from(times),
        };
    }

    const step = Math.ceil(rmsDb.length / maxPoints);
    const downsampled = [];
    const downsampledTimes = [];
    for (let i = 0; i < rmsDb.length; i += step) {
        downsampled.push(rmsDb[i]);
        downsampledTimes.push(times[i]);
    }

    return {
        rmsDb: downsampled,
        times: downsampledTimes,
    };
}

// ── Cleanup temp files ──────────────────────────────────────────

function cleanupTemp() {
    try {
        const files = fs.readdirSync(TEMP_DIR);
        for (const f of files) {
            fs.unlinkSync(path.join(TEMP_DIR, f));
        }
    } catch (e) { /* ignore */ }
}

module.exports = {
    getAudioInfo,
    decodeToWav,
    decodeToRawPCM,
    computeRMS,
    estimateNoiseFloor,
    detectGaps,
    analyzeRMSFromFile,
    cleanupTemp,
};
