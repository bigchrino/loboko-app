/**
 * lib/geo.ts
 *
 * Utilitaires de géolocalisation pour LOBOKO — Phase 2.
 *
 *  - distanceInMeters(a, b)  : distance à vol d'oiseau entre deux points GPS
 *  - formatDistance(meters)  : "À 450 m" / "À 1,8 km"
 *  - getCurrentPosition()    : position du navigateur, sans jamais rejeter
 *                              (un refus/échec renvoie juste coords: null)
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Distance à vol d'oiseau entre deux points GPS, en mètres.
 * Formule de Haversine — largement suffisante pour trier/afficher des
 * distances client <-> prestataire (précision à quelques mètres près).
 */
export function distanceInMeters(a: Coordinates, b: Coordinates): number {
  const EARTH_RADIUS_M = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return EARTH_RADIUS_M * c;
}

/**
 * Formate une distance en mètres pour l'affichage :
 *  - en dessous de 1 km  -> "À 450 m"  (arrondi à la dizaine de mètres)
 *  - au dessus de 1 km   -> "À 1,8 km" (une décimale, virgule française)
 *  - au dessus de 10 km  -> "À 24 km"  (arrondi au km, plus lisible)
 */
export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return '';

  if (meters < 1000) {
    const rounded = Math.max(10, Math.round(meters / 10) * 10);
    return `À ${rounded} m`;
  }

  const km = meters / 1000;
  if (km < 10) {
    return `À ${km.toFixed(1).replace('.', ',')} km`;
  }
  return `À ${Math.round(km)} km`;
}

export type GeolocationErrorReason =
  | 'denied'
  | 'unavailable'
  | 'timeout'
  | 'unsupported';

export interface GeolocationResult {
  coords: Coordinates | null;
  error: GeolocationErrorReason | null;
}

/**
 * Demande la position actuelle au navigateur. Ne rejette JAMAIS : en cas de
 * refus, d'indisponibilité ou de navigateur non compatible, elle résout avec
 * `coords: null` et une raison — à l'appelant de basculer proprement sur le
 * repli Province / Ville / Commune plutôt que de planter.
 */
export function getCurrentPosition(
  options?: PositionOptions,
): Promise<GeolocationResult> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve({ coords: null, error: 'unsupported' });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          coords: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
          error: null,
        });
      },
      (err) => {
        let reason: GeolocationErrorReason = 'unavailable';
        if (err.code === err.PERMISSION_DENIED) reason = 'denied';
        else if (err.code === err.TIMEOUT) reason = 'timeout';
        resolve({ coords: null, error: reason });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
        ...options,
      },
    );
  });
}
