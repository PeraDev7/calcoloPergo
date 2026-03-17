/**
 * Geocoding e calcolo distanza tramite Google Maps API.
 * - google.maps.Geocoder  → indirizzo ↔ coordinate
 * - google.maps.places.AutocompleteService → suggerimenti autocomplete
 * - Haversine per distanza in km (linea d'aria)
 *
 * NOTA: questo file viene caricato prima che il SDK Google Maps sia pronto.
 * Tutti i metodi vengono invocati solo dopo il callback onGoogleMapsReady.
 */

const GEOCODE = {
  /**
   * Distanza in km tra due punti (Haversine).
   * @param {{ lat: number, lon: number }} from
   * @param {{ lat: number, lon: number }} to
   * @returns {number}
   */
  distanzaHaversine(from, to) {
    const R = 6371;
    const dLat = (to.lat - from.lat) * Math.PI / 180;
    const dLon = (to.lon - from.lon) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(from.lat * Math.PI / 180) * Math.cos(to.lat * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  },

  /**
   * Geocodifica un indirizzo → { lat, lon } tramite Google Geocoder.
   * @param {string} indirizzo
   * @returns {Promise<{ lat: number, lon: number }|null>}
   */
  geocode(indirizzo) {
    return new Promise((resolve) => {
      if (!indirizzo?.trim()) { resolve(null); return; }
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode(
        { address: indirizzo.trim(), region: 'it' },
        (results, status) => {
          if (status === google.maps.GeocoderStatus.OK && results[0]) {
            const loc = results[0].geometry.location;
            resolve({ lat: loc.lat(), lon: loc.lng() });
          } else {
            resolve(null);
          }
        }
      );
    });
  },

  /**
   * Autocomplete: suggerimenti tramite google.maps.places.AutocompleteSuggestion (nuova API).
   * Ogni elemento ha { display_name, place_id }.
   * @param {string} query
   * @returns {Promise<Array<{ display_name: string, place_id: string }>>}
   */
  async search(query) {
    if (!query || query.trim().length < 3) return [];
    try {
      const { suggestions } =
        await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: query.trim(),
          includedRegionCodes: ['it'],
        });
      if (!suggestions?.length) return [];
      return suggestions
        .filter((s) => s.placePrediction)
        .map((s) => ({
          display_name: s.placePrediction.text.toString(),
          place_id: s.placePrediction.placeId,
        }));
    } catch {
      return [];
    }
  },

  /**
   * Recupera le coordinate di un luogo tramite place_id (nuova API google.maps.places.Place).
   * @param {string} placeId
   * @returns {Promise<{ lat: number, lon: number }|null>}
   */
  async getPlaceCoords(placeId) {
    try {
      const place = new google.maps.places.Place({ id: placeId });
      await place.fetchFields({ fields: ['location'] });
      if (!place.location) return null;
      return {
        lat: place.location.lat(),
        lon: place.location.lng(),
      };
    } catch {
      return null;
    }
  },

  /**
   * Geocodifica inversa: coordinate → indirizzo testuale.
   * @param {number} lat
   * @param {number} lon
   * @returns {Promise<string|null>}
   */
  reverseGeocode(lat, lon) {
    return new Promise((resolve) => {
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode(
        { location: { lat, lng: lon } },
        (results, status) => {
          if (status === google.maps.GeocoderStatus.OK && results[0]) {
            resolve(results[0].formatted_address);
          } else {
            resolve(null);
          }
        }
      );
    });
  },

  /**
   * Geocodifica un indirizzo e calcola la distanza dalla partenza.
   * @param {string} indirizzo
   * @param {{ lat: number, lon: number }} coordinatePartenza
   * @returns {Promise<{ km: number, coordinate: { lat, lon } }|null>}
   */
  async calcolaDistanza(indirizzo, coordinatePartenza) {
    const coord = await this.geocode(indirizzo);
    if (!coord) return null;
    const km = this.distanzaHaversine(coordinatePartenza, coord);
    return { km: Math.round(km * 10) / 10, coordinate: coord };
  },
};

window.GEOCODE = GEOCODE;
