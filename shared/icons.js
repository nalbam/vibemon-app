// Cached DOM elements
let iconCache = null;

// Initialize icon cache (called once on first drawInfoIcons call)
function initIconCache() {
  iconCache = {
    emojiIcons: document.querySelectorAll('.emoji-icon'),
    pixelIcons: document.querySelectorAll('.pixel-icon'),
    iconProject: document.getElementById('icon-project'),
    iconTool: document.getElementById('icon-tool'),
    iconModel: document.getElementById('icon-model'),
    iconMemory: document.getElementById('icon-memory')
  };
}

// Draw folder icon - 8x7 pixels
export function drawFolderIcon(iconCtx, color) {
  iconCtx.fillStyle = color;
  iconCtx.fillRect(0, 0, 3, 1);
  iconCtx.fillRect(0, 1, 8, 6);
  iconCtx.fillStyle = '#000000';
  iconCtx.fillRect(1, 2, 6, 1);
}

// Draw tool/wrench icon - 8x8 pixels
export function drawToolIcon(iconCtx, color) {
  iconCtx.fillStyle = color;
  iconCtx.fillRect(1, 0, 6, 3);
  iconCtx.fillStyle = '#000000';
  iconCtx.fillRect(3, 0, 2, 1);
  iconCtx.fillStyle = color;
  iconCtx.fillRect(3, 3, 2, 5);
}

// Draw robot icon - 8x8 pixels
export function drawRobotIcon(iconCtx, color) {
  iconCtx.fillStyle = color;
  iconCtx.fillRect(3, 0, 2, 1);
  iconCtx.fillRect(1, 1, 6, 5);
  iconCtx.fillStyle = '#000000';
  iconCtx.fillRect(2, 2, 1, 2);
  iconCtx.fillRect(5, 2, 1, 2);
  iconCtx.fillRect(2, 5, 4, 1);
  iconCtx.fillStyle = color;
  iconCtx.fillRect(0, 2, 1, 2);
  iconCtx.fillRect(7, 2, 1, 2);
}

// Draw brain icon - 8x7 pixels
export function drawBrainIcon(iconCtx, color) {
  iconCtx.fillStyle = color;
  iconCtx.fillRect(1, 0, 6, 7);
  iconCtx.fillRect(0, 1, 8, 5);
  iconCtx.fillStyle = '#000000';
  iconCtx.fillRect(4, 1, 1, 5);
  iconCtx.fillRect(2, 0, 1, 1);
  iconCtx.fillRect(5, 0, 1, 1);
}

// Draw all info icons
export function drawInfoIcons(color, bgColor, useEmoji) {
  // Initialize cache on first call
  if (!iconCache) {
    initIconCache();
  }

  const c = iconCache;

  // Toggle emoji/pixel icon visibility (using cached elements)
  c.emojiIcons.forEach(el => el.style.display = useEmoji ? 'inline' : 'none');
  c.pixelIcons.forEach(el => el.style.display = useEmoji ? 'none' : 'inline-block');

  if (!useEmoji) {
    const canvases = [c.iconProject, c.iconTool, c.iconModel, c.iconMemory];
    const drawFuncs = [drawFolderIcon, drawToolIcon, drawRobotIcon, drawBrainIcon];

    canvases.forEach((canvas, index) => {
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, 8, 8);
        drawFuncs[index](ctx, color);
      }
    });
  }
}
