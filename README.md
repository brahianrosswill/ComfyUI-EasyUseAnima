# ComfyUI EasyUse Anima

Small ComfyUI custom node pack for NAIA/Anima workflows.

This package is independent from `comfyui-naia-bridge`. It does not import or
override that node pack, so both can be installed at the same time.

Reference baseline:

- `DNT-LAB/comfyui-naia-bridge` master `b82f98e`
- NAIA API endpoints used:
  - `POST /api/comfyui/random`
  - `peng_override` request field

## Nodes

### Anima NAIA Random Prompt

Category: `NAIA Bridge/API`

Outputs:

- `prompt`
- `negative_prompt`
- `width`
- `height`

Main controls:

- `use_naia_bridge=false`: bypass NAIA and return input `prompt`,
  `negative_prompt`, `width`, `height` as-is. If the inputs are unchanged,
  this mode does not break ComfyUI caching.
- `freeze_naia_output=true`: if cached output is valid, return it without
  calling NAIA. This keeps downstream cache stable for the same fixed output.
- `show_preview=false`: hide the large read-only preview widget.
- Saved-image workflow reproduction: after a fresh NAIA response, saved image
  metadata is written with `freeze_naia_output=true` and cached output values.
  Loading that workflow reproduces the same output without another NAIA call.
- `use_naia_settings=false`: send this node's `pre_prompt`, `post_prompt`,
  `auto_hide`, and preprocessing options to NAIA for this request.

The `remove_*` preprocessing options are marked as advanced inputs.

### Anima Prompt Corrector

Category: `EasyUse Anima/Prompt`

Outputs:

- `corrected_prompt`
- `report`

The node accepts a prompt or caption and returns a normalized ANIMA-ordered
prompt plus a JSON report. It uses the vendored `anima_prompt` MVP core and
only loads AnimaDex character/artist data. It does not load a general tag DB.

Main controls:

- `profile=prompt`: parse comma-separated prompt tags and output comma-separated
  tags.
- `profile=caption`: preserve newline-separated caption files.
- `validate_artist_tags=true`: only AnimaDex artist triggers and manual
  overrides are treated as `@artist` tags.
- `insert_no_artist=true`: insert `@no-artist` when no valid artist tag exists.
- `artist_overrides`: manual comma- or newline-separated artist triggers.
- `artist_exclusions`: tags that must not be treated as artists.

AnimaDex data can be supplied with explicit paths:

- `animadex_character_index`: `character_index.jsonl`
- `animadex_artist_index`: `artist_index.jsonl`
- `animadex_characters_csv`: `characters.csv`
- `animadex_artists_csv`: `artists.csv`

If explicit paths are empty, the node also checks these environment variables:

- `ANIMADEX_CHARACTER_INDEX`
- `ANIMADEX_ARTIST_INDEX`
- `ANIMADEX_CHARACTERS_CSV`
- `ANIMADEX_ARTISTS_CSV`

Default local discovery also checks:

```text
models/animadex/index/character_index.jsonl
models/animadex/index/artist_index.jsonl
models/animadex/import/characters.csv
models/animadex/import/artists.csv
```

Do not commit downloaded AnimaDex exports or tokens.

## Requirements

NAIA must expose the ComfyUI remote API used by `comfyui-naia-bridge`.

Install Python dependency:

```bash
pip install -r requirements.txt
```

ComfyUI restart is required after installing or updating this node pack.

## Installation

Clone into `ComfyUI/custom_nodes`:

```bash
git clone https://github.com/n0va39/ComfyUI-EasyUseAnima
```

Then install dependencies in the ComfyUI Python environment:

```bash
pip install -r ComfyUI-EasyUseAnima/requirements.txt
```

Restart ComfyUI after installation.

## ComfyUI Manager / Registry

This repository includes `pyproject.toml` metadata for future Comfy Registry
registration. The Registry node id is `easyuse-anima`.

Before publishing to the Registry, verify that `[tool.comfy].PublisherId` matches
the actual Comfy Registry publisher id.
