import { useEffect, useMemo, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Airport } from '../data/airports'

type Coordinate = [number, number]

function toVector(latitude: number, longitude: number) {
  const lat = latitude * Math.PI / 180
  const lng = longitude * Math.PI / 180
  return [Math.cos(lat) * Math.cos(lng), Math.cos(lat) * Math.sin(lng), Math.sin(lat)]
}

function greatCircle(origin: Airport, destination: Airport, steps = 96): Coordinate[] {
  const start = toVector(origin.latitude, origin.longitude)
  const end = toVector(destination.latitude, destination.longitude)
  const dot = Math.min(1, Math.max(-1, start[0] * end[0] + start[1] * end[1] + start[2] * end[2]))
  const omega = Math.acos(dot)
  const sine = Math.sin(omega)
  const points: Coordinate[] = []

  for (let index = 0; index <= steps; index += 1) {
    const progress = index / steps
    const a = sine === 0 ? 1 - progress : Math.sin((1 - progress) * omega) / sine
    const b = sine === 0 ? progress : Math.sin(progress * omega) / sine
    const x = a * start[0] + b * end[0]
    const y = a * start[1] + b * end[1]
    const z = a * start[2] + b * end[2]
    const latitude = Math.atan2(z, Math.sqrt(x * x + y * y)) * 180 / Math.PI
    let longitude = Math.atan2(y, x) * 180 / Math.PI
    const previous = points.at(-1)
    if (previous) {
      while (longitude - previous[1] > 180) longitude -= 360
      while (longitude - previous[1] < -180) longitude += 360
    }
    points.push([latitude, longitude])
  }

  return points
}

function bearing(from: Coordinate, to: Coordinate) {
  const lat1 = from[0] * Math.PI / 180
  const lat2 = to[0] * Math.PI / 180
  const deltaLongitude = (to[1] - from[1]) * Math.PI / 180
  const y = Math.sin(deltaLongitude) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLongitude)
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
}

export function FlightMap({ origin, destination, progress }: { origin: Airport; destination: Airport; progress: number }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const planeRef = useRef<L.Marker | null>(null)
  const flownRouteRef = useRef<L.Polyline | null>(null)
  const points = useMemo(() => greatCircle(origin, destination), [origin, destination])

  useEffect(() => {
    if (!containerRef.current || origin.code === destination.code) return

    const map = L.map(containerRef.current, {
      zoomControl: false,
      scrollWheelZoom: false,
      worldCopyJump: true,
      attributionControl: true,
    })
    mapRef.current = map

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      updateWhenIdle: true,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map)

    L.polyline(points, { color: '#efe8d3', weight: 1.5, opacity: .42, dashArray: '4 8' }).addTo(map)
    flownRouteRef.current = L.polyline([], { color: '#8fb8e7', weight: 3, opacity: .92 }).addTo(map)

    const markerStyle = { radius: 5, weight: 2, color: '#efe8d3', fillColor: '#53675b', fillOpacity: 1 }
    L.circleMarker(points[0], markerStyle).bindTooltip(`${origin.code} · ${origin.city}`, { direction: 'top' }).addTo(map)
    L.circleMarker(points.at(-1) ?? points[0], markerStyle).bindTooltip(`${destination.code} · ${destination.city}`, { direction: 'top' }).addTo(map)

    const planeIcon = L.divIcon({ className: 'route-plane-icon', html: '<span aria-hidden="true">➤</span>', iconSize: [34, 34], iconAnchor: [17, 17] })
    planeRef.current = L.marker(points[0], { icon: planeIcon, interactive: false }).addTo(map)
    map.fitBounds(L.latLngBounds(points), { padding: [38, 38], maxZoom: 5 })

    return () => {
      map.remove()
      mapRef.current = null
      planeRef.current = null
      flownRouteRef.current = null
    }
  }, [destination, origin, points])

  useEffect(() => {
    const safeProgress = Math.min(1, Math.max(0, progress))
    const pointIndex = Math.min(points.length - 1, Math.round(safeProgress * (points.length - 1)))
    const point = points[pointIndex]
    const previous = points[Math.max(0, pointIndex - 1)]
    const next = points[Math.min(points.length - 1, pointIndex + 1)]
    planeRef.current?.setLatLng(point)
    flownRouteRef.current?.setLatLngs(points.slice(0, pointIndex + 1))
    const element = planeRef.current?.getElement()?.querySelector('span') as HTMLElement | null
    if (element) element.style.transform = `rotate(${bearing(previous, next) - 45}deg)`
  }, [points, progress])

  if (origin.code === destination.code) {
    return <div className="flight-map flight-map--empty"><span>Choose two different airports.</span></div>
  }

  return <div ref={containerRef} className="flight-map" aria-label={`Map from ${origin.city} to ${destination.city}`} />
}
