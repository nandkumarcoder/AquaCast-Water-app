# AquaCast 💧 - Water & Weather Forecast + Hydration Companion

AquaCast is a modern full-stack web application combining real-time precipitation and weather forecasting with a smart, weather-adaptive hydration tracker and rainwater harvesting calculator.

## 🚀 Live Demo
- **GitHub Pages**:  https://nandkumarcoder.github.io/AquaCast-Water-app/

---

## 🌟 Key Features

1. **🌦️ Precipitation & Rain Forecast**:
   - Real-time weather and precipitation data powered by Open-Meteo API.
   - Interactive 24-hour precipitation volume (mm) & rain probability (%) chart.
   - 7-day weather forecast with temperature range, conditions, and rainfall sums.
   - Global city search with instant auto-complete and GPS location lookup.

2. **💧 Smart Hydration Companion ("Water App")**:
   - Realistic animated water tank with wave physics filling up as you log drinks.
   - Weather-adaptive daily hydration targets (automatically recommends more water on hot/dry days).
   - Quick one-click logging (+150ml, +250ml, +500ml, +750ml, or custom amount).
   - Water drop sound effect (Web Audio API) and confetti celebration when daily goal is reached.
   - Daily timeline and 7-day intake history.

3. **🌧️ Rainwater Harvesting & Eco Hub**:
   - Roof catchment calculator: input roof area (m²) and rainfall (mm) to calculate harvestable liters and gallons.
   - Calculates impact equivalents: toilet flushes, shower minutes, and garden watering days.
   - Smart garden watering advisory based on upcoming forecast.

4. **📊 Analytics & Insights**:
   - 7-day hydration vs target graph.
   - Weekly total volume, daily average, and streak completion metrics.

---

## 🛠️ Technology Stack
- **Backend**: Node.js, Express.js, CORS
- **Frontend**: HTML5, Tailwind CSS, Chart.js, Canvas Confetti, FontAwesome
- **APIs**: Open-Meteo Weather API & Geocoding API
- **Deployment**: Node.js server or static hosting on GitHub Pages

---

## 💻 Local Setup & Running

```bash
# Clone the repository
git clone https://github.com/nandkumarcoder/aquacast-water-app.git
cd aquacast-water-app

# Install dependencies
npm install

# Start the Node.js server
npm start
```
Then open http://localhost:3000 in your browser.
