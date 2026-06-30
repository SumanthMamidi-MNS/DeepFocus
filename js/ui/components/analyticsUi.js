/**
 * Deep Focus v2.0 - Analytics and Chart UI Component
 */

import store from '../../state/store.js';
import { getAllSessions } from '../../state/db.js';
import { getRecommendation } from '../../intelligence/recommender.js';

export function initAnalyticsUi() {
  const chartContainer = document.getElementById('analytics-chart');
  const totalMinutesEl = document.getElementById('stat-total-minutes');
  const successRateEl = document.getElementById('stat-success-rate');
  const streakEl = document.getElementById('stat-streak');
  const pulseScoreEl = document.getElementById('pulse-score');
  const pulseTextEl = document.getElementById('pulse-text');
  const recommendationEl = document.getElementById('recommendation-text');

  // Trigger metrics compilation
  loadAndCompileMetrics();

  // Listen to session completion events
  window.addEventListener('session-logged', loadAndCompileMetrics);

  function loadAndCompileMetrics() {
    getAllSessions()
      .then((sessions) => {
        const metrics = compileMetrics(sessions);
        
        // Save to store
        store.setState('weeklyStats', metrics);

        // Update DOM elements
        if (totalMinutesEl) totalMinutesEl.textContent = `${metrics.todayMinutes}m`;
        if (successRateEl) successRateEl.textContent = `${metrics.successRate}%`;
        if (streakEl) {
          streakEl.textContent = `${metrics.streak} Day${metrics.streak !== 1 ? 's' : ''}`;
        }

        // Productivity Pulse Score (Target is 120 mins a day)
        const targetMinutes = 120;
        const pulseScore = Math.min(100, Math.round((metrics.todayMinutes / targetMinutes) * 100));
        if (pulseScoreEl) pulseScoreEl.textContent = `${pulseScore}%`;
        
        if (pulseTextEl) {
          if (pulseScore === 0) {
            pulseTextEl.textContent = 'Zen state waiting. Complete a session to begin.';
          } else if (pulseScore < 30) {
            pulseTextEl.textContent = 'Spark ignited. Keep building momentum.';
          } else if (pulseScore < 70) {
            pulseTextEl.textContent = 'Optimal rhythm. You are in your peak work window.';
          } else {
            pulseTextEl.textContent = 'Peak cognitive flow. Focus goal achieved today!';
          }
        }

        // Update recommendation text
        const { currentMood } = store.getState();
        const recommendation = getRecommendation(sessions, currentMood);
        store.setState('smartRecommendation', recommendation);
        if (recommendationEl) {
          recommendationEl.textContent = recommendation;
        }

        // Draw weekly chart
        drawWeeklyChart(metrics.weeklyMinutes);
      })
      .catch((err) => console.error('Metrics loading error:', err));
  }

  function compileMetrics(sessions) {
    const now = new Date();
    
    // 1. Calculate today's focus minutes
    const todayStart = new Date();
    todayStart.setHours(0,0,0,0);
    const todayTimestamp = todayStart.getTime();

    const todaySessions = sessions.filter(s => s.startTime >= todayTimestamp);
    const todayCompleted = todaySessions.filter(s => s.completed && s.type === 'focus');
    const todayMinutes = todayCompleted.reduce((acc, s) => acc + s.duration, 0);

    // 2. Success rate (completed focus blocks / total started focus blocks)
    const focusSessions = sessions.filter(s => s.type === 'focus');
    const completedFocus = focusSessions.filter(s => s.completed);
    const successRate = focusSessions.length > 0
      ? Math.round((completedFocus.length / focusSessions.length) * 100)
      : 100;

    // 3. Weekly focus minutes distribution (Mon-Sun)
    // Find start of current week (Monday)
    const currentDay = now.getDay(); // 0 = Sun, 1 = Mon, etc.
    const distanceToMon = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(now);
    monday.setDate(now.getDate() + distanceToMon);
    monday.setHours(0,0,0,0);
    const startOfWeek = monday.getTime();

    const weeklyMinutes = [0, 0, 0, 0, 0, 0, 0]; // Mon-Sun index

    sessions.forEach((s) => {
      if (s.startTime >= startOfWeek && s.type === 'focus' && s.completed) {
        const dateObj = new Date(s.startTime);
        const dayIdx = dateObj.getDay() === 0 ? 6 : dateObj.getDay() - 1; // Map Sun(0) to index 6, Mon(1) to 0
        weeklyMinutes[dayIdx] += s.duration;
      }
    });

    // 4. Streak calculation
    const streak = calculateFocusStreak(sessions);

    return {
      todayMinutes,
      successRate,
      weeklyMinutes,
      streak
    };
  }

  function calculateFocusStreak(sessions) {
    if (sessions.length === 0) return 0;

    // Filter successfully completed focus sessions
    const completedDays = new Set();
    sessions.forEach(s => {
      if (s.completed && s.type === 'focus') {
        const dayStr = new Date(s.startTime).toDateString(); // unique string per calendar day
        completedDays.add(dayStr);
      }
    });

    if (completedDays.size === 0) return 0;

    let streak = 0;
    const checkDate = new Date();
    checkDate.setHours(0,0,0,0);

    // Check if user completed a session today
    let activeDayStr = checkDate.toDateString();
    let hasLoggedActiveDay = completedDays.has(activeDayStr);

    if (!hasLoggedActiveDay) {
      // If not today, check yesterday to sustain streak
      checkDate.setDate(checkDate.getDate() - 1);
      activeDayStr = checkDate.toDateString();
      if (!completedDays.has(activeDayStr)) {
        return 0; // No focus logs today or yesterday = streak dead
      }
    }

    // Trace backwards day by day to count consecutive days active
    while (completedDays.has(activeDayStr)) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
      activeDayStr = checkDate.toDateString();
    }

    return streak;
  }

  function drawWeeklyChart(weeklyMinutes) {
    if (!chartContainer) return;

    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const maxMins = Math.max(30, ...weeklyMinutes); // Floor baseline scale at 30 minutes

    const svgWidth = 400;
    const svgHeight = 150;
    const padding = 25;
    const chartW = svgWidth - padding * 2;
    const chartH = svgHeight - padding * 2;

    const barWidth = 32;
    const spacing = (chartW - (barWidth * 7)) / 6;

    let barsSvgHtml = '';
    
    // Draw background horizontal gridlines (3 notches)
    for (let i = 0; i <= 3; i++) {
      const yVal = padding + (chartH / 3) * i;
      const labelMins = Math.round(maxMins - (maxMins / 3) * i);
      barsSvgHtml += `
        <line class="chart-grid-line" x1="${padding}" y1="${yVal}" x2="${svgWidth - padding}" y2="${yVal}" />
        <text class="chart-text" x="${padding - 4}" y="${yVal + 3}" text-anchor="end">${labelMins}m</text>
      `;
    }

    // Draw active bars
    weeklyMinutes.forEach((mins, idx) => {
      const barHeight = (mins / maxMins) * chartH;
      const x = padding + idx * (barWidth + spacing);
      const y = padding + chartH - barHeight;

      // Draw bars with CSS transition heights
      barsSvgHtml += `
        <g>
          <rect class="chart-bar" x="${x}" y="${y}" width="${barWidth}" height="${Math.max(2, barHeight)}" rx="4" ry="4">
            <title>${days[idx]}: ${mins} minutes focused</title>
          </rect>
          <text class="chart-text" x="${x + barWidth / 2}" y="${svgHeight - 6}" text-anchor="middle">${days[idx]}</text>
        </g>
      `;
    });

    chartContainer.innerHTML = `
      <svg viewBox="0 0 ${svgWidth} ${svgHeight}" width="100%" height="100%">
        ${barsSvgHtml}
        <line class="chart-axis-line" x1="${padding}" y1="${padding + chartH}" x2="${svgWidth - padding}" y2="${padding + chartH}" />
      </svg>
    `;
  }
}
