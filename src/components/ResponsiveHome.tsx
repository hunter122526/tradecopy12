'use client';

import { useState } from 'react';
import Image from 'next/image';
import { TradeCommandCenter } from '@/components/trade/TradeCommandCenter';
import { ConnectionMonitor } from '@/components/dashboard/ConnectionMonitor';
import { FollowerTerminal } from '@/components/dashboard/FollowerTerminal';
import FollowersDashboard from '@/components/dashboard/FollowersDashboard';
import { LedgerLog } from '@/components/dashboard/LedgerLog';
import { ForexRatesPanel } from '@/components/dashboard/ForexRatesPanel';
import { Toaster } from '@/components/ui/toaster';
import { useIsMobile } from '@/hooks/use-mobile';
import { LayoutDashboard, Zap, Globe, Terminal, Users, LogOut, Settings } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const mobileTabs: Array<{
  id: 'home' | 'trade' | 'markets' | 'status';
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: 'home', label: 'Home', icon: LayoutDashboard },
  { id: 'trade', label: 'Signal', icon: Zap },
  { id: 'markets', label: 'Markets', icon: Globe },
  { id: 'status', label: 'Bridge', icon: Terminal },
];

export function ResponsiveHome() {
  const isMobile = useIsMobile();
  const [tab, setTab] = useState<'home' | 'trade' | 'markets' | 'status'>('home');

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="relative">
        {isMobile ? (
          <header className="sticky top-0 z-40 border-b border-white/10 bg-card/95 backdrop-blur-xl px-4 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-3xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-[0_20px_60px_rgba(56,189,248,0.25)]">
                  <Image src="/logo.png" alt="Logo" width={36} height={36} className="object-contain" />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.35em] text-muted-foreground">Mobile Application</p>
                  <h1 className="text-xl font-bold text-white">igrow Mobile</h1>
                </div>
              </div>
              <Badge variant="secondary" className="text-[10px] uppercase tracking-[0.25em] px-3 py-1">
                Live
              </Badge>
            </div>
          </header>
        ) : null}

        <main className={isMobile ? 'pb-28' : 'flex min-h-screen'}>
          {!isMobile ? (
            <aside className="w-20 border-r border-white/5 flex flex-col items-center py-8 space-y-8 bg-card/30">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-[0_0_15px_hsl(var(--primary)/0.3)]">
                <LayoutDashboard className="text-white w-6 h-6" strokeWidth={2.5} />
              </div>
              <nav className="flex flex-col space-y-6">
                <button className="p-3 text-primary bg-primary/10 rounded-lg"><Users className="w-5 h-5" /></button>
                <button className="p-3 text-muted-foreground hover:text-white transition-colors"><Settings className="w-5 h-5" /></button>
              </nav>
              <div className="mt-auto pb-4">
                <button className="p-3 text-muted-foreground hover:text-destructive transition-colors"><LogOut className="w-5 h-5" /></button>
              </div>
            </aside>
          ) : null}

          <section className={isMobile ? 'px-4 pb-6 pt-4' : 'flex-1 overflow-auto p-6 lg:p-10'}>
            <div className={isMobile ? 'space-y-4' : 'space-y-6'}>
              {!isMobile ? (
                <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 lg:p-8 shadow-[0_24px_90px_rgba(15,23,42,0.35)] backdrop-blur-xl">
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-[0_30px_70px_rgba(56,189,248,0.18)]">
                        <Image src="/logo.png" alt="igrow logo" width={56} height={56} className="object-contain" />
                      </div>
                      <div>
                        <p className="text-sm uppercase tracking-[0.35em] text-muted-foreground">Forex performance dashboard</p>
                        <h1 className="text-4xl font-headline font-bold tracking-tight text-white">igrow Learning Society</h1>
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                      <div className="rounded-3xl bg-slate-950/80 border border-white/10 p-4">
                        <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Active Pairs</p>
                        <p className="mt-2 text-3xl font-semibold text-white">Full MT5 Symbol Support</p>
                      </div>
                      <div className="rounded-3xl bg-slate-950/80 border border-white/10 p-4">
                        <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Mobile + desktop ready</p>
                        <p className="mt-2 text-3xl font-semibold text-white">App-style navigation</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-[2rem] border border-white/10 bg-card/70 p-4 shadow-[0_20px_50px_rgba(0,0,0,0.25)] backdrop-blur-xl">
                  <p className="text-[11px] uppercase tracking-[0.35em] text-muted-foreground">Welcome back</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">Trade signals on the move</h2>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">Use the footer navigation to switch between live signal control, market overview, and MT5 bridge status.</p>
                </div>
              )}

              {isMobile ? (
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-3xl bg-secondary/80 border border-white/10 p-4">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Multi MT5 Ready</p>
                    <p className="mt-2 text-lg font-semibold text-white">Use one PC with multiple terminals</p>
                  </div>
                  <div className="rounded-3xl bg-secondary/80 border border-white/10 p-4">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Any symbol</p>
                    <p className="mt-2 text-lg font-semibold text-white">BTC/USD, ETH/USD, FX pairs</p>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.2)]">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Signal Engine</p>
                    <p className="mt-3 text-2xl font-semibold text-white">Live broadcast, follower sync, currency filters.</p>
                  </div>
                  <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.2)]">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Follower insights</p>
                    <p className="mt-3 text-2xl font-semibold text-white">Open trade status and P/L grid.</p>
                  </div>
                  <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.2)]">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Chart analytics</p>
                    <p className="mt-3 text-2xl font-semibold text-white">Per-symbol market preview for every MT5 asset.</p>
                  </div>
                </div>
              )}

              {isMobile ? (
                <div className="space-y-4">
                  {tab === 'home' && (
                    <>
                      <FollowerTerminal />
                      <ConnectionMonitor />
                    </>
                  )}
                  {tab === 'trade' && (
                    <>
                      <TradeCommandCenter />
                      <LedgerLog />
                    </>
                  )}
                  {tab === 'markets' && <ForexRatesPanel />}
                  {tab === 'status' && (
                    <>
                      <ConnectionMonitor />
                      <div className="rounded-[2rem] border border-white/10 bg-card/60 p-5">
                        <h3 className="text-sm font-semibold text-white">MT5 Multi-Terminal Setup</h3>
                        <p className="mt-3 text-sm leading-6 text-muted-foreground">Run separate MT5 terminals or accounts for each follower profile. Use a unique bridge key for each terminal if you want independent signal delivery.</p>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="bento-grid">
                  <div className="col-span-12 xl:col-span-6 space-y-6">
                    <TradeCommandCenter />
                    <LedgerLog />
                  </div>
                  <div className="col-span-12 xl:col-span-6 space-y-6">
                    <FollowerTerminal />
                    <FollowersDashboard />
                    <ConnectionMonitor />
                  </div>
                  <div className="col-span-12">
                    <ForexRatesPanel />
                  </div>
                  <div className="col-span-12">
                    <div className="rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.2)]">
                      <h3 className="text-lg font-semibold text-white">MT5 Multi-Follower Guidance</h3>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">You can run multiple MT5 instances on one PC, or use separate broker accounts. One MT5 terminal can execute many trades, but for clean follower isolation it is best to run one terminal per follower key/account.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </main>
      </div>

      {isMobile ? (
        <footer className="mobile-footer-nav">
          <div className="grid grid-cols-4 gap-2">
            {mobileTabs.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`flex flex-col items-center justify-center gap-1 rounded-3xl px-2 py-2 text-[10px] font-semibold transition ${active ? 'bg-white/10 text-white shadow-[0_10px_30px_rgba(255,255,255,0.12)]' : 'text-muted-foreground hover:bg-white/5'}`}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </button>
              );
            })}
          </div>
        </footer>
      ) : null}

      <Toaster />
    </div>
  );
}
