importScripts('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js');

const zipFiles = ['assets1.zip', 'assets2.zip']; // Update this list!
const engineParts = ['UT.js.part1', 'UT.js.part2']; // The chunks created by Python

let masterZip = null;

// Helper to join UT.js chunks
async function getJoinedEngine() {
    const parts = await Promise.all(engineParts.map(p => fetch(p).then(r => r.arrayBuffer())));
    const blob = new Blob(parts, { type: 'application/javascript' });
    return new Response(blob);
}

// ... (keep the loadAndMergeZips function from previous response) ...

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // 1. Handle the Engine (UT.js)
    if (url.pathname.endsWith('UT.js')) {
        event.respondWith(getJoinedEngine());
        return;
    }

    // 2. Handle the Assets (html5game/)
    if (url.pathname.includes('html5game/')) {
        event.respondWith((async () => {
            const zip = await loadAndMergeZips();
            const relativePath = url.pathname.substring(url.pathname.indexOf('html5game/'));
            const file = zip.file(relativePath);
            
            if (!file) return fetch(event.request);

            const content = await file.async('uint8array');
            const ext = relativePath.split('.').pop().toLowerCase();
            const type = (ext === 'ogg') ? 'audio/ogg' : 'application/octet-stream'; 

            return new Response(content, { headers: { 'Content-Type': type } });
        })());
    }
});