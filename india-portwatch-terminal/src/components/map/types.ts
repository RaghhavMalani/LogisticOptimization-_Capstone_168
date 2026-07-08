export interface MapLayerVisibility {
  ports: boolean;
  vessels: boolean;
  weather: boolean;
  routes: boolean;
  alerts: boolean;
  sar: boolean;
}

export const DEFAULT_MAP_LAYERS: MapLayerVisibility = {
  ports: true,
  vessels: true,
  weather: true,
  routes: true,
  alerts: true,
  sar: true,
};
