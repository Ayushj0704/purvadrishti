import { useMemo } from 'react';
import Map, { Source, Layer, NavigationControl } from 'react-map-gl/maplibre';
import type * as GeoJSON from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
import { h3LayerStyle } from './h3Layer';
import { candidateAtmLayer } from './markers';

interface RiskMapProps {
  heatmapData?: GeoJSON.FeatureCollection;
  candidateAtms?: GeoJSON.FeatureCollection;
  viewState?: {
    longitude: number;
    latitude: number;
    zoom: number;
  };
  onMove?: (evt: any) => void;
}

const DEFAULT_VIEW_STATE = {
  longitude: 78.9629,
  latitude: 20.5937,
  zoom: 4
};

export function RiskMap({ heatmapData, candidateAtms, viewState, onMove }: RiskMapProps) {
  // Use public OSM compatible tile layer as required by the doc
  // We'll use a standard osm style but maybe in the future a dark styled one can be used
  const mapStyle = useMemo(() => ({
    version: 8 as const,
    sources: {
      'osm-tiles': {
        type: 'raster' as const,
        tiles: [
          'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
          'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
          'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
        ],
        tileSize: 256,
        attribution: '&copy; OpenStreetMap contributors'
      }
    },
    layers: [
      {
        id: 'osm-tiles-layer',
        type: 'raster' as const,
        source: 'osm-tiles',
        minzoom: 0,
        maxzoom: 19
      }
    ]
  }), []);

  return (
    <div className="w-full h-full bg-[#E6E9F4] dark:bg-[#0B0B12]">
      <Map
        {...(viewState || DEFAULT_VIEW_STATE)}
        onMove={onMove}
        mapStyle={mapStyle}
        style={{ width: '100%', height: '100%' }}
      >
        <NavigationControl position="top-right" />

        {heatmapData && (
          <Source id="h3-cells" type="geojson" data={heatmapData}>
            <Layer {...h3LayerStyle} />
          </Source>
        )}

        {candidateAtms && (
          <Source id="candidate-atms" type="geojson" data={candidateAtms}>
            <Layer {...candidateAtmLayer} />
          </Source>
        )}
      </Map>
    </div>
  );
}
