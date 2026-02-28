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
    
    // This gets the base path of the Service Worker (e.g., "/my-repo-name/")
    const swScope = self.registration.scope;
    const scopePath = new URL(swScope).pathname;

    // Check if the request includes 'html5game/'
    if (url.pathname.includes('html5game/')) {
        event.respondWith((async () => {
            try {
                const zip = await loadAndMergeZips();
                
                // FIX: Extract the path relative to the html5game folder
                // This strips everything before 'html5game/' regardless of the repo name
                const relativePath = url.pathname.substring(url.pathname.indexOf('html5game/'));
                
                // ... inside your fetch event listener ...
                
                const file = zip.file(relativePath);
                if (!file) return fetch(event.request);
                
                // 1. Get the raw content
                const content = await file.async('uint8array');
                
                // 2. CLONE the data before creating the Response
                // content.slice() creates a new memory allocation so the original isn't detached
                const clonedContent = content.slice();
                
                const ext = relativePath.split('.').pop().toLowerCase();
                const type = mimeTypes[ext] || 'application/octet-stream';
                
                return new Response(clonedContent, {
                    status: 200,
                    headers: { 
                        'Content-Type': type,
                        'Content-Length': clonedContent.length.toString()
                    }
                });
            } catch (err) {
                return fetch(event.request);
            }
        })());
        return; // Exit fetch listener
    }

    // Handle the UT.js chunks (also path-aware)
    if (url.pathname.endsWith('UT.js')) {
        event.respondWith(getJoinedEngine());
    }
});

