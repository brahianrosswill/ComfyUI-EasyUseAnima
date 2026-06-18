import { app } from "../../../scripts/app.js";

const NODE_TYPE = "EasyUseAnimaLoraPreset";
const MAX_PROFILES = 16;
const WIDGET_INDEX = {
  stylePrompt: 0,
  profileIndex: 1,
  profileCount: 2,
  loraName: 3,
  loras: 4,
  profileData: 5,
};
const MIN_NODE_WIDTH = 460;
const LORA_ROW_HEIGHT = 28;
const LORA_STRENGTH_STEP = 0.05;
let loraManagerModulesPromise = null;

async function loadLoraManagerModules() {
  if (!loraManagerModulesPromise) {
    loraManagerModulesPromise = import("../../comfyui-lora-manager/preview_tooltip.js")
      .then((previewModule) => ({
        PreviewTooltip: previewModule.PreviewTooltip,
      })).catch((error) => {
      console.warn("EasyUse Anima: LoraManager UI is unavailable.", error);
      return null;
    });
  }
  return loraManagerModulesPromise;
}

function findWidget(node, name) {
  return node.__easyuseAnimaHiddenWidgets?.[name]
    || node.widgets?.find((widget) => widget.name === name);
}

function findInputEl(widget) {
  const input = widget?.inputEl;
  if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
    return input;
  }
  return null;
}

function widgetValue(widget, fallback = "") {
  if (!widget) {
    return fallback;
  }
  const input = findInputEl(widget);
  if (input) {
    return input.value ?? fallback;
  }
  return widget.value ?? fallback;
}

function setWidgetValue(widget, value) {
  if (!widget) {
    return;
  }
  widget.value = value;
  const input = findInputEl(widget);
  if (input && input.value !== value) {
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }
  widget.callback?.(value);
}

function parseProfileData(widget) {
  try {
    const value = widgetValue(widget, "{}");
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function looksLikeProfileData(value) {
  if (typeof value !== "string") {
    return false;
  }
  try {
    const parsed = JSON.parse(value || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed);
  } catch {
    return false;
  }
}

function normalizeSerializedWidgets(info) {
  const values = info?.widgets_values;
  if (!Array.isArray(values)) {
    return;
  }

  if (!Array.isArray(values[WIDGET_INDEX.loras])) {
    const lorasIndex = values.findIndex((value, index) => (
      index > WIDGET_INDEX.loras
      && Array.isArray(value)
      && value.every((item) => item && typeof item === "object" && "name" in item)
    ));
    values[WIDGET_INDEX.loras] = lorasIndex >= 0 ? values[lorasIndex] : [];
  }

  if (!looksLikeProfileData(values[WIDGET_INDEX.profileData])) {
    const profileDataIndex = values.findIndex((value, index) => (
      index > WIDGET_INDEX.profileData && looksLikeProfileData(value)
    ));
    if (profileDataIndex >= 0) {
      values[WIDGET_INDEX.profileData] = values[profileDataIndex];
    }
  }
}

function writeProfileData(widget, data) {
  setWidgetValue(widget, JSON.stringify(data));
}

function profileKey(index) {
  return String(Math.max(1, Math.min(MAX_PROFILES, Number.parseInt(index, 10) || 1)));
}

function profileCount(node) {
  const widget = findWidget(node, "profile_count");
  return Math.max(1, Math.min(MAX_PROFILES, Number.parseInt(widgetValue(widget, 4), 10) || 4));
}

function setProfileCount(node, count) {
  const nextCount = Math.max(1, Math.min(MAX_PROFILES, Number.parseInt(count, 10) || 1));
  node.__easyuseAnimaSuppressProfileCountCallback = true;
  try {
    setWidgetValue(findWidget(node, "profile_count"), nextCount);
  } finally {
    node.__easyuseAnimaSuppressProfileCountCallback = false;
  }
}

function wrapProfileIndex(index, count) {
  const profileCountValue = Math.max(1, Math.min(MAX_PROFILES, Number.parseInt(count, 10) || 1));
  const profileIndexValue = Math.max(1, Number.parseInt(index, 10) || 1);
  return ((profileIndexValue - 1) % profileCountValue) + 1;
}

function selectedProfileIndex(node) {
  const widget = findWidget(node, "profile_index");
  return wrapProfileIndex(widgetValue(widget, 1), profileCount(node));
}

function setProfileIndex(node, index) {
  const nextIndex = wrapProfileIndex(index, profileCount(node));
  node.__easyuseAnimaSuppressProfileIndexCallback = true;
  try {
    setWidgetValue(findWidget(node, "profile_index"), nextIndex);
  } finally {
    node.__easyuseAnimaSuppressProfileIndexCallback = false;
  }
}

function activeProfileIndex(node) {
  return wrapProfileIndex(node.__easyuseAnimaActiveProfileIndex || selectedProfileIndex(node), profileCount(node));
}

function lorasWidgetValue(node) {
  const widget = findWidget(node, "loras");
  const value = widgetValue(widget, []);
  if (value && typeof value === "object" && Array.isArray(value.__value__)) {
    return value.__value__;
  }
  if (Array.isArray(value)) {
    return value;
  }
  return [];
}

function setLorasWidgetValue(node, loras) {
  const widget = findWidget(node, "loras");
  if (!widget) {
    return;
  }
  const value = Array.isArray(loras) ? loras : [];
  widget.value = value;
  widget.callback?.(value);
  renderLoraRows(node);
}

function currentProfile(node) {
  return {
    style_prompt: String(widgetValue(findWidget(node, "style_prompt"), "")),
    loras: lorasWidgetValue(node),
  };
}

function defaultProfileName(index) {
  return `Profile ${index}`;
}

function saveProfile(node, index) {
  const dataWidget = findWidget(node, "profile_data");
  if (!dataWidget) {
    return;
  }
  const data = parseProfileData(dataWidget);
  const key = profileKey(index);
  const previous = data[key] && typeof data[key] === "object" ? data[key] : {};
  data[key] = {
    ...currentProfile(node),
    name: String(previous.name || defaultProfileName(index)),
  };
  writeProfileData(dataWidget, data);
}

function saveCurrentProfile(node) {
  if (node.__easyuseAnimaLoadingProfile) {
    return;
  }
  saveProfile(node, activeProfileIndex(node));
}

function emptyProfile(index = 1) {
  return {
    name: defaultProfileName(index),
    style_prompt: "",
    loras: [],
  };
}

function loadProfile(node, index, options = {}) {
  const dataWidget = findWidget(node, "profile_data");
  if (!dataWidget) {
    return;
  }
  const data = parseProfileData(dataWidget);
  const key = profileKey(index);
  if (!Object.prototype.hasOwnProperty.call(data, key)) {
    data[key] = options.initializeFromCurrent
      ? { ...currentProfile(node), name: defaultProfileName(index) }
      : emptyProfile(index);
    writeProfileData(dataWidget, data);
  }
  const profile = data[key] ?? {};
  node.__easyuseAnimaLoadingProfile = true;
  try {
    setWidgetValue(findWidget(node, "style_prompt"), String(profile.style_prompt ?? ""));
    setLorasWidgetValue(node, Array.isArray(profile.loras) ? profile.loras : []);
  } finally {
    node.__easyuseAnimaLoadingProfile = false;
  }
}

function switchProfile(node, index) {
  const nextIndex = wrapProfileIndex(index, profileCount(node));
  const currentIndex = activeProfileIndex(node);
  if (nextIndex === currentIndex) {
    renderTabs(node);
    return;
  }
  saveProfile(node, currentIndex);
  setProfileIndex(node, nextIndex);
  loadProfile(node, nextIndex);
  node.__easyuseAnimaActiveProfileIndex = nextIndex;
  renderTabs(node);
  node.setDirtyCanvas?.(true, true);
}

function profileLabel(node, index) {
  const dataWidget = findWidget(node, "profile_data");
  const profile = parseProfileData(dataWidget)[profileKey(index)];
  return String(profile?.name || defaultProfileName(index));
}

function addProfile(node) {
  const count = profileCount(node);
  if (count >= MAX_PROFILES) {
    return;
  }
  saveCurrentProfile(node);
  const nextIndex = count + 1;
  const dataWidget = findWidget(node, "profile_data");
  const data = parseProfileData(dataWidget);
  data[profileKey(nextIndex)] = emptyProfile(nextIndex);
  writeProfileData(dataWidget, data);
  setProfileCount(node, nextIndex);
  switchProfile(node, nextIndex);
}

function renameProfile(node, index) {
  saveCurrentProfile(node);
  const dataWidget = findWidget(node, "profile_data");
  const data = parseProfileData(dataWidget);
  const key = profileKey(index);
  const currentName = String(data[key]?.name || defaultProfileName(index));
  const nextName = window.prompt("Profile name", currentName);
  if (nextName == null) {
    return;
  }
  const cleaned = nextName.trim();
  data[key] = {
    ...(data[key] && typeof data[key] === "object" ? data[key] : emptyProfile(index)),
    name: cleaned || defaultProfileName(index),
  };
  writeProfileData(dataWidget, data);
  renderTabs(node);
  node.setDirtyCanvas?.(true, true);
}

function deleteProfile(node, index) {
  const count = profileCount(node);
  if (count <= 1) {
    return;
  }

  const label = profileLabel(node, index);
  if (!window.confirm(`Delete profile "${label}"?`)) {
    return;
  }

  const activeIndex = activeProfileIndex(node);
  if (index !== activeIndex) {
    saveProfile(node, activeIndex);
  }

  const dataWidget = findWidget(node, "profile_data");
  const data = parseProfileData(dataWidget);
  const nextData = {};
  let nextWriteIndex = 1;
  for (let sourceIndex = 1; sourceIndex <= count; sourceIndex += 1) {
    if (sourceIndex === index) {
      continue;
    }
    const source = data[profileKey(sourceIndex)] || emptyProfile(nextWriteIndex);
    nextData[profileKey(nextWriteIndex)] = {
      ...source,
      name: String(source.name || defaultProfileName(nextWriteIndex)),
    };
    nextWriteIndex += 1;
  }

  writeProfileData(dataWidget, nextData);
  const nextCount = count - 1;
  setProfileCount(node, nextCount);
  const nextActive = index === activeIndex
    ? Math.min(index, nextCount)
    : activeIndex > index
      ? activeIndex - 1
      : activeIndex;
  node.__easyuseAnimaActiveProfileIndex = nextActive;
  setProfileIndex(node, nextActive);
  loadProfile(node, nextActive);
  renderTabs(node);
  node.setDirtyCanvas?.(true, true);
}

function hideInternalWidget(node, name) {
  const widget = findWidget(node, name);
  if (!widget || widget.__easyuseAnimaHidden) {
    return;
  }
  widget.__easyuseAnimaHidden = true;
  widget.hidden = true;
  widget.serialize = true;
  widget.computeSize = () => [0, 0];
  widget.draw = () => {};
  widget.type = "hidden";
}

function detachInternalWidget(node, name) {
  const widget = findWidget(node, name);
  if (!widget || !node.widgets?.includes(widget)) {
    return;
  }
  hideInternalWidget(node, name);
  node.__easyuseAnimaHiddenWidgets ??= {};
  node.__easyuseAnimaHiddenWidgets[name] = widget;
  const index = node.widgets.indexOf(widget);
  if (index >= 0) {
    node.widgets.splice(index, 1);
  }
}

function finalizeInternalWidgets(node) {
  detachInternalWidget(node, "profile_data");
  detachInternalWidget(node, "profile_count");
  detachInternalWidget(node, "lora_name");
  detachInternalWidget(node, "loras");
}

function enforceNodeLayout(node) {
  if (!node?.size || typeof node.setSize !== "function") {
    return;
  }
  const currentWidth = Number(node.size[0]) || 0;
  const currentHeight = Number(node.size[1]) || 0;
  const computed = typeof node.computeSize === "function" ? node.computeSize() : null;
  const nextWidth = currentWidth < MIN_NODE_WIDTH ? MIN_NODE_WIDTH : currentWidth;
  const nextHeight = Math.max(currentHeight, Number(computed?.[1]) || 0);
  if (nextWidth !== currentWidth || nextHeight !== currentHeight) {
    node.setSize([nextWidth, nextHeight]);
  }
  node.setDirtyCanvas?.(true, true);
}

function ensureLoraStackInput(node) {
  if (!node.inputs?.some((input) => input.name === "lora_stack")) {
    node.addInput?.("lora_stack", "LORA_STACK");
  }
}

function roundStrength(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function formatStrength(value) {
  return roundStrength(value).toFixed(2);
}

function mutateLoras(node, mutator) {
  const loras = lorasWidgetValue(node).map((lora) => ({ ...lora }));
  mutator(loras);
  setLorasWidgetValue(node, loras);
  saveCurrentProfile(node);
}

function addLoraEntry(node, entry) {
  if (!entry?.name) {
    return;
  }
  mutateLoras(node, (loras) => {
    const existing = loras.find((lora) => lora.name === entry.name);
    if (existing) {
      existing.strength = entry.strength;
      existing.clipStrength = entry.clipStrength;
      existing.active = entry.active;
      return;
    }
    loras.push(entry);
  });
}

function updateLoraEntry(node, index, patch) {
  mutateLoras(node, (loras) => {
    const current = loras[index];
    if (!current) {
      return;
    }
    const oldStrength = Number(current.strength ?? 1);
    const oldClip = Number(current.clipStrength ?? oldStrength);
    Object.assign(current, patch);
    if (Object.prototype.hasOwnProperty.call(patch, "strength") && Math.abs(oldClip - oldStrength) < 0.0001) {
      current.clipStrength = patch.strength;
    }
  });
}

function removeLoraEntry(node, index) {
  mutateLoras(node, (loras) => {
    loras.splice(index, 1);
  });
}

function comboValues(widget) {
  const raw = widget?.options?.values || widget?.values || widget?.inputSpec?.[0] || [];
  if (Array.isArray(raw)) {
    return raw;
  }
  if (raw && typeof raw === "object") {
    return Object.keys(raw);
  }
  return [];
}

function loraNameValues(node) {
  return comboValues(findWidget(node, "lora_name"))
    .map((value) => String(value || "").trim())
    .filter((value) => value && value !== "None");
}

function loraEntryFromName(name, base = {}) {
  const modelStrength = Number.isFinite(Number(base.strength)) ? Number(base.strength) : 1;
  const clipStrength = Number.isFinite(Number(base.clipStrength)) ? Number(base.clipStrength) : modelStrength;
  return {
    name: String(name || "").trim(),
    strength: modelStrength,
    clipStrength,
    active: base.active ?? true,
  };
}

function menuEvent(event) {
  if (event instanceof Event) {
    return event;
  }
  const mouse = app.canvas?.last_mouse;
  return app.canvas?.last_mouse_event || new MouseEvent("click", {
    clientX: Array.isArray(mouse) ? mouse[0] : window.innerWidth / 2,
    clientY: Array.isArray(mouse) ? mouse[1] : window.innerHeight / 2,
  });
}

function openLoraMenu(node, event, onChoose) {
  const values = loraNameValues(node);
  if (!values.length) {
    window.alert("No LoRA files found. Refresh ComfyUI after adding LoRAs.");
    return;
  }
  const canvas = app.canvas;
  new LiteGraph.ContextMenu(values, {
    event: menuEvent(event),
    title: "Choose a LoRA",
    scale: Math.max(1, Number(canvas?.ds?.scale) || 1),
    className: "dark",
    callback: (value) => {
      const name = String(value?.content ?? value ?? "").trim();
      if (!name) {
        return;
      }
      setWidgetValue(findWidget(node, "lora_name"), name);
      onChoose(loraEntryFromName(name));
    },
  });
}

async function showLoraPreview(node, name, event) {
  const modules = await loadLoraManagerModules();
  if (!modules?.PreviewTooltip || !name) {
    return;
  }
  if (!node.__easyuseAnimaLoraPreviewTooltip) {
    node.__easyuseAnimaLoraPreviewTooltip = new modules.PreviewTooltip({ modelType: "loras" });
  }
  const x = Number(event?.clientX || window.innerWidth / 2) + 18;
  const y = Number(event?.clientY || window.innerHeight / 2) + 18;
  node.__easyuseAnimaLoraPreviewTooltip.show(name, x, y, true);
  node.__easyuseAnimaLoraPreviewName = name;
}

function hideLoraPreview(node) {
  node.__easyuseAnimaLoraPreviewTooltip?.hide?.();
  node.__easyuseAnimaLoraPreviewName = null;
}

function fitCanvasText(ctx, text, maxWidth) {
  const value = String(text || "");
  if (ctx.measureText(value).width <= maxWidth) {
    return value;
  }
  let result = value;
  while (result.length > 1 && ctx.measureText(`${result}...`).width > maxWidth) {
    result = result.slice(0, -1);
  }
  return `${result}...`;
}

function roundedRect(ctx, x, y, width, height, radius) {
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, width, height, radius);
    return;
  }
  const r = Math.min(radius, width / 2, height / 2);
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}

class EasyUseAnimaLoraRowWidget {
  constructor(index) {
    this.name = `easyuse_anima_lora_${index}`;
    this.type = "custom";
    this.options = { serialize: false };
    this.serialize = false;
    this.index = index;
    this.__easyuseAnimaLoraRowWidget = true;
    this.hitAreas = {};
  }

  computeSize(width) {
    return [width, LORA_ROW_HEIGHT];
  }

  draw(ctx, node, width, y, height) {
    const lora = lorasWidgetValue(node)[this.index] || {};
    const active = lora.active !== false;
    const margin = 10;
    const inner = 5;
    const rowX = margin;
    const rowW = width - margin * 2;
    const midY = y + height / 2;
    const right = width - margin;
    const deleteW = 22;
    const previewW = 24;
    const incW = 20;
    const valueW = 50;
    const decW = 20;
    const toggleW = 18;

    this.hitAreas = {
      toggle: [rowX + inner, y + 5, toggleW, height - 10],
      delete: [right - deleteW, y + 4, deleteW, height - 8],
      preview: [right - deleteW - inner - previewW, y + 4, previewW, height - 8],
      inc: [right - deleteW - inner - previewW - inner - incW, y + 4, incW, height - 8],
      value: [right - deleteW - inner - previewW - inner - incW - valueW, y + 4, valueW, height - 8],
      dec: [right - deleteW - inner - previewW - inner - incW - valueW - decW, y + 4, decW, height - 8],
    };
    const nameX = this.hitAreas.toggle[0] + toggleW + inner * 2;
    const nameW = this.hitAreas.dec[0] - nameX - inner;
    this.hitAreas.name = [nameX, y + 4, Math.max(40, nameW), height - 8];

    ctx.save();
    ctx.globalAlpha = active ? 1 : 0.45;
    ctx.fillStyle = "rgba(60, 72, 92, 0.55)";
    ctx.strokeStyle = "rgba(120, 132, 155, 0.45)";
    ctx.beginPath();
    roundedRect(ctx, rowX, y + 2, rowW, height - 4, 5);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = active ? "#4aa3df" : "#555";
    ctx.beginPath();
    roundedRect(ctx, ...this.hitAreas.toggle, 4);
    ctx.fill();

    ctx.fillStyle = LiteGraph.WIDGET_TEXT_COLOR;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(fitCanvasText(ctx, lora.name || "None", nameW), nameX, midY);

    ctx.textAlign = "center";
    ctx.fillText("<", this.hitAreas.dec[0] + decW / 2, midY);
    ctx.fillText(formatStrength(lora.strength ?? 1), this.hitAreas.value[0] + valueW / 2, midY);
    ctx.fillText(">", this.hitAreas.inc[0] + incW / 2, midY);
    ctx.fillText("i", this.hitAreas.preview[0] + previewW / 2, midY);
    ctx.fillText("x", this.hitAreas.delete[0] + deleteW / 2, midY);
    ctx.restore();
  }

  contains(pos, area) {
    const hit = this.hitAreas[area];
    return !!hit
      && pos[0] >= hit[0]
      && pos[0] <= hit[0] + hit[2]
      && pos[1] >= hit[1]
      && pos[1] <= hit[1] + hit[3];
  }

  mouse(event, pos, node) {
    const lora = lorasWidgetValue(node)[this.index];
    if (!lora) {
      return false;
    }
    if (event.type === "pointermove") {
      if (this.contains(pos, "preview")) {
        showLoraPreview(node, lora.name, event);
        return true;
      }
      if (node.__easyuseAnimaLoraPreviewName === lora.name) {
        hideLoraPreview(node);
      }
      return false;
    }
    if (event.type !== "pointerdown") {
      return false;
    }
    if (this.contains(pos, "toggle")) {
      updateLoraEntry(node, this.index, { active: lora.active === false });
      return true;
    }
    if (this.contains(pos, "delete")) {
      removeLoraEntry(node, this.index);
      return true;
    }
    if (this.contains(pos, "preview")) {
      showLoraPreview(node, lora.name, event);
      return true;
    }
    if (this.contains(pos, "dec")) {
      updateLoraEntry(node, this.index, { strength: roundStrength((lora.strength ?? 1) - LORA_STRENGTH_STEP) });
      return true;
    }
    if (this.contains(pos, "inc")) {
      updateLoraEntry(node, this.index, { strength: roundStrength((lora.strength ?? 1) + LORA_STRENGTH_STEP) });
      return true;
    }
    if (this.contains(pos, "value")) {
      app.canvas.prompt("LoRA strength", lora.strength ?? 1, (value) => {
        const next = Number(value);
        if (Number.isFinite(next)) {
          updateLoraEntry(node, this.index, { strength: roundStrength(next) });
        }
      }, event);
      return true;
    }
    if (this.contains(pos, "name")) {
      openLoraMenu(node, event, (entry) => {
        updateLoraEntry(node, this.index, loraEntryFromName(entry.name, lora));
      });
      return true;
    }
    return false;
  }
}

function renderLoraRows(node) {
  if (!node.widgets) {
    return;
  }
  node.widgets = node.widgets.filter((widget) => !widget.__easyuseAnimaLoraRowWidget);
  const addButton = node.__easyuseAnimaAddLoraButton;
  const addIndex = addButton ? node.widgets.indexOf(addButton) : -1;
  const rows = lorasWidgetValue(node).map((_, index) => new EasyUseAnimaLoraRowWidget(index));
  if (addIndex >= 0) {
    node.widgets.splice(addIndex, 0, ...rows);
  } else {
    node.widgets.push(...rows);
  }
  enforceNodeLayout(node);
}

function profileOptions(node) {
  const count = profileCount(node);
  const options = [];
  for (let index = 1; index <= count; index += 1) {
    options.push(`${index}. ${profileLabel(node, index)}`);
  }
  return options;
}

function profileOptionIndex(value) {
  const match = String(value || "").match(/^(\d+)\./);
  return Math.max(1, Number.parseInt(match?.[1] || "1", 10) || 1);
}

function renderTabs(node) {
  const selector = node.__easyuseAnimaProfileSelector;
  if (!selector) {
    return;
  }
  const options = profileOptions(node);
  selector.options.values = options;
  const selectedLabel = options[activeProfileIndex(node) - 1] || options[0] || defaultProfileName(1);
  node.__easyuseAnimaSuppressProfileSelectorCallback = true;
  try {
    selector.value = selectedLabel;
  } finally {
    node.__easyuseAnimaSuppressProfileSelectorCallback = false;
  }
  const deleteButton = node.__easyuseAnimaDeleteProfileButton;
  if (deleteButton) {
    deleteButton.disabled = profileCount(node) <= 1;
  }
  enforceNodeLayout(node);
}

function ensureTabsWidget(node) {
  if (node.__easyuseAnimaProfileSelector || typeof node.addWidget !== "function") {
    return;
  }
  const selector = node.addWidget(
    "combo",
    "profile",
    profileOptions(node)[activeProfileIndex(node) - 1] || defaultProfileName(1),
    (value) => {
      if (node.__easyuseAnimaSuppressProfileSelectorCallback) {
        return;
      }
      switchProfile(node, profileOptionIndex(value));
    },
    { values: profileOptions(node) },
  );
  selector.serialize = false;
  node.__easyuseAnimaProfileSelector = selector;

  const addButton = node.addWidget("button", "add_profile", "+", () => addProfile(node));
  addButton.serialize = false;

  const renameButton = node.addWidget("button", "rename_profile", "Rename", () => {
    renameProfile(node, activeProfileIndex(node));
  });
  renameButton.serialize = false;

  const deleteButton = node.addWidget("button", "delete_profile", "Delete", () => {
    deleteProfile(node, activeProfileIndex(node));
  });
  deleteButton.serialize = false;
  node.__easyuseAnimaDeleteProfileButton = deleteButton;

  for (const widget of [selector, addButton, renameButton, deleteButton]) {
    if (widget) {
      widget.__easyuseAnimaControlWidget = true;
    }
  }
  const controls = [selector, addButton, renameButton, deleteButton].filter(Boolean);
  const insertBeforeIndex = node.widgets?.findIndex((widget) => widget.name === "lora_name" || widget.name === "loras") ?? -1;
  if (insertBeforeIndex >= 0 && controls.length) {
    node.widgets = node.widgets.filter((widget) => !widget.__easyuseAnimaControlWidget);
    node.widgets.splice(insertBeforeIndex, 0, ...controls);
  }
  const addLoraButton = node.addWidget("button", "add_lora", "Add LoRA", (event) => {
    openLoraMenu(node, event, (entry) => addLoraEntry(node, entry));
  });
  addLoraButton.serialize = false;
  node.__easyuseAnimaAddLoraButton = addLoraButton;
  renderTabs(node);
  renderLoraRows(node);
}

function wrapWidgetCallback(node, name, callback) {
  const widget = findWidget(node, name);
  if (!widget || widget.__easyuseAnimaLoraWrapped) {
    return;
  }
  widget.__easyuseAnimaLoraWrapped = true;
  const previous = widget.callback;
  widget.callback = function (...args) {
    const result = previous?.apply(this, args);
    callback?.();
    return result;
  };
}

function syncAfterWidgetChange(node) {
  if (node.__easyuseAnimaLoadingProfile) {
    return;
  }
  saveCurrentProfile(node);
  renderTabs(node);
}

function initializeNode(node) {
  if (node.__easyuseAnimaLoraPresetInitialized) {
    return;
  }
  node.__easyuseAnimaLoraPresetInitialized = true;
  node.serialize_widgets = true;
  ensureLoraStackInput(node);
  ensureTabsWidget(node);
  hideInternalWidget(node, "profile_data");
  hideInternalWidget(node, "profile_count");
  enforceNodeLayout(node);

  wrapWidgetCallback(node, "style_prompt", () => syncAfterWidgetChange(node));
  wrapWidgetCallback(node, "loras", () => syncAfterWidgetChange(node));
  wrapWidgetCallback(node, "profile_count", () => {
    if (node.__easyuseAnimaSuppressProfileCountCallback) {
      return;
    }
    renderTabs(node);
    saveCurrentProfile(node);
  });
  wrapWidgetCallback(node, "profile_index", () => {
    if (node.__easyuseAnimaSuppressProfileIndexCallback) {
      return;
    }
    const index = selectedProfileIndex(node);
    const currentIndex = activeProfileIndex(node);
    if (index !== currentIndex) {
      saveProfile(node, currentIndex);
    }
    loadProfile(node, index);
    node.__easyuseAnimaActiveProfileIndex = index;
    renderTabs(node);
  });

  const originalOnSerialize = node.onSerialize;
  node.onSerialize = function (workflowNode) {
    saveCurrentProfile(this);
    originalOnSerialize?.apply(this, arguments);
    const dataWidget = findWidget(this, "profile_data");
    if (workflowNode?.widgets_values && dataWidget) {
      workflowNode.widgets_values[WIDGET_INDEX.loras] = lorasWidgetValue(this);
      workflowNode.widgets_values[WIDGET_INDEX.profileData] = widgetValue(dataWidget, "{}");
    }
  };

  const originalOnConfigure = node.onConfigure;
  node.onConfigure = function (...args) {
    originalOnConfigure?.apply(this, args);
    window.requestAnimationFrame(() => {
      finalizeInternalWidgets(this);
      ensureTabsWidget(this);
      this.__easyuseAnimaActiveProfileIndex = selectedProfileIndex(this);
      loadProfile(this, selectedProfileIndex(this), { initializeFromCurrent: true });
      renderTabs(this);
      enforceNodeLayout(this);
    });
  };

  window.requestAnimationFrame(() => {
    finalizeInternalWidgets(node);
    node.__easyuseAnimaActiveProfileIndex = selectedProfileIndex(node);
    loadProfile(node, selectedProfileIndex(node), { initializeFromCurrent: true });
    renderTabs(node);
    enforceNodeLayout(node);
  });
}

app.registerExtension({
  name: "EasyUseAnima.LoraPreset",
  async beforeRegisterNodeDef(nodeType, nodeData) {
    if (nodeData.name !== NODE_TYPE) {
      return;
    }

    const originalConfigure = nodeType.prototype.configure;
    nodeType.prototype.configure = function (info) {
      normalizeSerializedWidgets(info);
      return originalConfigure?.apply(this, arguments);
    };

    const originalOnNodeCreated = nodeType.prototype.onNodeCreated;
    nodeType.prototype.onNodeCreated = function (...args) {
      const result = originalOnNodeCreated?.apply(this, args);
      initializeNode(this);
      return result;
    };
  },
});
