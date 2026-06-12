document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('activity-form');
  const detailsPanel = document.getElementById('details-panel');
  const selectedLabel = document.getElementById('selected-activity-label');
  const resultsCard = document.getElementById('results-card');
  const co2Value = document.getElementById('co2-value');
  const nudgeText = document.getElementById('contextual-nudge');
  const submitBtn = form.querySelector('button[type="submit"]');
  const btnText = submitBtn.querySelector('.btn-text');
  const toastContainer = document.getElementById('toast-container');

  // Hero panel nodes
  const co2SavedEl = document.getElementById('co2-saved');
  const treesPlantedEl = document.getElementById('trees-planted');
  const streakCountEl = document.getElementById('streak-count');
  const rankEl = document.getElementById('community-rank');
  const levelEl = document.getElementById('eco-level');
  const xpTextEl = document.getElementById('xp-text');
  const progressPercentEl = document.getElementById('weekly-progress-percentage');
  const progressBarEl = document.getElementById('weekly-progress-bar');

  // Ecosystem SVG elements
  const growthTitleEl = document.getElementById('growth-stage-title');
  const ecoPointsEl = document.getElementById('ecosystem-points');
  const ecoProgressBarEl = document.getElementById('ecosystem-progress-bar');
  const nextStageHintEl = document.getElementById('next-stage-hint');
  const svgEl = document.getElementById('ecosystem-svg');

  // AI Chat and Actions
  const coachMessages = document.getElementById('coach-messages');
  const coachForm = document.getElementById('coach-form');
  const coachInput = document.getElementById('coach-input');
  const challengesList = document.getElementById('challenges-list');
  const recommendationsList = document.getElementById('recommendations-list');
  const leaderboardList = document.getElementById('leaderboard-list');
  const heatmapGrid = document.getElementById('heatmap-grid');
  const micBtn = document.getElementById('mic-btn');
  const voiceStatus = document.getElementById('voice-status');
  const speakBtn = document.getElementById('speak-btn');
  const shareBtn = document.getElementById('share-btn');
  const badgesGrid = document.getElementById('badges-grid');

  // HTML escaping utility for XSS protection
  const escapeHtml = (unsafe) => {
    return String(unsafe)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  // --- Initialize Gamified Stats ---
  const defaultStats = {
    ecoPoints: 50, // Starts with 50 XP
    totalCo2Saved: 0.0,
    streak: 0,
    lastLoggedDate: null,
    totalLogged: 0,
    commits: [0, 1, 0, 2, 0, 1, 3, 0, 2, 1, 0, 1, 2, 0, 0], // Heatmap grid status
    unlockedBadges: [],
    sources: { Transport: 0, Food: 0, Energy: 0, Water: 0 }
  };

  let stats = JSON.parse(localStorage.getItem('eco_stats_v2')) || defaultStats;
  
  // Safe deep merge to prevent TypeError crashes during rendering of badges/commits
  stats = { ...defaultStats, ...stats };
  if (!Array.isArray(stats.unlockedBadges)) stats.unlockedBadges = [];
  if (!Array.isArray(stats.commits)) stats.commits = [...defaultStats.commits];
  if (stats.sources) {
    stats.sources = { ...defaultStats.sources, ...stats.sources };
  } else {
    stats.sources = { ...defaultStats.sources };
  }

  const BADGES = [
    { id: 'first_step', name: '🌱 Green Sprout', desc: 'Logged your first activity (+30 XP)' },
    { id: 'clean_commuter', name: '🚴 Transit Hero', desc: 'Commuted cleanly 3 times (+50 XP)' },
    { id: 'beef_free', name: '🥗 Eco Eater', desc: 'Ate 3 sustainable meals (+50 XP)' },
    { id: 'energy_saver', name: '⚡ Watt Saver', desc: 'Logged energy conservation (+40 XP)' },
    { id: 'carbon_master', name: '🏆 Carbon Champion', desc: 'Accumulated 500+ Eco Points (+100 XP)' }
  ];

  const CHALLENGES = [
    { id: 'walk_2k', text: 'Walk 2 km instead of driving today', xp: 40, category: 'Transport' },
    { id: 'avoid_car', text: 'Avoid private motor transit for 24h', xp: 60, category: 'Transport' },
    { id: 'no_beef', text: 'Eat a fully plant-based meal today', xp: 30, category: 'Food' },
    { id: 'unplug', text: 'Unplug high-power appliances for 2h', xp: 40, category: 'Energy' }
  ];

  const RECOMMENDATIONS = [
    { habit: 'Car 10km/day', suggest: 'Bus 3 days/week', co2: 24, xp: 50 },
    { habit: 'AC on 6h/day', suggest: 'Eco mode or ceiling fan', co2: 15, xp: 40 }
  ];

  const mockLeaderboard = [
    { name: 'Aarav', score: 850, level: 'Carbon Hero', rank: 1, isSelf: false },
    { name: 'Diya', score: 620, level: 'Eco Warrior', rank: 2, isSelf: false },
    { name: 'Kabir', score: 410, level: 'Green Explorer', rank: 3, isSelf: false },
    { name: 'Yash (You)', score: 50, level: 'Eco Beginner', rank: 4, isSelf: true },
    { name: 'Meera', score: 30, level: 'Eco Beginner', rank: 5, isSelf: false }
  ];

  // --- SVG Ecosystem Renderer (Dynamic Wow Feature) ---
  const renderEcosystem = (points) => {
    let stageTitle = '';
    let hint = '';
    let progress = 0;
    let svgContent = '<ellipse class="ground fill-emerald-900/30" cx="100" cy="180" rx="80" ry="12" />';

    if (points < 100) {
      stageTitle = 'Seed Stage 🌱';
      progress = (points / 100) * 100;
      hint = `Unlock Plant Stage at 100 XP (${100 - points} left)`;
      // Seed / sprout SVG
      svgContent += `
        <!-- Sprout Stem -->
        <path class="ecosystem-element" d="M100 180 Q104 162 100 150 Q96 162 100 180" fill="#10b981" />
        <!-- Small Sprout Leaves -->
        <path class="ecosystem-element" d="M100 150 Q85 142 90 152 C95 155 100 152 100 150" fill="#84cc16" />
        <path class="ecosystem-element" d="M100 150 Q115 142 110 152 C105 155 100 152 100 150" fill="#10b981" />
        <circle class="ecosystem-element" cx="100" cy="178" r="4.5" fill="#78350f" />
      `;
    } else if (points < 300) {
      stageTitle = 'Plant Stage 🌿';
      progress = ((points - 100) / 200) * 100;
      hint = `Unlock Tree Stage at 300 XP (${300 - points} left)`;
      // Sapling SVG
      svgContent += `
        <!-- Sapling Stem -->
        <path class="ecosystem-element" d="M99 180 Q101 130 96 110 Q104 130 101 180 Z" fill="#78350f" />
        <!-- Leaves -->
        <path class="ecosystem-element" d="M97 140 Q80 128 75 138 Q90 143 97 140" fill="#10b981" />
        <path class="ecosystem-element" d="M100 125 Q120 115 125 125 Q110 130 100 125" fill="#84cc16" />
        <path class="ecosystem-element" d="M96 110 Q90 92 100 82 Q105 95 96 110" fill="#10b981" />
      `;
    } else if (points < 600) {
      stageTitle = 'Tree Stage 🌳';
      progress = ((points - 300) / 300) * 100;
      hint = `Unlock Forest Stage at 600 XP (${600 - points} left)`;
      // Mature Tree SVG
      svgContent += `
        <!-- Main Trunk -->
        <path class="ecosystem-element" d="M93 180 C96 130 90 110 100 90 C110 110 104 130 107 180 Z" fill="#78350f" />
        <path class="ecosystem-element" d="M98 120 Q84 100 74 105 Q84 112 98 120" fill="#78350f" />
        <path class="ecosystem-element" d="M102 115 Q116 95 126 100 Q116 107 102 115" fill="#78350f" />
        <!-- Lush Green Canopy -->
        <circle class="ecosystem-element" cx="100" cy="80" r="30" fill="#10b981" />
        <circle class="ecosystem-element" cx="76" cy="100" r="24" fill="#047857" />
        <circle class="ecosystem-element" cx="124" cy="100" r="24" fill="#047857" />
        <circle class="ecosystem-element" cx="86" cy="72" r="20" fill="#84cc16" />
        <circle class="ecosystem-element" cx="114" cy="72" r="20" fill="#84cc16" />
      `;
    } else if (points < 1000) {
      stageTitle = 'Forest Stage 🌲🌲🌲';
      progress = ((points - 600) / 400) * 100;
      hint = `Unlock Eco City Stage at 1000 XP (${1000 - points} left)`;
      // Triple overlapping trees SVG
      svgContent += `
        <!-- Left Pine -->
        <path class="ecosystem-element" d="M60 180 L62 135 L58 135 Z" fill="#451a03" />
        <polygon class="ecosystem-element" points="60,115 42,150 78,150" fill="#065f46" />
        <polygon class="ecosystem-element" points="60,100 46,132 74,132" fill="#047857" />

        <!-- Right Pine -->
        <path class="ecosystem-element" d="M140 180 L142 135 L138 135 Z" fill="#451a03" />
        <polygon class="ecosystem-element" points="140,115 122,150 158,150" fill="#065f46" />
        <polygon class="ecosystem-element" points="140,100 126,132 154,132" fill="#047857" />

        <!-- Center Tree -->
        <path class="ecosystem-element" d="M100 180 C102 120 98 100 100 80 Z" fill="#78350f" />
        <circle class="ecosystem-element" cx="100" cy="80" r="28" fill="#10b981" />
        <circle class="ecosystem-element" cx="82" cy="98" r="20" fill="#059669" />
        <circle class="ecosystem-element" cx="118" cy="98" r="20" fill="#059669" />
      `;
    } else {
      stageTitle = 'Eco City Stage 🌎';
      progress = 100;
      hint = 'Perfect balance achieved. Keep growing your City!';
      // Planet Earth with tiny wind turbine & clean assets
      svgContent += `
        <!-- Globe -->
        <circle class="ecosystem-element" cx="100" cy="115" r="54" fill="#1e3a8a" stroke="#10b981" stroke-width="2.5" />
        <!-- Continents -->
        <path class="ecosystem-element" d="M72 85 C82 80 92 90 82 105 C72 115 62 105 72 85 Z" fill="#047857" />
        <path class="ecosystem-element" d="M112 125 C122 115 137 125 132 140 C122 150 112 140 112 125 Z" fill="#047857" />
        <path class="ecosystem-element" d="M120 90 C130 95 135 85 130 80 C125 75 115 85 120 90 Z" fill="#047857" />
        <!-- Miniature Wind Turbine -->
        <line class="ecosystem-element" x1="100" y1="115" x2="100" y2="70" stroke="#f3f4f6" stroke-width="2" />
        <circle class="ecosystem-element" cx="100" cy="70" r="3" fill="#f59e0b" />
        <path class="ecosystem-element" d="M100 70 L86 62 M100 70 L114 62 M100 70 L100 90" stroke="#f3f4f6" stroke-width="1.5" />
        <!-- Green sprout on side -->
        <path class="ecosystem-element" d="M54 110 Q58 102 54 96" stroke="#84cc16" stroke-width="2" fill="none" />
      `;
    }

    growthTitleEl.textContent = stageTitle;
    ecoPointsEl.textContent = `${points} XP`;
    ecoProgressBarEl.style.width = `${progress}%`;
    nextStageHintEl.textContent = hint;
    svgEl.innerHTML = svgContent;
  };

  // --- XP to Level Converter ---
  const getLevelInfo = (xp) => {
    if (xp < 100) return { level: 1, title: 'Eco Beginner', nextXp: 100, prevXp: 0 };
    if (xp < 300) return { level: 2, title: 'Green Explorer', nextXp: 300, prevXp: 100 };
    if (xp < 600) return { level: 3, title: 'Eco Warrior', nextXp: 600, prevXp: 300 };
    if (xp < 1000) return { level: 4, title: 'Carbon Hero', nextXp: 1000, prevXp: 600 };
    if (xp < 1500) return { level: 5, title: 'Climate Champion', nextXp: 1500, prevXp: 1000 };
    return { level: 6, title: 'Sustainability Legend', nextXp: 99999, prevXp: 1500 };
  };

  // --- Save / Load / Render Dashboard Stats ---
  const saveStats = () => {
    localStorage.setItem('eco_stats_v2', JSON.stringify(stats));
  };

  const renderDashboard = () => {
    co2SavedEl.textContent = stats.totalCo2Saved.toFixed(1);
    
    // Trees = CO2 saved / 21
    const treesEquivalent = (stats.totalCo2Saved / 21).toFixed(1);
    treesPlantedEl.textContent = treesEquivalent;
    
    // Streak
    streakCountEl.textContent = stats.streak;

    // Level & XP bar
    const lvlInfo = getLevelInfo(stats.ecoPoints);
    levelEl.textContent = `Lvl ${lvlInfo.level} - ${lvlInfo.title}`;
    
    const xpInCurrentLvl = stats.ecoPoints - lvlInfo.prevXp;
    const xpNeededForLvl = lvlInfo.nextXp - lvlInfo.prevXp;
    xpTextEl.textContent = `${stats.ecoPoints} / ${lvlInfo.nextXp} XP`;
    
    const progressPercent = Math.min(100, (xpInCurrentLvl / xpNeededForLvl) * 100);
    progressPercentEl.textContent = `${Math.round(progressPercent)}% to Level Up`;
    progressBarEl.style.width = `${progressPercent}%`;

    // Leaderboard updates
    const selfIdx = mockLeaderboard.findIndex(u => u.isSelf);
    if (selfIdx !== -1) {
      mockLeaderboard[selfIdx].score = stats.ecoPoints;
      mockLeaderboard[selfIdx].level = lvlInfo.title;
    }
    
    // Update Rank
    mockLeaderboard.sort((a, b) => b.score - a.score);
    const myRankIdx = mockLeaderboard.findIndex(u => u.isSelf);
    rankEl.textContent = `#${myRankIdx + 1}`;

    renderLeaderboard();
    renderBadges();
    renderChallenges();
    renderRecommendations();
    renderHeatmap();
    renderEcosystem(stats.ecoPoints);
    renderCommunityStats();
  };

  const renderLeaderboard = () => {
    leaderboardList.innerHTML = '';
    mockLeaderboard.forEach((user, idx) => {
      const row = document.createElement('div');
      
      // Rank design with podium border classes
      let podiumClass = '';
      let rankBadge = `#${idx + 1}`;
      if (idx === 0) {
        podiumClass = 'podium-1';
        rankBadge = '🥇';
      } else if (idx === 1) {
        podiumClass = 'podium-2';
        rankBadge = '🥈';
      } else if (idx === 2) {
        podiumClass = 'podium-3';
        rankBadge = '🥉';
      }

      row.className = `flex items-center justify-between p-3.5 rounded-2xl text-sm ${podiumClass} ${user.isSelf ? 'bg-emerald-500/20 border-emerald-500 text-white font-bold' : 'bg-white/[0.02] border border-white/5 text-gray-400'}`;
      row.innerHTML = `
        <span class="flex items-center gap-3">
          <span class="text-base">${rankBadge}</span>
          <span class="flex flex-col">
            <span class="${user.isSelf ? 'text-white' : 'text-gray-300'}">${user.name}</span>
            <span class="text-[10px] text-gray-500 font-semibold">${user.level}</span>
          </span>
        </span>
        <span class="font-extrabold text-white">${user.score} pts</span>
      `;
      leaderboardList.appendChild(row);
    });
  };

  const renderBadges = () => {
    badgesGrid.innerHTML = '';
    BADGES.forEach(badge => {
      const isUnlocked = stats.unlockedBadges.includes(badge.id);
      const card = document.createElement('div');
      card.className = `glass-card p-3 rounded-2xl flex flex-col items-center text-center transition-all ${isUnlocked ? 'border-emerald-500 bg-emerald-500/10' : 'opacity-30 filter grayscale'}`;
      card.innerHTML = `
        <span class="text-2xl mb-1">${badge.name.split(' ')[0]}</span>
        <span class="text-[10px] font-bold text-white leading-tight">${badge.name.split(' ').slice(1).join(' ')}</span>
        <span class="text-[8px] text-gray-400 mt-1 leading-tight block">${badge.desc.split(' (')[0]}</span>
      `;
      badgesGrid.appendChild(card);
    });
  };

  const renderChallenges = () => {
    challengesList.innerHTML = '';
    CHALLENGES.forEach(task => {
      const card = document.createElement('div');
      card.className = 'bg-white/[0.02] border border-white/5 p-3 rounded-2xl flex items-center justify-between gap-2 text-xs transition-all hover:bg-white/[0.04]';
      card.innerHTML = `
        <div class="flex flex-col gap-0.5">
          <span class="font-bold text-gray-200">${task.text}</span>
          <span class="text-[9px] text-emerald-400 font-semibold">+${task.xp} XP / Category: ${task.category}</span>
        </div>
        <button type="button" class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-[10px] font-bold text-white transition-all uppercase tracking-wider claim-challenge-btn" data-id="${task.id}" data-xp="${task.xp}">
          Claim
        </button>
      `;
      challengesList.appendChild(card);
    });

    // Add click listeners to claim buttons
    document.querySelectorAll('.claim-challenge-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const cId = e.currentTarget.getAttribute('data-id');
        const xpReward = parseInt(e.currentTarget.getAttribute('data-xp'), 10);
        
        // Trigger Confetti
        window.confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        
        stats.ecoPoints += xpReward;
        showToast(`Challenge Completed! +${xpReward} XP earned`, 'success');
        
        // Dynamic Streak calculation / logging simulation
        const today = new Date().toDateString();
        stats.lastLoggedDate = today;
        stats.streak = Math.max(1, stats.streak);

        // Remove/hide this challenge from list
        const idx = CHALLENGES.findIndex(c => c.id === cId);
        if (idx !== -1) {
          CHALLENGES.splice(idx, 1);
        }

        saveStats();
        renderDashboard();
      });
    });
  };

  const renderRecommendations = () => {
    recommendationsList.innerHTML = '';
    RECOMMENDATIONS.forEach(rec => {
      const card = document.createElement('div');
      card.className = 'bg-white/[0.02] border border-white/5 p-3.5 rounded-2xl text-xs space-y-2';
      card.innerHTML = `
        <div class="flex justify-between font-semibold">
          <span class="text-gray-400">Habit: <span class="text-red-400 strike-through line-through">${rec.habit}</span></span>
          <span class="text-emerald-400">Save: ${rec.co2}kg CO₂/mo</span>
        </div>
        <div class="flex justify-between items-center bg-black/30 p-2 rounded-lg">
          <span class="font-bold text-gray-200">👉 ${rec.suggest}</span>
          <button type="button" class="px-2.5 py-1 rounded bg-lime-600 hover:bg-lime-700 active:scale-95 text-[9px] font-bold text-white transition-all uppercase commit-rec-btn" data-xp="${rec.xp}">
            Commit
          </button>
        </div>
      `;
      recommendationsList.appendChild(card);
    });

    document.querySelectorAll('.commit-rec-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const xp = parseInt(e.currentTarget.getAttribute('data-xp'), 10);
        window.confetti({ particleCount: 60, spread: 50, origin: { y: 0.7 } });
        stats.ecoPoints += xp;
        showToast(`Habit Swap Committed! +${xp} XP`, 'success');
        saveStats();
        renderDashboard();
      });
    });
  };

  const renderHeatmap = () => {
    heatmapGrid.innerHTML = '';
    stats.commits.forEach(val => {
      const cell = document.createElement('div');
      // Set background shade based on commits count
      let bgClass = 'bg-[#151515]';
      if (val === 1) bgClass = 'bg-emerald-950';
      else if (val === 2) bgClass = 'bg-emerald-800';
      else if (val === 3) bgClass = 'bg-emerald-600';
      else if (val >= 4) bgClass = 'bg-emerald-400 shadow-[0_0_8px_#10b981]';
      
      cell.className = `heatmap-cell ${bgClass}`;
      heatmapGrid.appendChild(cell);
    });
  };

  // --- Chart.js Analytics Initializations ---
  let weeklyChart = null;
  let sourceChart = null;

  const initCharts = () => {
    // 1. Weekly Emission Bar Chart
    const ctxWeekly = document.getElementById('weeklyChart').getContext('2d');
    weeklyChart = new Chart(ctxWeekly, {
      type: 'bar',
      data: {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [{
          label: 'Emissions',
          data: [15, 22, 5, 8, 12, 4, stats.totalCo2Saved > 0 ? Math.round(stats.totalCo2Saved) : 2],
          backgroundColor: '#10b981',
          borderColor: '#10b981',
          borderWidth: 1,
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#9ca3af' } },
          y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af' } }
        }
      }
    });

    // 2. Source Breakdown Pie Chart
    const ctxSource = document.getElementById('sourceChart').getContext('2d');
    sourceChart = new Chart(ctxSource, {
      type: 'doughnut',
      data: {
        labels: ['Transport', 'Food', 'Energy', 'Water'],
        datasets: [{
          data: [
            stats.sources.Transport || 10,
            stats.sources.Food || 5,
            stats.sources.Energy || 5,
            stats.sources.Water || 2
          ],
          backgroundColor: ['#10b981', '#f59e0b', '#3b82f6', '#06b6d4'],
          borderColor: 'transparent'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { color: '#f3f4f6', boxWidth: 12, font: { size: 10 } } }
        },
        cutout: '65%'
      }
    });
  };

  const updateCharts = (category, value) => {
    if (!sourceChart || !weeklyChart) return;
    
    // Add to specific source category
    if (stats.sources[category] !== undefined) {
      stats.sources[category] += value;
    } else {
      // Mapping fallback for energy or home
      if (category.includes('Energy') || category.includes('AC')) {
        stats.sources.Energy += value;
      } else if (category.includes('Water')) {
        stats.sources.Water += value;
      }
    }

    sourceChart.data.datasets[0].data = [
      stats.sources.Transport || 10,
      stats.sources.Food || 5,
      stats.sources.Energy || 5,
      stats.sources.Water || 2
    ];
    sourceChart.update();

    // Increment weekly data (Sunday/today)
    const currentData = weeklyChart.data.datasets[0].data;
    currentData[currentData.length - 1] = Math.round(value + (currentData[currentData.length - 1] || 0));
    weeklyChart.update();
  };

  // --- Smart Activity Logging Logic ---
  const activityCards = document.querySelectorAll('.activity-card');
  const activityTypeSelect = document.getElementById('activityType');

  activityCards.forEach(card => {
    card.addEventListener('click', (e) => {
      // Remove selected class from all cards
      activityCards.forEach(c => c.classList.remove('selected'));
      
      const targetCard = e.currentTarget;
      targetCard.classList.add('selected');

      const activityVal = targetCard.getAttribute('data-activity');
      activityTypeSelect.value = activityVal;

      selectedLabel.textContent = `Configure ${activityVal}`;

      // Open details panel
      detailsPanel.classList.remove('hidden');
      void detailsPanel.offsetHeight; // Reflow

      // Customize inputs depending on selected activity
      const distanceInput = document.getElementById('distance');
      const distanceLabel = distanceInput.parentElement.querySelector('label');
      const unitSelect = document.getElementById('unit');

      if (activityVal === 'Eating a beef burger') {
        distanceLabel.textContent = 'Quantity (Burgers)';
        distanceInput.placeholder = 'e.g. 1';
        unitSelect.parentElement.classList.add('hidden');
      } else if (activityVal === 'Running AC' || activityVal === 'Home Energy') {
        distanceLabel.textContent = 'Usage (kWh/units)';
        distanceInput.placeholder = 'e.g. 5';
        unitSelect.parentElement.classList.add('hidden');
      } else if (activityVal === 'Water Usage') {
        distanceLabel.textContent = 'Volume (Liters)';
        distanceInput.placeholder = 'e.g. 100';
        unitSelect.parentElement.classList.add('hidden');
      } else {
        distanceLabel.textContent = 'Distance';
        distanceInput.placeholder = 'e.g. 10';
        unitSelect.parentElement.classList.remove('hidden');
      }
    });
  });

  // --- Badge Unlock Verifier ---
  const verifyBadges = () => {
    // 1. Sprout Badge (First Log)
    if (stats.totalLogged >= 1 && !stats.unlockedBadges.includes('first_step')) {
      stats.unlockedBadges.push('first_step');
      stats.ecoPoints += 30;
      showToast('Achievement Unlocked: 🌱 Green Sprout (+30 XP)', 'success');
      window.confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
    }
    // 2. Clean Commuter (Transit logs >= 3)
    if (stats.cleanCommutes >= 3 && !stats.unlockedBadges.includes('clean_commuter')) {
      stats.unlockedBadges.push('clean_commuter');
      stats.ecoPoints += 50;
      showToast('Achievement Unlocked: 🚴 Transit Hero (+50 XP)', 'success');
      window.confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    }
    // 3. Eco Eater (Food logs >= 3)
    if (stats.cleanEats >= 3 && !stats.unlockedBadges.includes('beef_free')) {
      stats.unlockedBadges.push('beef_free');
      stats.ecoPoints += 50;
      showToast('Achievement Unlocked: 🥗 Eco Eater (+50 XP)', 'success');
      window.confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    }
    // 4. Energy Saver
    if (stats.energySavings >= 3 && !stats.unlockedBadges.includes('energy_saver')) {
      stats.unlockedBadges.push('energy_saver');
      stats.ecoPoints += 40;
      showToast('Achievement Unlocked: ⚡ Watt Saver (+40 XP)', 'success');
      window.confetti({ particleCount: 80, spread: 65, origin: { y: 0.6 } });
    }
    // 5. Carbon Master (points >= 500)
    if (stats.ecoPoints >= 500 && !stats.unlockedBadges.includes('carbon_master')) {
      stats.unlockedBadges.push('carbon_master');
      stats.ecoPoints += 100;
      showToast('Achievement Unlocked: 🏆 Carbon Champion (+100 XP)', 'success');
      window.confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
    }
  };

  const updateStateOnLog = (activity, co2, status) => {
    stats.totalLogged += 1;

    // Categorize for charts
    let chartCat = 'Transport';
    if (activity === 'Eating a beef burger') {
      chartCat = 'Food';
      stats.cleanEats = (stats.cleanEats || 0) + 1;
    } else if (activity === 'Cycling' || activity === 'Walking') {
      chartCat = 'Transport';
      stats.cleanCommutes = (stats.cleanCommutes || 0) + 1;
    } else if (activity === 'Running AC' || activity === 'Home Energy') {
      chartCat = 'Energy';
      stats.energySavings = (stats.energySavings || 0) + 1;
    } else if (activity === 'Water Usage') {
      chartCat = 'Water';
    }

    // Accumulate total saved
    if (status === 'thriving') {
      stats.totalCo2Saved += 5.0; // Assume 5kg saved compared to default
      stats.ecoPoints += 25; // Good action award
    } else {
      stats.ecoPoints += 10; // Effort points
    }

    // Streak tracker
    const today = new Date().toDateString();
    if (stats.lastLoggedDate) {
      const lastDate = new Date(stats.lastLoggedDate);
      const diffTime = Math.abs(new Date(today) - lastDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) stats.streak += 1;
      else if (diffDays > 1) stats.streak = 1;
    } else {
      stats.streak = 1;
    }
    stats.lastLoggedDate = today;

    // Update heatmap commits
    if (stats.commits && stats.commits.length > 0) {
      const lastIdx = stats.commits.length - 1;
      stats.commits[lastIdx] = Math.min(4, stats.commits[lastIdx] + 1);
    }

    updateCharts(chartCat, co2);
    verifyBadges();
    saveStats();
    renderDashboard();
  };

  // --- API Endpoint: Impact Calculation ---
  const calculateImpact = async (data) => {
    // SessionStorage Cache
    const cacheKey = `carbon2_${data.activityType.replace(/\s+/g, '')}_${data.duration}_${data.distance}_${data.unit}`;
    const cachedData = sessionStorage.getItem(cacheKey);

    if (cachedData) {
      console.log('Using cached analytics:', cacheKey);
      const parsedResult = JSON.parse(cachedData);
      displayResults(parsedResult, false);
      updateStateOnLog(data.activityType, parsedResult.raw_co2_kg, parsedResult.environmental_impact_status);
      return;
    }

    try {
      toggleLoadingState(true);

      const response = await fetch('/api/carbon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const result = await response.json();
      
      if (!response.ok && response.status !== 206) {
        throw new Error(result.error || 'Failed to calculate impact.');
      }

      sessionStorage.setItem(cacheKey, JSON.stringify(result));
      
      displayResults(result, response.status === 206);
      updateStateOnLog(data.activityType, result.raw_co2_kg, result.environmental_impact_status);

    } catch (error) {
      console.error(error);
      showToast('API communication failed. Logged fallback calculations.', 'error');
      
      // Resilient local estimation in case of offline / key error
      const mockResult = {
        raw_co2_kg: data.activityType === 'Driving a petrol car' ? 12.0 : 0.2,
        contextual_nudge: 'Fallback estimation used. Switching to cleaner commutes makes the world green.',
        environmental_impact_status: data.activityType === 'Driving a petrol car' ? 'degrading' : 'thriving'
      };
      displayResults(mockResult, true);
      updateStateOnLog(data.activityType, mockResult.raw_co2_kg, mockResult.environmental_impact_status);
    } finally {
      toggleLoadingState(false);
    }
  };

  const displayResults = (result, isFallback) => {
    co2Value.textContent = result.raw_co2_kg;
    const cleanNudge = escapeHtml(result.contextual_nudge || '');
    let nudge = `"${cleanNudge}"`;
    if (isFallback) {
      nudge += ' <span class="block mt-2 text-xs text-lime-400 font-bold">Fallback active</span>';
    }
    nudgeText.innerHTML = nudge;

    // Show panel
    resultsCard.classList.remove('hidden');
    void resultsCard.offsetWidth;
    resultsCard.classList.add('opacity-100');
  };

  const toggleLoadingState = (isLoading) => {
    if (isLoading) {
      submitBtn.disabled = true;
      btnText.innerHTML = '<span class="loader"></span> Saving...';
    } else {
      submitBtn.disabled = false;
      btnText.textContent = 'Log Eco Action & Recalculate';
    }
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = {
      activityType: activityTypeSelect.value,
      duration: parseFloat(document.getElementById('duration').value) || 0,
      distance: parseFloat(document.getElementById('distance').value) || 0,
      unit: document.getElementById('unit').value
    };
    calculateImpact(data);
  });

  // --- AI Carbon Coach Chat Submission ---
  coachForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = coachInput.value.trim();
    if (!msg) return;

    // Append User message
    const userBubble = document.createElement('div');
    userBubble.className = 'self-end bg-emerald-600 text-white max-w-[85%] p-3.5 rounded-2xl rounded-tr-none leading-relaxed';
    userBubble.textContent = msg;
    coachMessages.appendChild(userBubble);
    coachMessages.scrollTop = coachMessages.scrollHeight;

    coachInput.value = '';

    // Append Typing indicator
    const typingBubble = document.createElement('div');
    typingBubble.className = 'self-start bg-white/[0.04] text-gray-400 max-w-[85%] p-3.5 rounded-2xl rounded-tl-none italic';
    typingBubble.innerHTML = '<span class="loader"></span> Coach is thinking...';
    coachMessages.appendChild(typingBubble);
    coachMessages.scrollTop = coachMessages.scrollHeight;

    try {
      const response = await fetch('/api/carbon/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg })
      });
      const data = await response.json();
      
      typingBubble.remove();

      // Render markdown response safely
      const replyBubble = document.createElement('div');
      replyBubble.className = 'self-start bg-white/[0.04] text-gray-300 max-w-[85%] p-3.5 rounded-2xl rounded-tl-none leading-relaxed';
      
      // Simplistic markdown parse after safe escaping
      const text = data.response || "That's an interesting question! Swapping private trips with cycling saves around 2.4kg of CO2 per trip.";
      let safeText = escapeHtml(text);
      safeText = safeText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      safeText = safeText.replace(/\*(.*?)\*/g, '<em>$1</em>');
      replyBubble.innerHTML = safeText;

      coachMessages.appendChild(replyBubble);
      coachMessages.scrollTop = coachMessages.scrollHeight;

    } catch (error) {
      console.error(error);
      typingBubble.remove();

      const errorBubble = document.createElement('div');
      errorBubble.className = 'self-start bg-white/[0.04] text-red-400 max-w-[85%] p-3.5 rounded-2xl rounded-tl-none';
      errorBubble.textContent = 'Failed to connect with Coach. Swapping to public transit is always a great advice!';
      coachMessages.appendChild(errorBubble);
    }
  });

  // --- Web Speech API Voice Dictation ---
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let isListening = false;

  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      isListening = true;
      voiceStatus.classList.remove('hidden');
      micBtn.classList.add('bg-red-900', 'border-red-500');
    };

    recognition.onend = () => {
      isListening = false;
      voiceStatus.classList.add('hidden');
      micBtn.classList.remove('bg-red-900', 'border-red-500');
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.toLowerCase();
      showToast(`Heard: "${transcript}"`, 'success');
      
      // Prefill activity fields based on spoken words
      parseVoiceInput(transcript);
    };
  }

  const parseVoiceInput = (text) => {
    let act = '';
    if (text.includes('car') || text.includes('drive')) act = 'Driving a petrol car';
    else if (text.includes('bus') || text.includes('transit')) act = 'Taking a bus';
    else if (text.includes('burger') || text.includes('beef') || text.includes('burger')) act = 'Eating a beef burger';
    else if (text.includes('ac') || text.includes('conditioning')) act = 'Running AC';
    else if (text.includes('cycle') || text.includes('cycling') || text.includes('bike')) act = 'Cycling';
    else if (text.includes('walk') || text.includes('walking')) act = 'Walking';
    else if (text.includes('energy') || text.includes('home') || text.includes('heating')) act = 'Home Energy';
    else if (text.includes('water') || text.includes('shower')) act = 'Water Usage';

    if (act) {
      // Find matching card and trigger click
      const card = Array.from(activityCards).find(c => c.getAttribute('data-activity') === act);
      if (card) card.click();
    }

    const numbers = text.match(/\d+/g);
    if (numbers) {
      if (numbers.length >= 1) {
        document.getElementById('duration').value = parseInt(numbers[0], 10);
      }
      if (numbers.length >= 2) {
        document.getElementById('distance').value = parseInt(numbers[1], 10);
      }
    }
    showToast('Form pre-filled. Review values and click log!', 'success');
  };

  micBtn.addEventListener('click', () => {
    if (!recognition) {
      showToast('Speech recognition is not supported on this browser.', 'error');
      return;
    }
    if (isListening) recognition.stop();
    else recognition.start();
  });

  // --- Web Speech TTS: Speak nudge ---
  speakBtn.addEventListener('click', () => {
    if (!window.speechSynthesis) {
      showToast('Speech synthesis not supported.', 'error');
      return;
    }
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      return;
    }
    const txt = `Your carbon footprint is ${co2Value.textContent} kilograms. Context: ${nudgeText.innerText}`;
    const utterance = new SpeechSynthesisUtterance(txt);
    window.speechSynthesis.speak(utterance);
    showToast('Speaking assessment...', 'success');
  });

  // --- Share statistics to clipboard ---
  shareBtn.addEventListener('click', () => {
    const lvlInfo = getLevelInfo(stats.ecoPoints);
    const text = `🌍 Carbon Reduction Ecosystem 2.0 🌿\n• My Eco-Score: ${stats.ecoPoints} XP (Level ${lvlInfo.level})\n• Streak: ${stats.streak} Days Green 🔥\n• Carbon Saved: ${stats.totalCo2Saved.toFixed(1)} kg CO₂\n👉 Join me in planting virtual forests and saving the planet!`;
    navigator.clipboard.writeText(text).then(() => {
      showToast('Stats copied to clipboard!', 'success');
    });
  });

  // --- Carbon Offset Marketplace Logic ---
  let communityTrees = parseInt(localStorage.getItem('community_trees_val')) || 1240;
  let communitySaved = parseInt(localStorage.getItem('community_saved_val')) || 4821;

  const renderCommunityStats = () => {
    const treesEl = document.getElementById('community-trees');
    const savedEl = document.getElementById('community-saved');
    if (treesEl) treesEl.textContent = `🌳 ${communityTrees.toLocaleString()} Trees Planted`;
    if (savedEl) savedEl.textContent = `🌍 ${communitySaved.toLocaleString()} kg`;
  };

  const initMarketplace = () => {
    document.querySelectorAll('.redeem-offset-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const cost = parseInt(e.currentTarget.getAttribute('data-cost'), 10);
        const item = e.currentTarget.getAttribute('data-item');

        if (stats.ecoPoints < cost) {
          showToast(`Insufficient Eco Points! You need ${cost - stats.ecoPoints} more XP to redeem this.`, 'error');
          return;
        }

        // Deduct points
        stats.ecoPoints -= cost;
        
        // Trigger Confetti
        window.confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });

        // Update community stats
        if (item === 'sapling') {
          communityTrees += 1;
          localStorage.setItem('community_trees_val', communityTrees);
          showToast('Success! 1 real sapling sponsored to GreenBhopal NGO. 🌳', 'success');
        } else {
          communitySaved += 10;
          localStorage.setItem('community_saved_val', communitySaved);
          showToast('Success! 10kg Carbon Removal certificate purchased. 🌍', 'success');
        }

        saveStats();
        renderDashboard();
      });
    });
  };

  // --- Toast messages helper ---
  const showToast = (message, type = 'success') => {
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'toast-error' : ''}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    void toast.offsetWidth;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
      toast.addEventListener('transitionend', () => toast.remove());
    }, 4000);
  };

  // --- Initialize Platform ---
  initCharts();
  renderDashboard();
  initMarketplace();
  renderCommunityStats();
});
