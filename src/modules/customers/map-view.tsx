"use client";
import { useEffect, useRef } from "react";
import type { Item } from "@/lib/db/types";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
export function MapView({
  locations,
  customers,
}: {
  locations: Item[];
  customers: Item[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    let stop = false;
    let map: import("leaflet").Map | undefined;
    (async () => {
      const L = await import("leaflet");
      await import("leaflet.markercluster");
      if (stop || !ref.current) return;
      map = L.map(ref.current).setView([40.4093, 49.8671], 12);
      const key = process.env.NEXT_PUBLIC_GEOAPIFY_KEY;
      L.tileLayer(
        key
          ? `https://maps.geoapify.com/v1/tile/osm-carto/{z}/{x}/{y}.png?apiKey=${key}`
          : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        { attribution: key ? "Powered by Geoapify | © OpenStreetMap contributors" : "© OpenStreetMap contributors", maxZoom: 20 },
      ).addTo(map);
      const cluster = L.markerClusterGroup();
      locations
        .filter((l) => l.latitude != null && l.longitude != null)
        .forEach((l) => {
          const text = document.createElement("span");
          text.textContent =
            (customers.find((c) => c.id === l.customer_id)?.name ??
              "Müəssisə") +
            " · " +
            (l.address ?? "");
          cluster.addLayer(
            L.marker([l.latitude!, l.longitude!], {
              icon: L.divIcon({
                className: "map-pin",
                html: "●",
                iconSize: [22, 22],
              }),
            }).bindPopup(text),
          );
        });
      map.addLayer(cluster);
    })();
    return () => {
      stop = true;
      map?.remove();
    };
  }, [locations, customers]);
  return <div className="map" ref={ref} />;
}
