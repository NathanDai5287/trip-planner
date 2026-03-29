"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import {
  Map,
  Marker,
  Source,
  Layer,
  NavigationControl,
  type MapRef,
} from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Destination } from "@/lib/types";
import type { RouteSegment } from "@/components/trip/trip-editor";

const MAP_STYLE = {
  version: 8 as const,
  sources: {
    osm: {
      type: "raster" as const,
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  layers: [
    {
      id: "osm",
      type: "raster" as const,
      source: "osm",
    },
  ],
};

interface TripMapProps {
  destinations: Destination[];
  routes: RouteSegment[];
  highlightedId: string | null;
  onMarkerClick: (destId: string) => void;
}

function TripMap({
  destinations,
  routes,
  highlightedId,
  onMarkerClick,
}: TripMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Fit bounds when destinations change
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || destinations.length === 0) return;

    const map = mapRef.current;

    if (destinations.length === 1) {
      map.flyTo({
        center: [destinations[0].lng, destinations[0].lat],
        zoom: 12,
        duration: 1000,
      });
      return;
    }

    const lngs = destinations.map((d) => d.lng);
    const lats = destinations.map((d) => d.lat);

    const bounds: [[number, number], [number, number]] = [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ];

    map.fitBounds(bounds, {
      padding: { top: 60, bottom: 60, left: 60, right: 60 },
      maxZoom: 14,
      duration: 1000,
    });
  }, [destinations, mapLoaded]);

  // Fly to highlighted destination
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !highlightedId) return;

    const dest = destinations.find((d) => d.id === highlightedId);
    if (!dest) return;

    const map = mapRef.current;
    const currentZoom = map.getZoom();
    map.flyTo({
      center: [dest.lng, dest.lat],
      zoom: Math.max(currentZoom, 10),
      duration: 800,
    });
  }, [highlightedId, destinations, mapLoaded]);

  const handleLoad = useCallback(() => {
    setMapLoaded(true);
  }, []);

  const routeGeoJSON = {
    type: "FeatureCollection" as const,
    features: routes.map((route) => ({
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates: route.geometry,
      },
    })),
  };

  return (
    <Map
      ref={mapRef}
      initialViewState={{
        longitude: 0,
        latitude: 20,
        zoom: 2,
      }}
      style={{ width: "100%", height: "100%" }}
      mapStyle={MAP_STYLE}
      onLoad={handleLoad}
    >
      <NavigationControl position="top-right" />

      {/* Route polylines */}
      {routes.length > 0 && (
        <Source id="route" type="geojson" data={routeGeoJSON}>
          <Layer
            id="route-line"
            type="line"
            paint={{
              "line-color": "#c0582f",
              "line-width": 3,
              "line-dasharray": [2, 2],
            }}
          />
        </Source>
      )}

      {/* Destination markers */}
      {destinations.map((dest, index) => (
        <Marker
          key={dest.id}
          longitude={dest.lng}
          latitude={dest.lat}
          anchor="center"
          onClick={(e) => {
            e.originalEvent.stopPropagation();
            onMarkerClick(dest.id);
          }}
        >
          <div
            className={`
              flex items-center justify-center
              w-8 h-8 rounded-full
              bg-terracotta text-white text-xs font-bold
              border-2 cursor-pointer
              transition-all duration-200
              ${
                highlightedId === dest.id
                  ? "border-gold scale-125 shadow-lg ring-2 ring-gold/40"
                  : "border-gold shadow-md hover:scale-110"
              }
            `}
          >
            {index + 1}
          </div>
        </Marker>
      ))}
    </Map>
  );
}

export { TripMap };
