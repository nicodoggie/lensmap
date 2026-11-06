import { useRef, useState } from "react";
import { type MapEntry, Navigation } from "./map-navigation";
export function useMapNavigation(
  initial: MapEntry,
  onChange?: (navigation: Navigation) => void,
) {
  const [, update] = useState(0);
  const ref = useRef<Navigation | null>(null);
  const callback = useRef(onChange);
  callback.current = onChange;
  if (!ref.current)
    ref.current = new Navigation(initial, () => {
      if (ref.current) callback.current?.(ref.current);
      update((n) => n + 1);
    });
  return ref.current;
}
export function NavigationNotice({
  navigation,
  openAnyway,
}: {
  navigation: Navigation;
  openAnyway: () => void;
}) {
  return (
    <>
      {navigation.error && <p role="alert">{navigation.error}</p>}
      {navigation.fallback && (
        <button type="button" onClick={openAnyway}>
          Open destination map anyway
        </button>
      )}
    </>
  );
}
