importScripts('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js');

// 1. SETTINGS - Update these to match your file names
const zipFiles = ['assets1.zip', 'assets2.zip']; 
const engineParts = ['UT.js.part1', 'UT.js.part2'];

const mimeTypes = {
    'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
    'gif': 'image/gif', 'webp': 'image/webp', 'js': 'application/javascript',
    'css': 'text/css', 'json': 'application/json', 'mp3': 'audio/mpeg',
    'ogg': 'audio/ogg', 'wav': 'audio/wav', 'wasm': 'application/wasm'
};

let masterZip = null;
let loadPromise = null;

// 2. THE MISSING FUNCTION: Loads and merges all zips into one virtual FS
async function loadAndMergeZips() {
    if (masterZip) return masterZip;
    if (loadPromise) return loadPromise;

    loadPromise = (async () => {
        const mergedZip = new JSZip();
        try {
            const zipBuffers = await Promise.all(
                zipFiles.map(file => fetch(file).then(res => {
                    if (!res.ok) throw new Error(`Failed to load ${file}`);
                    return res.arrayBuffer();
                }))
            );

            for (const buffer of zipBuffers) {
                await mergedZip.loadAsync(buffer);
            }

            masterZip = mergedZip;
            return masterZip;
        } catch (err) {
            console.error("ZIP Merge Error:", err);
            loadPromise = null; 
            throw err;
        }
    })();

    return loadPromise;
}

// 3. ENGINE JOINER: Stitches the split UT.js back together
async function getJoinedEngine() {
    try {
        const parts = await Promise.all(engineParts.map(p => fetch(p).then(r => r.arrayBuffer())));
        const blob = new Blob(parts, { type: 'application/javascript' });
        return new Response(blob);
    } catch (err) {
        console.error("Engine Stitch Error:", err);
        return fetch('UT.js.part1'); // Fallback to first part as last resort
    }
}

// 4. SERVICE WORKER LIFECYCLE
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// 5. FETCH INTERCEPTION
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Handle the Engine (UT.js)
    if (url.pathname.endsWith('UT.js')) {
        event.respondWith(getJoinedEngine());
        return;
    }

    // Handle Game Assets
    if (url.pathname.includes('html5game/')) {
        event.respondWith((async () => {
            try {
                const zip = await loadAndMergeZips();
                
                // Identify the file path inside the ZIP
                const match = url.pathname.match(/html5game\/.+$/);
                if (!match) return fetch(event.request);
                const relativePath = match[0];

                const file = zip.file(relativePath);
                if (!file) {
                    console.error(`[SW] 404 - Not in ZIP: ${relativePath}`);
                    return new Response("Asset not found in ZIP", { status: 404 });
                }

                // Get content and SLICE it to prevent DataCloneError
                const content = await file.async('uint8array');
                const clonedContent = content.slice();

                const ext = relativePath.split('.').pop().toLowerCase();
                let type = mimeTypes[ext] || 'application/octet-stream';

                return new Response(clonedContent, {
                    status: 200,
                    headers: { 
                        'Content-Type': type,
                        'Content-Length': clonedContent.length.toString(),
                        'Accept-Ranges': 'bytes'
                    }
                });
            } catch (err) {
                console.error(`[SW] Fetch Error for ${url.pathname}:`, err);
                return fetch(event.request);
            }
        })());
    }
});
