/**
 * Natural Disasters & Climate Change Impacts Map
 * Author:  Green Light Geospatial  |  GitHub: "@greenlightgeo"
 * Created: 2025-07-01
 * Description:  Main JavaScript logic for the interactive map application.
 * License: MIT — See LICENSE file in project root
 */


import Map from "https://js.arcgis.com/4.30/@arcgis/core/Map.js";
import MapView from "https://js.arcgis.com/4.30/@arcgis/core/views/MapView.js";
import GeoJSONLayer from "https://js.arcgis.com/4.30/@arcgis/core/layers/GeoJSONLayer.js";
import GraphicsLayer from "https://js.arcgis.com/4.30/@arcgis/core/layers/GraphicsLayer.js";
import Graphic from "https://js.arcgis.com/4.30/@arcgis/core/Graphic.js";
import SimpleFillSymbol from "https://js.arcgis.com/4.30/@arcgis/core/symbols/SimpleFillSymbol.js";



// --- Global state ---
window._highlightHandle = null;     // for managing selection highlight
window._selectedStates = [];        // current selection set
let tourIndex = 0;
let extentHistory = [];
let extentIndex = -1;


// Create the map
const map = new Map({
  basemap: 'osm' // OpenStreetMap (free and no API key required)
});

// Create the view
const view = new MapView({
  container: 'viewDiv',
  map: map,
  center: [-98, 39], // Continental US
  zoom: 4
});

// Add the initial states test layer
const statesLayer = new GeoJSONLayer({
  url: './data/states.geojson',
  title: 'US States'
});
map.add(statesLayer);

// Add graphics layer
const highlightLayer = new GraphicsLayer();
map.add(highlightLayer);

// Move +/- zoom control to bottom right
view.ui.move("zoom", "bottom-right");

// Help button
document.getElementById('helpButton').addEventListener('click', () => {
  console.log('Help button clicked.');
  const modal = document.getElementById('myModal');
  modal.style.display = modal.style.display === 'none' ? 'block' : 'none';

  gtag('event', 'click', {
    event_category: 'Toolbar',
    event_label: 'Help Button',
    value: 1
  });

});

// States layer on/off toggle
let statesVisible = true;
document.getElementById('toggleStatesBtn').addEventListener('click', () => {
  statesVisible = !statesVisible;
  statesLayer.visible = statesVisible;

  gtag('event', 'click', {
    event_category: 'Toolbar',
    event_label: 'Toggle States Layer',
    value: statesVisible ? 1 : 0
  });
});

// For search input box
const searchBox = document.getElementById('stateSearchBox');
const searchButton = document.getElementById('searchButton');


// Function to flash the found state
function flashFeature(feature, view) {
  const flashGraphic = new Graphic({
    geometry: feature.geometry,
    symbol: new SimpleFillSymbol({
      color: [255, 255, 0, 0.4], // yellow with transparency
      outline: {
        color: [255, 255, 0],
        width: 2
      }
    })
  });

  highlightLayer.add(flashGraphic);

  let count = 0;
  const maxFlashes = 3;
  const interval = setInterval(() => {
    flashGraphic.visible = !flashGraphic.visible;
    count++;
    if (count >= maxFlashes * 2) {
      clearInterval(interval);
      highlightLayer.remove(flashGraphic); // cleanup
    }
  }, 300);
}

// Search button
searchButton.addEventListener('click', () => {
  const userInput = searchBox.value.trim().toLowerCase();
  if (!userInput) return;

  statesLayer.queryFeatures({
    where: `LOWER(STATE_NAME) LIKE '${userInput}%'`, // e.g. "o%" will get OH, OK, OR
    returnGeometry: true,
    outFields: ['*']
  }).then((results) => {
    if (results.features.length === 0) {
      alert('No states found.');
      updateSelectionUI(0);
      return;
    }
  
    // Save selection set globally
    // window._selectedStates = results.features;
    window._selectedStates = results.features.map(f => f.clone());

    // Highlights
    view.whenLayerView(statesLayer).then((layerView) => {
      if (window._highlightHandle) window._highlightHandle.remove();
      window._highlightHandle = layerView.highlight(results.features);
    });
  
    // Flash each result (sequentially optional, here we flash all at once)
    results.features.forEach(feature => flashFeature(feature, view));
  
    // Zoom to union of all extents
    const unionExtent = results.features
      .map(f => f.geometry.extent)
      .reduce((acc, ext) => acc.union(ext));
    view.goTo(unionExtent.expand(1.0)); // was 1.2
  
    // Update count button UI
    updateSelectionUI(results.features.length);
  
    gtag('event', 'search', {
      event_category: 'Toolbar',
      event_label: `State Search: ${userInput}`,
      value: results.features.length
    });
  });
});

// Listen for Enter key in the search box
searchBox.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    searchButton.click();
  }
  tourIndex = 0;
});

// Update selections
function updateSelectionUI(count) {
  const countBtn = document.getElementById('selectionCountBtn');
  countBtn.textContent = count;

  if (count > 0) {
    countBtn.classList.add('active');
    countBtn.disabled = false;
  } else {
    countBtn.classList.remove('active');
    countBtn.disabled = true;
  }
}

// Tour button 
document.getElementById('tourButton').addEventListener('click', () => {

  console.log('You clicked the Tour button');
  const selected = window._selectedStates || [];
  if (!selected.length) {
    alert('No selected states to tour.');
    return;
  }

  // Wrap the index before using it
  if (tourIndex >= selected.length) {
    tourIndex = 0;
  }

  console.log('Tour index = ' + tourIndex);

  const feature = selected[tourIndex];
  if (!feature || !feature.geometry || !feature.geometry.extent) {
    console.error('Invalid feature in tour:', tourIndex, feature);
    return;
  }

  // Zoom to this state's extent (consistently)
  console.log(`Touring ${feature.attributes.STATE_NAME}`);
  console.log("about to view.goTo target: feature.geometry.extent, padding: 50...");
  view.goTo({
    target: feature.geometry.extent,
    padding: 50
  });

  // Update count button UI
  const countBtn = document.getElementById('selectionCountBtn');
  countBtn.textContent = (tourIndex + 1) + " of " + selected.length;

  flashFeature(feature, view);

  console.log(`Touring state ${tourIndex + 1} of ${selected.length}: ${feature.attributes.STATE_NAME}`);

  // Increment after using the feature
  tourIndex++;

  gtag('event', 'click', {
    event_category: 'Toolbar',
    event_label: `Tour: ${feature.attributes.STATE_NAME}`,
    value: tourIndex
  });
});

// Backwards Tour button
document.getElementById('tourBackButton').addEventListener('click', () => {
  const selected = window._selectedStates || [];
  if (!selected.length) {
    alert('No selected states to tour.');
    return;
  }

  if (tourIndex <= 0) {
    tourIndex = selected.length - 1; // loop back
  } else {
    tourIndex--;
  }

  const feature = selected[tourIndex];
  if (!feature || !feature.geometry || !feature.geometry.extent) {
    console.error('Invalid feature in reverse tour:', tourIndex, feature);
    return;
  }

  view.goTo({
    target: feature.geometry.extent,
    padding: 50
  });

  flashFeature(feature, view);

  console.log(`Touring state ${tourIndex + 1} of ${selected.length}: ${feature.attributes.STATE_NAME}`);

  document.getElementById('selectionCountBtn').textContent =
    (tourIndex + 1) + " of " + selected.length;

  gtag('event', 'click', {
    event_category: 'Toolbar',
    event_label: `Back Tour: ${feature.attributes.STATE_NAME}`,
    value: tourIndex
  });
});

document.getElementById('extentBackButton').addEventListener('click', () => {
  if (extentIndex > 0) {
    extentIndex--;
    // console.log("Going back to:", extentIndex, extentHistory[extentIndex]);
    view.goTo(extentHistory[extentIndex]);
  }
});

document.getElementById('extentForwardButton').addEventListener('click', () => {
  if (extentIndex < extentHistory.length - 1) {
    extentIndex++;
    // console.log("Going forward to:", extentIndex, extentHistory[extentIndex]);
    view.goTo(extentHistory[extentIndex]);
  }
});


