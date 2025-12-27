import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Search, Sparkles, ArrowRight, X, Maximize2, Filter } from 'lucide-react';
import { Delaunay } from 'd3-delaunay';

// --- Types ---

interface Item {
  id: string;
  title: string;
  category: string;
  image: string;
  tags: string[];
}

interface Point {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number; // current radius
  targetR: number; // target radius based on relevance
  id: string;
}

interface Cell {
  path: string;
  item: Item;
  relevance: number;
  center: [number, number];
}

// --- Mock Data ---

const MOCK_ITEMS: Item[] = [
  { id: '1', title: 'Neon Tokyo', category: 'Cyberpunk', tags: ['city', 'night', 'lights', 'neon'], image: 'https://images.unsplash.com/photo-1540979388789-6cee28a1cdc9?q=80&w=1000&auto=format&fit=crop' },
  { id: '2', title: 'Alpine Solitude', category: 'Nature', tags: ['mountain', 'snow', 'winter', 'peace'], image: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=1000&auto=format&fit=crop' },
  { id: '3', title: 'Desert Mirage', category: 'Nature', tags: ['sand', 'heat', 'dry', 'orange'], image: 'https://images.unsplash.com/photo-1473580044384-7ba9967e16a0?q=80&w=1000&auto=format&fit=crop' },
  { id: '4', title: 'Deep Ocean', category: 'Abstract', tags: ['blue', 'water', 'dark', 'mystery'], image: 'https://images.unsplash.com/photo-1551244072-5d12893278ab?q=80&w=1000&auto=format&fit=crop' },
  { id: '5', title: 'Urban Jungle', category: 'Architecture', tags: ['building', 'green', 'city', 'modern'], image: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?q=80&w=1000&auto=format&fit=crop' },
  { id: '6', title: 'Cosmic Dust', category: 'Space', tags: ['stars', 'galaxy', 'purple', 'dust'], image: 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?q=80&w=1000&auto=format&fit=crop' },
  { id: '7', title: 'Glass Prism', category: 'Abstract', tags: ['light', 'refraction', 'color', 'shape'], image: 'https://images.unsplash.com/photo-1504198458649-3128b932f49e?q=80&w=1000&auto=format&fit=crop' },
  { id: '8', title: 'Forest Mist', category: 'Nature', tags: ['trees', 'fog', 'green', 'morning'], image: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=1000&auto=format&fit=crop' },
  { id: '9', title: 'Cyber Circuit', category: 'Tech', tags: ['computer', 'chip', 'data', 'future'], image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1000&auto=format&fit=crop' },
  { id: '10', title: 'Volcanic Ash', category: 'Nature', tags: ['fire', 'dark', 'smoke', 'power'], image: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?q=80&w=1000&auto=format&fit=crop' },
  { id: '11', title: 'Geometric Wall', category: 'Architecture', tags: ['pattern', 'white', 'shadow', 'minimal'], image: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?q=80&w=1000&auto=format&fit=crop' },
  { id: '12', title: 'Liquid Gold', category: 'Abstract', tags: ['yellow', 'fluid', 'shiny', 'metal'], image: 'https://images.unsplash.com/photo-1500462918059-b1a0cb512f1d?q=80&w=1000&auto=format&fit=crop' },
];

// --- Physics & Layout Constants ---

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 800;
const BASE_RADIUS = 60;
const MAX_RADIUS = 180;
const FRICTION = 0.9;
const STIFFNESS = 0.05;
const REPULSION = 1.5; // Multiplier for radius collision

// --- Helper Functions ---

const calculateRelevance = (query: string, item: Item): number => {
  if (!query) return 0.1; // Base relevance
  const q = query.toLowerCase();
  let score = 0;

  if (item.title.toLowerCase().includes(q)) score += 0.6;
  if (item.category.toLowerCase().includes(q)) score += 0.3;
  if (item.tags.some(t => t.toLowerCase().includes(q))) score += 0.2;
  
  // Exact match bonus
  if (item.title.toLowerCase() === q) score += 0.4;

  return Math.min(score, 1.0) || 0.05; // Minimum size to prevent disappearing
};

// --- Component ---

export default function VoronoiRelevanceGrid() {
  const [query, setQuery] = useState('');
  const [cells, setCells] = useState<Cell[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const pointsRef = useRef<Point[]>([]);
  const requestRef = useRef<number>();

  // Initialize Points
  useEffect(() => {
    pointsRef.current = MOCK_ITEMS.map((item) => ({
      x: Math.random() * CANVAS_WIDTH,
      y: Math.random() * CANVAS_HEIGHT,
      vx: 0,
      vy: 0,
      r: BASE_RADIUS,
      targetR: BASE_RADIUS,
      id: item.id,
    }));
  }, []);

  // Update Target Radii based on Search
  useEffect(() => {
    pointsRef.current.forEach(p => {
      const item = MOCK_ITEMS.find(i => i.id === p.id)!;
      const relevance = calculateRelevance(query, item);
      // Map relevance (0-1) to Radius (BASE - MAX)
      p.targetR = BASE_RADIUS + (MAX_RADIUS - BASE_RADIUS) * (relevance > 0.1 ? relevance : 0);
    });
  }, [query]);

  // Physics Simulation Loop
  const animate = useCallback(() => {
    const points = pointsRef.current;
    
    // 1. Physics Step
    points.forEach(p => {
      // Smoothly interpolate radius
      p.r += (p.targetR - p.r) * 0.1;

      // Gravity towards center (keeps cloud centered)
      const dx = CANVAS_WIDTH / 2 - p.x;
      const dy = CANVAS_HEIGHT / 2 - p.y;
      p.vx += dx * 0.001;
      p.vy += dy * 0.001;

      // Friction
      p.vx *= FRICTION;
      p.vy *= FRICTION;

      p.x += p.vx;
      p.y += p.vy;
    });

    // 2. Collision Resolution (Weighted Repulsion)
    // Simple iterative solver to push circles apart
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const p1 = points[i];
        const p2 = points[j];
        
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = (p1.r + p2.r) * 0.8; // Allow slight overlap for Voronoi tightness

        if (dist < minDist) {
          const force = (minDist - dist) * STIFFNESS;
          const angle = Math.atan2(dy, dx);
          const fx = Math.cos(angle) * force;
          const fy = Math.sin(angle) * force;

          // Push apart inversely proportional to mass (radius)? 
          // Actually, let's just push equally for stability.
          p1.x -= fx;
          p1.y -= fy;
          p2.x += fx;
          p2.y += fy;
        }
      }
    }

    // 3. Keep within bounds
    points.forEach(p => {
      p.x = Math.max(0, Math.min(CANVAS_WIDTH, p.x));
      p.y = Math.max(0, Math.min(CANVAS_HEIGHT, p.y));
    });

    // 4. Compute Voronoi
    // We use points [x, y] to generate the diagram
    const delaunay = Delaunay.from(points.map(p => [p.x, p.y]));
    const voronoi = delaunay.voronoi([0, 0, CANVAS_WIDTH, CANVAS_HEIGHT]);

    // 5. Generate Cell Data
    const newCells = points.map((p, i) => {
      const item = MOCK_ITEMS.find(it => it.id === p.id)!;
      const path = voronoi.renderCell(i);
      const relevance = (p.r - BASE_RADIUS) / (MAX_RADIUS - BASE_RADIUS);
      return {
        path,
        item,
        relevance,
        center: [p.x, p.y] as [number, number]
      };
    });

    setCells(newCells);
    requestRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [animate]);


  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans overflow-hidden relative selection:bg-pink-500 selection:text-white">
      {/* Background Gradients */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-900/30 rounded-full blur-[120px] mix-blend-screen animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-900/20 rounded-full blur-[120px] mix-blend-screen" />
        <div className="absolute top-[40%] left-[40%] w-[30%] h-[30%] bg-pink-900/20 rounded-full blur-[100px] mix-blend-screen" />
      </div>

      {/* Header / Search Interface */}
      <div className="relative z-50 flex flex-col items-center justify-center pt-12 pb-4 px-4">
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-2 bg-gradient-to-r from-white via-gray-200 to-gray-500 bg-clip-text text-transparent drop-shadow-sm">
            Voronoi Relevance Grid
          </h1>
          <p className="text-gray-400 text-sm md:text-base max-w-xl mx-auto">
            A fluid search interface where result visibility adapts organically to relevance.
          </p>
        </div>

        <div className="w-full max-w-2xl relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl blur opacity-20 group-hover:opacity-40 transition-opacity duration-500" />
          <div className="relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl flex items-center p-2 shadow-2xl ring-1 ring-white/10 group-focus-within:ring-white/30 transition-all">
            <Search className="w-6 h-6 text-gray-400 ml-3" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for 'Nature', 'Cyberpunk', 'Blue'..."
              className="w-full bg-transparent border-none outline-none text-white text-lg px-4 py-2 placeholder-gray-500"
              autoFocus
            />
            {query && (
              <button 
                onClick={() => setQuery('')}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            )}
            <div className="hidden md:flex items-center gap-2 px-3 border-l border-white/10 text-xs text-gray-500 font-medium uppercase tracking-wider">
              <Sparkles className="w-3 h-3" />
              <span>AI Powered</span>
            </div>
          </div>
        </div>
      </div>

      {/* Voronoi Canvas Container */}
      <div 
        ref={containerRef}
        className="relative w-full h-[800px] max-w-[1200px] mx-auto mt-4 transition-opacity duration-700 ease-in-out"
      >
        {cells.map((cell, index) => {
          // Determine visual prominence based on relevance
          const isHighRelevance = cell.relevance > 0.1;
          const zIndex = Math.floor(cell.relevance * 100);
          
          return (
            <div
              key={cell.item.id}
              className="absolute top-0 left-0 w-full h-full pointer-events-none"
              style={{ 
                clipPath: `path('${cell.path}')`,
                zIndex: zIndex,
                // Small optimization: only render if path is valid
                display: cell.path ? 'block' : 'none'
              }}
            >
              {/* 
                We use an inner container for the actual interaction and styling.
                Since the parent is clipped, this fills the clipped area.
              */}
              <div 
                className={`
                  relative w-full h-full pointer-events-auto cursor-pointer
                  transition-all duration-300 ease-out
                  group overflow-hidden
                `}
                onClick={() => console.log('Clicked', cell.item.title)}
              >
                {/* Image Background with Zoom Effect */}
                <div className="absolute inset-0 bg-gray-900">
                  <img 
                    src={cell.item.image} 
                    alt={cell.item.title}
                    className={`
                      w-full h-full object-cover opacity-60 group-hover:opacity-90 transition-opacity duration-500
                      ${isHighRelevance ? 'grayscale-0' : 'grayscale-[80%] group-hover:grayscale-0'}
                    `}
                    style={{
                      transform: `scale(${1 + cell.relevance * 0.2})`, // Slight subtle zoom based on relevance
                    }}
                  />
                  {/* Overlay Gradient */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80" />
                </div>

                {/* Glassmorphic Border/Highlight */}
                <div className="absolute inset-0 border-[1px] border-white/20 group-hover:border-white/50 transition-colors pointer-events-none" />

                {/* Content - Positioned relative to the cell center roughly */}
                {/* Since the div is full screen but clipped, we can try to center content near the cell center.
                    However, standard centering works if the clip path is centered. 
                    Better approach: Use the calculated center from Voronoi.
                */}
                <div 
                  className="absolute flex flex-col items-center justify-center text-center p-4 pointer-events-none"
                  style={{
                    left: cell.center[0],
                    top: cell.center[1],
                    transform: 'translate(-50%, -50%)',
                    width: '200px', // Constrain text width
                  }}
                >
                  <div className={`
                    transition-all duration-500 flex flex-col items-center gap-1
                    ${isHighRelevance ? 'opacity-100 translate-y-0 scale-100' : 'opacity-40 translate-y-2 scale-90 group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-100'}
                  `}>
                    <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-blue-300 mb-1 drop-shadow-md">
                      {cell.item.category}
                    </span>
                    <h2 className="text-xl md:text-2xl font-bold text-white leading-tight drop-shadow-lg font-display">
                      {cell.item.title}
                    </h2>
                    
                    {/* Relevance Indicator */}
                    {isHighRelevance && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-green-400 bg-green-900/30 px-2 py-0.5 rounded-full border border-green-500/30 backdrop-blur-md">
                        <Maximize2 className="w-3 h-3" />
                        <span>{(cell.relevance * 100).toFixed(0)}% Match</span>
                      </div>
                    )}

                    {/* Tags - Only visible on high relevance or hover */}
                    <div className="mt-3 flex flex-wrap justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      {cell.item.tags.slice(0, 2).map(tag => (
                        <span key={tag} className="text-[9px] bg-white/10 px-1.5 py-0.5 rounded text-gray-300">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Hover Action Icon */}
                <div 
                  className="absolute opacity-0 group-hover:opacity-100 transition-all duration-300"
                  style={{
                    left: cell.center[0],
                    top: cell.center[1] + 60, // Position below text
                    transform: 'translate(-50%, -50%)'
                  }}
                >
                  <div className="bg-white text-black p-2 rounded-full shadow-lg hover:scale-110 transition-transform">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>

              </div>
            </div>
          );
        })}
      </div>

      {/* Footer / Controls */}
      <div className="fixed bottom-8 left-0 w-full flex justify-center pointer-events-none z-50">
        <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-full px-6 py-2 flex items-center gap-4 text-xs text-gray-400 pointer-events-auto hover:bg-black/60 transition-colors">
          <div className="flex items-center gap-2">
            <Filter className="w-3 h-3" />
            <span>{MOCK_ITEMS.length} Items</span>
          </div>
          <div className="w-px h-3 bg-white/10" />
          <span>Voronoi Tessellation Engine</span>
          <div className="w-px h-3 bg-white/10" />
          <span className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            Live Physics
          </span>
        </div>
      </div>
    </div>
  );
}