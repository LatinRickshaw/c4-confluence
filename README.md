# c4-confluence

A Confluence -> draw.io -> C4 Model plugin

Built as an Atlassian Forge app (Custom UI). See [CLAUDE.md](CLAUDE.md) for the full project brief.

## Quick start

- Install top-level dependencies:
  ```
  npm install
  ```
- Install dependencies inside the frontend app directory (currently `static/hello-world`):
  ```
  cd static/hello-world && npm install
  ```
- Build the frontend:
  ```
  cd static/hello-world && npm run build
  ```
- Deploy to the development environment:
  ```
  forge deploy
  ```
- Install the app on an Atlassian site:
  ```
  forge install
  ```

Use `forge deploy` to persist code changes; use `forge install` only when installing on a new site for the first time.
