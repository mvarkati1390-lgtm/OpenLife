# OpenLife Godot migration prototype

This folder starts a Godot 4 port alongside the existing Unity project. The Unity files are intentionally preserved.

## Current prototype
- Procedural 3D test area with solid obstacle collisions and a third-person capsule character.
- Keyboard and on-screen touch movement/jump controls, plus touch-drag camera look.
- Login/register starts authenticated world polling; nearby online players are rendered as named remote avatars.
- Movement sync is rate-limited to match the current server API.
- Persian login/register panel wired to the existing server API paths.
- The server URL is a placeholder until the backend is deployed.

## Open in Godot
1. Install Godot 4.3 or newer on a computer.
2. Import the `godot/project.godot` project.
3. Press Run.

## Important limitations
- This is an early migration scaffold, not a finished game or verified Android APK.
- No Godot editor/device build has been run in this environment.
- The server is not deployed. Replace the example URL in-game with the real HTTPS service URL after deployment.
- Backend API integration tests and a GitHub Actions test workflow have been added; their first hosted run still needs to be checked.
- Login/register and basic HTTP world-position polling are connected in the prototype. Remote avatars are basic capsules; realtime interpolation, persistent movement sync, inventory, missions, and admin tools still need further work and testing.
- Android export needs Godot Android export templates and Android SDK setup.

The existing Unity project and its history remain unchanged on the main branch. This work is on the `godot-migration` branch.
