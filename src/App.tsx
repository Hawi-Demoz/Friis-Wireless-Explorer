import React, { useState, useEffect, useMemo, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { Settings2, RefreshCcw, Wifi, AlertTriangle, CheckCircle2, Activity, Zap, Info, Sun, Moon, Download, FileText, Image as ImageIcon } from 'lucide-react';
import { toPng } from 'html-to-image';

export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const exportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "FRIIS TRANSMISSION SIMULATION EXPORT\n\n";
    
    // Parameters
    csvContent += "System Parameters\n";
    csvContent += `Transmit Power (W),${pt}\n`;
    csvContent += `Frequency (MHz),${f}\n`;
    csvContent += `Distance (m),${d}\n`;
    csvContent += `Transmitter Gain (dBi),${gt}\n`;
    csvContent += `Receiver Gain (dBi),${gr}\n`;
    csvContent += `Polarization Loss Factor,${plf}\n`;
    csvContent += `Receiver Sensitivity (dBm),${sensitivity}\n\n`;

    // Link Analysis Results
    csvContent += "Link Analysis Results\n";
    const prDBm = receivedPowerW > 0 ? 10 * Math.log10(receivedPowerW) + 30 : -200;
    csvContent += `Received Power (dBm),${prDBm.toFixed(4)}\n`;
    csvContent += `Received Power (W),${receivedPowerW.toExponential(4)}\n`;
    csvContent += `Free Space Path Loss FSPL (dB),${fsplDB.toFixed(4)}\n`;
    csvContent += `Max Range (m),${dMax.toFixed(2)}\n`;
    csvContent += `Link Viable,${isLinkViable}\n\n`;

    // Chart Data
    csvContent += "Distance (m),Received Power (dBm),FSPL (dB)\n";
    chartData.forEach(row => {
      csvContent += `${row.distance},${row.power},${row.fspl}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "friis_simulation_data.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportPNG = () => {
    if (mainRef.current) {
      toPng(mainRef.current, { 
        backgroundColor: theme === 'dark' ? '#0B0E14' : '#F1F5F9',
        pixelRatio: 2
      })
      .then((dataUrl) => {
        const link = document.createElement("a");
        link.download = "friis_dashboard.png";
        link.href = dataUrl;
        link.click();
      })
      .catch((err) => console.error('Failed to export Image', err));
    }
  };

  const formatPowerDisplay = (watts: number) => {
    if (watts === 0) return '0 W';
    if (watts >= 1) return `${watts.toFixed(2)} W`;
    if (watts >= 1e-3) return `${(watts * 1e3).toFixed(2)} mW`;
    if (watts >= 1e-6) return `${(watts * 1e6).toFixed(2)} µW`;
    if (watts >= 1e-9) return `${(watts * 1e9).toFixed(2)} nW`;
    if (watts >= 1e-12) return `${(watts * 1e12).toFixed(2)} pW`;
    if (watts >= 1e-15) return `${(watts * 1e15).toFixed(2)} fW`;
    return `${watts.toExponential(2)} W`;
  };

  // Input States
  const [pt, setPt] = useState<number>(1); // Transmit Power (W)
  const [f, setF] = useState<number>(100); // Frequency (MHz)
  const [d, setD] = useState<number>(1000); // Distance (m)
  const [gt, setGt] = useState<number>(0); // Transmitter Gain (dBi)
  const [gr, setGr] = useState<number>(0); // Receiver Gain (dBi)
  const [plf, setPlf] = useState<number>(1); // Polarization Loss Factor (0-1)
  const [sensitivity, setSensitivity] = useState<number>(-80); // Receiver Sensitivity (dBm)

  // Constants
  const c = 3e8; // Speed of light (m/s)

  // Derived Values
  const f_Hz = f * 1e6;
  const lambda = c / f_Hz;
  const gt_lin = Math.pow(10, gt / 10);
  const gr_lin = Math.pow(10, gr / 10);
  
  // Received Power Calculations
  const receivedPowerW = pt * gt_lin * gr_lin * Math.pow(lambda / (4 * Math.PI * d), 2) * plf;
  const receivedPowerDBm = receivedPowerW > 0 ? 10 * Math.log10(receivedPowerW) + 30 : -200;
  
  // FSPL Calculation
  const fsplDB = 20 * Math.log10(d) + 20 * Math.log10(f_Hz) + 20 * Math.log10((4 * Math.PI) / c);
  
  // Max Distance Calculation
  const sensitivityW = Math.max(Math.pow(10, (sensitivity - 30) / 10), 1e-20);
  const dMax = Math.sqrt((pt * gt_lin * gr_lin * plf) / sensitivityW) * (lambda / (4 * Math.PI));

  // Link Viability
  const isLinkViable = receivedPowerDBm >= sensitivity;
  const viabilityMargin = receivedPowerDBm - sensitivity;

  // Presets
  const presetShortStrong = () => { setPt(1); setF(100); setD(10); setGt(2); setGr(2); setPlf(1); setSensitivity(-80); };
  const presetLongWeak = () => { setPt(10); setF(100); setD(10000); setGt(10); setGr(10); setPlf(0.5); setSensitivity(-90); };
  const presetHighFreqLoss = () => { setPt(1); setF(3000); setD(5000); setGt(5); setGr(5); setPlf(1); setSensitivity(-80); };
  const resetControls = () => { setPt(1); setF(100); setD(1000); setGt(0); setGr(0); setPlf(1); setSensitivity(-80); };

  // Generate chart data up to 1.5x the current distance
  const chartData = useMemo(() => {
    const data = [];
    const maxDist = Math.max(d * 1.5, 10);
    const step = maxDist / 50; // 50 points
    for (let currentD = step; currentD <= maxDist; currentD += step) {
      const prW = pt * gt_lin * gr_lin * Math.pow(lambda / (4 * Math.PI * currentD), 2) * plf;
      const prDBm = prW > 0 ? 10 * Math.log10(prW) + 30 : -200;
      const fspl = 20 * Math.log10(currentD) + 20 * Math.log10(f_Hz) + 20 * Math.log10((4 * Math.PI) / c);
      data.push({
        distance: Math.round(currentD),
        power: parseFloat(prDBm.toFixed(2)),
        fspl: parseFloat(fspl.toFixed(2))
      });
    }
    return data;
  }, [pt, gt_lin, gr_lin, lambda, plf, d, f_Hz]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-sleek-card border border-sleek-border p-2 rounded shadow-lg shrink-0 text-[11px] font-mono">
          <p className="text-sleek-muted mb-1">{`Distance: ${label} m`}</p>
          {payload.map((entry: any, index: number) => (
             <p key={index} style={{ color: entry.color }} className="font-medium">
               {`${entry.name}: ${entry.value} ${entry.name === 'FSPL' ? 'dB' : 'dBm'}`}
             </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-sleek-bg text-sleek-text font-sans selection:bg-sleek-accent/30">
      
      {/* Header */}
      <header className="h-[56px] px-6 flex items-center justify-between border-b border-sleek-border bg-sleek-card shrink-0">
        <div className="font-bold tracking-tight text-sleek-accent flex items-center gap-2">
          <div className="w-6 h-6 border-2 border-sleek-accent rounded flex items-center justify-center text-xs">λ</div>
          FRIIS WIRELESS EXPLORER
        </div>
        <div className="flex gap-3 items-center">
          <div className="flex bg-sleek-card border border-sleek-border rounded-full overflow-hidden shrink-0">
             <button onClick={exportCSV} title="Export Data to CSV" className="px-3 py-1 hover:bg-sleek-accent/10 hover:text-sleek-accent text-sleek-muted text-[11px] transition-all flex items-center gap-1.5 border-r border-sleek-border cursor-pointer font-medium">
               <FileText size={12} /> CSV
             </button>
             <button onClick={exportPNG} title="Export Dashboard Image" className="px-3 py-1 hover:bg-sleek-accent/10 hover:text-sleek-accent text-sleek-muted text-[11px] transition-all flex items-center gap-1.5 cursor-pointer font-medium">
               <ImageIcon size={12} /> PNG
             </button>
          </div>
          <div className="w-px h-5 bg-sleek-border"></div>
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="w-7 h-7 flex items-center justify-center bg-sleek-card border border-sleek-border hover:border-sleek-accent text-sleek-text rounded-full transition-colors cursor-pointer"
            title="Toggle Light/Dark Mode"
          >
            {theme === 'dark' ? <Sun size={14} className="text-sleek-muted hover:text-sleek-accent" /> : <Moon size={14} className="text-sleek-muted hover:text-sleek-accent" />}
          </button>
          <button 
            onClick={resetControls}
            className="px-3 py-1 bg-sleek-card border border-sleek-border hover:border-sleek-accent text-sleek-text rounded-full text-[11px] transition-all shrink-0 font-medium cursor-pointer"
          >
            RESET SIMULATION
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <main ref={mainRef} className="flex-1 grid grid-cols-1 lg:grid-cols-[260px_1fr_280px] gap-px bg-sleek-border overflow-hidden">
        
        {/* Left Panel: System Parameters */}
        <section className="bg-sleek-bg p-4 flex flex-col gap-3 overflow-y-auto">
          <div className="text-[11px] font-semibold uppercase tracking-[1px] text-sleek-muted mb-1 flex justify-between items-center">
            System Parameters
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center text-xs">
              <span>Tx Power <span className="text-sleek-muted text-[10px]">Pt (Watts)</span></span>
              <input type="number" value={pt} onChange={(e) => setPt(parseFloat(e.target.value) || 0)} className="bg-sleek-card border border-sleek-border text-sleek-text px-2 py-1 rounded font-mono text-[11px] w-[70px] text-right outline-none focus:border-sleek-accent transition-colors" />
            </div>
            <input type="range" min="0.1" max="100" step="0.1" value={pt} onChange={(e) => setPt(parseFloat(e.target.value))} />
            <div className="flex justify-between text-[9px] text-sleek-muted font-mono mt-[-2px]">
              <span>0.1W</span>
              <span>100W</span>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center text-xs">
              <span>Frequency <span className="text-sleek-muted text-[10px]">f (MHz)</span></span>
              <input type="number" value={f} onChange={(e) => setF(parseFloat(e.target.value) || 0)} className="bg-sleek-card border border-sleek-border text-sleek-text px-2 py-1 rounded font-mono text-[11px] w-[70px] text-right outline-none focus:border-sleek-accent transition-colors" />
            </div>
            <input type="range" min="1" max="3000" step="1" value={f} onChange={(e) => setF(parseFloat(e.target.value))} />
            <div className="flex justify-between text-[9px] text-sleek-muted font-mono mt-[-2px]">
              <span>1MHz</span>
              <span>3000MHz</span>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center text-xs">
              <span>Distance <span className="text-sleek-muted text-[10px]">d (meters)</span></span>
              <input type="number" value={d} onChange={(e) => setD(parseFloat(e.target.value) || 0)} className="bg-sleek-card border border-sleek-border text-sleek-text px-2 py-1 rounded font-mono text-[11px] w-[70px] text-right outline-none focus:border-sleek-accent transition-colors" />
            </div>
            <input type="range" min="1" max="10000" step="1" value={d} onChange={(e) => setD(parseFloat(e.target.value))} />
            <div className="flex justify-between text-[9px] text-sleek-muted font-mono mt-[-2px]">
              <span>1m</span>
              <span>10,000m</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-1">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-sleek-text">Tx Gain (dBi)</label>
              <input type="number" value={gt} onChange={(e) => setGt(parseFloat(e.target.value) || 0)} className="bg-sleek-card border border-sleek-border text-sleek-text px-2 py-1 rounded font-mono text-[12px] w-full outline-none focus:border-sleek-accent transition-colors" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-sleek-text">Rx Gain (dBi)</label>
              <input type="number" value={gr} onChange={(e) => setGr(parseFloat(e.target.value) || 0)} className="bg-sleek-card border border-sleek-border text-sleek-text px-2 py-1 rounded font-mono text-[12px] w-full outline-none focus:border-sleek-accent transition-colors" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-sleek-text" title="Polarization Loss Factor">PLF (0-1)</label>
              <input type="number" step="0.05" value={plf} onChange={(e) => setPlf(parseFloat(e.target.value) || 0)} className="bg-sleek-card border border-sleek-border text-sleek-text px-2 py-1 rounded font-mono text-[12px] w-full outline-none focus:border-sleek-accent transition-colors" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-sleek-text">Sensitivity (dBm)</label>
              <input type="number" value={sensitivity} onChange={(e) => setSensitivity(parseFloat(e.target.value) || -100)} className="bg-sleek-card border border-sleek-border text-sleek-text px-2 py-1 rounded font-mono text-[12px] w-full outline-none focus:border-sleek-accent transition-colors" />
            </div>
          </div>

          <div className="text-[11px] font-semibold uppercase tracking-[1px] text-sleek-muted mt-3 mb-1">
            Presets
          </div>
          <button onClick={presetShortStrong} className="bg-sleek-card border border-sleek-border text-sleek-text p-2 rounded flex items-center gap-2 text-[11px] text-left hover:bg-sleek-border hover:border-sleek-accent transition-all cursor-pointer">
             📡 Short-range High Bandwidth
          </button>
          <button onClick={presetLongWeak} className="bg-sleek-card border border-sleek-border text-sleek-text p-2 rounded flex items-center gap-2 text-[11px] text-left hover:bg-sleek-border hover:border-sleek-accent transition-all cursor-pointer">
             🛰️ Satellite Link (Deep Space)
          </button>
          <button onClick={presetHighFreqLoss} className="bg-sleek-card border border-sleek-border text-sleek-text p-2 rounded flex items-center gap-2 text-[11px] text-left hover:bg-sleek-border hover:border-sleek-accent transition-all cursor-pointer">
             📻 LoRa Long-Range IoT
          </button>

        </section>

        {/* Center Panel: Charts */}
        <section className="bg-sleek-bg p-4 flex flex-col gap-4 overflow-y-auto">
          
          <div className="flex-1 bg-sleek-card border border-sleek-border rounded-lg p-3 relative flex flex-col min-h-[240px]">
            <div className="text-[11px] font-semibold uppercase tracking-[1px] text-sleek-muted mb-2">
              Received Power vs Distance <span className="text-sleek-accent normal-case font-mono ml-1">Pr (dBm)</span>
            </div>
            <div className="flex-1 w-full min-h-0 mt-2 relative">
              <ResponsiveContainer width="100%" height="100%">
                 <LineChart data={chartData} margin={{ top: 10, right: 10, bottom: 5, left: 0 }}>
                   <CartesianGrid stroke="var(--color-sleek-border)" strokeDasharray="3 3" vertical={false} />
                   <XAxis dataKey="distance" type="number" dataKey="distance" tick={{ fill: 'var(--color-sleek-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }} axisLine={{ stroke: 'var(--color-sleek-border)' }} tickLine={false} tickFormatter={(val) => val > 1000 ? `${(val/1000).toFixed(1)}k` : val} domain={[0, 'dataMax']} />
                   <YAxis tick={{ fill: 'var(--color-sleek-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }} axisLine={{ stroke: 'var(--color-sleek-border)' }} tickLine={false} domain={['auto', 'auto']} tickFormatter={(val) => val.toFixed(0)} width={35} />
                   <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--color-sleek-border)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                   <Line type="monotone" dataKey="power" stroke="var(--color-sleek-accent)" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "var(--color-sleek-bg)", stroke: "var(--color-sleek-accent)", strokeWidth: 2 }} isAnimationActive={false} />
                   {isLinkViable && 
                      <ReferenceLine y={sensitivity} stroke="#ef4444" strokeDasharray="3 3" />
                   }
                   <ReferenceLine x={d} stroke="var(--color-sleek-accent-alt)" strokeDasharray="3 3" />
                 </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="flex-1 bg-sleek-card border border-sleek-border rounded-lg p-3 relative flex flex-col min-h-[240px]">
            <div className="text-[11px] font-semibold uppercase tracking-[1px] text-sleek-muted mb-2">
              Free Space Path Loss <span className="text-sleek-accent-alt normal-case font-mono ml-1">FSPL (dB)</span>
            </div>
            <div className="flex-1 w-full min-h-0 mt-2 relative">
               <ResponsiveContainer width="100%" height="100%">
                 <LineChart data={chartData} margin={{ top: 10, right: 10, bottom: 5, left: 0 }}>
                   <CartesianGrid stroke="var(--color-sleek-border)" strokeDasharray="3 3" vertical={false} />
                   <XAxis dataKey="distance" type="number" dataKey="distance" tick={{ fill: 'var(--color-sleek-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }} axisLine={{ stroke: 'var(--color-sleek-border)' }} tickLine={false} tickFormatter={(val) => val > 1000 ? `${(val/1000).toFixed(1)}k` : val} domain={[0, 'dataMax']} />
                   <YAxis tick={{ fill: 'var(--color-sleek-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }} axisLine={{ stroke: 'var(--color-sleek-border)' }} tickLine={false} domain={['auto', 'auto']} tickFormatter={(val) => val.toFixed(0)} width={35} />
                   <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--color-sleek-border)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                   <Line type="monotone" dataKey="fspl" stroke="var(--color-sleek-accent-alt)" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "var(--color-sleek-bg)", stroke: "var(--color-sleek-accent-alt)", strokeWidth: 2 }} isAnimationActive={false} />
                   <ReferenceLine x={d} stroke="var(--color-sleek-accent)" strokeDasharray="3 3" />
                 </LineChart>
               </ResponsiveContainer>
            </div>
          </div>

        </section>

        {/* Right Panel: Link Analysis */}
        <section className="bg-sleek-bg p-4 flex flex-col gap-3 overflow-y-auto w-full">
          
          <div className="text-[11px] font-semibold uppercase tracking-[1px] text-sleek-muted mb-1">
            Link Analysis
          </div>
          
          <div className="bg-sleek-card p-3 rounded-lg border-l-[3px] border-sleek-accent">
            <div className="text-[10px] uppercase text-sleek-muted">Received Power (Pr)</div>
            <div className="font-mono text-[22px] text-sleek-accent leading-tight mt-0.5">
              {receivedPowerDBm.toFixed(2)} <span className="text-[12px]">dBm</span>
            </div>
            <div className="text-[12px] font-mono mt-1 text-sleek-text opacity-90">{formatPowerDisplay(receivedPowerW)}</div>
            <div className="text-[9px] text-sleek-muted mt-2 leading-relaxed border-t border-sleek-border pt-2">
              <span className="font-semibold text-sleek-accent">Hint:</span> If you double the distance, the Wattage divides perfectly by 4, which translates to exactly -6 dBm on the logarithmic scale. If you double the Tx Power, the Wattage doubles, translating to exactly +3 dBm.
            </div>
          </div>

          <div className="bg-sleek-card p-3 rounded-lg border-l-[3px] border-sleek-accent-alt">
            <div className="text-[10px] uppercase text-sleek-muted">Path Loss (FSPL)</div>
            <div className="font-mono text-[22px] text-sleek-accent-alt leading-tight mt-0.5">
              {fsplDB.toFixed(2)} <span className="text-[12px]">dB</span>
            </div>
          </div>

          <div className="bg-sleek-card p-3 rounded-lg border-l-[3px] border-sleek-text">
            <div className="text-[10px] uppercase text-sleek-muted">Max Theoretical Range</div>
            <div className="font-mono text-[22px] text-sleek-text leading-tight mt-0.5 max-w-full truncate" title={dMax > 1000000 ? '>1000 km' : dMax < 1000 ? `${dMax.toFixed(1)} m` : `${(dMax/1000).toFixed(2)} km`}>
              {dMax > 1000000 ? '>1000 km' : dMax < 1000 ? `${dMax.toFixed(1)} m` : `${(dMax/1000).toFixed(2)} km`}
            </div>
          </div>

          <div className={`p-3 rounded-lg text-xs leading-[1.5] border ${isLinkViable ? 'bg-[rgba(0,209,255,0.05)] border-[rgba(0,209,255,0.2)]' : 'bg-[rgba(244,114,182,0.05)] border-[rgba(244,114,182,0.2)]'}`}>
            <div className="flex justify-between items-center mb-2">
               <strong>Status</strong>
               {isLinkViable ? 
                 <span className="bg-sleek-success text-black text-[10px] font-bold px-[6px] py-[2px] rounded-full uppercase">LINK VIABLE</span> : 
                 <span className="bg-sleek-accent-alt text-black text-[10px] font-bold px-[6px] py-[2px] rounded-full uppercase">LINK FAILED</span>
               }
            </div>
            {isLinkViable 
                ? `At ${f >= 1000 ? (f/1000).toFixed(2) + ' GHz' : f + ' MHz'}, the link closes successfully. Margin above sensitivity floor is +${viabilityMargin.toFixed(1)}dB.`
                : `At ${f >= 1000 ? (f/1000).toFixed(2) + ' GHz' : f + ' MHz'}, signal attenuation is critical. Power is ${Math.abs(viabilityMargin).toFixed(1)}dB below decode threshold.`
            }
          </div>

          <div className="text-[11px] font-semibold uppercase tracking-[1px] text-sleek-muted mt-2 mb-1">
            Optimization Case Studies
          </div>

          <div className="grid grid-cols-2 gap-3 bg-sleek-card p-3 rounded-lg">
            <div>
              <h4 className="text-[11px] text-sleek-accent-alt mb-1">Satellite Comm</h4>
              <p className="text-[10px] text-sleek-muted leading-[1.3]">High FSPL due to distance. Use parabolic dishes (high G) and low-noise amps.</p>
            </div>
            <div>
              <h4 className="text-[11px] text-sleek-accent-alt mb-1">Radio Astronomy</h4>
              <p className="text-[10px] text-sleek-muted leading-[1.3]">Passive Rx. Maximize aperture size to capture faint cosmic photons.</p>
            </div>
          </div>

          <div className="mt-auto text-[9px] text-sleek-muted text-center pt-2">
            Physics Engine: Friis Eq v2.1 • c = 3.0e8 m/s
          </div>

        </section>
      </main>
    </div>
  );
}
