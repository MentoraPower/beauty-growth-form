import { useState, useEffect, useCallback } from "react";

export interface AppSettings {
  agendaEnabled: boolean;
}

const SETTINGS_KEY = "app_settings";

const defaultSettings: AppSettings = {
  agendaEnabled: true,
};

export function useAppSettings() {
  const [settings, setSettings] = useState<AppSettings>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) {
        try {
          return { ...defaultSettings, ...JSON.parse(saved) };
        } catch {
          return defaultSettings;
        }
      }
    }
    return defaultSettings;
  });

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    // Dispatch custom event so other components can react
    window.dispatchEvent(new CustomEvent("app-settings-change", { detail: settings }));
  }, [settings]);

  const updateSetting = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  return { settings, updateSetting };
}

// Hook to subscribe to settings changes (for components that need to react)
export function useAppSettingsListener() {
  const [settings, setSettings] = useState<AppSettings>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) {
        try {
          return { ...defaultSettings, ...JSON.parse(saved) };
        } catch {
          return defaultSettings;
        }
      }
    }
    return defaultSettings;
  });

  useEffect(() => {
    const handler = (e: CustomEvent<AppSettings>) => {
      setSettings(e.detail);
    };
    window.addEventListener("app-settings-change", handler as EventListener);
    return () => window.removeEventListener("app-settings-change", handler as EventListener);
  }, []);

  return settings;
}
