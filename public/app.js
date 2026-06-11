document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('activity-form');
  const resultsCard = document.getElementById('results-card');
  const co2Value = document.getElementById('co2-value');
  const nudgeText = document.getElementById('contextual-nudge');
  const livingWorld = document.querySelector('.living-world');
  const submitBtn = form.querySelector('button[type="submit"]');
  const btnText = submitBtn.querySelector('.btn-text');
  const toastContainer = document.getElementById('toast-container');

  // Voice & Social buttons
  const micBtn = document.getElementById('mic-btn');
  const voiceStatus = document.getElementById('voice-status');
  const speakBtn = document.getElementById('speak-btn');
  const shareBtn = document.getElementById('share-btn');

  // Gamification & Leaderboard DOM
  const ecoScoreEl = document.getElementById('eco-score');
  const streakCountEl = document.getElementById('streak-count');
  const activeTitleEl = document.getElementById('active-title');
  const badgesGrid = document.getElementById('badges-grid');
  const leaderboardList = document.getElementById('leaderboard-list');

  // --- Toast Notification System ---
  const showToast = (message, type = 'success') => {
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'toast-error' : ''}`;
    toast.textContent = message;
    
    toastContainer.appendChild(toast);
    
    // Trigger reflow to ensure transition works
    void toast.offsetWidth;
    toast.classList.add('show');

    setTimeout(() => {
      toast.classList.remove('show');
      toast.addEventListener('transitionend', () => toast.remove());
    }, 5000);
  };

  // --- Local State Management (Gamification / Stats) ---
  const defaultStats = {
    ecoScore: 100,
    streak: 0,
    lastLoggedDate: null,
    totalLogged: 0,
    cleanCommutes: 0,
    cleanEats: 0,
    unlockedBadges: []
  };

  let stats = JSON.parse(localStorage.getItem('carbon_user_stats')) || defaultStats;

  // Badges Definitions
  const BADGES = [
    { id: 'first_step', name: '🌱 Green Start', desc: 'Logged your first activity' },
    { id: 'clean_commuter', name: '🚴 Transit Hero', desc: 'Rode a cycle or took a bus' },
    { id: 'beef_free', name: '🥗 Eco Eater', desc: 'Ate a non-beef option' },
    { id: 'carbon_master', name: '🏆 Carbon Champion', desc: 'Reached a perfect 100 Eco-Score' }
  ];

  // Leaderboard Mock Database
  const mockLeaderboard = [
    { name: 'Yash (You)', score: 100, isSelf: true },
    { name: 'Aarav (Eco Warrior)', score: 92, isSelf: false },
    { name: 'Diya (Forest Guardian)', score: 85, isSelf: false },
    { name: 'Kabir (Planet Protector)', score: 72, isSelf: false },
    { name: 'Meera (Novice Camper)', score: 48, isSelf: false }
  ];

  // --- Initialize Gamification Interface ---
  const saveStats = () => {
    localStorage.setItem('carbon_user_stats', JSON.stringify(stats));
  };

  const calculateTitle = (score) => {
    if (score >= 95) return 'Carbon Champion';
    if (score >= 80) return 'Eco Guardian';
    if (score >= 60) return 'Forest Protector';
    if (score >= 40) return 'Carbon Novice';
    return 'CO2 Polluter';
  };

  const renderGamification = () => {
    ecoScoreEl.textContent = stats.ecoScore;
    streakCountEl.innerHTML = `${stats.streak} <span class="text-xl" aria-hidden="true">🌿</span>`;
    
    const title = calculateTitle(stats.ecoScore);
    activeTitleEl.textContent = title;
    
    // Update active user in leaderboard array
    const userIndex = mockLeaderboard.findIndex(item => item.isSelf);
    if (userIndex !== -1) {
      mockLeaderboard[userIndex].score = stats.ecoScore;
    }
    
    renderLeaderboard();
    renderBadges();
  };

  const renderLeaderboard = () => {
    // Sort leaderboard desc
    mockLeaderboard.sort((a, b) => b.score - a.score);
    
    leaderboardList.innerHTML = '';
    mockLeaderboard.forEach((user, idx) => {
      const row = document.createElement('div');
      row.className = `flex items-center justify-between p-2.5 rounded text-sm ${user.isSelf ? 'bg-[var(--accent-forest)] font-bold text-[var(--text-main)]' : 'bg-[var(--bg-input)] border border-[var(--border-color)] text-[var(--text-muted)]'}`;
      row.innerHTML = `
        <span class="flex items-center gap-2">
          <span class="opacity-60">#${idx + 1}</span>
          <span>${user.name}</span>
        </span>
        <span class="font-semibold">${user.score} pts</span>
      `;
      leaderboardList.appendChild(row);
    });
  };

  const renderBadges = () => {
    badgesGrid.innerHTML = '';
    BADGES.forEach(badge => {
      const isUnlocked = stats.unlockedBadges.includes(badge.id);
      const card = document.createElement('div');
      card.className = `badge-card p-3 rounded flex flex-col items-center text-center ${isUnlocked ? 'unlocked' : 'locked'}`;
      card.innerHTML = `
        <span class="text-2xl mb-1">${badge.name.split(' ')[0]}</span>
        <span class="text-xs font-bold text-[var(--text-main)]">${badge.name.split(' ').slice(1).join(' ')}</span>
        <span class="text-[10px] text-[var(--text-muted)] mt-1 leading-tight">${badge.desc}</span>
      `;
      badgesGrid.appendChild(card);
    });
  };

  const updateGamificationStats = (activityType, co2, status) => {
    stats.totalLogged += 1;
    
    // 1. Calculate new Eco Score
    if (status === 'thriving') {
      stats.ecoScore = Math.min(100, stats.ecoScore + 8);
    } else {
      // High impact drops score proportionately
      const penalty = Math.round(co2 * 1.5) || 10;
      stats.ecoScore = Math.max(10, stats.ecoScore - penalty);
    }

    // 2. Track Streak
    const today = new Date().toDateString();
    if (stats.lastLoggedDate) {
      const lastDate = new Date(stats.lastLoggedDate);
      const diffTime = Math.abs(new Date(today) - lastDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        stats.streak += 1;
      } else if (diffDays > 1) {
        stats.streak = 1;
      }
    } else {
      stats.streak = 1;
    }
    stats.lastLoggedDate = today;

    // 3. Increment Category Milestones
    if (activityType === 'Cycling' || activityType === 'Taking a bus') {
      stats.cleanCommutes += 1;
    }
    if (activityType === 'Eating a beef burger' === false) {
      stats.cleanEats += 1;
    }

    // 4. Badge unlocking triggers
    if (!stats.unlockedBadges.includes('first_step')) {
      stats.unlockedBadges.push('first_step');
      showToast('New Badge Unlocked: 🌱 Green Start!', 'success');
    }
    if (stats.cleanCommutes >= 2 && !stats.unlockedBadges.includes('clean_commuter')) {
      stats.unlockedBadges.push('clean_commuter');
      showToast('New Badge Unlocked: 🚴 Transit Hero!', 'success');
    }
    if (activityType !== 'Eating a beef burger' && stats.cleanEats >= 3 && !stats.unlockedBadges.includes('beef_free')) {
      stats.unlockedBadges.push('beef_free');
      showToast('New Badge Unlocked: 🥗 Eco Eater!', 'success');
    }
    if (stats.ecoScore === 100 && !stats.unlockedBadges.includes('carbon_master')) {
      stats.unlockedBadges.push('carbon_master');
      showToast('New Badge Unlocked: 🏆 Carbon Champion!', 'success');
    }

    saveStats();
    renderGamification();
  };

  // --- Web Speech API: Speech-to-Text (Voice Dictation) ---
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let isListening = false;

  if (SpeechRecognition) {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    recognition.onstart = () => {
      isListening = true;
      voiceStatus.classList.remove('hidden');
      micBtn.classList.add('bg-red-900', 'border-red-600');
    };

    recognition.onend = () => {
      isListening = false;
      voiceStatus.classList.add('hidden');
      micBtn.classList.remove('bg-red-900', 'border-red-600');
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.toLowerCase();
      showToast(`Heard: "${transcript}"`, 'success');
      parseVoiceInput(transcript);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error', event.error);
      showToast(`Voice input error: ${event.error}`, 'error');
    };
  }

  const parseVoiceInput = (text) => {
    // 1. Parse Activity Type
    let detectedActivity = '';
    if (text.includes('car') || text.includes('petrol') || text.includes('drive') || text.includes('driving')) {
      detectedActivity = 'Driving a petrol car';
    } else if (text.includes('bus') || text.includes('transit')) {
      detectedActivity = 'Taking a bus';
    } else if (text.includes('burger') || text.includes('beef') || text.includes('meat') || text.includes('eat')) {
      detectedActivity = 'Eating a beef burger';
    } else if (text.includes('ac') || text.includes('condition') || text.includes('conditioning') || text.includes('cooling')) {
      detectedActivity = 'Running AC';
    } else if (text.includes('cycle') || text.includes('cycling') || text.includes('bike') || text.includes('riding')) {
      detectedActivity = 'Cycling';
    }

    if (detectedActivity) {
      document.getElementById('activityType').value = detectedActivity;
    }

    // 2. Parse Numbers (Duration/Distance)
    const numbers = text.match(/\d+/g);
    if (numbers) {
      if (numbers.length >= 1) {
        // Look for context clues
        if (text.includes('minute') || text.includes('min') || text.includes('hour') || text.includes('hr')) {
          let durationVal = parseInt(numbers[0], 10);
          if (text.includes('hour') || text.includes('hr')) durationVal *= 60;
          document.getElementById('duration').value = durationVal;
        } else {
          document.getElementById('duration').value = parseInt(numbers[0], 10);
        }
      }
      if (numbers.length >= 2) {
        document.getElementById('distance').value = parseInt(numbers[1], 10);
      } else if (text.includes('km') || text.includes('mile') || text.includes('km') || text.includes('distance')) {
        // If single number is close to distance units, map to distance
        const distWords = ['km', 'kilometer', 'kilometers', 'mile', 'miles'];
        const matchesDist = distWords.some(w => text.includes(w));
        if (matchesDist) {
          document.getElementById('distance').value = parseInt(numbers[0], 10);
          document.getElementById('duration').value = ''; // Reset duration guess
        }
      }
    }

    // 3. Parse Unit
    if (text.includes('mile') || text.includes('miles')) {
      document.getElementById('unit').value = 'miles';
    } else {
      document.getElementById('unit').value = 'km';
    }

    showToast('Form pre-filled via Voice Recognition. Press Calculate to check impact!', 'success');
  };

  micBtn.addEventListener('click', () => {
    if (!recognition) {
      showToast('Speech Recognition is not supported by your browser.', 'error');
      return;
    }
    if (isListening) {
      recognition.stop();
    } else {
      recognition.start();
    }
  });

  // --- Web Speech API: Text-to-Speech (Audio Synthesizer) ---
  let currentUtterance = null;

  speakBtn.addEventListener('click', () => {
    if (!window.speechSynthesis) {
      showToast('Text to Speech is not supported by your browser.', 'error');
      return;
    }

    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
      showToast('Audio paused', 'success');
      return;
    }

    const co2 = co2Value.textContent;
    const nudge = nudgeText.innerText;
    const voiceText = `Your calculated carbon footprint is ${co2} kilograms. Context: ${nudge}`;

    currentUtterance = new SpeechSynthesisUtterance(voiceText);
    currentUtterance.rate = 0.95;
    
    window.speechSynthesis.speak(currentUtterance);
    showToast('Speaking assessment...', 'success');
  });

  // --- Share Impact Details (Social Clipboard Card) ---
  shareBtn.addEventListener('click', () => {
    const title = activeTitleEl.textContent;
    const textToCopy = `🌍 Carbon Footprint Platform Assessment 🌿\n• My Eco-Score: ${stats.ecoScore}/100\n• Streak: ${stats.streak} Days Green 🔥\n• Active Title: ${title}\n• CO₂ Impact: ${co2Value.textContent} kg CO₂\n👉 Track your environmental impact & join the community!`;
    
    navigator.clipboard.writeText(textToCopy)
      .then(() => {
        showToast('Eco-Impact stats copied to clipboard! Share it with friends.', 'success');
      })
      .catch(err => {
        console.error('Copy error:', err);
        showToast('Failed to copy stats to clipboard.', 'error');
      });
  });

  // --- Modular UI State Management ---
  const toggleLoadingState = (isLoading) => {
    if (isLoading) {
      submitBtn.disabled = true;
      btnText.innerHTML = '<span class="loader"></span> Calculating...';
      submitBtn.setAttribute('aria-busy', 'true');
    } else {
      submitBtn.disabled = false;
      btnText.textContent = 'Calculate Impact';
      submitBtn.removeAttribute('aria-busy');
    }
  };

  const displayResults = (result, isFallback) => {
    co2Value.textContent = result.raw_co2_kg;
    
    let nudge = `"${result.contextual_nudge}"`;
    if (isFallback) {
      nudge += ' <span class="block mt-4 text-sm text-[var(--accent-forest)] font-bold">Note: Using fallback estimation.</span>';
      showToast('Calculated using fallback estimation', 'success');
    } else {
      showToast('Impact calculated successfully', 'success');
    }
    
    nudgeText.innerHTML = nudge;

    // Smooth reveal
    resultsCard.classList.remove('hidden');
    void resultsCard.offsetWidth; // Trigger reflow
    resultsCard.classList.add('opacity-100');

    updateVisualState(result.environmental_impact_status);
  };

  const updateVisualState = (status) => {
    if (status === 'degrading') {
      livingWorld.classList.remove('thriving');
      livingWorld.classList.add('degrading');
    } else {
      livingWorld.classList.remove('degrading');
      livingWorld.classList.add('thriving');
    }
  };

  // --- API Interaction & Client SessionStorage Caching ---
  const calculateImpact = async (data) => {
    // 1. SessionStorage Cache Check (Reduces token consumption and API load)
    const cacheKey = `carbon_${data.activityType.replace(/\s+/g, '')}_${data.duration}_${data.distance}_${data.unit}`;
    const cachedData = sessionStorage.getItem(cacheKey);

    if (cachedData) {
      console.log('Serving from local session cache:', cacheKey);
      const parsedResult = JSON.parse(cachedData);
      displayResults(parsedResult, false);
      updateGamificationStats(data.activityType, parsedResult.raw_co2_kg, parsedResult.environmental_impact_status);
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
        throw new Error(result.error || 'Failed to calculate impact. Invalid input parameters.');
      }

      // Save valid calculations to cache
      sessionStorage.setItem(cacheKey, JSON.stringify(result));
      
      displayResults(result, response.status === 206);
      updateGamificationStats(data.activityType, result.raw_co2_kg, result.environmental_impact_status);

    } catch (error) {
      console.error('API Error:', error);
      showToast(error.message || 'An unexpected error occurred. Please try again.', 'error');
      
      // Hide results if it was an error
      resultsCard.classList.remove('opacity-100');
      setTimeout(() => resultsCard.classList.add('hidden'), 300);
      updateVisualState('degrading');
    } finally {
      toggleLoadingState(false);
    }
  };

  // --- Event Listeners ---
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    
    // Parse numeric fields properly before sending
    const data = {
      activityType: formData.get('activityType'),
      duration: parseFloat(formData.get('duration')) || 0,
      distance: parseFloat(formData.get('distance')) || 0,
      unit: formData.get('unit')
    };

    calculateImpact(data);
  });

  // --- Initial Render ---
  renderGamification();
});
