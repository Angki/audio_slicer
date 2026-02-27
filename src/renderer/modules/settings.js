/**
 * AutoSlice — Settings & Modals Module
 * Handles loading/saving settings, UI themes, and general modal visibility.
 */

export async function initSettings() {
    // UI Elements
    const $btnSettings = document.getElementById('btnSettings');
    const $btnCloseSettings = document.getElementById('btnCloseSettings');
    const $settingsModal = document.getElementById('settingsModal');

    const $btnShortcuts = document.getElementById('btnShortcuts');
    const $btnCloseShortcuts = document.getElementById('btnCloseShortcuts');
    const $shortcutsModal = document.getElementById('shortcutsModal');

    const $btnAbout = document.getElementById('btnAbout');
    const $btnCloseAbout = document.getElementById('btnCloseAbout');
    const $aboutModal = document.getElementById('aboutModal');

    // Settings Inputs
    const $settingDefaultFormat = document.getElementById('settingDefaultFormat');
    const $settingDefaultOutputDir = document.getElementById('settingDefaultOutputDir');
    const $btnSetDefaultOutputDir = document.getElementById('btnSetDefaultOutputDir');
    const $btnClearDefaultOutputDir = document.getElementById('btnClearDefaultOutputDir');
    const $settingWaveformTheme = document.getElementById('settingWaveformTheme');
    const $btnApplySettings = document.getElementById('btnApplySettings');

    // Load initial settings
    if (window.api.storeGet) {
        $settingDefaultFormat.value = await window.api.storeGet('defaultFormat', 'flac');
        $settingDefaultOutputDir.value = await window.api.storeGet('defaultOutputDir', '');
        $settingWaveformTheme.value = await window.api.storeGet('waveformTheme', 'purple');

        // Apply the settings to export bar if possible
        const $exportFormat = document.getElementById('exportFormat');
        if ($exportFormat) $exportFormat.value = $settingDefaultFormat.value;
    }

    // Modal Toggles
    const toggleModal = (modal, show) => {
        if (show) modal.classList.remove('hidden');
        else modal.classList.add('hidden');
    };

    $btnSettings?.addEventListener('click', () => toggleModal($settingsModal, true));
    $btnCloseSettings?.addEventListener('click', () => toggleModal($settingsModal, false));

    $btnShortcuts?.addEventListener('click', () => toggleModal($shortcutsModal, true));
    $btnCloseShortcuts?.addEventListener('click', () => toggleModal($shortcutsModal, false));

    $btnAbout?.addEventListener('click', () => toggleModal($aboutModal, true));
    $btnCloseAbout?.addEventListener('click', () => toggleModal($aboutModal, false));

    // Close Modals on Overlay Click
    [$settingsModal, $shortcutsModal, $aboutModal].forEach(modal => {
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) toggleModal(modal, false);
        });
    });

    // Directory Selection
    $btnSetDefaultOutputDir?.addEventListener('click', async () => {
        const dir = await window.api.selectExportDir();
        if (dir) {
            $settingDefaultOutputDir.value = dir;
        }
    });

    $btnClearDefaultOutputDir?.addEventListener('click', () => {
        $settingDefaultOutputDir.value = '';
    });

    // Save Settings
    $btnApplySettings?.addEventListener('click', async () => {
        if (window.api.storeSet) {
            await window.api.storeSet('defaultFormat', $settingDefaultFormat.value);
            await window.api.storeSet('defaultOutputDir', $settingDefaultOutputDir.value);
            await window.api.storeSet('waveformTheme', $settingWaveformTheme.value);

            // Sync to export bar
            const $exportFormat = document.getElementById('exportFormat');
            if ($exportFormat) $exportFormat.value = $settingDefaultFormat.value;

            // Optional: apply waveform theme immediately
            applyWaveformTheme($settingWaveformTheme.value);

            toggleModal($settingsModal, false);
            if (window.showToast) window.showToast('Settings saved successfully', 'success');
        }
    });

    // Apply initial theme
    applyWaveformTheme($settingWaveformTheme.value);
}

// Global theme variables
const themes = {
    purple: { waveColor: '#bb82ff', progressColor: '#9333ea' },
    blue: { waveColor: '#4ea8de', progressColor: '#0077b6' },
    green: { waveColor: '#52b788', progressColor: '#2d6a4f' }
};

export function getThemeColors() {
    const themeName = document.getElementById('settingWaveformTheme')?.value || 'purple';
    return themes[themeName] || themes.purple;
}

export function applyWaveformTheme(themeName) {
    const theme = themes[themeName] || themes.purple;
    // Set CSS variables for waveform and highlights
    document.documentElement.style.setProperty('--accent', theme.progressColor);
    document.documentElement.style.setProperty('--accent-hover', theme.waveColor);

    // WaveSurfer instance is recreated dynamically, so we can't just mutate the existing one easily without a redraw.
    // However, if we change the CSS variables, the UI buttons update.
    // The next load of an audio file will pick up the new getThemeColors().
}
