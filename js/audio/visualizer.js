/**
 * Deep Focus v2.0 - Canvas Audio Visualizer
 */

import store from '../state/store.js';
import { getAnalyserNode } from './synth.js';

let canvas = null;
let ctx = null;
let animationFrameId = null;
let dataArray = null;
let isVisualizerRunning = false;

// Mouse coordinates for G.O.A.T. particle interaction
let mouseX = null;
let mouseY = null;

// Particle class for bubbles and cosmic fields
class Particle {
  constructor(w, h) {
    this.x = Math.random() * w;
    this.y = Math.random() * h;
    this.size = Math.random() * 5 + 1.5;
    this.speedX = Math.random() * 0.4 - 0.2;
    this.speedY = -(Math.random() * 0.3 + 0.1);
    this.alpha = Math.random() * 0.6 + 0.1;
    this.baseAlpha = this.alpha;
  }

  update(w, h, energy, mode) {
    this.x += this.speedX * (1 + energy * 2.5);
    this.y += this.speedY * (1 + energy * 2.0);

    // Mouse attraction/repulsion in Cosmic Mode
    if (mode === 'particles' && mouseX !== null && mouseY !== null) {
      const dx = mouseX - this.x;
      const dy = mouseY - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 120) {
        // Slow gravity pull towards cursor
        const force = (120 - dist) / 120;
        this.x += (dx / dist) * force * 1.5;
        this.y += (dy / dist) * force * 1.5;
        this.alpha = Math.min(1.0, this.baseAlpha + force * 0.5);
      } else {
        this.alpha = this.baseAlpha;
      }
    } else {
      this.alpha = this.baseAlpha;
    }

    // Reset if it goes off screen
    if (this.y < -10) {
      this.y = h + 10;
      this.x = Math.random() * w;
    }
    if (this.x < -10 || this.x > w + 10) {
      this.x = Math.random() * w;
    }
  }

  draw(context, color) {
    context.save();
    context.globalAlpha = this.alpha;
    context.fillStyle = color;
    context.beginPath();
    context.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }
}

const particles = [];
const particleCount = 45; // Increased density for cosmic mode

export function initVisualizer(canvasElement) {
  if (!canvasElement) return;

  canvas = canvasElement;
  ctx = canvas.getContext('2d');

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // G.O.A.T. Mouse event bindings on visualizer canvas
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    // Account for display scaling
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    mouseX = (e.clientX - rect.left) * scaleX;
    mouseY = (e.clientY - rect.top) * scaleY;
  });

  canvas.addEventListener('mouseleave', () => {
    mouseX = null;
    mouseY = null;
  });

  // Initialize particle swarm
  particles.length = 0;
  for (let i = 0; i < particleCount; i++) {
    particles.push(new Particle(canvas.width, canvas.height));
  }

  startVisualizerLoop();
}

function resizeCanvas() {
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * (window.devicePixelRatio || 1);
  canvas.height = rect.height * (window.devicePixelRatio || 1);
}

export function startVisualizerLoop() {
  if (isVisualizerRunning) return;
  isVisualizerRunning = true;
  draw();
}

export function stopVisualizerLoop() {
  isVisualizerRunning = false;
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

function draw() {
  if (!isVisualizerRunning || !canvas || !ctx) return;

  animationFrameId = requestAnimationFrame(draw);

  const w = canvas.width;
  const h = canvas.height;
  const analyser = getAnalyserNode();

  const computedStyle = getComputedStyle(document.body);
  const accentColor = computedStyle.getPropertyValue('--accent').trim() || '#818cf8';
  const secondaryColor = computedStyle.getPropertyValue('--accent-secondary').trim() || '#a78bfa';

  // Get active visualizer mode from settings store
  const { settings } = store.getState();
  const visMode = settings.visualizerMode || 'aurora';

  // 1. Semi-transparent background clear for motion blur trail
  ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
  ctx.fillRect(0, 0, w, h);

  if (!analyser) {
    drawFlatLine(w, h, accentColor, visMode);
    return;
  }

  // Get Frequency domain data
  const bufferLength = analyser.frequencyBinCount;
  if (!dataArray || dataArray.length !== bufferLength) {
    dataArray = new Uint8Array(bufferLength);
  }
  analyser.getByteFrequencyData(dataArray);

  // Compute energy levels (low / mid / high frequency bands)
  let lowEnergy = 0;
  let midEnergy = 0;
  let highEnergy = 0;

  for (let i = 0; i < 10; i++) lowEnergy += dataArray[i];
  for (let i = 10; i < 50; i++) midEnergy += dataArray[i];
  for (let i = 50; i < bufferLength; i++) highEnergy += dataArray[i];

  lowEnergy = (lowEnergy / 10) / 255;
  midEnergy = (midEnergy / 40) / 255;
  highEnergy = (highEnergy / (bufferLength - 50)) / 255;
  const overallEnergy = (lowEnergy + midEnergy + highEnergy) / 3;

  // Render modes
  if (visMode === 'particles') {
    // MODE 1: Cosmic Particle Field
    // Particles act as the visual focus in this mode, drifting and enlarging based on lowEnergy/bass
    particles.forEach(p => {
      p.update(w, h, lowEnergy, visMode);
      // Grow particles based on sound volume
      const originalSize = p.size;
      p.size = originalSize * (1 + lowEnergy * 0.8);
      p.draw(ctx, accentColor);
      p.size = originalSize; // restore original scale
    });

    // Draw secondary soft orbital rings at mouse cursor
    if (mouseX !== null && mouseY !== null) {
      ctx.save();
      ctx.globalAlpha = 0.1 + overallEnergy * 0.15;
      ctx.strokeStyle = secondaryColor;
      ctx.lineWidth = 1;
      ctx.shadowBlur = 10;
      ctx.shadowColor = secondaryColor;
      
      ctx.beginPath();
      ctx.arc(mouseX, mouseY, 30 + overallEnergy * 40, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  } 
  else if (visMode === 'spectrum') {
    // MODE 2: Retro Spectrum Glassmorphic Bars
    // Draw particles softly in the background first
    particles.forEach(p => {
      p.update(w, h, lowEnergy * 0.5, visMode);
      p.draw(ctx, 'rgba(255,255,255,0.05)');
    });

    const barCount = 18;
    const barWidth = (w / barCount) * 0.7;
    const barSpacing = (w / barCount) * 0.3;
    const dataMultiplier = bufferLength * 0.5 / barCount; // map buffer bins to bars

    ctx.save();
    ctx.shadowBlur = 12;
    ctx.shadowColor = accentColor;

    for (let i = 0; i < barCount; i++) {
      // Find average value of mapping bin
      let sum = 0;
      const startBin = Math.floor(i * dataMultiplier);
      const endBin = Math.floor((i + 1) * dataMultiplier);
      for (let j = startBin; j < endBin; j++) {
        sum += dataArray[j] || 0;
      }
      const val = (sum / (endBin - startBin)) / 255.0;
      const barHeight = Math.max(8, val * (h * 0.75));

      const x = i * (barWidth + barSpacing) + barSpacing / 2;
      const y = h - barHeight;

      // Draw glass bar with accent gradient
      const grad = ctx.createLinearGradient(x, y, x, h);
      grad.addColorStop(0, accentColor);
      grad.addColorStop(1, secondaryColor);
      
      ctx.fillStyle = grad;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, [4, 4, 0, 0]);
      ctx.fill();
    }
    ctx.restore();
  } 
  else {
    // MODE 3: Aurora Waveform (Default)
    // Draw background particles
    particles.forEach(p => {
      p.update(w, h, lowEnergy, visMode);
      p.draw(ctx, secondaryColor);
    });

    ctx.save();
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2.5 + overallEnergy * 3;
    ctx.shadowBlur = 10 + overallEnergy * 15;
    ctx.shadowColor = accentColor;
    ctx.beginPath();

    const sliceWidth = w / (bufferLength * 0.6);
    let x = 0;

    for (let i = 0; i < bufferLength * 0.6; i++) {
      const value = dataArray[i] / 255.0;
      const y = h / 2 + (value * (h * 0.42) * Math.sin(i * 0.18 + Date.now() * 0.0025));

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      x += sliceWidth;
    }

    ctx.lineTo(w, h / 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawFlatLine(w, h, color, mode) {
  if (mode === 'particles') {
    // Draw slow drift particle canvas even if silent
    particles.forEach(p => {
      p.update(w, h, 0, mode);
      p.draw(ctx, color);
    });
    return;
  }

  if (mode === 'spectrum') {
    // Draw very short baseline spectrum bars
    const barCount = 18;
    const barWidth = (w / barCount) * 0.7;
    const barSpacing = (w / barCount) * 0.3;
    
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.25;
    for (let i = 0; i < barCount; i++) {
      const x = i * (barWidth + barSpacing) + barSpacing / 2;
      const idleHeight = 6 + Math.sin(i * 0.5 + Date.now() * 0.002) * 3;
      ctx.beginPath();
      ctx.roundRect(x, h - idleHeight, barWidth, idleHeight, [2, 2, 0, 0]);
      ctx.fill();
    }
    return;
  }

  // Draw flat line for Aurora wave
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  
  const points = 40;
  const sliceWidth = w / points;
  let x = 0;

  for (let i = 0; i <= points; i++) {
    const y = h / 2 + Math.sin(i * 0.2 + Date.now() * 0.0015) * 4;
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
    x += sliceWidth;
  }
  ctx.stroke();
}
