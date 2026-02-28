/**
 * AutoSlice Discogs Client
 * Handles Discogs API search and tracklist retrieval.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');

const DISCOGS_BASE = 'https://api.discogs.com';
const USER_AGENT = 'AutoSlice/1.0';

/**
 * Make an HTTPS GET request to Discogs API.
 */
function discogsRequest(urlPath, token) {
    return new Promise((resolve, reject) => {
        const url = new URL(urlPath, DISCOGS_BASE);
        const headers = {
            'User-Agent': USER_AGENT,
        };
        if (token) {
            headers['Authorization'] = `Discogs token=${token}`;
        }

        https.get(url.toString(), { headers }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error(`Failed to parse Discogs response: ${data.substring(0, 200)}`));
                }
            });
            res.on('error', reject);
        }).on('error', reject);
    });
}

/**
 * Search for a release on Discogs.
 * @param {string} artist
 * @param {string} album
 * @param {string} token - Discogs personal access token
 * @returns {Promise<Array>} - Array of release results
 */
async function searchRelease(artist, album, token) {
    const query = encodeURIComponent(`${artist} ${album}`.trim());
    const data = await discogsRequest(
        `/database/search?q=${query}&type=release&per_page=10`,
        token
    );

    if (!data.results) return [];

    return data.results.map(r => ({
        id: r.id,
        title: r.title,
        year: r.year || '',
        country: r.country || '',
        format: (r.format || []).join(', '),
        label: (r.label || []).join(', '),
        thumb: r.thumb || '',
        resourceUrl: r.resource_url,
    }));
}

/**
 * Get tracklist for a specific release.
 * @param {number} releaseId
 * @param {string} token
 * @returns {Promise<{ tracklist: Array, info: object }>}
 */
async function getTracklist(releaseId, token) {
    const data = await discogsRequest(`/releases/${releaseId}`, token);

    if (!data.tracklist) {
        return { tracklist: [], info: {} };
    }

    const tracklist = data.tracklist
        .filter(t => t.type_ === 'track')
        .map((t, index) => ({
            position: t.position || String(index + 1),
            title: t.title,
            duration: t.duration || '',
            durationSeconds: parseDuration(t.duration),
            artists: t.artists ? t.artists.map(a => a.name).join(', ') : '',
        }));

    return {
        tracklist,
        info: {
            title: data.title || '',
            artists: (data.artists || []).map(a => a.name).join(', '),
            year: data.year || '',
            genres: data.genres || [],
            styles: data.styles || [],
            labels: (data.labels || []).map(l => l.name).join(', '),
            images: data.images ? data.images.map(img => img.resource_url || img.uri) : [],
        },
    };
}

/**
 * Parse a duration string like "3:45" or "12:30" to seconds.
 */
function parseDuration(durStr) {
    if (!durStr) return 0;
    const parts = durStr.split(':').map(Number);
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return 0;
}

/**
 * Attempt to match detected markers/segments to official tracklist by duration.
 * @param {Array} segments - Array of { start, end, duration }
 * @param {Array} tracklist - Array of { title, durationSeconds }
 * @returns {Array} - Matched results
 */
function matchMarkersToTracklist(segments, tracklist) {
    // Simple sequential matching with tolerance
    const tolerance = 10; // seconds
    const matched = [];

    for (let i = 0; i < Math.max(segments.length, tracklist.length); i++) {
        const seg = segments[i] || null;
        const track = tracklist[i] || null;

        let confidence = 'none';
        if (seg && track && track.durationSeconds > 0) {
            const diff = Math.abs(seg.duration - track.durationSeconds);
            if (diff <= 3) confidence = 'high';
            else if (diff <= tolerance) confidence = 'medium';
            else confidence = 'low';
        }

        matched.push({
            index: i,
            segment: seg,
            track: track,
            confidence,
            title: track ? track.title : (seg ? `Track ${String(i + 1).padStart(2, '0')}` : ''),
        });
    }

    return matched;
}

/**
 * Download a cover image to a temporary file.
 */
function downloadCover(imageUrl, token) {
    return new Promise((resolve, reject) => {
        const url = new URL(imageUrl);
        const headers = { 'User-Agent': USER_AGENT };
        if (token) headers['Authorization'] = `Discogs token=${token}`;

        https.get(url.toString(), { headers }, (res) => {
            if (res.statusCode !== 200) {
                return reject(new Error(`Failed to download image (Status: ${res.statusCode})`));
            }

            const ext = path.extname(url.pathname) || '.jpg';
            const tempPath = path.join(os.tmpdir(), `autoslice_cover_${Date.now()}${ext}`);
            const fileStream = fs.createWriteStream(tempPath);

            res.pipe(fileStream);

            fileStream.on('finish', () => {
                fileStream.close();
                resolve(tempPath);
            });
            fileStream.on('error', (err) => {
                fs.unlink(tempPath, () => { });
                reject(err);
            });
        }).on('error', reject);
    });
}

module.exports = {
    searchRelease,
    getTracklist,
    matchMarkersToTracklist,
    parseDuration,
    downloadCover,
};
