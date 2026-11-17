import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const tone = (z) => {
  if (z.availableSlots === 0) return { bg: '#e11d48', ring: '#fecdd3', text: '#fff' };
  if (z.availableSlots <= 2) return { bg: '#f59e0b', ring: '#fde68a', text: '#0f172a' };
  return { bg: '#10b981', ring: '#a7f3d0', text: '#022c22' };
};

function markerIcon(z, selected) {
  const t = tone(z);
  const letter = z.zone.replace('Zone ', '');
  return L.divIcon({
    className: 'pp-marker',
    iconSize: [0, 0],
    html: `<div style="transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 4px 6px rgba(15,23,42,.35))">
      <div style="display:flex;align-items:center;gap:6px;padding:5px 10px;border-radius:999px;background:${t.bg};color:${t.text};font:700 12px/1 ui-monospace,monospace;box-shadow:0 0 0 ${selected ? 4 : 2}px ${t.ring};${selected ? 'transform:scale(1.12);' : ''}">
        <span>${letter}</span><span style="background:rgba(255,255,255,.28);border-radius:999px;padding:2px 6px;font-size:11px">${z.availableSlots}</span>
      </div>
      <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid ${t.bg}"></div>
    </div>`
  });
}

function popupNode(z, onDirections) {
  const el = document.createElement('div');
  el.style.minWidth = '180px';
  const title = document.createElement('strong');
  title.textContent = z.name;
  title.style.cssText = 'display:block;font-size:13px;color:#0f172a;margin-bottom:2px';
  const sub = document.createElement('div');
  sub.textContent = `${z.zone} · ${z.level}`;
  sub.style.cssText = 'font-size:11px;color:#64748b;margin-bottom:6px';
  const avail = document.createElement('div');
  avail.textContent = `${z.availableSlots} of ${z.totalSlots} bays free`;
  avail.style.cssText = 'font-size:12px;font-weight:700;color:#047857;margin-bottom:8px';
  const link = document.createElement('a');
  link.textContent = 'Get directions →';
  link.href = onDirections(z);
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.style.cssText = 'font-size:12px;font-weight:700;color:#4f46e5';
  el.append(title, sub, avail, link);
  return el;
}

export const ZoneMap = ({ zones, selectedZone, onSelect, userLocation, directionsUrl }) => {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const userLayerRef = useRef(null);
  const fittedRef = useRef(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Create the map once.
  useEffect(() => {
    const map = L.map(containerRef.current, {
      zoomControl: true,
      scrollWheelZoom: false,
      dragging: !L.Browser.mobile,
      attributionControl: true
    }).setView([18.4603, 73.8836], 17);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    userLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // (Re)draw zone markers whenever live availability changes.
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    const pts = [];
    zones.forEach((z) => {
      if (z.lat == null || z.lng == null) return;
      pts.push([z.lat, z.lng]);
      const m = L.marker([z.lat, z.lng], { icon: markerIcon(z, selectedZone?.zone === z.zone), keyboard: true, title: `${z.name} — ${z.availableSlots} free` });
      m.on('click', () => onSelectRef.current?.(z));
      m.bindPopup(popupNode(z, directionsUrl), { closeButton: false, offset: [0, -34] });
      m.addTo(layer);
    });
    if (!fittedRef.current && pts.length) {
      map.fitBounds(L.latLngBounds(pts).pad(0.35), { maxZoom: 18 });
      fittedRef.current = true;
    }
  }, [zones, selectedZone, directionsUrl]);

  // Fly to the selected zone.
  useEffect(() => {
    const map = mapRef.current;
    if (map && selectedZone?.lat != null) map.flyTo([selectedZone.lat, selectedZone.lng], Math.max(map.getZoom(), 18), { duration: 0.6 });
  }, [selectedZone?.zone]); // eslint-disable-line react-hooks/exhaustive-deps

  // Show the driver's own position.
  useEffect(() => {
    const layer = userLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    if (userLocation?.lat != null) {
      L.circle([userLocation.lat, userLocation.lng], { radius: Math.min(userLocation.accuracy || 20, 200), color: '#3b82f6', weight: 1, fillOpacity: 0.12 }).addTo(layer);
      L.circleMarker([userLocation.lat, userLocation.lng], { radius: 7, color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }).bindTooltip('You are here').addTo(layer);
    }
  }, [userLocation]);

  return <div ref={containerRef} className="w-full h-[360px] sm:h-[440px] rounded-3xl overflow-hidden border border-slate-200 shadow-sm z-0" role="application" aria-label="Campus parking map" />;
};

export default ZoneMap;
