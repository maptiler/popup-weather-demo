import { PrecipitationLayer, RadarLayer, TemperatureLayer, WindLayer } from "@maptiler/weather";
import * as suncalc from "suncalc";
import { PopupBase } from "./popupmanager";
import "./popup-style.css";

export function makePopup(
  popupBase: PopupBase, 
  windLayer: WindLayer, 
  temperatureLayer: TemperatureLayer,
  radarLayer: RadarLayer,
  precipitationLayer: PrecipitationLayer,
  date: Date,
): HTMLDivElement {

  const popup = document.createElement("div");
  popup.classList.add("popup");
  popup.classList.add('fade-in-animation');
  popup.style.setProperty("width", `${popupBase.size[0]}px`);
  popup.style.setProperty("height", `${popupBase.size[1]}px`);
  popup.style.setProperty("transform", `translate(${popupBase.position[0]}px, ${popupBase.position[1]}px)`);
  
  const lonLat = (popupBase.feature.geometry as GeoJSON.Point).coordinates;    
  const temperatureData = temperatureLayer.pickAt(lonLat[0], lonLat[1]);
  const precipitationData = precipitationLayer.pickAt(lonLat[0], lonLat[1]);
  const windData = windLayer.pickAt(lonLat[0], lonLat[1]);
  const radarData = radarLayer.pickAt(lonLat[0], lonLat[1]);
  
  let mainWeatherIconURL = "weather-icons/";
  const radarDBz: number = radarData?.value || -20;
  const precipMmH = precipitationData?.value || 0;
  const temperatureDeg = temperatureData?.value || 0;
  const windSpeed = windData?.speedKilometersPerHour || 0;
  const compassDirection = windData?.compassDirection || 0;
  const temperature = temperatureData?.value.toFixed(1) as string;

  const sunPosition = suncalc.getPosition(date, lonLat[1], lonLat[0]);

  if (sunPosition.altitude < 0) {
    mainWeatherIconURL += "night-";
  } else {
    mainWeatherIconURL += "day-";
  }

  if (radarDBz < 0) {

    if (precipMmH > 0.2) {
      mainWeatherIconURL += "cloudy-";
    } else {
      mainWeatherIconURL += "clear-";
    }

    
  } else if (radarDBz < 10) {
    mainWeatherIconURL += "cloudy-";
  } else if (radarDBz < 20) {
    mainWeatherIconURL += "overcast-";
  } else {
    mainWeatherIconURL += "extreme-";
  }

  if (precipMmH > 5) {
    mainWeatherIconURL += (temperatureDeg < -1 ? "snow" : "rain");
  } else if (precipMmH > 0.2) {
    mainWeatherIconURL += (temperatureDeg < -1 ? "snow" : "drizzle");
  } else {
    mainWeatherIconURL += "none";
  }


  mainWeatherIconURL += ".svg";

  let windDiv = "";
  if (windSpeed > 5) {
    windDiv = `
    <div
      class="popupWind"
    >
      <img class="popupWindIcon" src="weather-icons/wind.svg"></img>${windSpeed.toFixed(0)} <span style="font-weight: 600; margin-left: 4px">${compassDirection}</span>
    </div>
    `
  }

  let precipDiv = "";
  if (precipMmH > 0.1) {
    precipDiv = `
    <div
      class="popupPrecipitation"
    >
      ${precipMmH.toFixed(1)} mm/h
    </div>
    `
  }

  popup.innerHTML = `
    <div class="popupPointy"></div>
    <div class="popupBody">
      
      <div class="popupTop">
        ${popupBase.feature.properties["name:en"] || popupBase.feature.properties["name"]}
      </div>
      
      <div class="popupBottom">

        <div class="popupBottomLeft">
          <div class="popupTemperature">${temperature}°</div>
          ${windDiv}
        </div>

        <div class="popupBottomRight">
          <img class="popupMainWeatherIcon" src=${mainWeatherIconURL}></img>
          ${precipDiv}
        </div>
        
      </div>
    </div>
  `

  return popup;
}


export function updatePopupDiv(popupBase: PopupBase, popup: HTMLDivElement) {
  popup.style.setProperty("width", `${popupBase.size[0]}px`);
  popup.style.setProperty("height", `${popupBase.size[1]}px`);
  popup.style.setProperty("transform", `translate(${popupBase.position[0]}px, ${popupBase.position[1]}px)`);
}