# Fukat Scraper API

This is a custom streaming REST API built on top of the `@movie-web/providers` library. It scrapes direct video streams (`.m3u8` and `.mp4`) from dozens of providers and returns them as clean JSON.

## How to Deploy to Render (Free)

1. **Upload to GitHub**
   - Create a new public or private repository on your GitHub account.
   - Upload this `fukat-scraper-api` folder to the repository.

2. **Deploy on Render**
   - Go to [Render.com](https://render.com) and sign in.
   - Click **New** -> **Web Service**.
   - Connect your GitHub account and select your new repository.
   - Render will auto-detect that it is a Node.js project.
   - Set the **Start Command** to: `node server.js`
   - Select the **Free** instance type.
   - Click **Create Web Service**.

3. **Get Your URL**
   - Once it finishes building, Render will give you a live URL (e.g., `https://fukat-scraper-api.onrender.com`).
   - You can test it by opening this in your browser:
     `https://fukat-scraper-api.onrender.com/scrape?type=movie&tmdbId=385687&title=Fast%20X&releaseYear=2023`

## How it Works
This API acts as a middleman. When your Flutter app requests a movie, this server spins up `@movie-web/providers`, bypasses provider encryptions, and finds the raw video URL. Because you are hosting it yourself, it won't get banned or rate-limited like public Consumet instances!
