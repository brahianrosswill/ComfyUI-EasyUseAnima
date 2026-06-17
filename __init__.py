# -*- coding: utf-8 -*-
from .nodes import EasyUseAnimaNAIARandomPrompt, EasyUseAnimaPromptCorrector

NODE_CLASS_MAPPINGS = {
    "EasyUseAnimaNAIARandomPrompt": EasyUseAnimaNAIARandomPrompt,
    "EasyUseAnimaPromptCorrector": EasyUseAnimaPromptCorrector,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "EasyUseAnimaNAIARandomPrompt": "Anima NAIA Random Prompt",
    "EasyUseAnimaPromptCorrector": "Anima Prompt Corrector",
}

WEB_DIRECTORY = "./web"

__all__ = [
    "NODE_CLASS_MAPPINGS",
    "NODE_DISPLAY_NAME_MAPPINGS",
    "WEB_DIRECTORY",
]
