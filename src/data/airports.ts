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
  { code: 'YHZ', city: 'Halifax', name: 'Halifax Stanfield International', country: 'Canada', latitude: 44.8808, longitude: -63.5086 },
  { code: 'YOW', city: 'Ottawa', name: 'Ottawa International', country: 'Canada', latitude: 45.3225, longitude: -75.6692 },
  { code: 'YQB', city: 'Québec City', name: 'Québec City Jean Lesage International', country: 'Canada', latitude: 46.7911, longitude: -71.3933 },
  { code: 'YWG', city: 'Winnipeg', name: 'Winnipeg James Armstrong Richardson International', country: 'Canada', latitude: 49.91, longitude: -97.2399 },
  { code: 'YXS', city: 'Prince George', name: 'Prince George Airport', country: 'Canada', latitude: 53.889, longitude: -122.679 },
  { code: 'SEA', city: 'Seattle', name: 'Seattle–Tacoma', country: 'United States', latitude: 47.4502, longitude: -122.3088 },
  { code: 'PDX', city: 'Portland', name: 'Portland International', country: 'United States', latitude: 45.5898, longitude: -122.5951 },
  { code: 'SFO', city: 'San Francisco', name: 'San Francisco International', country: 'United States', latitude: 37.6213, longitude: -122.379 },
  { code: 'LAX', city: 'Los Angeles', name: 'Los Angeles International', country: 'United States', latitude: 33.9416, longitude: -118.4085 },
  { code: 'LAS', city: 'Las Vegas', name: 'Harry Reid International', country: 'United States', latitude: 36.084, longitude: -115.1537 },
  { code: 'PHX', city: 'Phoenix', name: 'Phoenix Sky Harbor International', country: 'United States', latitude: 33.4342, longitude: -112.0116 },
  { code: 'DEN', city: 'Denver', name: 'Denver International', country: 'United States', latitude: 39.8561, longitude: -104.6737 },
  { code: 'DFW', city: 'Dallas', name: 'Dallas Fort Worth International', country: 'United States', latitude: 32.8998, longitude: -97.0403 },
  { code: 'IAH', city: 'Houston', name: 'George Bush Intercontinental', country: 'United States', latitude: 29.9902, longitude: -95.3368 },
  { code: 'ATL', city: 'Atlanta', name: 'Hartsfield–Jackson Atlanta International', country: 'United States', latitude: 33.6407, longitude: -84.4277 },
  { code: 'MIA', city: 'Miami', name: 'Miami International', country: 'United States', latitude: 25.7959, longitude: -80.287 },
  { code: 'JFK', city: 'New York', name: 'John F. Kennedy International', country: 'United States', latitude: 40.6413, longitude: -73.7781 },
  { code: 'EWR', city: 'Newark', name: 'Newark Liberty International', country: 'United States', latitude: 40.6895, longitude: -74.1745 },
  { code: 'IAD', city: 'Washington', name: 'Washington Dulles International', country: 'United States', latitude: 38.9531, longitude: -77.4565 },
  { code: 'BOS', city: 'Boston', name: 'Boston Logan', country: 'United States', latitude: 42.3656, longitude: -71.0096 },
  { code: 'ORD', city: 'Chicago', name: "O'Hare International", country: 'United States', latitude: 41.9742, longitude: -87.9073 },
  { code: 'MSP', city: 'Minneapolis', name: 'Minneapolis–Saint Paul International', country: 'United States', latitude: 44.8848, longitude: -93.2223 },
  { code: 'HNL', city: 'Honolulu', name: 'Daniel K. Inouye International', country: 'United States', latitude: 21.3187, longitude: -157.9225 },
  { code: 'MEX', city: 'Mexico City', name: 'Benito Juárez International', country: 'Mexico', latitude: 19.4361, longitude: -99.0719 },
  { code: 'CUN', city: 'Cancún', name: 'Cancún International', country: 'Mexico', latitude: 21.0365, longitude: -86.8771 },
  { code: 'BOG', city: 'Bogotá', name: 'El Dorado International', country: 'Colombia', latitude: 4.7016, longitude: -74.1469 },
  { code: 'LIM', city: 'Lima', name: 'Jorge Chávez International', country: 'Peru', latitude: -12.0219, longitude: -77.1143 },
  { code: 'GRU', city: 'São Paulo', name: 'Guarulhos International', country: 'Brazil', latitude: -23.4356, longitude: -46.4731 },
  { code: 'GIG', city: 'Rio de Janeiro', name: 'Rio de Janeiro–Galeão International', country: 'Brazil', latitude: -22.809, longitude: -43.2506 },
  { code: 'EZE', city: 'Buenos Aires', name: 'Ministro Pistarini International', country: 'Argentina', latitude: -34.8222, longitude: -58.5358 },
  { code: 'SCL', city: 'Santiago', name: 'Arturo Merino Benítez International', country: 'Chile', latitude: -33.393, longitude: -70.7858 },
  { code: 'LHR', city: 'London', name: 'London Heathrow', country: 'United Kingdom', latitude: 51.47, longitude: -0.4543 },
  { code: 'MAN', city: 'Manchester', name: 'Manchester Airport', country: 'United Kingdom', latitude: 53.3537, longitude: -2.275 },
  { code: 'EDI', city: 'Edinburgh', name: 'Edinburgh Airport', country: 'United Kingdom', latitude: 55.95, longitude: -3.3725 },
  { code: 'DUB', city: 'Dublin', name: 'Dublin Airport', country: 'Ireland', latitude: 53.4264, longitude: -6.2499 },
  { code: 'CDG', city: 'Paris', name: 'Charles de Gaulle', country: 'France', latitude: 49.0097, longitude: 2.5479 },
  { code: 'AMS', city: 'Amsterdam', name: 'Amsterdam Schiphol', country: 'Netherlands', latitude: 52.3105, longitude: 4.7683 },
  { code: 'CPH', city: 'Copenhagen', name: 'Copenhagen Airport', country: 'Denmark', latitude: 55.618, longitude: 12.6508 },
  { code: 'ARN', city: 'Stockholm', name: 'Stockholm Arlanda', country: 'Sweden', latitude: 59.6519, longitude: 17.9186 },
  { code: 'HEL', city: 'Helsinki', name: 'Helsinki Airport', country: 'Finland', latitude: 60.3172, longitude: 24.9633 },
  { code: 'LIS', city: 'Lisbon', name: 'Humberto Delgado', country: 'Portugal', latitude: 38.7756, longitude: -9.1354 },
  { code: 'MAD', city: 'Madrid', name: 'Adolfo Suárez Madrid–Barajas', country: 'Spain', latitude: 40.4983, longitude: -3.5676 },
  { code: 'BCN', city: 'Barcelona', name: 'Barcelona–El Prat', country: 'Spain', latitude: 41.2974, longitude: 2.0833 },
  { code: 'FCO', city: 'Rome', name: 'Leonardo da Vinci–Fiumicino', country: 'Italy', latitude: 41.8003, longitude: 12.2389 },
  { code: 'MXP', city: 'Milan', name: 'Milan Malpensa', country: 'Italy', latitude: 45.63, longitude: 8.7231 },
  { code: 'ZRH', city: 'Zürich', name: 'Zürich Airport', country: 'Switzerland', latitude: 47.4581, longitude: 8.5555 },
  { code: 'VIE', city: 'Vienna', name: 'Vienna International', country: 'Austria', latitude: 48.1103, longitude: 16.5697 },
  { code: 'FRA', city: 'Frankfurt', name: 'Frankfurt Airport', country: 'Germany', latitude: 50.0379, longitude: 8.5622 },
  { code: 'BER', city: 'Berlin', name: 'Berlin Brandenburg', country: 'Germany', latitude: 52.3667, longitude: 13.5033 },
  { code: 'MUC', city: 'Munich', name: 'Munich Airport', country: 'Germany', latitude: 48.3538, longitude: 11.7861 },
  { code: 'PRG', city: 'Prague', name: 'Václav Havel Airport Prague', country: 'Czechia', latitude: 50.1008, longitude: 14.26 },
  { code: 'WAW', city: 'Warsaw', name: 'Warsaw Chopin Airport', country: 'Poland', latitude: 52.1657, longitude: 20.9671 },
  { code: 'BUD', city: 'Budapest', name: 'Budapest Ferenc Liszt International', country: 'Hungary', latitude: 47.4369, longitude: 19.2556 },
  { code: 'ATH', city: 'Athens', name: 'Athens International', country: 'Greece', latitude: 37.9364, longitude: 23.9445 },
  { code: 'IST', city: 'Istanbul', name: 'Istanbul Airport', country: 'Türkiye', latitude: 41.2753, longitude: 28.7519 },
  { code: 'OSL', city: 'Oslo', name: 'Oslo Gardermoen', country: 'Norway', latitude: 60.1939, longitude: 11.1004 },
  { code: 'KEF', city: 'Reykjavík', name: 'Keflavík International', country: 'Iceland', latitude: 63.985, longitude: -22.6056 },
  { code: 'KHN', city: 'Nanchang', name: 'Nanchang Changbei International', country: 'China', latitude: 28.8648, longitude: 115.9027 },
  { code: 'PEK', city: 'Beijing', name: 'Beijing Capital International', country: 'China', latitude: 40.0799, longitude: 116.6031 },
  { code: 'PKX', city: 'Beijing', name: 'Beijing Daxing International', country: 'China', latitude: 39.5098, longitude: 116.4105 },
  { code: 'PVG', city: 'Shanghai', name: 'Shanghai Pudong International', country: 'China', latitude: 31.1443, longitude: 121.8083 },
  { code: 'SHA', city: 'Shanghai', name: 'Shanghai Hongqiao International', country: 'China', latitude: 31.1979, longitude: 121.3363 },
  { code: 'CAN', city: 'Guangzhou', name: 'Guangzhou Baiyun International', country: 'China', latitude: 23.3924, longitude: 113.2988 },
  { code: 'SZX', city: 'Shenzhen', name: 'Shenzhen Bao’an International', country: 'China', latitude: 22.6393, longitude: 113.8107 },
  { code: 'CTU', city: 'Chengdu', name: 'Chengdu Shuangliu International', country: 'China', latitude: 30.5785, longitude: 103.9471 },
  { code: 'CKG', city: 'Chongqing', name: 'Chongqing Jiangbei International', country: 'China', latitude: 29.7192, longitude: 106.6417 },
  { code: 'XIY', city: "Xi'an", name: "Xi'an Xianyang International", country: 'China', latitude: 34.4471, longitude: 108.7516 },
  { code: 'HND', city: 'Tokyo', name: 'Tokyo Haneda', country: 'Japan', latitude: 35.5494, longitude: 139.7798 },
  { code: 'NRT', city: 'Tokyo', name: 'Narita International', country: 'Japan', latitude: 35.772, longitude: 140.3929 },
  { code: 'KIX', city: 'Osaka', name: 'Kansai International', country: 'Japan', latitude: 34.4347, longitude: 135.244 },
  { code: 'NGO', city: 'Nagoya', name: 'Chubu Centrair International', country: 'Japan', latitude: 34.8584, longitude: 136.8054 },
  { code: 'FUK', city: 'Fukuoka', name: 'Fukuoka Airport', country: 'Japan', latitude: 33.5859, longitude: 130.451 },
  { code: 'ICN', city: 'Seoul', name: 'Incheon International', country: 'South Korea', latitude: 37.4602, longitude: 126.4407 },
  { code: 'PUS', city: 'Busan', name: 'Gimhae International', country: 'South Korea', latitude: 35.1795, longitude: 128.9382 },
  { code: 'HKG', city: 'Hong Kong', name: 'Hong Kong International', country: 'Hong Kong', latitude: 22.308, longitude: 113.9185 },
  { code: 'TPE', city: 'Taipei', name: 'Taiwan Taoyuan International', country: 'Taiwan', latitude: 25.0797, longitude: 121.2342 },
  { code: 'SIN', city: 'Singapore', name: 'Singapore Changi', country: 'Singapore', latitude: 1.3644, longitude: 103.9915 },
  { code: 'BKK', city: 'Bangkok', name: 'Suvarnabhumi', country: 'Thailand', latitude: 13.69, longitude: 100.7501 },
  { code: 'HAN', city: 'Hanoi', name: 'Noi Bai International', country: 'Vietnam', latitude: 21.2212, longitude: 105.8072 },
  { code: 'SGN', city: 'Ho Chi Minh City', name: 'Tan Son Nhat International', country: 'Vietnam', latitude: 10.8188, longitude: 106.652 },
  { code: 'MYY', city: 'Miri', name: 'Miri Airport', country: 'Malaysia', latitude: 4.3253, longitude: 113.9883 },
  { code: 'KUL', city: 'Kuala Lumpur', name: 'Kuala Lumpur International', country: 'Malaysia', latitude: 2.7456, longitude: 101.7099 },
  { code: 'CGK', city: 'Jakarta', name: 'Soekarno–Hatta International', country: 'Indonesia', latitude: -6.1256, longitude: 106.6559 },
  { code: 'DPS', city: 'Bali', name: 'I Gusti Ngurah Rai International', country: 'Indonesia', latitude: -8.7482, longitude: 115.167 },
  { code: 'MNL', city: 'Manila', name: 'Ninoy Aquino International', country: 'Philippines', latitude: 14.5086, longitude: 121.0197 },
  { code: 'DEL', city: 'Delhi', name: 'Indira Gandhi International', country: 'India', latitude: 28.5562, longitude: 77.1 },
  { code: 'BOM', city: 'Mumbai', name: 'Chhatrapati Shivaji Maharaj International', country: 'India', latitude: 19.0896, longitude: 72.8656 },
  { code: 'BLR', city: 'Bengaluru', name: 'Kempegowda International', country: 'India', latitude: 13.1986, longitude: 77.7066 },
  { code: 'DOH', city: 'Doha', name: 'Hamad International', country: 'Qatar', latitude: 25.2731, longitude: 51.6081 },
  { code: 'SYD', city: 'Sydney', name: 'Sydney Kingsford Smith', country: 'Australia', latitude: -33.9399, longitude: 151.1753 },
  { code: 'MEL', city: 'Melbourne', name: 'Melbourne Airport', country: 'Australia', latitude: -37.669, longitude: 144.841 },
  { code: 'BNE', city: 'Brisbane', name: 'Brisbane Airport', country: 'Australia', latitude: -27.3842, longitude: 153.1175 },
  { code: 'PER', city: 'Perth', name: 'Perth Airport', country: 'Australia', latitude: -31.9403, longitude: 115.967 },
  { code: 'ADL', city: 'Adelaide', name: 'Adelaide Airport', country: 'Australia', latitude: -34.945, longitude: 138.5306 },
  { code: 'AKL', city: 'Auckland', name: 'Auckland Airport', country: 'New Zealand', latitude: -37.0082, longitude: 174.785 },
  { code: 'DXB', city: 'Dubai', name: 'Dubai International', country: 'United Arab Emirates', latitude: 25.2532, longitude: 55.3657 },
  { code: 'AUH', city: 'Abu Dhabi', name: 'Zayed International', country: 'United Arab Emirates', latitude: 24.433, longitude: 54.6511 },
  { code: 'TLV', city: 'Tel Aviv', name: 'Ben Gurion Airport', country: 'Israel', latitude: 32.0005, longitude: 34.8708 },
  { code: 'CAI', city: 'Cairo', name: 'Cairo International', country: 'Egypt', latitude: 30.1219, longitude: 31.4056 },
  { code: 'CMN', city: 'Casablanca', name: 'Mohammed V International', country: 'Morocco', latitude: 33.3675, longitude: -7.59 },
  { code: 'ADD', city: 'Addis Ababa', name: 'Bole International', country: 'Ethiopia', latitude: 8.9779, longitude: 38.7993 },
  { code: 'NBO', city: 'Nairobi', name: 'Jomo Kenyatta International', country: 'Kenya', latitude: -1.3192, longitude: 36.9278 },
  { code: 'JNB', city: 'Johannesburg', name: 'O. R. Tambo International', country: 'South Africa', latitude: -26.1337, longitude: 28.242 },
  { code: 'CPT', city: 'Cape Town', name: 'Cape Town International', country: 'South Africa', latitude: -33.97, longitude: 18.6021 },
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
