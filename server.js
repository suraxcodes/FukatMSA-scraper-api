const express = require('express');
const cors = require('cors');
const { MOVIES } = require('@consumet/extensions');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// Initialize all available movie scrapers (The "BeeTV" Fallback Loop)
const providers = [
    new MOVIES.FlixHQ(),
    new MOVIES.VidSrcTo(),
    new MOVIES.Goku(),
    new MOVIES.Zoechip(),
    new MOVIES.SmashyStream()
];

app.get('/', (req, res) => {
    res.json({ message: "Welcome to FukatMovies Scraper API powered by Consumet (Multi-Provider)!" });
});

app.get('/scrape', async (req, res) => {
    const { type, tmdbId, title, releaseYear, season, episode } = req.query;

    if (!title) {
        return res.status(400).json({ error: "Missing required query parameter: title" });
    }

    console.log(`Searching for: ${title} (${type || 'unknown'})`);

    // Loop through every single provider until one works!
    for (const provider of providers) {
        try {
            console.log(`\n--- Trying Provider: ${provider.name} ---`);
            
            // 1. Search for the title
            const searchResults = await provider.search(title);
            
            if (!searchResults.results || searchResults.results.length === 0) {
                console.log(`[${provider.name}] No search results found.`);
                continue; // Try next provider
            }

            let mediaId = searchResults.results[0].id;
            
            // Try exact title matching
            const bestMatch = searchResults.results.find(
                (r) => r.title.toLowerCase() === title.toLowerCase() && (type === 'movie' ? r.type === 'Movie' : r.type === 'TV Series')
            );
            if (bestMatch) {
                mediaId = bestMatch.id;
            }

            console.log(`[${provider.name}] Found Media ID: ${mediaId}`);

            // 2. Fetch Media Info
            const mediaInfo = await provider.fetchMediaInfo(mediaId);
            let targetEpisodeId = mediaId;

            if (type === 'show' && season && episode) {
                const ep = mediaInfo.episodes.find(
                    (e) => e.season === parseInt(season) && e.number === parseInt(episode)
                );
                if (ep) {
                    targetEpisodeId = ep.id;
                } else if (mediaInfo.episodes && mediaInfo.episodes.length > 0) {
                    targetEpisodeId = mediaInfo.episodes[0].id;
                } else {
                    console.log(`[${provider.name}] Episode not found.`);
                    continue; // Try next provider
                }
            } else if (type === 'movie' || !type) {
                if (mediaInfo.episodes && mediaInfo.episodes.length > 0) {
                    targetEpisodeId = mediaInfo.episodes[0].id;
                }
            }

            // 3. Fetch Sources
            console.log(`[${provider.name}] Fetching sources for Episode ID: ${targetEpisodeId}`);
            const sources = await provider.fetchEpisodeSources(targetEpisodeId, mediaId);

            if (sources && sources.sources) {
                console.log(`[${provider.name}] SUCCESS! Found raw video streams.`);
                return res.json({
                    success: true,
                    stream: {
                        type: "file",
                        qualities: sources.sources.reduce((acc, source) => {
                            acc[source.quality || 'Auto'] = { url: source.url };
                            return acc;
                        }, {}),
                        headers: sources.headers || {},
                        captions: (sources.subtitles || []).map(s => ({
                            url: s.url,
                            language: s.lang
                        }))
                    }
                });
            }
        } catch (error) {
            console.log(`[${provider.name}] Failed or blocked: ${error.message}`);
            // Silently catch and try the next provider!
        }
    }

    // If ALL providers fail
    console.log("All providers failed or were blocked.");
    return res.status(404).json({ success: false, error: "No stream sources found across any provider." });
});

app.listen(PORT, () => {
    console.log(`FukatMovies Scraper API is running on port ${PORT}`);
});
