# -*- coding: utf-8 -*-
from .nodes import (
    EasyUseAnimaLoraPreset,
    EasyUseAnimaNAIARandomPrompt,
    EasyUseAnimaPromptBuilder,
    EasyUseAnimaPromptCorrector,
    EasyUseAnimaPromptStudio,
    EasyUseAnimaPromptStudioAdvanced,
    EasyUseAnimaPromptStudioExtend,
)
from . import api  # noqa: F401 - registers ComfyUI HTTP routes

NODE_CLASS_MAPPINGS = {
    "EasyUseAnimaLoraPreset": EasyUseAnimaLoraPreset,
    "EasyUseAnimaNAIARandomPrompt": EasyUseAnimaNAIARandomPrompt,
    "EasyUseAnimaPromptBuilder": EasyUseAnimaPromptBuilder,
    "EasyUseAnimaPromptCorrector": EasyUseAnimaPromptCorrector,
    "EasyUseAnimaPromptStudio": EasyUseAnimaPromptStudio,
    "EasyUseAnimaPromptStudioAdvanced": EasyUseAnimaPromptStudioAdvanced,
    "EasyUseAnimaPromptStudioExtend": EasyUseAnimaPromptStudioExtend,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "EasyUseAnimaLoraPreset": "Anima LoRA Preset",
    "EasyUseAnimaNAIARandomPrompt": "Anima NAIA Random Prompt",
    "EasyUseAnimaPromptBuilder": "Anima Prompt Builder",
    "EasyUseAnimaPromptCorrector": "Anima Prompt Corrector",
    "EasyUseAnimaPromptStudio": "Anima Prompt Studio",
    "EasyUseAnimaPromptStudioAdvanced": "Anima Prompt Studio Advanced",
    "EasyUseAnimaPromptStudioExtend": "Anima Prompt Studio Extend",
}

WEB_DIRECTORY = "./web"

__all__ = [
    "NODE_CLASS_MAPPINGS",
    "NODE_DISPLAY_NAME_MAPPINGS",
    "WEB_DIRECTORY",
]
