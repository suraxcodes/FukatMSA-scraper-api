const express = require('express');
const cors = require('cors');
const { MOVIES } = require('@consumet/extensions');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// Initialize FlixHQ (very reliable for movies and series)
const flixhq = new MOVIES.FlixHQ();

app.get('/', (req, res) => {
    res.json({ message: "Welcome to FukatMovies Scraper API powered by Consumet!" });
});

app.get('/scrape', async (req, res) => {
    const { type, tmdbId, title, releaseYear, season, episode } = req.query;

    if (!title) {
        return res.status(400).json({ error: "Missing required query parameter: title" });
    }

    try {
        console.log(`Searching for: ${title} (${type || 'unknown'})`);
        
        // 1. Search for the title on FlixHQ
        const searchResults = await flixhq.search(title);
        
        if (!searchResults.results || searchResults.results.length === 0) {
            return res.status(404).json({ success: false, error: "Movie/Series not found on provider." });
        }

        // Try to find the best match (compare title and release year if possible)
        let mediaId = searchResults.results[0].id; // Default to first result
        
        // Try exact title matching
        const bestMatch = searchResults.results.find(
            (r) => r.title.toLowerCase() === title.toLowerCase() && (type === 'movie' ? r.type === 'Movie' : r.type === 'TV Series')
        );
        if (bestMatch) {
            mediaId = bestMatch.id;
        }

        console.log(`Found Media ID: ${mediaId}`);

        // 2. Fetch Media Info to get episode IDs
        const mediaInfo = await flixhq.fetchMediaInfo(mediaId);
        
        let targetEpisodeId = mediaId; // For movies, episodeId is usually the same or embedded

        if (type === 'show' && season && episode) {
            // Find the exact episode
            const ep = mediaInfo.episodes.find(
                (e) => e.season === parseInt(season) && e.number === parseInt(episode)
            );
            if (ep) {
                targetEpisodeId = ep.id;
                console.log(`Found Episode ID: ${targetEpisodeId}`);
            } else {
                 // Fallback to first episode if exact not found
                 if(mediaInfo.episodes && mediaInfo.episodes.length > 0) {
                      targetEpisodeId = mediaInfo.episodes[0].id;
                 } else {
                      return res.status(404).json({ success: false, error: "Episode not found." });
                 }
            }
        } else if (type === 'movie' || !type) {
             // For FlixHQ movies, the episode ID is the first episode in the array
             if(mediaInfo.episodes && mediaInfo.episodes.length > 0) {
                  targetEpisodeId = mediaInfo.episodes[0].id;
             }
        }

        // 3. Fetch Sources
        console.log(`Fetching sources for Episode ID: ${targetEpisodeId}, Media ID: ${mediaId}`);
        const sources = await flixhq.fetchEpisodeSources(targetEpisodeId, mediaId);

        if (sources && sources.sources) {
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
                        language: s.lang // Mapped to 'language' for our flutter app
                    }))
                }
            });
        } else {
             return res.status(404).json({ success: false, error: "No stream sources found" });
        }

    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, error: error.toString() });
    }
});

app.listen(PORT, () => {
    console.log(`FukatMovies Scraper API is running on port ${PORT}`);
});
