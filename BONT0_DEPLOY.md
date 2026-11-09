# Deploy OpenLife on Bonto

This branch is prepared for Bonto's Node.js runtime.

## App settings

- Repository: `mvarkati1390-lgtm/OpenLife`
- Branch: `bonto-deploy`
- App/root directory: repository root
- Runtime: Node.js 20
- Install command: `npm install`
- Start command: `npm start`

The root `package.json` starts `server/index.js` and installs the backend dependencies.

## Environment variables

Set these in the Bonto app's Environment Variables panel. Do not commit real secrets to GitHub.

- `JWT_SECRET`: a private random value of at least 32 characters.
- `OWNER_USERNAME`: an owner login name, 3–20 English letters/numbers/underscores.
- `OWNER_PASSWORD`: a private password of at least 10 characters.
- `CORS_ORIGIN`: the exact HTTPS origin of the web admin/client, if used. For native Unity clients, browser CORS does not apply.

Bonto supplies `PORT` automatically.

## Health check

After deployment, open `https://YOUR-APP.bonto.run/health`. A working server returns JSON containing `"ok":true`.

## Important limitations

The free Bonto tier has a monthly usage-hours limit and apps sleep when idle. This is suitable for an initial test, not guaranteed 24/7 production hosting. The backend currently uses SQLite; confirm Bonto's filesystem persistence before relying on it for player accounts. Back up data or migrate to a managed database before public launch.
