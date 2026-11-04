import { useSearchParams } from "react-router";
import {
  DEFAULT_SETTINGS_SECTION,
  isSettingsSection,
  type SettingsSection,
} from "../lib/settings-sections";

const SECTION_PARAM = "section";

/**
 * The section of Settings in view. It is in the address (`?section=preferences`), so a link opens
 * it and Back leaves it; anything that is not an available section is Profile.
 */
export function useSettingsSection(
  available: readonly SettingsSection[],
): [SettingsSection, (section: SettingsSection) => void] {
  const [params, setParams] = useSearchParams();
  const value = params.get(SECTION_PARAM);
  const section = isSettingsSection(value, available) ? value : DEFAULT_SETTINGS_SECTION;

  const select = (next: SettingsSection) => {
    setParams(next === DEFAULT_SETTINGS_SECTION ? {} : { [SECTION_PARAM]: next }, {
      replace: true,
    });
  };

  return [section, select];
}
