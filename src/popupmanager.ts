import { LngLatLike, Map, MapGeoJSONFeature } from "@maptiler/sdk";

/**
 * How the popups are anchored to a given point
 */
export type PopupAnchor = "center" | "top" | "bottom" | "left" | "right";

/**
 * Minimalist set of properties that represent a popup
 */
export type PopupBase = {
  /**
   * Unique ID of a popup, most likely the ID of a geojson feature (from a vector tile)
   */
  id: number,

  /**
   * Position in screenspace of the top-left corner [x, y]
   */
  position: [number, number],

  /**
   * Size in screen space [width, height]
   */
  size: [number, number],

  /**
   * The feature represented by the popup
   */
  feature: MapGeoJSONFeature,
}


/**
 * List of popup IDs (IDs are unique and likely to come from vector tiles)
 */
export type PopupList = {
  [id: number]: PopupBase
};


/**
 * Status of the popup compared to the previous status
 */
export type PopupStatus = {
  /**
   * The popups that were added since the last update
   */
  new: PopupList,

  /**
   * The popups that were already present in the last update but had their position changed
   */
  updated: PopupList,

  /**
   * The popups that are no longer present since the last update
   */
  removed: PopupList,
};


export type PopupManagerOptions = {
  /**
   * IDs of layers to keep
   */
  layers?: Array<string>,

  /**
   * GeoJSON feature class to keep
   */
  classes?: Array<string>,

  /**
   * Size of the popups (screen space)
   */
  popupSize?: [number, number],

  /**
   * Maximum number of popups to keep
   */
  max?: number,

  /**
   * Position of the popup compared to its anchor point
   */
  popupAnchor?: PopupAnchor,
}


function doesCollide(a: PopupBase, b: PopupBase): boolean {
  return !(
    b.position[0] > (a.position[0] + a.size[0]) ||
    (b.position[0] + b.size[0]) < a.position[0] || 
    b.position[1] > (a.position[1] + a.size[1]) || 
    (b.position[1] + b.size[1]) < a.position[1]
  );
}

function doesCollideWithAny(popup: PopupBase, manyPopup: PopupList): boolean {
  const popupList = Object.values(manyPopup);

  for (let i = 0; i < popupList.length; i += 1) {
    if (doesCollide(popup, popupList[i])) {
      return true;
    }
  }

  return false;
}



export class PopupManager {
  /**
   * Style layer IDs to keep
   */
  private layers: Array<string> | undefined;

  /**
   * GeoJSON feature classes to keep
   */
  private classes: Array<string> | null;

  private popupSize: [number, number];
  private popupAnchor: PopupAnchor;
  private map: Map;
  private lastStatus: PopupStatus;
  private max: number | null;

  /**
   * Screenspace offset in pixel due to the anchor position
   */
  private anchorOffset: [number, number] = [0, 0];

  /**
   * This is a concat of lastStatus.new and lastStatus.updated
   * only for optimisation purposes
   */
  private lastPresent: PopupList;

  constructor(map: Map, options: PopupManagerOptions = {}) {
    this.map = map;
    this.layers = options.layers ?? undefined;
    this.classes = options.classes ?? null;
    this.popupAnchor = options.popupAnchor ?? "center";
    this.popupSize = options.popupSize ?? [150, 50];
    this.max = options.max ?? null;
    this.lastStatus = {
      new: {},
      updated: {},
      removed: {},
    };
    this.lastPresent = {};

    if (this.popupAnchor === "center") {
      this.anchorOffset = [-this.popupSize[0]/2, -this.popupSize[1]/2];
    } else if (this.popupAnchor === "top") {
      this.anchorOffset = [-this.popupSize[0]/2, -this.popupSize[1]];
    } else if (this.popupAnchor === "bottom") {
      this.anchorOffset = [-this.popupSize[0]/2, 0];
    } else if (this.popupAnchor === "left") {
      this.anchorOffset = [-this.popupSize[0], -this.popupSize[1]/2];
    } else if (this.popupAnchor === "right") {
      this.anchorOffset = [0, -this.popupSize[1]];
    } 
  }


  update(): PopupStatus | null {
    if (!this.map) return null;

    // Collecting the features displayed in the viewport
    let features = this.map.queryRenderedFeatures(undefined, {layers: this.layers});

    // sorting the features by rank
    features = features
      .filter((feature) => feature.properties.rank) // the features must have a rank
      .sort((a, b) => a.properties.rank > b.properties.rank ? 1 : -1); // sorting them by rank

    // Keeping only features from certain (optionnaly) provided classes
    if (this.classes) {
      features = features.filter((feature) => (this.classes as Array<string>).includes(feature.properties.class));
    }

    // Keeping only a max amount of features
    if (this.max) {
      features = features.slice(0, this.max);
    }

    const newPopups: PopupList = {};
    const updatedPopups: PopupList = {};

    const newPresent: PopupList = {};

    for (let i = 0; i < features.length; i += 1) {
      const feature = features[i];
      const id: number = feature.id as number;
      const lonLat = (feature.geometry as GeoJSON.Point).coordinates as LngLatLike;
      const screenspacePosition = this.map.project(lonLat);
      const popup: PopupBase = {
        id,
        position: [screenspacePosition.x + this.anchorOffset[0], screenspacePosition.y + this.anchorOffset[1]],
        size: this.popupSize,
        feature,
      };

      if (doesCollideWithAny(popup, newPresent)) {
        continue;
      }

      newPresent[id] = popup;

      // if current feature was previously in 'new', then it's updated
      if (id in this.lastStatus.new) {
        updatedPopups[id] = popup;
        delete this.lastPresent[id];
      } else 

      // If current feature was previously in 'updated' , then it still is
      if (id in this.lastStatus.updated) {
        updatedPopups[id] = popup;
        delete this.lastPresent[id];
      } else

      // If current feature was in previous updated/new, then it is new now
      {
        newPopups[id] = popup;
      }
    }

    // All the features of this updates that have been part of the previous update have been deleted from this.lastPresent
    // This means that this.lastPresent is the new removedPopups
    this.lastStatus.removed = this.lastPresent;
    this.lastPresent = newPresent;
    this.lastStatus.new = newPopups;
    this.lastStatus.updated = updatedPopups;
    
    return this.lastStatus;
  }




}