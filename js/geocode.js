/**
 * Geocoding e calcolo distanza (API gratuite).
 * - Nominatim (OSM) per indirizzo → coordinate
 * - Formula di Haversine per distanza in km (linea d'aria)
 * Per distanza su strada si può integrare OSRM (gratuito).
 */

const GEOCODE = {
  nominatimBase: 'https://nominatim.openstreetmap.org/search',
  userAgent: 'CalcoloPergo/1.0',

  /**
   * Converte un indirizzo in coordinate lat/lon (Nominatim, gratuito).
   * @param {string} indirizzo
   * @param {string} countryCode - es. 'it'
   * @returns {Promise<{ lat: number, lon: number }|null>}
   */
  async geocode(indirizzo, countryCode = 'it') {
    if (!indirizzo || !indirizzo.trim()) return null;
    const params = new URLSearchParams({
      q: indirizzo.trim(),
      format: 'json',
      limit: '1',
      countrycodes: countryCode,
    });
    const url = `${this.nominatimBase}?${params}`;
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': this.userAgent },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data[0]) return null;
    const lat = parseFloat(data[0].lat);
    const lon = parseFloat(data[0].lon);
    if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
    return { lat, lon };
  },

  /**
   * Distanza in km tra due punti (Haversine).
   * @param {{ lat: number, lon: number }} from
   * @param {{ lat: number, lon: number }} to
   * @returns {number} km
   */
  distanzaHaversine(from, to) {
    const R = 6371; // raggio Terra in km
    const dLat = (to.lat - from.lat) * Math.PI / 180;
    const dLon = (to.lon - from.lon) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(from.lat * Math.PI / 180) * Math.cos(to.lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  },

  /**
   * Dato indirizzo e coordinate partenza, restituisce distanza in km.
   * @param {string} indirizzo
   * @param {{ lat: number, lon: number }} coordinatePartenza
   * @returns {Promise<{ km: number, coordinate?: { lat, lon } }|null>}
   */
  async calcolaDistanza(indirizzo, coordinatePartenza) {
    const coord = await this.geocode(indirizzo);
    if (!coord) return null;
    const km = this.distanzaHaversine(coordinatePartenza, coord);
    return { km: Math.round(km * 10) / 10, coordinate: coord };
  },
};

window.GEOCODE = GEOCODE;
