import map from "../data/lebanon-map.json";
import { locations, type ScreenLocation } from "../data/locations";

export const cities = map.cities;
export type LocationSelection = { cities: string[]; screens: string[] };
export const emptySelection: LocationSelection = { cities: [], screens: [] };

export function cleanSelection(
  input: Partial<LocationSelection>,
  inventory: ScreenLocation[] = locations,
): LocationSelection {
  const cityNames = [
    ...new Set(
      (input.cities || []).filter((name) =>
        cities.some((city) => city.name === name),
      ),
    ),
  ];
  return {
    cities: cityNames,
    screens: [
      ...new Set(
        (input.screens || []).filter((id) =>
          inventory.some(
            (screen) => screen.id === id && !cityNames.includes(screen.city),
          ),
        ),
      ),
    ],
  };
}
export function toggleCity(
  selection: LocationSelection,
  name: string,
): LocationSelection {
  return cleanSelection({
    ...selection,
    cities: selection.cities.includes(name)
      ? selection.cities.filter((city) => city !== name)
      : [...selection.cities, name],
  });
}
export function toggleScreen(
  selection: LocationSelection,
  id: string,
  inventory = locations,
): LocationSelection {
  const screen = inventory.find((item) => item.id === id);
  if (!screen) return selection;
  return cleanSelection(
    {
      cities: selection.cities.filter((city) => city !== screen.city),
      screens: selection.screens.includes(id)
        ? selection.screens.filter((value) => value !== id)
        : [...selection.screens, id],
    },
    inventory,
  );
}
export function selectionFromParams(params: URLSearchParams) {
  return cleanSelection({
    cities: params.getAll("city"),
    screens: [...params.getAll("screen"), ...params.getAll("location")],
  });
}
export function campaignUrl(selection: LocationSelection, occasion = false) {
  const params = new URLSearchParams();
  const clean = cleanSelection(selection);
  clean.cities.forEach((city) => params.append("city", city));
  clean.screens.forEach((screen) => params.append("screen", screen));
  if (occasion) params.set("type", "special");
  return `/start-campaign${params.size ? `?${params}` : ""}`;
}
