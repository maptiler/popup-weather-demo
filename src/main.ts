import { Crepuscule } from "crepuscule";
import { config, Map, StyleSpecification } from "@maptiler/sdk";
import "@maptiler/sdk/style.css";
import {
  PrecipitationLayer,
  TemperatureLayer,
  WindLayer,
  RadarLayer,
  ColorRamp,
} from "@maptiler/weather";
import './style.css'
import { PopupBase, PopupManager } from "./popupmanager";
import { makePopup, updatePopupDiv } from "./popupmaker";
import CustomTopoStyle from "./style-topo-early-labels.json";


(async () => {
  const appContainer = document.getElementById("app");
  if (!appContainer) return;

  // Configuring the SDK with MapTiler API key 
  config.apiKey = "dur4cHJc9CiBxzv0S6Kh";

  // Instanciating the map
  const map = new Map({
    container: appContainer,
    style: CustomTopoStyle as StyleSpecification,
    hash: true,
    maptilerLogo: true,
  });

  // Adding the sunlight layer from Crepuscule
  new Crepuscule(map, {opacity: 0.3});

  // Waiting that the map is "loaded"
  // (this is equivalent to putting the rest of the code the "load" event callback)
  await map.onLoadAsync();

  // The popup manager is in charge of computing the positions where popups
  // should be, sort them by POI rank and select non-overlaping places.
  // (it does not actually create DOM elements, it just uses logical points and bounding boxes)
  const popupManager = new PopupManager(map, {
    layers: ["City labels", "Place labels", "Town labels", "Village labels"],
    classes: ["city", "village", "town"],
    popupSize: [140, 70],
    popupAnchor: "top",
  });
  
  // Creating the weather layers...
  // Temperature will be used as the main overlay
  const temperatureLayer = new TemperatureLayer({opacity: 0.7});

  // Radar will be using the cloud color ramp and used as a cloud overlay
  const radarLayer = new RadarLayer({colorramp: ColorRamp.builtin.RADAR_CLOUD});

  // From the wind layer, we only display the particles (the background is using the NULL color ramp, which is transparent).
  // The slower particles are transparent, the fastest are opaque white
  const windLayer = new WindLayer({colorramp: ColorRamp.builtin.NULL, color: [255, 255, 255, 0], fastColor: [255, 255, 255, 100]});

  // The precispitation layer is created but actually not displayed.
  // It will only be used for picking precipitation metrics at the locations of the popups
  const precipitationLayer = new PrecipitationLayer({colorramp: ColorRamp.builtin.NULL});

  // Setting the water layer partially transparent to increase the visual separation between land and water
  map.setPaintProperty("Water", "fill-color", "rgba(0, 0, 0, 0.7)")
  map.addLayer(temperatureLayer, "Place labels");
  map.addLayer(windLayer)
  map.addLayer(radarLayer);
  map.addLayer(precipitationLayer);

  // Creating the div that will contain all the popups
  const popupContainer = document.createElement("div");
  appContainer.appendChild(popupContainer);

  // This object contains the popup DIV so that they can be updated rather than fully recreated every time
  const popupLogicContainer: {[key: number]: HTMLDivElement} = {};

  // This function will be used as the callback for some map events
  const updatePopups = () => {
    const popupStatus = popupManager.update();
    
    if (!popupStatus) return;

    // Remove the div that corresponds to removed popups
    Object.values(popupStatus.removed).forEach((pb: PopupBase) => {
      const popupDiv = popupLogicContainer[pb.id];
      delete popupLogicContainer[pb.id];
      popupContainer.removeChild(popupDiv);
    });

    // Update the div that corresponds to updated popups
    Object.values(popupStatus.updated).forEach((pb: PopupBase) => {
      const popupDiv = popupLogicContainer[pb.id];
      updatePopupDiv(pb, popupDiv);
    });

    // Create the div that corresponds to the new popups
    Object.values(popupStatus.new).forEach((pb: PopupBase) => {
      const popupDiv = makePopup(pb, windLayer, temperatureLayer, radarLayer,precipitationLayer, new Date());
      popupLogicContainer[pb.id] = popupDiv;
      popupContainer.appendChild(popupDiv);
    });
  }

  // The "idle" event is triggered every second because of the particle layer being refreshed,
  // even though their is no new data loaded, so this approach proved to be the best for this scenario
  map.on("move", updatePopups);

  map.on("moveend", () => {
    map.once("idle", updatePopups);
  })

  map.once("idle", () => {
    updatePopups();
  });
  
})()