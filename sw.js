importScripts('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js');

const zipFiles = ['assets1.zip', 'assets2.zip', 'assets3.zip', 'assets4.zip', 'assets5.zip', 'assets6.zip'];
const engineParts = ['UT.js.part1', 'UT.js.part2'];

let masterZip = null;

// Helper to join UT.js chunks
async function getJoinedEngine() {
    const parts = await Promise.all(engineParts.map(p => fetch(p).then(r => r.arrayBuffer())));
    const blob = new Blob(parts, { type: 'application/javascript' });
    return new Response(blob);
}


self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    console.log(`[SW] Requesting: ${url.pathname} | Cleaned: ${url.pathname.match(/html5game\/.+$/)?.[0]}`);

    if (url.pathname.includes('html5game/')) {
        event.respondWith((async () => {
            try {
                const zip = await loadAndMergeZips();
                
                // NORMALIZE PATH: 
                // This finds "html5game/..." even if the URL is "/repo/html5game/..."
                const match = url.pathname.match(/html5game\/.+$/);
                if (!match) return fetch(event.request);
                
                const relativePath = match[0]; 
                
                // Try to find the file. If not found, try stripping "html5game/" 
                // just in case the zip was made without the root folder.
                // even though that won't happen because the archives are correct. They even work locally, just not on GitHub Pages.
                let file = zip.file(relativePath);
                if (!file) {
                    const flatPath = relativePath.replace('html5game/', '');
                    file = zip.file(flatPath);
                }

                if (!file) {
                    console.error(`[SW] 404 - Not in ZIP: ${relativePath}`);
                    return new Response("Not Found", { status: 404 });
                }

                const content = await file.async('uint8array');
                const extension = relativePath.split('.').pop().toLowerCase();
                
                // AUDIO FIX: Browsers are extremely picky about MIME types for decoding
                let type = mimeTypes[extension] || 'application/octet-stream';
                if (extension === 'ogg') type = 'audio/ogg';
                if (extension === 'mp3') type = 'audio/mpeg';
                if (extension === 'wav') type = 'audio/wav';

                return new Response(content.slice(), {
                    status: 200,
                    headers: { 
                        'Content-Type': type,
                        'Content-Length': content.length.toString(),
                        'Accept-Ranges': 'bytes' // Crucial for audio seeking
                    }
                });
            } catch (err) {
                console.error("[SW] Fetch Error:", err);
                return fetch(event.request);
            }
        })());
        return;
    }

    if (url.pathname.endsWith('UT.js')) {
        event.respondWith(getJoinedEngine());
    }
});


