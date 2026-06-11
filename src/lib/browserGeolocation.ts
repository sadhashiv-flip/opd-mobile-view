export type BrowserGeoPosition = Readonly<{
  lat: number;
  lng: number;
}>;

/** patient-app `AddAddressController._getCurrentLocation` — browser Geolocation API. */
export function getBrowserCurrentPosition(): Promise<BrowserGeoPosition | null> {
  const geo = globalThis.navigator?.geolocation;
  if (!geo) return Promise.resolve(null);

  return new Promise((resolve) => {
    geo.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          resolve(null);
          return;
        }
        resolve({ lat, lng });
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    );
  });
}
