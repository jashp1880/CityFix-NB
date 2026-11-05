import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMapEvents,
  useMap,
} from "react-leaflet";
import { useEffect } from "react";
const colors = {
  submitted: "#c58b30",
  reviewing: "#6678ac",
  in_progress: "#3d8b7e",
  resolved: "#368254",
  rejected: "#a16666",
};
function Picker({ onPick }) {
  useMapEvents({ click: (e) => onPick?.(e.latlng) });
  return null;
}
function Resize({ focus }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    if (focus) map.flyTo(focus, 16);
  }, [map, focus]);
  return null;
}
export default function CityMap({
  reports = [],
  onSelect,
  onPick,
  position,
  focus,
}) {
  return (
    <MapContainer
      center={[40.495, -74.447]}
      zoom={14}
      scrollWheelZoom={false}
      className="city-map"
      aria-label="Map of New Brunswick and Rutgers reports"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Resize focus={focus} />
      <Picker onPick={onPick} />
      {reports.map((r) => (
        <CircleMarker
          key={r.id}
          center={[r.latitude, r.longitude]}
          radius={8}
          pathOptions={{
            color: "#fff",
            weight: 2,
            fillColor: colors[r.status],
            fillOpacity: 1,
          }}
        >
          <Popup>
            <strong>{r.title}</strong>
            <br />
            {r.location}
            <br />
            <button onClick={() => onSelect?.(r)}>View report</button>
          </Popup>
        </CircleMarker>
      ))}
      {position && (
        <CircleMarker
          center={position}
          radius={9}
          pathOptions={{ color: "#143f36", fillColor: "#fff", fillOpacity: 1 }}
        />
      )}
    </MapContainer>
  );
}
