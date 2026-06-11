document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('activity-form');
  const resultsCard = document.getElementById('results-card');
  const co2Value = document.getElementById('co2-value');
  const nudgeText = document.getElementById('contextual-nudge');
  const livingWorld = document.querySelector('.living-world');
  const submitBtn = form.querySelector('button[type="submit"]');
  const btnText = submitBtn.querySelector('.btn-text');
  const toastContainer = document.getElementById('toast-container');

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

  // --- API Interaction ---
  const calculateImpact = async (data) => {
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

      displayResults(result, response.status === 206);

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
});
