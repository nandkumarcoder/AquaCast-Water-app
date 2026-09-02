// AquaCast Frontend Core Controller
document.addEventListener('DOMContentLoaded', () => {
  // State
  let state = {
    city: 'New York',
    lat: 40.7128,
    lon: -74.0060,
    weatherData: null,
    hydrationData: {
      target: 2500,
      totalDrank: 0,
      logs: [],
      settings: { baseTarget: 2500, weight: 70 }
    },
    weeklyHistory: [],
    recommendedExtraWater: 0
  };

  // Chart Instances
  let hourlyPrecipChartInstance = null;
  let weeklyHydrationChartInstance = null;

  // DOM Elements
  const cityInput = document.getElementById('cityInput');
  const searchResults = document.getElementById('searchResults');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const geoBtn = document.getElementById('geoBtn');
  const locationTitle = document.getElementById('locationTitle');
  const weatherSummary = document.getElementById('weatherSummary');
  const weatherMainIcon = document.getElementById('weatherMainIcon');
  const headerTemp = document.getElementById('headerTemp');
  const headerHumidity = document.getElementById('headerHumidity');
  const headerPrecip = document.getElementById('headerPrecip');
  const headerWind = document.getElementById('headerWind');
  const dailyForecastGrid = document.getElementById('dailyForecastGrid');
  const advisoryBadge = document.getElementById('advisoryBadge');
  const advisoryText = document.getElementById('advisoryText');
  const applyHydrationBoostBtn = document.getElementById('applyHydrationBoostBtn');

  // Hydration DOM Elements
  const hydrationPctText = document.getElementById('hydrationPctText');
  const intakeValue = document.getElementById('intakeValue');
  const targetValue = document.getElementById('targetValue');
  const tankRemaining = document.getElementById('tankRemaining');
  const waterTankInner = document.getElementById('waterTankInner');
  const todayLogsList = document.getElementById('todayLogsList');
  const logCountBadge = document.getElementById('logCountBadge');
  const customLogForm = document.getElementById('customLogForm');
  const customAmountInput = document.getElementById('customAmountInput');
  const resetTodayBtn = document.getElementById('resetTodayBtn');
  const openTargetModalBtn = document.getElementById('openTargetModalBtn');
  const closeTargetModalBtn = document.getElementById('closeTargetModalBtn');
  const cancelTargetBtn = document.getElementById('cancelTargetBtn');
  const targetModal = document.getElementById('targetModal');
  const targetForm = document.getElementById('targetForm');
  const baseTargetInput = document.getElementById('baseTargetInput');
  const weightInput = document.getElementById('weightInput');

  // Rain Harvest Elements
  const roofAreaInput = document.getElementById('roofAreaInput');
  const rainfallInput = document.getElementById('rainfallInput');
  const useForecastRainBtn = document.getElementById('useForecastRainBtn');
  const harvestLiters = document.getElementById('harvestLiters');
  const harvestGallons = document.getElementById('harvestGallons');
  const flushCount = document.getElementById('flushCount');
  const showerMinutes = document.getElementById('showerMinutes');
  const gardenDays = document.getElementById('gardenDays');
  const gardenStatusText = document.getElementById('gardenStatusText');

  // Analytics Elements
  const statWeeklyTotal = document.getElementById('statWeeklyTotal');
  const statDailyAvg = document.getElementById('statDailyAvg');
  const statGoalRate = document.getElementById('statGoalRate');

  // Tabs
  const navTabs = document.querySelectorAll('.nav-tab');
  const tabContents = document.querySelectorAll('.tab-content');

  // Tab Switching
  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.tab;
      navTabs.forEach(t => {
        t.classList.remove('active', 'bg-sky-500/20', 'text-sky-300', 'border-sky-400/40');
        t.classList.add('bg-transparent', 'text-slate-400', 'border-transparent');
      });
      tab.classList.add('active', 'bg-sky-500/20', 'text-sky-300', 'border-sky-400/40');
      tab.classList.remove('bg-transparent', 'text-slate-400', 'border-transparent');

      tabContents.forEach(c => c.classList.add('hidden'));
      const activeSection = document.getElementById(`tab-${targetTab}`);
      if (activeSection) {
        activeSection.classList.remove('hidden');
      }

      if (targetTab === 'analytics') {
        renderWeeklyHydrationChart();
      } else if (targetTab === 'forecast') {
        if (hourlyPrecipChartInstance) hourlyPrecipChartInstance.resize();
      }
    });
  });

  // Sound Effect via Web Audio API (Water droplet chime)
  function playWaterDropSound() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      // Pitch drop creates water drip sound
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.08);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.2);

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch (e) {
      // Audio not permitted or supported, silent fallback
    }
  }

  // Toast Notifications
  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    const bg = type === 'success' ? 'bg-emerald-600/90 border-emerald-400/40' : 'bg-sky-600/90 border-sky-400/40';
    const icon = type === 'success' ? 'fa-circle-check' : 'fa-info-circle';

    toast.className = `${bg} backdrop-blur-md border text-white text-xs px-4 py-3 rounded-xl shadow-xl flex items-center gap-2 transform transition-all duration-300 translate-y-2 opacity-0 pointer-events-auto`;
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
    
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.remove('translate-y-2', 'opacity-0');
    }, 10);

    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-2');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // Weather Condition Icon Mapping
  function getWeatherIconHtml(iconName, condition) {
    switch (iconName) {
      case 'sun':
        return '<i class="fa-solid fa-sun text-yellow-400"></i>';
      case 'sun-dim':
      case 'cloud-sun':
        return '<i class="fa-solid fa-cloud-sun text-amber-300"></i>';
      case 'cloud':
        return '<i class="fa-solid fa-cloud text-slate-300"></i>';
      case 'cloud-drizzle':
        return '<i class="fa-solid fa-cloud-rain text-cyan-300"></i>';
      case 'cloud-rain':
      case 'cloud-heavy-rain':
        return '<i class="fa-solid fa-cloud-showers-heavy text-sky-400"></i>';
      case 'cloud-lightning':
      case 'cloud-lightning-rain':
        return '<i class="fa-solid fa-cloud-bolt text-yellow-300"></i>';
      case 'snowflake':
        return '<i class="fa-regular fa-snowflake text-sky-200"></i>';
      case 'fog':
        return '<i class="fa-solid fa-smog text-slate-300"></i>';
      default:
        return '<i class="fa-solid fa-cloud-sun text-sky-300"></i>';
    }
  }

  // 1. Fetch & Render Weather
  async function fetchWeather(lat, lon, cityName) {
    try {
      locationTitle.textContent = cityName || 'Updating...';
      weatherSummary.textContent = 'Fetching precipitation and atmospheric metrics...';

      const res = await fetch(`/api/weather?lat=${lat}&lon=${lon}&city=${encodeURIComponent(cityName || '')}`);
      if (!res.ok) throw new Error('Could not fetch weather data');
      
      const data = await res.json();
      state.weatherData = data;
      state.lat = lat;
      state.lon = lon;
      state.city = data.location.city || cityName;
      state.recommendedExtraWater = data.hydrationBoost?.recommendedExtraWater || 0;

      renderWeatherOverview(data);
      renderHourlyPrecipChart(data.hourly || []);
      renderDailyForecast(data.daily || []);
      renderEcoAdvisory(data.ecoAdvisory, data.hydrationBoost);
      calculateRainHarvest();

      showToast(`Weather updated for ${state.city}`, 'info');
    } catch (err) {
      console.error(err);
      showToast('Error loading forecast data', 'error');
    }
  }

  function renderWeatherOverview(data) {
    const cur = data.current;
    locationTitle.textContent = data.location.city;
    weatherSummary.textContent = `${cur.weather.label} • Feels like ${Math.round(cur.apparentTemp)}°C`;
    weatherMainIcon.innerHTML = getWeatherIconHtml(cur.weather.icon, cur.weather.condition);
    
    headerTemp.textContent = `${Math.round(cur.temp)}°C`;
    headerHumidity.textContent = `${cur.humidity}%`;
    headerPrecip.textContent = `${cur.precipitationMm} mm`;
    headerWind.textContent = `${Math.round(cur.windSpeed)} km/h`;
  }

  // 2. Render Hourly Precipitation Chart (Chart.js)
  function renderHourlyPrecipChart(hourlyList) {
    const ctx = document.getElementById('hourlyPrecipChart').getContext('2d');
    const labels = hourlyList.map(h => h.time);
    const rainVol = hourlyList.map(h => h.precipMm);
    const rainProb = hourlyList.map(h => h.precipProb);

    if (hourlyPrecipChartInstance) {
      hourlyPrecipChartInstance.destroy();
    }

    hourlyPrecipChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            type: 'line',
            label: 'Rain Probability (%)',
            data: rainProb,
            borderColor: '#38bdf8',
            backgroundColor: 'rgba(56, 189, 248, 0.15)',
            borderWidth: 2,
            tension: 0.35,
            fill: true,
            yAxisID: 'yProb',
            pointRadius: 2,
            pointHoverRadius: 5
          },
          {
            type: 'bar',
            label: 'Precipitation Volume (mm)',
            data: rainVol,
            backgroundColor: 'rgba(2, 132, 199, 0.7)',
            borderColor: '#0284c7',
            borderWidth: 1,
            borderRadius: 4,
            yAxisID: 'yPrecip'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            titleColor: '#fff',
            bodyColor: '#38bdf8',
            borderColor: 'rgba(56, 189, 248, 0.3)',
            borderWidth: 1,
            padding: 10,
            cornerRadius: 8
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#94a3b8', font: { size: 10 } }
          },
          yProb: {
            type: 'linear',
            position: 'left',
            min: 0,
            max: 100,
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: {
              color: '#38bdf8',
              font: { size: 10 },
              callback: val => `${val}%`
            }
          },
          yPrecip: {
            type: 'linear',
            position: 'right',
            min: 0,
            grid: { drawOnChartArea: false },
            ticks: {
              color: '#0284c7',
              font: { size: 10 },
              callback: val => `${val}mm`
            }
          }
        }
      }
    });
  }

  // 3. Render 7-Day Forecast Grid
  function renderDailyForecast(dailyList) {
    dailyForecastGrid.innerHTML = '';
    dailyList.forEach(day => {
      const card = document.createElement('div');
      card.className = 'glass-card glass-card-interactive p-3 flex flex-col items-center justify-between text-center gap-2';
      
      const rainProbBadge = day.rainProbMax > 40
        ? `<span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-sky-500/20 text-sky-300"><i class="fa-solid fa-droplet text-[8px] mr-0.5"></i>${day.rainProbMax}%</span>`
        : `<span class="text-[10px] text-slate-400 font-medium">${day.rainProbMax}% rain</span>`;

      card.innerHTML = `
        <span class="text-xs font-semibold text-slate-300">${day.dayName}</span>
        <div class="text-2xl my-1">
          ${getWeatherIconHtml(day.weather.icon, day.weather.condition)}
        </div>
        <div class="text-xs">
          <span class="font-bold text-white">${Math.round(day.tempMax)}°</span>
          <span class="text-slate-400 ml-1 font-light">${Math.round(day.tempMin)}°</span>
        </div>
        <div class="mt-1">
          ${rainProbBadge}
        </div>
        <span class="text-[10px] text-cyan-400/90 font-medium">${day.rainSumMm} mm</span>
      `;
      dailyForecastGrid.appendChild(card);
    });
  }

  // 4. Render Eco & Hydration Advisory
  function renderEcoAdvisory(eco, hydrationBoost) {
    if (eco) {
      gardenStatusText.textContent = eco.gardenAdvice;
      const statusBox = document.getElementById('gardenStatusBox');
      if (eco.gardenBadge === 'skip-watering') {
        statusBox.className = 'p-4 rounded-xl bg-sky-950/50 border border-sky-400/40 text-sky-200 text-sm space-y-2';
      } else {
        statusBox.className = 'p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 text-sm space-y-2';
      }
    }

    if (hydrationBoost) {
      if (hydrationBoost.recommendedExtraWater > 0) {
        advisoryBadge.textContent = `+${hydrationBoost.recommendedExtraWater} ml Boost`;
        advisoryBadge.className = 'text-xs font-semibold px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded-md';
        advisoryText.textContent = `${hydrationBoost.reason} We recommend drinking an extra +${hydrationBoost.recommendedExtraWater} ml today.`;
      } else {
        advisoryBadge.textContent = 'Standard';
        advisoryBadge.className = 'text-xs font-semibold px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded-md';
        advisoryText.textContent = 'Weather is moderate. Standard daily hydration target is sufficient.';
      }
    }
  }

  // Apply Weather Hydration Boost
  applyHydrationBoostBtn.addEventListener('click', async () => {
    if (state.recommendedExtraWater > 0) {
      const newTarget = (state.hydrationData.settings.baseTarget || 2500) + state.recommendedExtraWater;
      await updateTarget(newTarget, state.hydrationData.settings.weight);
      showToast(`Target adjusted to ${newTarget} ml based on current temperature!`, 'success');
    } else {
      showToast('Standard water target is already ideal for current weather.', 'info');
    }
  });

  // 5. Hydration App Logic
  async function fetchHydration() {
    try {
      const res = await fetch('/api/hydration');
      if (!res.ok) throw new Error('Failed to fetch hydration');
      const data = await res.json();
      state.hydrationData = data;
      renderHydrationUI();
    } catch (err) {
      console.error(err);
    }
  }

  function renderHydrationUI() {
    const { totalDrank, target, percentage, remaining, logs, settings } = state.hydrationData;

    hydrationPctText.textContent = `${percentage}%`;
    intakeValue.textContent = totalDrank;
    targetValue.textContent = target;
    tankRemaining.textContent = remaining > 0 ? `${remaining} ml to go` : '🎉 Goal Achieved!';
    
    // Wave Tank fill height (cap between 0% and 100%)
    waterTankInner.style.height = `${Math.min(100, Math.max(0, percentage))}%`;

    // Render Timeline
    logCountBadge.textContent = `${logs.length} drink${logs.length === 1 ? '' : 's'}`;
    if (logs.length === 0) {
      todayLogsList.innerHTML = '<p class="text-sm text-slate-400 italic py-4 text-center">No water logged yet today. Take a sip and track your first glass!</p>';
    } else {
      todayLogsList.innerHTML = '';
      [...logs].reverse().forEach(item => {
        const row = document.createElement('div');
        row.className = 'flex items-center justify-between p-2.5 rounded-xl bg-slate-800/40 border border-white/5 text-xs';
        row.innerHTML = `
          <div class="flex items-center gap-2.5">
            <span class="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center">
              <i class="fa-solid fa-glass-water"></i>
            </span>
            <div>
              <span class="font-bold text-white block">+${item.amount} ml</span>
              <span class="text-[10px] text-slate-400">${item.type || 'Water'}</span>
            </div>
          </div>
          <span class="text-slate-400 text-[11px] font-medium">${item.time}</span>
        `;
        todayLogsList.appendChild(row);
      });
    }

    // Trigger celebration confetti if goal achieved
    if (percentage >= 100 && percentage - (logs[logs.length-1]?.amount / target * 100) < 100) {
      if (typeof confetti === 'function') {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
    }
  }

  // Quick Add Buttons
  document.querySelectorAll('.btn-quick-add').forEach(btn => {
    btn.addEventListener('click', () => {
      const amount = parseInt(btn.dataset.amount, 10);
      logWater(amount);
    });
  });

  // Custom Amount Form
  customLogForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const amount = parseInt(customAmountInput.value, 10);
    if (amount > 0) {
      logWater(amount);
      customAmountInput.value = '';
    }
  });

  async function logWater(amount) {
    try {
      playWaterDropSound();
      const res = await fetch('/api/hydration/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, type: 'Water' })
      });
      if (!res.ok) throw new Error('Could not log intake');
      const data = await res.json();
      
      // Update local state and UI
      await fetchHydration();
      fetchWeeklyHistory();
      showToast(`+${amount} ml logged! Keep it up 💧`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Error logging water', 'error');
    }
  }

  // Reset Today
  resetTodayBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to reset today\'s water intake logs?')) {
      try {
        await fetch('/api/hydration/reset', { method: 'DELETE' });
        await fetchHydration();
        fetchWeeklyHistory();
        showToast('Hydration log reset for today', 'info');
      } catch (err) {
        console.error(err);
      }
    }
  });

  // Target Settings Modal
  openTargetModalBtn.addEventListener('click', () => {
    baseTargetInput.value = state.hydrationData.target || 2500;
    weightInput.value = state.hydrationData.settings?.weight || 70;
    targetModal.classList.remove('hidden');
    targetModal.classList.add('flex');
  });

  function closeTargetModal() {
    targetModal.classList.add('hidden');
    targetModal.classList.remove('flex');
  }

  closeTargetModalBtn.addEventListener('click', closeTargetModal);
  cancelTargetBtn.addEventListener('click', closeTargetModal);

  targetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const baseTarget = parseInt(baseTargetInput.value, 10);
    const weight = parseInt(weightInput.value, 10);
    await updateTarget(baseTarget, weight);
    closeTargetModal();
    showToast('Water target updated successfully!', 'success');
  });

  async function updateTarget(baseTarget, weight) {
    try {
      const res = await fetch('/api/hydration/target', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseTarget, weight })
      });
      if (res.ok) {
        await fetchHydration();
      }
    } catch (err) {
      console.error(err);
    }
  }

  // 6. Rain Harvesting Calculator
  function calculateRainHarvest() {
    const area = parseFloat(roofAreaInput.value) || 0;
    const rainfall = parseFloat(rainfallInput.value) || 0;
    const runoff = 0.85;

    const liters = Math.round(area * rainfall * runoff);
    const gallons = Math.round(liters * 0.264172);

    harvestLiters.textContent = liters.toLocaleString();
    harvestGallons.textContent = `(~${gallons.toLocaleString()} Gallons)`;

    flushCount.textContent = Math.floor(liters / 6).toLocaleString();
    showerMinutes.textContent = Math.floor(liters / 9).toLocaleString();
    gardenDays.textContent = Math.round(liters / 15).toLocaleString();
  }

  roofAreaInput.addEventListener('input', calculateRainHarvest);
  rainfallInput.addEventListener('input', calculateRainHarvest);

  useForecastRainBtn.addEventListener('click', () => {
    if (state.weatherData?.daily) {
      const totalWeekRain = state.weatherData.daily.reduce((acc, curr) => acc + curr.rainSumMm, 0);
      rainfallInput.value = totalWeekRain > 0 ? parseFloat(totalWeekRain.toFixed(1)) : 15;
      calculateRainHarvest();
      showToast(`Set rainfall to ${rainfallInput.value} mm from 7-day forecast`, 'info');
    }
  });

  // 7. Weekly History & Analytics Chart
  async function fetchWeeklyHistory() {
    try {
      const res = await fetch('/api/hydration/history');
      if (!res.ok) return;
      const data = await res.json();
      state.weeklyHistory = data.history || [];
      renderWeeklyAnalyticsStats();
    } catch (err) {
      console.error(err);
    }
  }

  function renderWeeklyAnalyticsStats() {
    const history = state.weeklyHistory;
    if (!history || history.length === 0) return;

    const totalMl = history.reduce((sum, item) => sum + item.total, 0);
    const avgMl = Math.round(totalMl / history.length);
    const daysMet = history.filter(item => item.total >= item.target && item.target > 0).length;
    const completionRate = Math.round((daysMet / history.length) * 100);

    statWeeklyTotal.textContent = `${(totalMl / 1000).toFixed(1)} L`;
    statDailyAvg.textContent = `${avgMl} ml`;
    statGoalRate.textContent = `${completionRate}%`;
  }

  function renderWeeklyHydrationChart() {
    const ctx = document.getElementById('weeklyHydrationChart').getContext('2d');
    const history = state.weeklyHistory;
    if (!history || history.length === 0) return;

    const labels = history.map(h => h.day);
    const values = history.map(h => h.total);
    const targets = history.map(h => h.target);

    if (weeklyHydrationChartInstance) {
      weeklyHydrationChartInstance.destroy();
    }

    weeklyHydrationChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            type: 'line',
            label: 'Daily Target (ml)',
            data: targets,
            borderColor: '#f87171',
            borderWidth: 2,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false
          },
          {
            type: 'bar',
            label: 'Water Intake (ml)',
            data: values,
            backgroundColor: values.map(v => v >= 2500 ? 'rgba(56, 189, 248, 0.85)' : 'rgba(2, 132, 199, 0.7)'),
            borderColor: '#38bdf8',
            borderWidth: 1,
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            titleColor: '#fff',
            bodyColor: '#38bdf8',
            borderColor: 'rgba(56, 189, 248, 0.3)',
            borderWidth: 1,
            padding: 10,
            cornerRadius: 8
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#94a3b8' }
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: {
              color: '#94a3b8',
              callback: val => `${val}ml`
            }
          }
        }
      }
    });
  }

  // 8. City Search & Geocoding Autocomplete
  let searchTimeout = null;
  cityInput.addEventListener('input', (e) => {
    const val = e.target.value.trim();
    clearSearchBtn.classList.toggle('hidden', val.length === 0);

    clearTimeout(searchTimeout);
    if (val.length < 2) {
      searchResults.classList.add('hidden');
      return;
    }

    searchTimeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(val)}`);
        const data = await res.json();
        const results = data.results || [];

        if (results.length === 0) {
          searchResults.innerHTML = '<div class="p-3 text-xs text-slate-400">No matching cities found</div>';
        } else {
          searchResults.innerHTML = '';
          results.forEach(item => {
            const opt = document.createElement('div');
            opt.className = 'p-2.5 hover:bg-sky-600/30 cursor-pointer text-xs border-b border-white/5 flex items-center justify-between';
            const locationStr = [item.name, item.admin1, item.country].filter(Boolean).join(', ');
            opt.innerHTML = `
              <span class="font-medium text-white">${locationStr}</span>
              <span class="text-[10px] text-sky-400">${item.countryCode}</span>
            `;
            opt.addEventListener('click', () => {
              cityInput.value = item.name;
              searchResults.classList.add('hidden');
              fetchWeather(item.latitude, item.longitude, item.name);
            });
            searchResults.appendChild(opt);
          });
        }
        searchResults.classList.remove('hidden');
      } catch (err) {
        console.error(err);
      }
    }, 280);
  });

  clearSearchBtn.addEventListener('click', () => {
    cityInput.value = '';
    clearSearchBtn.classList.add('hidden');
    searchResults.classList.add('hidden');
  });

  document.addEventListener('click', (e) => {
    if (!cityInput.contains(e.target) && !searchResults.contains(e.target)) {
      searchResults.classList.add('hidden');
    }
  });

  // Geolocation Button
  geoBtn.addEventListener('click', () => {
    if (!navigator.geolocation) {
      showToast('Geolocation not supported by browser', 'error');
      return;
    }
    showToast('Getting device coordinates...', 'info');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        fetchWeather(latitude, longitude, 'My Location');
      },
      (err) => {
        console.error(err);
        showToast('Location permission denied or unavailable', 'error');
      }
    );
  });

  // Initial Load
  fetchWeather(state.lat, state.lon, state.city);
  fetchHydration();
  fetchWeeklyHistory();
  calculateRainHarvest();
});
