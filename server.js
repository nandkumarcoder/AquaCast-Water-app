const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Simple file-based data store for hydration history
const DATA_FILE = path.join(__dirname, 'data', 'hydration.json');

function readHydrationData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error reading hydration data:', err.message);
  }
  return { logs: [], settings: { baseTarget: 2500, unit: 'ml', weight: 70 } };
}

function saveHydrationData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving hydration data:', err.message);
  }
}

// Map WMO weather codes to human-readable info & icons
function getWeatherMeta(code) {
  const map = {
    0: { label: 'Clear Sky', icon: 'sun', condition: 'sunny', rainRisk: 'None' },
    1: { label: 'Mainly Clear', icon: 'sun-dim', condition: 'mostly-clear', rainRisk: 'Low' },
    2: { label: 'Partly Cloudy', icon: 'cloud-sun', condition: 'partly-cloudy', rainRisk: 'Low' },
    3: { label: 'Overcast', icon: 'cloud', condition: 'cloudy', rainRisk: 'Medium' },
    45: { label: 'Foggy', icon: 'fog', condition: 'fog', rainRisk: 'Low' },
    48: { label: 'Depositing Rime Fog', icon: 'fog', condition: 'fog', rainRisk: 'Low' },
    51: { label: 'Light Drizzle', icon: 'cloud-drizzle', condition: 'drizzle', rainRisk: 'High' },
    53: { label: 'Moderate Drizzle', icon: 'cloud-drizzle', condition: 'drizzle', rainRisk: 'High' },
    55: { label: 'Dense Drizzle', icon: 'cloud-drizzle', condition: 'drizzle', rainRisk: 'High' },
    61: { label: 'Slight Rain', icon: 'cloud-rain', condition: 'rain', rainRisk: 'Very High' },
    63: { label: 'Moderate Rain', icon: 'cloud-rain', condition: 'rain', rainRisk: 'Very High' },
    65: { label: 'Heavy Rain', icon: 'cloud-heavy-rain', condition: 'heavy-rain', rainRisk: 'Extreme' },
    71: { label: 'Slight Snow', icon: 'snowflake', condition: 'snow', rainRisk: 'Snow' },
    73: { label: 'Moderate Snow', icon: 'snowflake', condition: 'snow', rainRisk: 'Snow' },
    75: { label: 'Heavy Snow', icon: 'snowflake', condition: 'snow', rainRisk: 'Snow' },
    80: { label: 'Rain Showers', icon: 'cloud-rain', condition: 'showers', rainRisk: 'Very High' },
    81: { label: 'Heavy Rain Showers', icon: 'cloud-heavy-rain', condition: 'showers', rainRisk: 'Extreme' },
    82: { label: 'Violent Rain Showers', icon: 'cloud-lightning-rain', condition: 'storm', rainRisk: 'Extreme' },
    95: { label: 'Thunderstorm', icon: 'cloud-lightning', condition: 'thunderstorm', rainRisk: 'Extreme' },
    96: { label: 'Thunderstorm with Hail', icon: 'cloud-lightning', condition: 'thunderstorm', rainRisk: 'Extreme' }
  };
  return map[code] || { label: 'Variable Weather', icon: 'cloud', condition: 'cloudy', rainRisk: 'Moderate' };
}

// 1. Geocoding Search Endpoint
app.get('/api/search', async (req, res) => {
  const query = req.query.q;
  if (!query || query.trim().length < 2) {
    return res.status(400).json({ error: 'Search query must be at least 2 characters' });
  }

  try {
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=en&format=json`;
    const response = await fetch(geoUrl);
    if (!response.ok) throw new Error('Geocoding service unavailable');
    
    const data = await response.json();
    const results = (data.results || []).map(item => ({
      id: item.id,
      name: item.name,
      admin1: item.admin1 || '',
      country: item.country || '',
      countryCode: item.country_code || '',
      latitude: item.latitude,
      longitude: item.longitude,
      timezone: item.timezone || 'auto'
    }));

    res.json({ results });
  } catch (error) {
    console.error('Geocoding error:', error.message);
    res.status(500).json({ error: 'Failed to search location', details: error.message });
  }
});

// 2. Weather & Precipitation Forecast Endpoint
app.get('/api/weather', async (req, res) => {
  const { lat, lon, city } = req.query;
  const latitude = parseFloat(lat) || 28.6139; // Default Delhi
  const longitude = parseFloat(lon) || 77.2090;

  try {
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,weather_code,wind_speed_10m,surface_pressure&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,uv_index_max&timezone=auto`;
    
    const response = await fetch(weatherUrl);
    if (!response.ok) throw new Error('Weather forecast service error');
    
    const raw = await response.json();
    
    const currentCode = raw.current?.weather_code ?? 0;
    const currentMeta = getWeatherMeta(currentCode);
    const temp = raw.current?.temperature_2m ?? 24;
    const humidity = raw.current?.relative_humidity_2m ?? 50;
    const apparentTemp = raw.current?.apparent_temperature ?? temp;
    const rainNow = raw.current?.rain ?? raw.current?.precipitation ?? 0;

    // Calculate smart weather-adaptive hydration modifier (Base: 2500ml)
    // +150ml per 5°C above 22°C, +100ml if humidity < 40% (dry air increases water loss)
    let weatherExtraWater = 0;
    if (temp > 22) {
      weatherExtraWater += Math.round(((temp - 22) / 5) * 200);
    }
    if (humidity < 40) {
      weatherExtraWater += 150;
    }

    // Process next 24 hours of hourly precipitation & probability
    const currentHourIndex = new Date().getHours();
    const next24Hours = [];
    const hourlyTimes = raw.hourly?.time || [];
    const hourlyPrecip = raw.hourly?.precipitation || [];
    const hourlyProb = raw.hourly?.precipitation_probability || [];
    const hourlyTemp = raw.hourly?.temperature_2m || [];
    const hourlyCodes = raw.hourly?.weather_code || [];

    for (let i = 0; i < Math.min(24, hourlyTimes.length); i++) {
      const idx = (currentHourIndex + i) % hourlyTimes.length;
      const timeStr = hourlyTimes[idx] || '';
      const hour = timeStr ? new Date(timeStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : `+${i}h`;
      next24Hours.push({
        time: hour,
        fullTime: timeStr,
        temp: hourlyTemp[idx] ?? 0,
        precipMm: hourlyPrecip[idx] ?? 0,
        precipProb: hourlyProb[idx] ?? 0,
        weather: getWeatherMeta(hourlyCodes[idx] ?? 0)
      });
    }

    // Process 7-day daily forecast
    const dailyForecast = [];
    const dailyTimes = raw.daily?.time || [];
    const dailyMax = raw.daily?.temperature_2m_max || [];
    const dailyMin = raw.daily?.temperature_2m_min || [];
    const dailyRain = raw.daily?.precipitation_sum || [];
    const dailyRainProb = raw.daily?.precipitation_probability_max || [];
    const dailyCodes = raw.daily?.weather_code || [];
    const dailyUv = raw.daily?.uv_index_max || [];

    for (let i = 0; i < dailyTimes.length; i++) {
      const dateObj = new Date(dailyTimes[i]);
      const dayName = i === 0 ? 'Today' : dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      dailyForecast.push({
        date: dailyTimes[i],
        dayName,
        tempMax: dailyMax[i] ?? 0,
        tempMin: dailyMin[i] ?? 0,
        rainSumMm: dailyRain[i] ?? 0,
        rainProbMax: dailyRainProb[i] ?? 0,
        uvMax: dailyUv[i] ?? 0,
        weather: getWeatherMeta(dailyCodes[i] ?? 0)
      });
    }

    // Smart plant watering & rain harvest forecast advisory
    const totalRainNext3Days = dailyForecast.slice(0, 3).reduce((acc, curr) => acc + curr.rainSumMm, 0);
    const rainProbToday = dailyForecast[0]?.rainProbMax || 0;
    
    let gardenAdvice = "Normal watering needed today.";
    let gardenBadge = "water-ok";
    if (rainProbToday > 60 || totalRainNext3Days > 10) {
      gardenAdvice = "🌧️ High rain expected! Skip outdoor garden watering to save water.";
      gardenBadge = "skip-watering";
    } else if (temp > 32 && rainProbToday < 20) {
      gardenAdvice = "☀️ Hot & dry conditions. Water plants early morning or evening to prevent evaporation.";
      gardenBadge = "water-early";
    }

    res.json({
      location: {
        city: city || 'Current Location',
        latitude,
        longitude,
        timezone: raw.timezone
      },
      current: {
        temp,
        apparentTemp,
        humidity,
        windSpeed: raw.current?.wind_speed_10m ?? 0,
        pressure: raw.current?.surface_pressure ?? 1013,
        precipitationMm: rainNow,
        weather: currentMeta
      },
      hydrationBoost: {
        recommendedExtraWater: weatherExtraWater,
        reason: temp > 28 ? 'High ambient temperature requires increased fluid intake.' : 'Standard hydration weather.'
      },
      ecoAdvisory: {
        gardenAdvice,
        gardenBadge,
        expected3DayRainMm: parseFloat(totalRainNext3Days.toFixed(1))
      },
      hourly: next24Hours,
      daily: dailyForecast
    });
  } catch (error) {
    console.error('Weather API error:', error.message);
    res.status(500).json({ error: 'Failed to fetch weather & water forecast', details: error.message });
  }
});

// 3. Hydration Log & Target Endpoints
app.get('/api/hydration', (req, res) => {
  const data = readHydrationData();
  const today = new Date().toISOString().split('T')[0];
  const todayLogs = data.logs.filter(log => log.date === today);
  const totalDrank = todayLogs.reduce((acc, item) => acc + item.amount, 0);

  res.json({
    date: today,
    target: data.settings.baseTarget || 2500,
    totalDrank,
    remaining: Math.max(0, (data.settings.baseTarget || 2500) - totalDrank),
    percentage: Math.min(100, Math.round((totalDrank / (data.settings.baseTarget || 2500)) * 100)),
    logs: todayLogs,
    settings: data.settings
  });
});

app.post('/api/hydration/log', (req, res) => {
  const { amount, note, type } = req.body;
  const numAmount = parseInt(amount, 10);
  
  if (!numAmount || numAmount <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive integer in ml' });
  }

  const data = readHydrationData();
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const newEntry = {
    id: Date.now().toString(),
    date: today,
    time,
    timestamp: now.toISOString(),
    amount: numAmount,
    type: type || 'Water',
    note: note || ''
  };

  data.logs.push(newEntry);
  saveHydrationData(data);

  const todayLogs = data.logs.filter(log => log.date === today);
  const totalDrank = todayLogs.reduce((acc, item) => acc + item.amount, 0);
  const target = data.settings.baseTarget || 2500;

  res.json({
    success: true,
    added: newEntry,
    totalDrank,
    remaining: Math.max(0, target - totalDrank),
    percentage: Math.min(100, Math.round((totalDrank / target) * 100))
  });
});

app.post('/api/hydration/target', (req, res) => {
  const { baseTarget, weight } = req.body;
  const data = readHydrationData();

  if (baseTarget && baseTarget > 500 && baseTarget < 10000) {
    data.settings.baseTarget = parseInt(baseTarget, 10);
  }
  if (weight && weight > 20 && weight < 300) {
    data.settings.weight = parseInt(weight, 10);
  }

  saveHydrationData(data);
  res.json({ success: true, settings: data.settings });
});

app.delete('/api/hydration/reset', (req, res) => {
  const data = readHydrationData();
  const today = new Date().toISOString().split('T')[0];
  data.logs = data.logs.filter(log => log.date !== today);
  saveHydrationData(data);
  res.json({ success: true, message: 'Hydration reset for today' });
});

app.get('/api/hydration/history', (req, res) => {
  const data = readHydrationData();
  
  // Group logs by past 7 days
  const history = {};
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
    history[dateStr] = { date: dateStr, day: dayName, total: 0, target: data.settings.baseTarget || 2500 };
  }

  data.logs.forEach(log => {
    if (history[log.date]) {
      history[log.date].total += log.amount;
    }
  });

  res.json({ history: Object.values(history) });
});

// 4. Rainwater Harvesting & Conservation Calculator
app.get('/api/harvest-calc', (req, res) => {
  const roofArea = parseFloat(req.query.area) || 100; // in square meters
  const rainfallMm = parseFloat(req.query.rainfall) || 25; // in mm
  const runoffCoeff = parseFloat(req.query.runoff) || 0.85; // 0.85 for tiled/metal roof
  
  // Formula: Harvested Liters = Roof Area (m^2) * Rainfall (mm) * Runoff Coefficient
  const liters = roofArea * rainfallMm * runoffCoeff;
  const gallons = liters * 0.264172;
  const flushUses = Math.floor(liters / 6); // Average toilet flush is 6L
  const showerMinutes = Math.floor(liters / 9); // 9L per min shower

  res.json({
    roofArea,
    rainfallMm,
    runoffCoeff,
    harvestableLiters: Math.round(liters),
    harvestableGallons: Math.round(gallons),
    equivalents: {
      toiletFlushes: flushUses,
      showerMinutes,
      plantsWateredDays: Math.round(liters / 15) // assuming ~15L/day garden watering
    }
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`💧 AquaCast Water & Forecast App server running at http://localhost:${PORT}`);
});
