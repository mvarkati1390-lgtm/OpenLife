# OpenLife Godot migration prototype

This folder starts a Godot 4 port alongside the existing Unity project. The Unity files are intentionally preserved.

## Current prototype
- Procedural 3D test area and a third-person capsule character.
- Keyboard and on-screen touch movement/jump controls.
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
- Login/register are connected to the API, but remote player rendering, persistent movement sync, inventory, missions, and admin tools still need porting and testing.
- Android export needs Godot Android export templates and Android SDK setup.

The existing Unity project and its history remain unchanged on the main branch. This work is on the `godot-migration` branch.
