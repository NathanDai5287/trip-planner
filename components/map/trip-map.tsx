"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import {
  Map,
  Marker,
  Popup,
  Source,
  Layer,
  NavigationControl,
  type MapRef,
} from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { Dumbbell, BookOpen, Mountain } from "lucide-react";
import type { Destination, PointOfInterest } from "@/lib/types";
import type { RouteSegment } from "@/components/trip/trip-editor";
import { POIOverlayControls } from "./poi-overlay-controls";
import { POIPopup } from "./poi-popup";

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

const DAY_COLORS = [
  "#c0582f", // terracotta  (day 1)
  "#2d6a4f", // forest      (day 2)
  "#c49a1e", // gold        (day 3)
  "#2e5fa3", // slate blue  (day 4)
  "#7c4f7e", // plum        (day 5)
  "#2d7d7d", // teal        (day 6)
  "#8b5e3c", // warm brown  (day 7)
];

export function getDayColor(dayIndex: number): string {
  return DAY_COLORS[dayIndex % DAY_COLORS.length];
}

const POI_ICON_CONFIG = {
  gym:     { icon: Dumbbell,  color: "bg-blue-600",    borderColor: "border-blue-400" },
  library: { icon: BookOpen,  color: "bg-orange-600",  borderColor: "border-orange-400" },
  peak:    { icon: Mountain,  color: "bg-emerald-700", borderColor: "border-emerald-500" },
} as const;

interface TripMapProps {
  destinations: Destination[];
  routes: RouteSegment[];
  highlightedId: string | null;
  onMarkerClick: (destId: string) => void;
  pois: PointOfInterest[];
  onPoisChange: (pois: PointOfInterest[]) => void;
  onAddPOI: (poi: PointOfInterest) => void;
}

function TripMap({
  destinations,
  routes,
  highlightedId,
  onMarkerClick,
  pois,
  onPoisChange,
  onAddPOI,
}: TripMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [selectedPOI, setSelectedPOI] = useState<PointOfInterest | null>(null);
  const [showPublicLands, setShowPublicLands] = useState(false);
  const [publicLandsLoading, setPublicLandsLoading] = useState(false);

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

  useEffect(() => {
    if (!showPublicLands || !mapLoaded || !mapRef.current) return;
    const map = mapRef.current.getMap();
    const onSourceData = () => {
      if (map.isSourceLoaded("public-lands")) {
        setPublicLandsLoading(false);
      }
    };
    map.on("sourcedata", onSourceData);
    return () => { map.off("sourcedata", onSourceData); };
  }, [showPublicLands, mapLoaded]);

  const handleAddPOIFromPopup = useCallback(
    (poi: PointOfInterest) => {
      onAddPOI(poi);
      setSelectedPOI(null);
    },
    [onAddPOI],
  );

  const destById = Object.fromEntries(destinations.map((d) => [d.id, d]));

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

      {/* Route polylines — solid color per segment, colored by destination day */}
      {routes.map((route) => {
        const color = getDayColor(destById[route.toId]?.dayIndex ?? 0);
        const sourceId = `route-${route.fromId}-${route.toId}`;
        return (
          <Source
            key={sourceId}
            id={sourceId}
            type="geojson"
            data={{
              type: "FeatureCollection",
              features: [{
                type: "Feature",
                properties: {},
                geometry: { type: "LineString", coordinates: route.geometry },
              }],
            }}
          >
            <Layer
              id={`casing-${route.fromId}-${route.toId}`}
              type="line"
              paint={{
                "line-color": "#ffffff",
                "line-width": 8,
                "line-opacity": 0.7,
              }}
            />
            <Layer
              id={`line-${route.fromId}-${route.toId}`}
              type="line"
              paint={{
                "line-width": 5,
                "line-color": color,
              }}
            />
          </Source>
        );
      })}

      {/* Destination markers */}
      {destinations.map((dest, index) => {
        const dayColor = getDayColor(dest.dayIndex);
        return (
          <Marker
            key={dest.id}
            longitude={dest.lng}
            latitude={dest.lat}
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              onMarkerClick(dest.id);
            }}
          >
            <div
              className={`flex flex-col items-center cursor-pointer transition-all duration-200 ${
                highlightedId === dest.id ? "scale-125" : "hover:scale-110"
              }`}
            >
              <div
                className="flex items-center justify-center w-9 h-9 rounded-full text-white text-sm font-bold border-[3px] border-white"
                style={{
                  backgroundColor: dayColor,
                  boxShadow: highlightedId === dest.id
                    ? `0 4px 12px rgba(0,0,0,0.45), 0 0 0 3px ${dayColor}99`
                    : "0 4px 12px rgba(0,0,0,0.45)",
                }}
              >
                {index + 1}
              </div>
              {/* Pin tip */}
              <div
                className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[9px] border-l-transparent border-r-transparent -mt-px"
                style={{ borderTopColor: dayColor }}
              />
            </div>
          </Marker>
        );
      })}

      {/* POI markers */}
      {pois.map((poi) => {
        const config = POI_ICON_CONFIG[poi.type];
        const Icon = config.icon;
        return (
          <Marker
            key={`poi-${poi.id}`}
            longitude={poi.lng}
            latitude={poi.lat}
            anchor="center"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              setSelectedPOI(poi);
            }}
          >
            <div
              className={`
                flex items-center justify-center
                w-6 h-6 rounded-full
                ${config.color} text-white
                border ${config.borderColor}
                cursor-pointer shadow-sm
                hover:scale-110 transition-transform duration-150
              `}
            >
              <Icon size={12} />
            </div>
          </Marker>
        );
      })}

      {/* POI popup */}
      {selectedPOI && (
        <Popup
          longitude={selectedPOI.lng}
          latitude={selectedPOI.lat}
          anchor="bottom"
          onClose={() => setSelectedPOI(null)}
          closeOnClick={false}
          className="[&_.maplibregl-popup-content]:!p-3 [&_.maplibregl-popup-content]:!rounded-lg [&_.maplibregl-popup-content]:!shadow-lg"
        >
          <POIPopup poi={selectedPOI} onAddToTrip={handleAddPOIFromPopup} />
        </Popup>
      )}

      {/* Public lands (BLM/USFS) layer — loaded lazily on first toggle */}
      {showPublicLands && (
        <Source id="public-lands" type="geojson" data="/data/public_lands.geojson">
          <Layer
            id="public-lands-fill"
            type="fill"
            paint={{
              "fill-color": [
                "match", ["get", "manager"],
                "BLM", "#d97706",
                "USFS", "#16a34a",
                "#94a3b8",
              ],
              "fill-opacity": 0.45,
            }}
          />
          <Layer
            id="public-lands-outline"
            type="line"
            paint={{
              "line-color": [
                "match", ["get", "manager"],
                "BLM", "#d97706",
                "USFS", "#16a34a",
                "#94a3b8",
              ],
              "line-width": 1,
              "line-opacity": 0.6,
            }}
          />
        </Source>
      )}

      {/* POI overlay controls */}
      <POIOverlayControls
        destinations={destinations}
        routes={routes}
        onPoisChange={onPoisChange}
        showPublicLands={showPublicLands}
        onPublicLandsChange={(show) => {
          if (show) setPublicLandsLoading(true);
          setShowPublicLands(show);
        }}
        publicLandsLoading={publicLandsLoading}
      />
    </Map>
  );
}

export { TripMap };
