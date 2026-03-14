# Contribute to EML Lib

First of all, thank you for your interest in contributing to EML Lib ❤️!

This project aims to provide a reliable, efficient and maintainable Node.js library to facilitate the development of Minecraft launchers. Contributions are welcome, but must follow the guidelines below to ensure consistency and stability.

## Before you start

Please make sure to:

- Read the [README.md](./README.md).
- Check existing issues and pull requests.
- Join the Discord server if you need clarification.

If you plan to implement a significant feature, open an issue first to discuss it

## Branching strategy

This repository follows a structured workflow:

| Branch name | Purpose                                                  |
| ----------- | -------------------------------------------------------- |
| `main`      | Currently published version (production-ready)           |
| `dev`       | Next version under preparation                           |
| `feature/*` | Feature-specific branches (recommended for contributors) |
| `fix/*`     | Bug fix branches (recommended for contributors)          |

### Do not:

- Open pull requests directly to `main`.
- Create version-numbered branches (e.g., `v1.0.0`).
- Use non-descriptive branch names (e.g., `update`, `bugfix`).

### Do:

- Fork the repository and clone it locally.
- Create a branch from `dev` for your feature or bug fix.
- Name your branch according to the type of contribution (e.g., `feature/quilt-support`, `fix/natives-issue`).
- Open a pull request to `dev` when your work is ready for review.

## Development setup

### Requirements

- Node.js (LTS version recommended).
- Git.

### Installation

```bash
git clone https://github.com/Electron-Minecraft-Launcher/EML-Lib.git
cd EML-Lib
npm install
```

## Code guidelines

### General principles

- Write clean, readable and maintainable code.
- Keep logic modular and reusable.
- Avoid using unnecessary dependencies.
- Respect the project's coding style and conventions.

### TypeScript

- Use strict typing and avoid using `any` where possible.
- Use interfaces and types to define expected shapes of data.
- Prefer explicit return types for exported functions and constants.
- Use `async/await` for asynchronous operations and handle errors properly.

### Public API

- Ensure backward compatibility when modifying existing functions or constants.
- Document all public functions and constants with JSDoc comments.

## Pull request guidelines

Before submitting a PR:

- Test your changes manually.
- Keep PRs focused (one feature or fix per PR).

PR description must include:

- What was changed.
- Why it was changed.
- Whether it affects the API behavior.

## Security

If you discover a security vulnerability:

- Do **NOT** open a public issue.
- Contact the maintainers via Discord (@goldfrite) or email ([goldfrite@gmail.com](mailto:goldfrite@gmail.com)) with details.

## Versioning

This project follows Semantic Versioning (SemVer). Version numbers are in the format `x.y.z` where:

| Type          | Description               |
| ------------- | ------------------------- |
| `PATCH` (`z`) | Bug fixes                 |
| `MINOR` (`y`) | New non-breaking features |
| `MAJOR` (`x`) | Breaking changes          |

Version tags are created only when merging to main.

## License

This project is licensed under `MIT`.

By contributing, you agree that your code will be distributed under this license.
