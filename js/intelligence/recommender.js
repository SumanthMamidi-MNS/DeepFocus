/**
 * Deep Focus v2.0 - Smart Intelligence Recommender
 */

export function getRecommendation(sessions = [], currentMood = null) {
  const now = new Date();
  const hour = now.getHours();

  // 1. Analyze today's performance
  const todayStart = new Date();
  todayStart.setHours(0,0,0,0);

  const todaySessions = sessions.filter(s => s.startTime >= todayStart.getTime());
  const completedToday = todaySessions.filter(s => s.completed && s.type === 'focus');
  const totalFocusMinutesToday = completedToday.reduce((acc, s) => acc + s.duration, 0);

  // 2. Base recommendations on current mood
  if (currentMood) {
    switch (currentMood) {
      case 'distracted':
        return "Distracted? Try the 'pomodoro burst': a 15-minute focus window with 'Zen Rain' and 'Keyboard' sound layers to anchor your attention.";
      case 'tired':
        return "Energy is low. We recommend a light 20-minute session combined with the soothing 'Ocean Cove' preset. Remember to take a break after.";
      case 'calm':
        return "A calm mind is fertile ground. Try a standard 25-minute session with the 'Warm Cabin' environment to sustain this state.";
      case 'focused':
        return "Excellent! You are in flow state. Push your limits with a 50-minute deep work block with minimal ambient sound.";
      case 'stressed':
        return "Stressed? Try a 10-minute break first. Or start a 20-minute focus session with 'Waves' volume turned up for somatic breathing.";
      default:
        break;
    }
  }

  // 3. Time-of-day based suggestions
  if (hour >= 5 && hour < 10) {
    return "A fresh morning focus. Start your day with a structured 45-minute focus session and the active 'Cafe Writer' preset.";
  }
  if (hour >= 22 || hour < 4) {
    return "Working late? Protect your sleep cycle. Try a gentle 20-minute session with 'Nordic Frost' and dim your screen.";
  }

  // 4. Performance based suggestions
  if (totalFocusMinutesToday > 120) {
    return "Outstanding! You've focused for over 2 hours today. Be sure to take longer breaks to prevent mental fatigue.";
  }

  if (todaySessions.length > 2 && completedToday.length === 0) {
    return "Struggling to finish cycles? Let's reduce friction. Try setting the timer to just 10 minutes to build momentum.";
  }

  // Default fallbacks (10 meaningful productivity recommendations)
  const tips = [
    "To protect your circadian rhythm, avoid high-intensity screen exposure late at night and use dim warm light presets.",
    "Binaural beats (10Hz Alpha Waves) can enhance alert relaxation. Try listening to them with stereo headphones.",
    "Struggling to build focus momentum? Start with a tiny 10-minute session—reducing friction helps overcome procrastination.",
    "Keep a physical notepad next to you. If a distracting thought occurs, jot it down to review later, then return to your work.",
    "Acknowledge distractions when they happen. Using the 'Log Distraction' button helps build meta-awareness of your attention drifts.",
    "Complete at least one focus block daily to maintain your productivity streak and reinforce your habits.",
    "The 528Hz Solfeggio frequency has been shown to promote stress relief and somatic grounding. Try blending it with rain.",
    "Boost middle-high frequencies (1kHz–4kHz) in the EQ to increase clarity of forest wind, helping block out office chatter.",
    "A standard 25-minute Pomodoro block followed by a 5-minute break is optimal for keeping baseline focus high without fatigue.",
    "Perform a quick reflection journal entry after each block. Writing down how you felt helps lock in progress."
  ];

  const randomIndex = Math.floor(Math.random() * tips.length);
  return tips[randomIndex];
}
