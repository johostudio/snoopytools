export interface Airport {
  code: string
  city: string
  name: string
  country: string
  latitude: number
  longitude: number
}

export const AIRPORTS: Airport[] = [
  { code: 'YVR', city: 'Vancouver', name: 'Vancouver International', country: 'Canada', latitude: 49.1947, longitude: -123.1792 },
  { code: 'YYC', city: 'Calgary', name: 'Calgary International', country: 'Canada', latitude: 51.1215, longitude: -114.0076 },
  { code: 'YEG', city: 'Edmonton', name: 'Edmonton International', country: 'Canada', latitude: 53.3097, longitude: -113.5797 },
  { code: 'YYZ', city: 'Toronto', name: 'Toronto Pearson', country: 'Canada', latitude: 43.6777, longitude: -79.6248 },
  { code: 'YUL', city: 'Montréal', name: 'Montréal–Trudeau', country: 'Canada', latitude: 45.4706, longitude: -73.7408 },
  { code: 'SEA', city: 'Seattle', name: 'Seattle–Tacoma', country: 'United States', latitude: 47.4502, longitude: -122.3088 },
  { code: 'SFO', city: 'San Francisco', name: 'San Francisco International', country: 'United States', latitude: 37.6213, longitude: -122.379 },
  { code: 'LAX', city: 'Los Angeles', name: 'Los Angeles International', country: 'United States', latitude: 33.9416, longitude: -118.4085 },
  { code: 'JFK', city: 'New York', name: 'John F. Kennedy International', country: 'United States', latitude: 40.6413, longitude: -73.7781 },
  { code: 'BOS', city: 'Boston', name: 'Boston Logan', country: 'United States', latitude: 42.3656, longitude: -71.0096 },
  { code: 'ORD', city: 'Chicago', name: "O'Hare International", country: 'United States', latitude: 41.9742, longitude: -87.9073 },
  { code: 'MEX', city: 'Mexico City', name: 'Benito Juárez International', country: 'Mexico', latitude: 19.4361, longitude: -99.0719 },
  { code: 'GRU', city: 'São Paulo', name: 'Guarulhos International', country: 'Brazil', latitude: -23.4356, longitude: -46.4731 },
  { code: 'LHR', city: 'London', name: 'London Heathrow', country: 'United Kingdom', latitude: 51.47, longitude: -0.4543 },
  { code: 'CDG', city: 'Paris', name: 'Charles de Gaulle', country: 'France', latitude: 49.0097, longitude: 2.5479 },
  { code: 'AMS', city: 'Amsterdam', name: 'Amsterdam Schiphol', country: 'Netherlands', latitude: 52.3105, longitude: 4.7683 },
  { code: 'CPH', city: 'Copenhagen', name: 'Copenhagen Airport', country: 'Denmark', latitude: 55.618, longitude: 12.6508 },
  { code: 'ARN', city: 'Stockholm', name: 'Stockholm Arlanda', country: 'Sweden', latitude: 59.6519, longitude: 17.9186 },
  { code: 'HEL', city: 'Helsinki', name: 'Helsinki Airport', country: 'Finland', latitude: 60.3172, longitude: 24.9633 },
  { code: 'LIS', city: 'Lisbon', name: 'Humberto Delgado', country: 'Portugal', latitude: 38.7756, longitude: -9.1354 },
  { code: 'BCN', city: 'Barcelona', name: 'Barcelona–El Prat', country: 'Spain', latitude: 41.2974, longitude: 2.0833 },
  { code: 'FCO', city: 'Rome', name: 'Leonardo da Vinci–Fiumicino', country: 'Italy', latitude: 41.8003, longitude: 12.2389 },
  { code: 'KHN', city: 'Nanchang', name: 'Nanchang Changbei International', country: 'China', latitude: 28.8648, longitude: 115.9027 },
  { code: 'HND', city: 'Tokyo', name: 'Tokyo Haneda', country: 'Japan', latitude: 35.5494, longitude: 139.7798 },
  { code: 'NRT', city: 'Tokyo', name: 'Narita International', country: 'Japan', latitude: 35.772, longitude: 140.3929 },
  { code: 'ICN', city: 'Seoul', name: 'Incheon International', country: 'South Korea', latitude: 37.4602, longitude: 126.4407 },
  { code: 'HKG', city: 'Hong Kong', name: 'Hong Kong International', country: 'Hong Kong', latitude: 22.308, longitude: 113.9185 },
  { code: 'SIN', city: 'Singapore', name: 'Singapore Changi', country: 'Singapore', latitude: 1.3644, longitude: 103.9915 },
  { code: 'BKK', city: 'Bangkok', name: 'Suvarnabhumi', country: 'Thailand', latitude: 13.69, longitude: 100.7501 },
  { code: 'MYY', city: 'Miri', name: 'Miri Airport', country: 'Malaysia', latitude: 4.3253, longitude: 113.9883 },
  { code: 'DEL', city: 'Delhi', name: 'Indira Gandhi International', country: 'India', latitude: 28.5562, longitude: 77.1 },
  { code: 'SYD', city: 'Sydney', name: 'Sydney Kingsford Smith', country: 'Australia', latitude: -33.9399, longitude: 151.1753 },
  { code: 'MEL', city: 'Melbourne', name: 'Melbourne Airport', country: 'Australia', latitude: -37.669, longitude: 144.841 },
  { code: 'AKL', city: 'Auckland', name: 'Auckland Airport', country: 'New Zealand', latitude: -37.0082, longitude: 174.785 },
  { code: 'DXB', city: 'Dubai', name: 'Dubai International', country: 'United Arab Emirates', latitude: 25.2532, longitude: 55.3657 },
]

export function findAirport(code: string) {
  return AIRPORTS.find((airport) => airport.code === code) ?? AIRPORTS[0]
}

const toRadians = (degrees: number) => degrees * Math.PI / 180

export function routeDistanceKm(origin: Airport, destination: Airport) {
  const earthRadiusKm = 6_371
  const latitudeDelta = toRadians(destination.latitude - origin.latitude)
  const longitudeDelta = toRadians(destination.longitude - origin.longitude)
  const originLatitude = toRadians(origin.latitude)
  const destinationLatitude = toRadians(destination.latitude)
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(originLatitude) * Math.cos(destinationLatitude) * Math.sin(longitudeDelta / 2) ** 2
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
}

export function estimateFlightMinutes(origin: Airport, destination: Airport) {
  if (origin.code === destination.code) return 0
  const distanceKm = routeDistanceKm(origin, destination)
  const cruiseMinutes = distanceKm / 850 * 60
  const airportOverheadMinutes = distanceKm < 1_000 ? 35 : distanceKm < 4_000 ? 45 : 55
  return Math.max(45, Math.round((cruiseMinutes + airportOverheadMinutes) / 5) * 5)
}
