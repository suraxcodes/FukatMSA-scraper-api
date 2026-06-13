const express = require('express');
const cors = require('cors');
const { MOVIES } = require('@consumet/extensions');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.json({ message: "Welcome to FukatMovies Scraper API powered by Consumet (Client-Side Fallback)!" });
});

app.get('/scrape', async (req, res) => {
    const { type, tmdbId, title, releaseYear, season, episode, provider: providerName } = req.query;

    if (!title) {
        return res.status(400).json({ error: "Missing required query parameter: title" });
    }

    let provider;
    switch(providerName?.toLowerCase()) {
        case 'vidsrcto':
            provider = new MOVIES.VidSrcTo();
            break;
        case 'goku':
            provider = new MOVIES.Goku();
            break;
        case 'zoechip':
            provider = new MOVIES.Zoechip();
            break;
        case 'smashystream':
            provider = new MOVIES.SmashyStream();
            break;
        case 'flixhq':
        default:
            provider = new MOVIES.FlixHQ();
            break;
    }

    console.log(`Searching for: ${title} (${type || 'unknown'}) via ${provider.name}`);

    try {
        const searchResults = await provider.search(title);
        
        if (!searchResults.results || searchResults.results.length === 0) {
            return res.status(404).json({ success: false, error: "Movie/Series not found on provider." });
        }

        let mediaId = searchResults.results[0].id;
        
        const bestMatch = searchResults.results.find(
            (r) => r.title.toLowerCase() === title.toLowerCase() && (type === 'movie' ? r.type === 'Movie' : r.type === 'TV Series')
        );
        if (bestMatch) {
            mediaId = bestMatch.id;
        }

        console.log(`[${provider.name}] Found Media ID: ${mediaId}`);

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
                return res.status(404).json({ success: false, error: "Episode not found." });
            }
        } else if (type === 'movie' || !type) {
            if (mediaInfo.episodes && mediaInfo.episodes.length > 0) {
                targetEpisodeId = mediaInfo.episodes[0].id;
            }
        }

        console.log(`[${provider.name}] Fetching sources for Episode ID: ${targetEpisodeId}`);
        const sources = await provider.fetchEpisodeSources(targetEpisodeId, mediaId);

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
                        language: s.lang
                    }))
                }
            });
        }
    } catch (error) {
        console.error(`[${provider.name}] Failed or blocked:`, error.message);
        return res.status(500).json({ success: false, error: error.message });
    }

    return res.status(404).json({ success: false, error: "No stream sources found." });
});

app.listen(PORT, () => {
    console.log(`FukatMovies Scraper API is running on port ${PORT}`);
});
