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
import { Tent, Dumbbell, BookOpen } from "lucide-react";
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

const POI_ICON_CONFIG = {
  campsite: { icon: Tent, color: "bg-green-600", borderColor: "border-green-400" },
  gym: { icon: Dumbbell, color: "bg-blue-600", borderColor: "border-blue-400" },
  library: { icon: BookOpen, color: "bg-orange-600", borderColor: "border-orange-400" },
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

      {/* Public lands toggle */}
      <div className="absolute top-3 left-3 z-10">
        <button
          onClick={() => {
            if (!showPublicLands) setPublicLandsLoading(true);
            setShowPublicLands((v) => !v);
          }}
          className={`
            flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold shadow
            border transition-colors
            ${showPublicLands
              ? "bg-green-700 text-white border-green-500"
              : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            }
          `}
        >
          {publicLandsLoading && showPublicLands ? (
            <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          ) : (
            <Tent size={12} />
          )}
          Public Lands
        </button>
      </div>

      {/* POI overlay controls */}
      <POIOverlayControls
        destinations={destinations}
        routes={routes}
        onPoisChange={onPoisChange}
      />
    </Map>
  );
}

export { TripMap };
