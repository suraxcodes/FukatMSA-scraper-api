const express = require('express');
const cors = require('cors');
const { makeProviders, makeStandardFetcher, targets } = require('@movie-web/providers');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// Initialize the providers
const fetcher = makeStandardFetcher(fetch);
const providers = makeProviders({
  fetcher,
  target: targets.ANY, 
});

app.get('/', (req, res) => {
    res.json({ message: "Welcome to FukatMovies Scraper API powered by @movie-web/providers!" });
});

app.get('/scrape', async (req, res) => {
    const { type, tmdbId, title, releaseYear, season, episode } = req.query;

    if (!type || !tmdbId || !title || !releaseYear) {
        return res.status(400).json({ error: "Missing required query parameters: type, tmdbId, title, releaseYear" });
    }

    try {
        const media = {
            type: type, // 'movie' or 'show'
            title: title,
            releaseYear: parseInt(releaseYear),
            tmdbId: tmdbId
        };
        if (req.query.imdbId && req.query.imdbId !== 'null' && req.query.imdbId !== '') {
            media.imdbId = req.query.imdbId;
        }

        if (type === 'show') {
            if (!season || !episode) {
                return res.status(400).json({ error: "Missing season or episode for show type" });
            }
            media.season = { number: parseInt(season), tmdbId: "" };
            media.episode = { number: parseInt(episode), tmdbId: "" };
        }

        console.log(`Scraping for: ${title} (${type})`);

        // Run all providers
        const results = await providers.runAll({
            media: media,
            sourceOrder: ['vidsrc', 'flixhq', 'showbox', 'smashystream', 'vidsrcto'],
            events: {
                update: (evt) => console.log(`[Scraper Update] ${evt.id}: ${evt.status} - ${evt.reason || evt.error || ''}`)
            }
        });

        if (results && results.stream) {
            return res.json({
                success: true,
                stream: results.stream
            });
        } else {
             return res.status(404).json({
                success: false,
                error: "No stream found"
            });
        }

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.toString() });
    }
});

app.listen(PORT, () => {
    console.log(`FukatMovies Scraper API is running on port ${PORT}`);
});
