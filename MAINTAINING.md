# Maintaining ComfyUI EasyUse Anima

This repository is prepared for future ComfyUI Manager / Comfy Registry registration.

## Release Rules

- Keep `pyproject.toml` version in semantic version format: `X.Y.Z`.
- Patch version: bug fixes and documentation-only changes.
- Minor version: backward-compatible node inputs, UI, or behavior additions.
- Major version: breaking node class names, input names, output types, or workflow behavior.
- Once a version is published to Comfy Registry, do not rewrite that release. Publish a newer version instead.

## Registry Rules

- `pyproject.toml` `[project].name` is the Registry node id. Treat `easyuse-anima` as immutable.
- `[tool.comfy].PublisherId` must match the Comfy Registry publisher id. It is currently set to `n0va39`.
- Keep `[project.urls].Repository` pointed at the public GitHub repository.
- Keep install dependencies in `pyproject.toml` and `requirements.txt`; do not install packages at runtime.
- Use `.comfyignore` for files that should stay in git but not ship in the Registry archive.

## Compatibility Rules

- Do not rely on the installed folder name for imports.
- Keep node class ids stable unless a breaking release is intended.
- Do not conflict with `comfyui-naia-bridge` class ids or display names.
- Keep this node pack usable with or without `comfyui-naia-bridge` installed.

## Security Rules

- Do not use `eval` or `exec`.
- Do not add obfuscated code.
- Do not run arbitrary shell commands from node execution.
- Do not store API keys, tokens, or personal data in the repository.

## Checks

Run from `D:\ComfyUI\custom_nodes_workplace`:

```powershell
powershell -ExecutionPolicy Bypass -File tools\check_custom_node.ps1 -Project ComfyUI-EasyUseAnima
```

Before publishing, also test installation in the active ComfyUI instance:

```text
D:\ComfyUI\ComfyUI_main\instances\ComfyUI_v0.24.0\custom_nodes
```
