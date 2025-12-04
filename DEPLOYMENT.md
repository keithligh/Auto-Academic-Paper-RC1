<!-- GOSPEL RULE: NEVER USE replace_file_content. ALWAYS USE multi_replace_file_content or write_to_file. -->
<!-- GOSPEL RULE: NEVER USE replace_file_content. ALWAYS USE multi_replace_file_content or write_to_file. -->
# Deployment Guide (Railway)

This application is designed to be deployed on [Railway](https://railway.app).

## Prerequisites

1.  A Railway account.
2.  A GitHub repository containing this code.
3.  A Poe API Key (for the AI features).

## Configuration

### Environment Variables
Set the following variables in your Railway project settings:

| Variable | Description | Required |
|:---------|:------------|:---------|
| `POE_API_KEY` | Your Poe API Key. | Yes |
| `POE_SEARCH_BOT` | Name of the bot for research (e.g., `Gemini-2.5-Pro`). | Yes |
| `POE_WRITER_BOT` | Name of the bot for writing (e.g., `Claude-3.5-Sonnet`). | Yes |
| `NODE_ENV` | Set to `production`. | Yes |
| `PORT` | Railway sets this automatically (usually `PORT`). | No |

## Build & Start Commands

Railway usually detects these automatically from `package.json`, but for reference:

*   **Build Command:** `npm run build`
*   **Start Command:** `npm start`

## Deployment Steps

1.  **Connect GitHub:** In Railway, create a new project and select "Deploy from GitHub repo".
2.  **Select Repository:** Choose `auto-academic-formatter-railway`.
3.  **Add Variables:** Go to the "Variables" tab and add the keys listed above.
4.  **Deploy:** Railway will automatically build and deploy the application.

## Troubleshooting

*   **Build Fails:** Check the "Build Logs" in Railway. Ensure `npm run build` runs locally without errors.
*   **App Crashes:** Check the "Deploy Logs". Ensure all environment variables are set correctly.
*   **404 Errors:** Ensure `client/dist` is being served correctly by the Express server (handled in `server/index.ts`).
