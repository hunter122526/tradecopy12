"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Button } from "@/components/ui/button";
import { AlertCircle, Play, Square } from 'lucide-react';

type Follower = { id: string; followerKey?: string; name?: string; mt5Login?: string; status?: string; copyTradingEnabled?: boolean };
type Trade = { id?: string; followerKey: string; symbol: string; side: string; volume: number; price: number; profitLoss: number; created_at: string };

export function FollowersDashboard() {
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const fRes = await fetch('/api/followers');
        const fJson = await fRes.json();
        setFollowers(Array.isArray(fJson.followers) ? fJson.followers : []);

        const tRes = await fetch('/api/followers/trades?limit=200');
        const tJson = await tRes.json();
        setTrades(Array.isArray(tJson.trades) ? tJson.trades : []);
      } catch (e) {
        console.error('Failed to load followers/trades', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function toggleCopyTrading(followerId: string, currentState: boolean) {
    setTogglingId(followerId);
    try {
      const res = await fetch(`/api/followers/${followerId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ copyTradingEnabled: !currentState }),
      });
      const json = await res.json();
      if (json.success) {
        setFollowers(followers.map(f => 
          f.id === followerId ? { ...f, copyTradingEnabled: !currentState } : f
        ));
      } else {
        console.error('Failed to toggle copy trading:', json.error);
      }
    } catch (e) {
      console.error('Failed to toggle copy trading', e);
    } finally {
      setTogglingId(null);
    }
  }

  function tradesForFollower(key?: string) {
    if (!key) return [] as Trade[];
    return trades.filter(t => String(t.followerKey) === String(key));
  }

  function seriesDataForFollower(key?: string) {
    const list = tradesForFollower(key).slice().reverse();
    // Aggregate into simple series: index -> cumulative P/L
    let cum = 0;
    return list.map((t, i) => {
      cum += Number(t.profitLoss || 0);
      return { name: new Date(t.created_at).toLocaleTimeString(), value: Number(cum.toFixed(2)) };
    });
  }

  function calculateTotalPnL(key?: string): number {
    const list = tradesForFollower(key);
    return list.reduce((sum, t) => sum + Number(t.profitLoss || 0), 0);
  }

  function calculateWinRate(key?: string): { wins: number; losses: number; rate: string } {
    const list = tradesForFollower(key);
    const wins = list.filter(t => Number(t.profitLoss || 0) > 0).length;
    const losses = list.filter(t => Number(t.profitLoss || 0) < 0).length;
    const total = wins + losses;
    const rate = total > 0 ? ((wins / total) * 100).toFixed(1) : '0.0';
    return { wins, losses, rate };
  }

  return (
    <Card className="glass-card h-full">
      <CardHeader>
        <CardTitle>Followers Dashboard</CardTitle>
      </CardHeader>
      <CardContent className="p-2">
        {loading ? (
          <div className="text-sm text-muted-foreground p-4">Loading followers and trades...</div>
        ) : followers.length === 0 ? (
          <div className="text-sm text-muted-foreground p-4">No followers found.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {followers.map((f) => {
              const pnl = calculateTotalPnL(f.followerKey);
              const { wins, losses, rate } = calculateWinRate(f.followerKey);
              const isEnabled = f.copyTradingEnabled !== false;
              const isToggling = togglingId === f.id;
              
              return (
                <div key={f.id} className={`rounded-md border p-3 transition-all ${isEnabled ? 'border-white/5 bg-card' : 'border-red-500/20 bg-red-950/10'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1">
                      <div className="font-medium flex items-center gap-2">
                        {f.name || f.followerKey || f.id}
                        {!isEnabled && <AlertCircle className="w-4 h-4 text-red-500" />}
                      </div>
                      <div className="text-xs text-muted-foreground">{f.mt5Login ? `MT5: ${f.mt5Login}` : f.followerKey}</div>
                    </div>
                    <Button
                      size="sm"
                      variant={isEnabled ? 'default' : 'destructive'}
                      onClick={() => toggleCopyTrading(f.id, isEnabled)}
                      disabled={isToggling}
                      className="ml-2 gap-1"
                    >
                      {isEnabled ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                      {isToggling ? '...' : isEnabled ? 'Stop' : 'Start'}
                    </Button>
                  </div>

                  {/* P/L Stats Row */}
                  <div className="grid grid-cols-3 gap-2 text-xs mb-3 pb-2 border-b border-white/5">
                    <div>
                      <div className="text-muted-foreground">P/L</div>
                      <div className={`font-mono font-semibold ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">W/L</div>
                      <div className="font-mono">{wins}/{losses}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Win %</div>
                      <div className="font-mono">{rate}%</div>
                    </div>
                  </div>

                  {/* Chart */}
                  <div className="h-32">
                    <ChartContainer config={{ value: { color: '#06b6d4' } }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={seriesDataForFollower(f.followerKey)}>
                          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.06} />
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip />
                          <Line type="monotone" dataKey="value" stroke={pnl >= 0 ? '#10b981' : '#ef4444'} strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                  </div>

                  {/* Status Indicator */}
                  <div className="mt-2 pt-2 border-t border-white/5 text-xs">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${isEnabled ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <span className="text-muted-foreground">{isEnabled ? 'Copy Trading: Active' : 'Copy Trading: Stopped'}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default FollowersDashboard;
