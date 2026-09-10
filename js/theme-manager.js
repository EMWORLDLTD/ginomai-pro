// ScriptureFlow Live - Theme & Display Customizer Engine
'use strict';

// Early Theme Hydration (Prevents Layout Stacking and Flash of Unstyled Theme on Refresh)
(function() {
  let savedStyle = (typeof localStorage !== 'undefined' && localStorage.getItem('sf_ui_style')) || 'bento';
  if (savedStyle !== 'bento') {
    savedStyle = 'bento';
    try { localStorage.setItem('sf_ui_style', 'bento'); } catch(e) {}
  }
  const savedMode = (typeof localStorage !== 'undefined' && localStorage.getItem('sf_ui_mode')) || 'dark';
  if (typeof document !== 'undefined') {
    if (document.documentElement) {
      document.documentElement.setAttribute('data-theme-style', 'bento');
      document.documentElement.setAttribute('data-theme-mode', savedMode);
    }
    if (document.body) {
      document.body.setAttribute('data-theme-style', savedStyle);
      document.body.setAttribute('data-theme-mode', savedMode);
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        if (document.body) {
          document.body.setAttribute('data-theme-style', savedStyle);
          document.body.setAttribute('data-theme-mode', savedMode);
        }
      });
    }
  }
})();

const UI_STYLES = {
  bento: {
    id: 'bento',
    name: 'Bento Studio Pro',
    description: 'Modern bento grid with modular cards, smooth curves, and dense workspace ergonomics.'
  },
  classic: {
    id: 'classic',
    name: 'Classic Studio Pro',
    description: 'Classic high-contrast dark slate broadcast studio console.'
  }
};

const UI_MODES = {
  dark: {
    id: 'dark',
    name: 'Dark Mode'
  },
  light: {
    id: 'light',
    name: 'Light Mode'
  }
};

const THEME_PRESETS = {
  classic_lt: {
    name: 'Classic Lower Third',
    bg: '#0F172A',
    mode: 'lt',
    font: 'Montserrat',
    primaryColor: '#3B82F6'
  },
  modern_broadcast: {
    name: 'Modern Broadcast',
    bg: '#1E1B4B',
    mode: 'lt',
    font: 'Inter',
    primaryColor: '#8B5CF6'
  },
  emerald_church: {
    name: 'Emerald Sanctuary',
    bg: '#064E3B',
    mode: 'full',
    font: 'Montserrat',
    primaryColor: '#10B981'
  },
  deep_dark: {
    name: 'Deep Night Fullscreen',
    bg: '#090D16',
    mode: 'full',
    font: 'Inter',
    primaryColor: '#60A5FA'
  }
};

const THEME_ICONS = {
  sun: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,
  moon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`
};

// ── Theme Layout Resizing Specifications Registry ────────────────────────────
// Every existing theme and every new theme added going forward registers its
// layout structure and resizable elements here for universal resize ergonomics.
const THEME_LAYOUT_SPECS = {
  bento: {
    containerSelector: '#bento-layout-root .bento-grid, #bento-grid-workspace, .bento-grid',
    resizers: [
      {
        id: 'bento-resizer-left',
        type: 'column',
        targetSelector: '#bento-col-left, .bento-col-left',
        cssVar: '--bento-sidebar-width',
        storageKey: 'sf_bento_sidebar_width',
        defaultVal: 260,
        min: 180,
        max: 600,
        direction: 'start'
      },
      {
        id: 'bento-resizer-right',
        type: 'column',
        targetSelector: '#bento-col-right, .bento-col-right',
        cssVar: '--bento-preview-width',
        storageKey: 'sf_bento_preview_width',
        defaultVal: 300,
        min: 220,
        max: 700,
        direction: 'end'
      },
      {
        id: 'bento-resizer-agenda',
        type: 'row',
        targetSelector: '#bento-agenda-card, .bento-agenda-card',
        cssVar: '--bento-agenda-height',
        storageKey: 'sf_bento_agenda_height',
        defaultVal: 220,
        min: 80,
        max: 520
      },
      {
        id: 'bento-resizer-preview',
        type: 'row',
        targetSelector: '#bento-prev-card, .bento-prev-card',
        cssVar: '--bento-preview-height',
        storageKey: 'sf_bento_preview_height',
        defaultVal: 250,
        min: 160,
        max: 520
      }
    ]
  },
  classic: {
    containerSelector: '#app-workspace',
    resizers: [
      {
        id: 'resizer-left',
        type: 'column',
        targetSelector: '#zone-library',
        cssVar: '--sidebar-width',
        storageKey: 'sf_sidebar_width',
        defaultVal: 300,
        min: 180,
        max: 600,
        direction: 'start'
      },
      {
        id: 'resizer-right',
        type: 'column',
        targetSelector: '#zone-preview',
        cssVar: '--preview-width',
        storageKey: 'sf_preview_width',
        defaultVal: 370,
        min: 220,
        max: 700,
        direction: 'end'
      },
      {
        id: 'resizer-agenda',
        type: 'row',
        targetSelector: '.sidebar-agenda-card',
        cssVar: '--agenda-height',
        storageKey: 'sf_agenda_height',
        defaultVal: 220,
        min: 80,
        max: 520
      }
    ]
  }
};

// ── Universal Theme Resizing Engine ──────────────────────────────────────────
class ThemeResizerEngine {
  static specs = THEME_LAYOUT_SPECS;
  static boundElements = new WeakSet();

  /**
   * Register a new theme's layout specifications
   * @param {string} themeKey - Key matching UI_STYLES
   * @param {object} layoutSpec - Layout configuration
   */
  static registerThemeLayout(themeKey, layoutSpec) {
    if (!themeKey || !layoutSpec) return;
    this.specs[themeKey] = layoutSpec;
    this.applySavedThemeDimensions(themeKey);
    this.init();
  }

  /**
   * Calculate responsive default value based on current window aspect ratio & size
   */
  static getResponsiveDefault(resizer) {
    const winW = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const winH = typeof window !== 'undefined' ? window.innerHeight : 720;
    const isSmallW = winW <= 1280;
    const isShortH = winH <= 760;

    if (resizer.cssVar === '--bento-sidebar-width') {
      return isSmallW ? 220 : 250;
    }
    if (resizer.cssVar === '--bento-preview-width') {
      return isSmallW ? 250 : 285;
    }
    if (resizer.cssVar === '--bento-agenda-height') {
      return isShortH ? Math.max(130, Math.floor(winH * 0.28)) : 220;
    }
    if (resizer.cssVar === '--bento-preview-height') {
      return isShortH ? Math.max(150, Math.floor(winH * 0.32)) : 250;
    }
    if (resizer.cssVar === '--sidebar-width') {
      return isSmallW ? 250 : 300;
    }
    if (resizer.cssVar === '--preview-width') {
      return isSmallW ? 300 : 370;
    }
    if (resizer.cssVar === '--agenda-height') {
      return isShortH ? 160 : 220;
    }
    return resizer.defaultVal;
  }

  /**
   * Apply all saved layout dimensions from localStorage into CSS Custom Properties
   * @param {string} [themeKey] - Specific theme or all registered themes
   */
  static applySavedThemeDimensions(themeKey) {
    const isFormatted = localStorage.getItem('sf_system_formatted') === 'true';
    const themesToApply = themeKey ? [themeKey] : Object.keys(this.specs);
    const winW = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const winH = typeof window !== 'undefined' ? window.innerHeight : 720;

    themesToApply.forEach(key => {
      const spec = this.specs[key];
      if (!spec || !spec.resizers) return;

      spec.resizers.forEach(resizer => {
        let val = this.getResponsiveDefault(resizer);
        if (!isFormatted) {
          const saved = localStorage.getItem(resizer.storageKey);
          if (saved !== null && saved !== undefined) {
            const num = parseInt(saved, 10);
            const dynamicMax = resizer.type === 'column' 
              ? Math.min(resizer.max || 700, Math.floor(winW * 0.45)) 
              : Math.min(resizer.max || 520, Math.floor(winH * 0.65));
            if (!isNaN(num) && num >= (resizer.min || 50) && num <= dynamicMax) {
              val = num;
            }
          }
        }
        if (typeof document !== 'undefined' && document.documentElement) {
          document.documentElement.style.setProperty(resizer.cssVar, `${val}px`);
        }
      });
    });

    if (typeof window !== 'undefined' && typeof window.scalePreviewIframe === 'function') {
      window.scalePreviewIframe();
    }
  }

  /**
   * Reset dimensions for a specific theme or all themes to default values
   */
  static resetThemeDimensions(themeKey) {
    const themesToReset = themeKey ? [themeKey] : Object.keys(this.specs);

    themesToReset.forEach(key => {
      const spec = this.specs[key];
      if (!spec || !spec.resizers) return;

      spec.resizers.forEach(resizer => {
        try {
          localStorage.removeItem(resizer.storageKey);
        } catch (e) {}
        const defaultVal = this.getResponsiveDefault(resizer);
        if (typeof document !== 'undefined' && document.documentElement) {
          document.documentElement.style.setProperty(resizer.cssVar, `${defaultVal}px`);
        }
      });
    });

    if (typeof window !== 'undefined' && typeof window.scalePreviewIframe === 'function') {
      window.scalePreviewIframe();
    }
  }

  /**
   * Initialize and attach event listeners to all resizer elements across layouts
   */
  static init() {
    if (typeof document === 'undefined') return;

    this.applySavedThemeDimensions();

    Object.keys(this.specs).forEach(themeKey => {
      const spec = this.specs[themeKey];
      if (!spec || !spec.resizers) return;

      spec.resizers.forEach(resizerConfig => {
        this.bindResizerElement(spec, resizerConfig);
      });
    });

    if (!this._resizeListenerAttached && typeof window !== 'undefined') {
      this._resizeListenerAttached = true;
      let resizeTimeout = null;
      window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          this.applySavedThemeDimensions();
          if (typeof window.syncBentoStagePreview === 'function') window.syncBentoStagePreview();
        }, 100);
      });
    }
  }

  /**
   * Bind drag and double-click handlers to a single resizer handle
   */
  static bindResizerElement(spec, config) {
    const resizerEl = document.getElementById(config.id) || (config.selector ? document.querySelector(config.selector) : null);
    if (!resizerEl || this.boundElements.has(resizerEl)) return;

    this.boundElements.add(resizerEl);

    // Double-click to restore default size
    resizerEl.ondblclick = (e) => {
      e.preventDefault();
      const defaultVal = this.getResponsiveDefault(config);
      document.documentElement.style.setProperty(config.cssVar, `${defaultVal}px`);
      try {
        localStorage.removeItem(config.storageKey);
      } catch (err) {}
      if (typeof window.scalePreviewIframe === 'function') window.scalePreviewIframe();
      if (typeof window.syncBentoStagePreview === 'function') window.syncBentoStagePreview();
    };

    // Pointerdown to start drag resizing
    resizerEl.onpointerdown = (e) => {
      if (e.button !== 0) return;
      e.preventDefault();

      const targetEl = config.targetSelector ? document.querySelector(config.targetSelector) : null;

      resizerEl.classList.add('dragging');
      const isCol = config.type === 'column';
      document.body.style.cursor = isCol ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';

      // Temporarily disable iframe pointer events during drag to prevent mouse capture loss
      const iframes = document.querySelectorAll('iframe');
      iframes.forEach(f => { f.style.pointerEvents = 'none'; });

      const pointerId = e.pointerId;
      if (typeof resizerEl.setPointerCapture === 'function' && pointerId !== undefined) {
        try { resizerEl.setPointerCapture(pointerId); } catch (err) {}
      }

      const startX = e.clientX;
      const startY = e.clientY;
      const initialTargetRect = targetEl ? targetEl.getBoundingClientRect() : null;
      let initialTargetSize = this.getResponsiveDefault(config);

      if (initialTargetRect) {
        initialTargetSize = isCol ? initialTargetRect.width : initialTargetRect.height;
      } else {
        const curVal = getComputedStyle(document.documentElement).getPropertyValue(config.cssVar).trim();
        const parsed = parseInt(curVal, 10);
        if (!isNaN(parsed) && parsed > 0) initialTargetSize = parsed;
      }

      const onMove = (moveEvt) => {
        let newSize;

        if (isCol) {
          const deltaX = moveEvt.clientX - startX;
          if (config.direction === 'end') {
            newSize = initialTargetSize - deltaX;
          } else {
            newSize = initialTargetSize + deltaX;
          }
          const winW = window.innerWidth;
          const maxAllowed = Math.min(config.max || 700, Math.floor(winW * 0.45));
          newSize = Math.max(config.min || 180, Math.min(newSize, maxAllowed));
        } else {
          // Row / Height resize
          const deltaY = moveEvt.clientY - startY;
          newSize = initialTargetSize + deltaY;
          const winH = window.innerHeight;
          const maxAllowed = Math.min(config.max || 520, Math.floor(winH * 0.65));
          newSize = Math.max(config.min || 80, Math.min(newSize, maxAllowed));
        }

        document.documentElement.style.setProperty(config.cssVar, `${newSize}px`);
        if (typeof window.scalePreviewIframe === 'function') window.scalePreviewIframe();
        if (typeof window.syncBentoStagePreview === 'function') window.syncBentoStagePreview();
      };

      const onUp = (upEvt) => {
        resizerEl.classList.remove('dragging');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        iframes.forEach(f => { f.style.pointerEvents = ''; });

        if (typeof resizerEl.releasePointerCapture === 'function' && pointerId !== undefined) {
          try { resizerEl.releasePointerCapture(pointerId); } catch (err) {}
        }

        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);

        const currentComputed = getComputedStyle(document.documentElement).getPropertyValue(config.cssVar).trim();
        const finalNum = parseInt(currentComputed, 10);
        if (!isNaN(finalNum)) {
          try {
            localStorage.setItem(config.storageKey, finalNum);
          } catch (err) {}
        }

        if (typeof window.scalePreviewIframe === 'function') window.scalePreviewIframe();
        if (typeof window.syncBentoStagePreview === 'function') window.syncBentoStagePreview();
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    };
  }
}

class ThemeManager {
  constructor(appState, broadcastCallback) {
    this.state = appState || {};
    this.broadcast = broadcastCallback || null;
    this.currentPreset = 'classic_lt';
    
    // Restore UI Style & Mode from localStorage
    let storedStyle = localStorage.getItem('sf_ui_style') || 'bento';
    if (storedStyle !== 'bento') {
      storedStyle = 'bento';
      try { localStorage.setItem('sf_ui_style', 'bento'); } catch(e) {}
    }
    this.currentStyle = storedStyle;
    this.currentMode = localStorage.getItem('sf_ui_mode') || 'dark';

    this.applyUiTheme();
    ThemeResizerEngine.applySavedThemeDimensions(this.currentStyle);
  }

  setStyle(styleKey) {
    if (!UI_STYLES[styleKey]) return;
    this.currentStyle = styleKey;
    localStorage.setItem('sf_ui_style', styleKey);
    this.applyUiTheme();
    ThemeResizerEngine.applySavedThemeDimensions(styleKey);
    this.updateSettingsUi();
  }

  setMode(modeKey) {
    if (!UI_MODES[modeKey]) return;
    this.currentMode = modeKey;
    localStorage.setItem('sf_ui_mode', modeKey);
    this.applyUiTheme();
    this.updateSettingsUi();
  }

  toggleMode() {
    const nextMode = this.currentMode === 'dark' ? 'light' : 'dark';
    this.setMode(nextMode);
    return nextMode;
  }

  applyUiTheme() {
    const root = document.documentElement;
    const body = document.body;
    
    if (body) {
      body.setAttribute('data-theme-style', this.currentStyle);
      body.setAttribute('data-theme-mode', this.currentMode);
    }
    if (root) {
      root.setAttribute('data-theme-style', this.currentStyle);
      root.setAttribute('data-theme-mode', this.currentMode);
    }

    this.updateHeaderThemeButtons();
  }

  updateHeaderThemeButtons() {
    const isDark = this.currentMode === 'dark';
    // In dark mode, show sun icon to switch to light mode; in light mode, show moon icon to switch to dark mode
    const iconSvg = isDark ? THEME_ICONS.sun : THEME_ICONS.moon;
    const tooltipText = isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode';

    const bentoBtn = document.getElementById('bento-theme-mode-toggle');
    if (bentoBtn) {
      bentoBtn.innerHTML = iconSvg;
      bentoBtn.title = tooltipText;
      bentoBtn.setAttribute('aria-label', tooltipText);
    }

    const classicBtn = document.getElementById('classic-theme-mode-toggle');
    if (classicBtn) {
      classicBtn.innerHTML = iconSvg;
      classicBtn.title = tooltipText;
      classicBtn.setAttribute('aria-label', tooltipText);
    }
  }

  updateSettingsUi() {
    // Update active state on Theme Style selection cards
    const styleCards = document.querySelectorAll('.theme-style-card');
    styleCards.forEach(card => {
      const styleId = card.getAttribute('data-style-id');
      if (styleId === this.currentStyle) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }
    });

    // Update active state on Theme Mode buttons
    const modeBtns = document.querySelectorAll('.theme-mode-btn');
    modeBtns.forEach(btn => {
      const modeId = btn.getAttribute('data-mode-id');
      if (modeId === this.currentMode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    this.updateHeaderThemeButtons();
  }

  applyPreset(presetKey) {
    if (!THEME_PRESETS[presetKey]) return;
    const preset = THEME_PRESETS[presetKey];
    this.currentPreset = presetKey;
    if (this.state) {
      this.state.background = preset.bg;
      this.state.currentMode = preset.mode;
    }

    if (this.broadcast) {
      this.broadcast({
        bg: preset.bg,
        mode: preset.mode,
        theme: preset
      });
    }
  }
}

window.UI_STYLES = UI_STYLES;
window.UI_MODES = UI_MODES;
window.THEME_PRESETS = THEME_PRESETS;
window.THEME_LAYOUT_SPECS = THEME_LAYOUT_SPECS;
window.ThemeResizerEngine = ThemeResizerEngine;
window.ThemeManager = ThemeManager;

// Auto-bind resizers on DOMContentLoaded or immediate execution
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ThemeResizerEngine.init());
  } else {
    ThemeResizerEngine.init();
  }
}

