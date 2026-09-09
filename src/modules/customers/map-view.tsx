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
          : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        { attribution: key ? "Powered by Geoapify | © OpenStreetMap contributors" : "© OpenStreetMap contributors © CARTO", maxZoom: 20 },
      ).addTo(map);
      L.control.scale({ imperial: false, position: "bottomleft" }).addTo(map);
      const cluster = L.markerClusterGroup({
        maxClusterRadius: 58,
        disableClusteringAtZoom: 17,
        showCoverageOnHover: false,
        iconCreateFunction: (group) => {
          const count = group.getChildCount();
          const size = count > 100 ? "large" : count > 20 ? "medium" : "small";
          return L.divIcon({
            className: `map-cluster map-cluster-${size}`,
            html: `<span>${count}</span>`,
            iconSize: [44, 44],
          });
        },
      });
      locations
        .filter((l) => l.latitude != null && l.longitude != null)
        .forEach((l) => {
          const popup = document.createElement("div");
          popup.className = "map-popup";
          const name = document.createElement("strong");
          name.textContent = customers.find((c) => c.id === l.customer_id)?.name ?? "Müəssisə";
          const address = document.createElement("span");
          address.textContent = l.address ?? "Ünvan daxil edilməyib";
          popup.append(name, address);
          cluster.addLayer(
            L.marker([l.latitude!, l.longitude!], {
              icon: L.divIcon({
                className: "map-pin",
                html: "<span></span>",
                iconSize: [30, 30],
                iconAnchor: [15, 15],
              }),
            }).bindPopup(popup, { closeButton: false, offset: [0, -12] }),
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
