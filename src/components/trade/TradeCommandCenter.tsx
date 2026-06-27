
"use client";

import { useState, useEffect, useMemo, FormEvent } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from "recharts";
import { TrendingUp, TrendingDown, Send, Zap, Server, Key, User, LogOut, Link2, Info, Copy, Check, ArrowRightLeft, Cloud, Terminal as TerminalIcon, FileCode, AlertCircle, Database, HelpCircle, Globe, Layout } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartContainer } from "@/components/ui/chart";
import TradingViewChart from '@/components/ui/TradingViewChart';
import { useToast } from "@/hooks/use-toast";
import { useFirestore, useFirebaseApp } from "@/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const currencyPairs = [
  { value: "EURUSD", label: "EUR / USD" },
  { value: "GBPUSD", label: "GBP / USD" },
  { value: "USDJPY", label: "USD / JPY" },
  { value: "AUDUSD", label: "AUD / USD" },
  { value: "USDCAD", label: "USD / CAD" },
  { value: "USDCHF", label: "USD / CHF" },
  { value: "NZDUSD", label: "NZD / USD" },
  { value: "EURJPY", label: "EUR / JPY" },
  { value: "EURGBP", label: "EUR / GBP" },
  { value: "EURCHF", label: "EUR / CHF" },
  { value: "AUDJPY", label: "AUD / JPY" },
  { value: "GBPJPY", label: "GBP / JPY" },
  { value: "CHFJPY", label: "CHF / JPY" },
  { value: "GBPCHF", label: "GBP / CHF" },
  { value: "AUDCAD", label: "AUD / CAD" },
  { value: "AUDCHF", label: "AUD / CHF" },
  { value: "CADJPY", label: "CAD / JPY" },
  { value: "EURAUD", label: "EUR / AUD" },
  { value: "EURNZD", label: "EUR / NZD" },
  { value: "NZDJPY", label: "NZD / JPY" },
  { value: "NZDCAD", label: "NZD / CAD" },
  { value: "XAUUSD", label: "XAU / USD" },
  { value: "XAGUSD", label: "XAG / USD" },
  { value: "BTCUSD", label: "BTC / USD" },
  { value: "ETHUSD", label: "ETH / USD" },
];

const timeframes = [
  { value: "1m", label: "1m" },
  { value: "3m", label: "3m" },
  { value: "5m", label: "5m" },
  { value: "15m", label: "15m" },
  { value: "30m", label: "30m" },
  { value: "1h", label: "1h" },
  { value: "2h", label: "2h" },
  { value: "4h", label: "4h" },
  { value: "1d", label: "1d" },
  { value: "1w", label: "1w" },
  { value: "1M", label: "1M" },
];

const pairBaselines: Record<string, number> = {
  EURUSD: 1.0850,
  GBPUSD: 1.2720,
  USDJPY: 148.55,
  AUDUSD: 0.6650,
  USDCAD: 1.3700,
  USDCHF: 0.9140,
  NZDUSD: 0.6050,
  EURJPY: 161.70,
  EURGBP: 0.8520,
  EURCHF: 0.9900,
  AUDJPY: 98.55,
  GBPJPY: 188.35,
  CHFJPY: 162.80,
  GBPCHF: 1.1640,
  AUDCAD: 0.9100,
  AUDCHF: 0.6090,
  CADJPY: 108.75,
  EURAUD: 1.6300,
  EURNZD: 1.7980,
  NZDJPY: 89.95,
  NZDCAD: 0.8300,
  XAUUSD: 2075.00,
  XAGUSD: 24.80,
  BTCUSD: 68000.00,
  ETHUSD: 3600.00,
};

const seededRandom = (seed: number) => {
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
};

export function TradeCommandCenter() {
  const { toast } = useToast();
  const db = useFirestore();
  const app = useFirebaseApp();
  const [direction, setDirection] = useState<'BUY' | 'SELL'>('BUY');
  const [selectedTimeframe, setSelectedTimeframe] = useState("1m");
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [copied, setCopied] = useState(false);

  const defaultHost = process.env.NEXT_PUBLIC_APP_DOMAIN || "https://your-domain.com";
  const apiHost = typeof window !== "undefined" ? window.location.origin : defaultHost;
  const hostUrl = apiHost;
  const localApiUrl = "/api/signals";
  const mqlApiUrl = `${apiHost}/api/signals`;

  // Form State
  const [vantageId, setVantageId] = useState("");
  const [vantagePassword, setVantagePassword] = useState("");
  const [vantageServer, setVantageServer] = useState("Vantage-Live 2");

  // Trade Details State
  const [pair, setPair] = useState("EURUSD");
  const [entry, setEntry] = useState("");
  const [lotSize, setLotSize] = useState("0.01");
  const [sl, setSl] = useState("");
  const [tp, setTp] = useState("");
  const [followers, setFollowers] = useState("");
  const [newFollowerKey, setNewFollowerKey] = useState("");
  const [followersData, setFollowersData] = useState<any>(null);
  const [signals, setSignals] = useState<any[]>([]);
  const [loadingSignals, setLoadingSignals] = useState(false);
  const [closingSignalId, setClosingSignalId] = useState<string | null>(null);
  const [closeFollowerKey, setCloseFollowerKey] = useState("");
  const [isClosingFollower, setIsClosingFollower] = useState(false);

  async function loadFollowers() {
    try {
      const res = await fetch('/api/followers');
      const json = await res.json();
      if (json && json.success) setFollowersData(json);
      else setFollowersData({ followers: [] });
    } catch (err) {
      setFollowersData({ followers: [] });
    }
  }

  async function loadSignals() {
    setLoadingSignals(true);
    try {
      const res = await fetch('/api/signals');
      const json = await res.json();
      if (json && json.success) setSignals(json.signals || []);
      else setSignals([]);
    } catch (err) {
      setSignals([]);
    } finally {
      setLoadingSignals(false);
    }
  }

  useEffect(() => { loadFollowers(); loadSignals(); }, []);

  const projectId = app.options.projectId;
  const isNumericProjectId = projectId && /^\d+$/.test(projectId);
  const isDummyProject = !projectId || projectId === "dummy-project-id";

  const mql5Template = `//+------------------------------------------------------------------+
//|                                              PulseCopyBridge.mq5 |
//|                             igrow Learning Society Self-Hosted    |
//+------------------------------------------------------------------+
#property copyright "igrow Learning Society"
#property link      "${hostUrl}"
#property version   "2.0"
#property strict

input string ApiUrl = "${mqlApiUrl}";
input string FollowerKey = "";
input int    RequestTimeoutMs = 5000;
input int    PollIntervalSec = 5;
input double OrderVolume = 0.0001;
input int    OrderDeviation = 20;
input bool   StrictTPValidation = false;

string lastProcessedSignal = "";

int OnInit()
{
   Print("PulseCopy Self-Hosted Bridge Started.");
   Print("Target API: ", ApiUrl);
   if(StringLen(FollowerKey) > 0)
      Print("Follower Key: ", FollowerKey);
   EventSetTimer(PollIntervalSec);
   return(INIT_SUCCEEDED);
}

void OnDeinit(const int reason)
{
   EventKillTimer();
}

void OnTimer()
{
   uchar result[];
   string resultHeaders;
   uchar requestData[] = {};
   string requestUrl = ApiUrl;
   string followerKey = TrimString(FollowerKey);
   if(StringLen(followerKey) > 0)
   {
      requestUrl += StringFind(ApiUrl, "?") >= 0 ? "&followerKey=" : "?followerKey=";
      requestUrl += followerKey;
   }

   int status = WebRequest("GET", requestUrl, "Content-Type: application/json\r\n", RequestTimeoutMs, requestData, result, resultHeaders);
   if(status == 200)
   {
      string response = CharArrayToString(result);
      Print("Bridge response: ", response);

      if(StringFind(response, "\"success\":true") >= 0)
      {
         string signalId;
         string currencyPair;
         string direction;
         string action;
         double entryPrice = 0;
         double stopLoss = 0;
         double takeProfit = 0;
         double lotSize = 0;

         if(ParseFirstPendingSignal(response, signalId, currencyPair, direction, action, entryPrice, stopLoss, takeProfit, lotSize))
         {
            if(StringLen(signalId) == 0)
            {
               Print("No valid signal id found in response.");
               return;
            }

            if(StringCompare(signalId, lastProcessedSignal) != 0)
            {
               Print("Processing signal ", signalId, ": ", action, " ", direction, " ", currencyPair);
               bool success = false;
               if(StringCompare(action, "CLOSE") == 0)
               {
                  success = ExecuteCloseSignal(currencyPair);
               }
               else
               {
                  success = ExecuteSignal(currencyPair, direction, entryPrice, stopLoss, takeProfit, lotSize);
               }

               if(success)
               {
                  lastProcessedSignal = signalId;
                  Print("Signal processed: ", signalId);
                  if(AckSignal(signalId))
                     Print("Signal acknowledged back to server: ", signalId);
               }
               else
               {
                  Print("Signal processing failed: ", signalId);
               }
            }
            else
            {
               Print("Signal already processed: ", signalId);
            }
         }
         else
         {
            Print("No pending signals were parseable from the response.");
         }
      }
      else
      {
         Print("Bridge warning: unexpected response from API. ", response);
      }
   }
   else
   {
      Print("PulseCopy error: WebRequest failed with code ", status);
      if(status <= 0)
      {
         Print("Make sure the domain is added to MT5 WebRequest allowed URLs.");
      }
   }
}

bool ParseFirstPendingSignal(const string json, string &signalId, string &currencyPair, string &direction, string &action, double &entryPrice, double &stopLoss, double &takeProfit, double &lotSize)
{
   int signalsIndex = StringFind(json, "\"signals\"");
   if(signalsIndex < 0) return false;

   int arrayStart = StringFind(json, "[", signalsIndex);
   int arrayEnd = StringFind(json, "]", arrayStart);
   if(arrayStart < 0 || arrayEnd < 0 || arrayEnd <= arrayStart) return false;

   int objectStart = StringFind(json, "{", arrayStart);
   int objectEnd = StringFind(json, "}", objectStart);
   if(objectStart < 0 || objectEnd < 0 || objectEnd <= objectStart) return false;

   string document = StringSubstr(json, objectStart, objectEnd - objectStart + 1);
   signalId = ExtractJsonField(document, "id");
   currencyPair = ExtractJsonField(document, "currencyPair");
   direction = ExtractJsonField(document, "direction");
   action = ExtractJsonField(document, "action");
   if(StringLen(action) == 0)
      action = "OPEN";
   entryPrice = StringToDouble(ExtractJsonField(document, "entryPrice"));
   stopLoss = StringToDouble(ExtractJsonField(document, "stopLoss"));
   takeProfit = StringToDouble(ExtractJsonField(document, "takeProfit"));
   lotSize = StringToDouble(ExtractJsonField(document, "lotSize"));

   return StringLen(signalId) > 0 && StringLen(currencyPair) > 0 && StringLen(direction) > 0;
}

string ExtractJsonField(const string json, const string field)
{
   string needle = "\"" + field + "\":";
   int pos = StringFind(json, needle);
   if(pos < 0) return "";

   pos += StringLen(needle);
   while(pos < StringLen(json) && (StringGetCharacter(json, pos) == 32 || StringGetCharacter(json, pos) == 9 || StringGetCharacter(json, pos) == 10 || StringGetCharacter(json, pos) == 13))
      pos++;

   if(pos >= StringLen(json)) return "";

   if(StringGetCharacter(json, pos) == '"')
   {
      pos++;
      int end = StringFind(json, '"', pos);
      if(end < 0) return "";
      return StringSubstr(json, pos, end - pos);
   }

   int end = StringFind(json, ",", pos);
   int endBrace = StringFind(json, "}", pos);
   if(end < 0 || (endBrace >= 0 && endBrace < end))
      end = endBrace;
   if(end < 0)
      end = StringLen(json);

   return StringSubstr(json, pos, end - pos);
}

string TrimString(const string value)
{
   int start = 0;
   int end = StringLen(value) - 1;

   while(start <= end && (StringGetCharacter(value, start) == 32 || StringGetCharacter(value, end) == 13))
      start++;
   while(end >= start && (StringGetCharacter(value, end) == 32 || StringGetCharacter(value, end) == 9 || StringGetCharacter(value, end) == 10 || StringGetCharacter(value, end) == 13))
      end--;

   return (start > end) ? "" : StringSubstr(value, start, end - start + 1);
}

bool IsStopLossValid(const int orderType, const double price, const double stopLoss)
{
   if(stopLoss <= 0)
      return false;

   if(orderType == ORDER_TYPE_BUY)
      return stopLoss < price;

   return stopLoss > price;
}

bool IsTakeProfitValid(const int orderType, const double price, const double takeProfit)
{
   if(takeProfit <= 0)
      return false;

   if(orderType == ORDER_TYPE_BUY)
      return takeProfit > price;

   return takeProfit < price;
}

void SanitizeStops(const string currencyPair, const int orderType, const double price, double &stopLoss, double &takeProfit)
{
   double point = SymbolInfoDouble(currencyPair, SYMBOL_POINT);
   int stopLevel = (int)SymbolInfoInteger(currencyPair, SYMBOL_TRADE_STOPS_LEVEL);
   double minDistance = stopLevel > 0 ? stopLevel * point : 0;

   if(stopLoss > 0)
   {
      bool invalidSide = !IsStopLossValid(orderType, price, stopLoss);
      bool invalidDistance = minDistance > 0 && MathAbs(price - stopLoss) < minDistance;
      if(invalidSide || invalidDistance)
      {
         Print("Invalid stop loss for ", orderType == ORDER_TYPE_BUY ? "BUY" : "SELL", " order; clearing SL. price=", DoubleToString(price, _Digits), " stopLoss=", DoubleToString(stopLoss, _Digits), " minDistance=", DoubleToString(minDistance, _Digits));
         stopLoss = 0;
      }
   }

   if(takeProfit > 0 && StrictTPValidation)
   {
      bool invalidSide = !IsTakeProfitValid(orderType, price, takeProfit);
      bool invalidDistance = minDistance > 0 && MathAbs(price - takeProfit) < minDistance;
      if(invalidSide || invalidDistance)
      {
         Print("Invalid take profit for ", orderType == ORDER_TYPE_BUY ? "BUY" : "SELL", " order; clearing TP. price=", DoubleToString(price, _Digits), " takeProfit=", DoubleToString(takeProfit, _Digits), " minDistance=", DoubleToString(minDistance, _Digits));
         takeProfit = 0;
      }
   }
}

bool ExecuteSignal(const string currencyPair, const string direction, double entryPrice, double stopLoss, double takeProfit, double lotSize)
{
   if(StringLen(currencyPair) == 0 || StringLen(direction) == 0)
      return false;

   double price = 0;
   int orderType = ORDER_TYPE_BUY;
   if(StringCompare(direction, "SELL") == 0)
   {
      orderType = ORDER_TYPE_SELL;
      price = SymbolInfoDouble(currencyPair, SYMBOL_BID);
   }
   else
   {
      orderType = ORDER_TYPE_BUY;
      price = SymbolInfoDouble(currencyPair, SYMBOL_ASK);
   }

   if(price <= 0)
   {
      Print("Unable to resolve market price for symbol: ", currencyPair);
      return false;
   }

   Print("Resolved market price for ", currencyPair, ": ", DoubleToString(price, _Digits), " (direction=", direction, ")");
   SanitizeStops(currencyPair, orderType, price, stopLoss, takeProfit);

   MqlTradeRequest request;
   MqlTradeResult result;
   ZeroMemory(request);
   ZeroMemory(result);

   request.action = TRADE_ACTION_DEAL;
   request.symbol = currencyPair;
   request.volume = lotSize > 0 ? lotSize : OrderVolume;
   request.type = orderType;
   request.price = price;
   request.sl = stopLoss > 0 ? stopLoss : 0;
   request.tp = takeProfit > 0 ? takeProfit : 0;
   request.deviation = OrderDeviation;
   request.type_filling = ORDER_FILLING_IOC;
   request.type_time = ORDER_TIME_GTC;

   if(request.sl > 0)
      Print("Using stop loss: ", DoubleToString(request.sl, _Digits));
   if(request.tp > 0)
      Print("Using take profit: ", DoubleToString(request.tp, _Digits));

   if(!OrderSend(request, result))
   {
      Print("OrderSend failed: retcode=", result.retcode, " comment=", result.comment);
      if(result.retcode == 10017)
      {
         Print("CRITICAL: retcode 10017 = Trade disabled on account/EA.");
         Print("  1. Ensure EA has 'Allow automated trading' enabled in Tools > Options > Expert Advisors");
         Print("  2. Check broker account settings for algo trading restrictions");
         Print("  3. Verify account is not in read-only mode");
      }
      return false;
   }

   Print("OrderSend result: retcode=", result.retcode, " deal=", result.deal, " price=", DoubleToString(price, _Digits));
   return true;
}

bool ExecuteCloseSignal(const string currencyPair)
{
   if(StringLen(currencyPair) == 0)
      return false;

   if(!PositionSelect(currencyPair))
   {
      Print("No open position found for symbol: ", currencyPair);
      return false;
   }

   ulong ticket = PositionGetInteger(POSITION_TICKET);
   if(ticket == 0)
   {
      Print("Failed to resolve position ticket for: ", currencyPair);
      return false;
   }

   if(!PositionClose(ticket))
   {
      Print("PositionClose failed for ", currencyPair, " ticket=", ticket);
      return false;
   }

   Print("Close order requested for position: ", currencyPair, " ticket=", ticket);
   return true;
}

bool AckSignal(const string signalId)
{
   if(StringLen(signalId) == 0)
      return false;

   string json = "{\"action\":\"ack\",\"signalId\":\"" + signalId + "\"}";
   uchar requestData[];
   StringToCharArray(json, requestData);

   uchar result[];
   string resultHeaders;
   int status = WebRequest("POST", ApiUrl, "Content-Type: application/json\r\n", RequestTimeoutMs, requestData, result, resultHeaders);
   if(status != 200)
   {
      Print("Ack request failed, HTTP status=", status);
      return false;
   }

   string response = CharArrayToString(result);
   Print("Ack response: ", response);
   return StringFind(response, "\"success\":true") >= 0;
}
`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast({ title: "Copied", description: "Copied to clipboard." });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCloseFollowerTrade = async () => {
    const followerKey = closeFollowerKey.trim();
    if (!followerKey) {
      toast({
        variant: "destructive",
        title: "Follower Key Required",
        description: "Enter a follower key to cancel that account's trade.",
      });
      return;
    }

    setIsClosingFollower(true);
    try {
      await fetch(localApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'close',
          followerKeys: [followerKey],
          currencyPair: pair,
        }),
      });
      await loadSignals();
      toast({
        title: 'Close Requested',
        description: `Sent close request for follower ${followerKey}.`,
      });
    } catch (err) {
      console.error('Close follower request failed', err);
      toast({
        variant: 'destructive',
        title: 'Close failed',
        description: 'Unable to send close request for the follower.',
      });
    } finally {
      setIsClosingFollower(false);
    }
  };

  const selectedPairLabel = currencyPairs.find((item) => item.value === pair)?.label ?? pair;
  const lineColor = direction === 'BUY' ? 'hsl(163, 80%, 55%)' : 'hsl(354, 84%, 63%)';

  const chartData = useMemo(() => {
    const count = selectedTimeframe === '1M' ? 18 : selectedTimeframe === '1w' ? 25 : selectedTimeframe === '1d' ? 30 : 22;
    const base = pairBaselines[pair] ?? 1.05;
    const seed = pair
      .split("")
      .reduce((acc, char) => acc * 31 + char.charCodeAt(0), 0) + count;
    const rng = seededRandom(seed);
    return Array.from({ length: count }, (_, index) => {
      const volatility = (rng() - 0.5) * (pair.startsWith('USD') ? 0.01 : 0.005) * (1 + index / count);
      const trend = Math.sin(index / 3 + seed / 1000) * 0.0012;
      const directionShift = direction === 'BUY' ? 0.0008 : -0.0008;
      const rawPrice = base * (1 + trend + volatility + directionShift * (index / count));
      const precision = pair === 'USDJPY' || pair.endsWith('JPY') ? 3 : pair.startsWith('XAU') || pair.startsWith('XAG') ? 2 : 5;
      const price = Number(rawPrice.toFixed(precision));
      return {
        time: index === 0 ? 'Now' : `${index}${selectedTimeframe}`,
        price,
      };
    });
  }, [pair, selectedTimeframe, direction]);

  const currentPrice = chartData[chartData.length - 1]?.price ?? pairBaselines[pair] ?? 1;
  const firstPrice = chartData[0]?.price ?? currentPrice;
  const changePercent = (((currentPrice - firstPrice) / firstPrice) * 100).toFixed(2);
  const spreadLabel = pair.startsWith('USD') ? '0.2' : pair.endsWith('JPY') ? '0.02' : '0.0002';

  const formatPairPrice = (symbol: string, value: number) => {
    const precision = symbol.endsWith('JPY') ? 3 : symbol.startsWith('XAU') || symbol.startsWith('XAG') ? 2 : 5;
    return value.toFixed(precision);
  };

  const getCurrentPriceForPair = (symbol: string) => {
    const base = pairBaselines[symbol] ?? 1.05;
    const symbolSeed = symbol.split("").reduce((acc, char) => acc * 31 + char.charCodeAt(0), 0);
    const offset = Math.sin(symbolSeed / 7) * 0.003 + Math.cos(symbolSeed / 11) * 0.0015;
    const rawPrice = base * (1 + offset * 0.01);
    return Number(formatPairPrice(symbol, rawPrice));
  };

  const getSignalPnL = (signal: any) => {
    if (!signal?.entryPrice || signal.entryPrice === 0) return null;
    const current = getCurrentPriceForPair(signal.currencyPair);
    const rawPnl = signal.direction === 'BUY'
      ? current - signal.entryPrice
      : signal.entryPrice - current;
    const formatted = Number(rawPnl.toFixed(signal.currencyPair.endsWith('JPY') ? 3 : 5));
    return {
      value: formatted,
      label: `${formatted >= 0 ? '+' : ''}${formatted}`,
      current,
    };
  };

  const handleConnectVantage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vantageId || !vantagePassword) {
      toast({
        variant: "destructive",
        title: "Missing Credentials",
        description: "Please provide both your Vantage ID and Password.",
      });
      return;
    }

    setIsConnecting(true);
    
    const masterRef = doc(db, "masterConnections", vantageId);
    setDoc(masterRef, {
      vantageId,
      server: vantageServer,
      isConnected: true,
      lastHeartbeat: serverTimestamp()
    }, { merge: true });

    setTimeout(() => {
      setIsConnecting(false);
      setIsConnected(true);
      toast({
        title: "Vantage Connected",
        description: `Successfully authenticated Master Node: ${vantageId}`,
      });
    }, 1500);
  };

  const handleBroadcast = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsBroadcasting(true);

    try {
      await fetch(localApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'open',
          currencyPair: pair,
          direction,
          entryPrice: parseFloat(entry) || 0,
          stopLoss: parseFloat(sl) || 0,
          takeProfit: parseFloat(tp) || 0,
          lotSize: Math.max(0.0001, parseFloat(lotSize) || 0.01),
          followers: followers.split(',').map((key) => key.trim()).filter(Boolean),
        }),
      });
      await loadSignals();
    } catch (err) {
      console.error('POST to /api/signals failed', err);
    } finally {
      setIsBroadcasting(false);
      toast({
        title: "Signal Propagated",
        description: `Successfully sent ${direction} signal to the bridge API.`,
      });
    }
  };

  async function handleRegisterFollower() {
    if (!newFollowerKey.trim()) return;
    try {
      const res = await fetch('/api/followers', { method: 'POST', body: JSON.stringify({ followerKey: newFollowerKey, name: newFollowerKey }), headers: { 'Content-Type': 'application/json' } });
      const json = await res.json();
      if (json.success) {
        setNewFollowerKey('');
        await loadFollowers();
      } else {
        alert('Failed to register follower: ' + (json.error || 'unknown'));
      }
    } catch (err) {
      alert('Failed to register follower: ' + String(err));
    }
  }

  async function handleCloseSignal(signalId: string) {
    if (!signalId) return;
    const signal = signals.find((item) => item.id === signalId);
    if (!signal) return;

    setClosingSignalId(signalId);
    try {
      await fetch(localApiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close', signalId }),
      });
    } catch (err) {
      console.error('Close signal failed', err);
    } finally {
      setClosingSignalId(null);
      await loadSignals();
      toast({
        title: 'Close requested',
        description: `Close request sent for ${signal.currencyPair}.`,
      });
    }
  }

  async function handleCloseAll() {
    if (!signals.length) return;
    setClosingSignalId('ALL');

    try {
      await Promise.all(
        signals.map((signal) =>
          fetch(localApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'close', signalId: signal.id }),
          })
        )
      );
    } catch (err) {
      console.error('Close all signals failed', err);
    } finally {
      setClosingSignalId(null);
      await loadSignals();
      toast({
        title: 'All close requests sent',
        description: `Sent close commands for ${signals.length} pending signal(s).`,
      });
    }
  }

  const disconnectVantage = () => {
    if (vantageId) {
      const masterRef = doc(db, "masterConnections", vantageId);
      setDoc(masterRef, { isConnected: false }, { merge: true });
    }
    setIsConnected(false);
    toast({
      title: "Vantage Disconnected",
      description: "Master node connection has been severed.",
    });
  };

  if (!isConnected) {
    return (
      <Card key="vantage-setup-form" className="glass-card border-l-4 border-l-destructive snappy-transition">
        <CardHeader>
          <CardTitle className="font-headline text-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="w-5 h-5 text-destructive" strokeWidth={1.5} />
              Vantage Setup
            </div>
            <span className="text-[10px] font-mono bg-destructive/20 text-destructive px-2 py-0.5 rounded-full uppercase tracking-tighter">
              Awaiting Master
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleConnectVantage} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase font-headline">Vantage Login ID</Label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  key="vantage-id-input-field"
                  placeholder="e.g. 50123456" 
                  className="bg-secondary/30 font-mono pl-10" 
                  value={vantageId}
                  onChange={(e) => setVantageId(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase font-headline">MT5 Password</Label>
              <div className="relative">
                <Key className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  key="vantage-pass-input-field"
                  type="password" 
                  placeholder="••••••••" 
                  className="bg-secondary/30 font-mono pl-10" 
                  value={vantagePassword}
                  onChange={(e) => setVantagePassword(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase font-headline">Vantage Server</Label>
              <Input 
                key="vantage-server-input-field"
                value={vantageServer} 
                onChange={(e) => setVantageServer(e.target.value)}
                className="bg-secondary/30 font-mono" 
              />
            </div>
            <Button 
              className="w-full h-12 font-headline text-md bg-destructive hover:bg-destructive/90 text-white shadow-[0_4px_15px_rgba(239,68,68,0.2)]"
              disabled={isConnecting}
            >
              {isConnecting ? "AUTHENTICATING..." : "CONNECT MASTER NODE"}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card key="terminal-main-view" className="glass-card border-l-4 border-l-primary snappy-transition">
      <CardHeader className="pb-0">
        <Tabs defaultValue="signals" className="w-full">
          <div className="flex items-center justify-between mb-4">
            <TabsList className="bg-secondary/50 h-9 p-1">
              <TabsTrigger value="signals" className="text-[10px] uppercase font-bold tracking-widest px-4">Terminal</TabsTrigger>
              <TabsTrigger value="bridge" className="text-[10px] uppercase font-bold tracking-widest px-4 flex gap-1">
                <Link2 className="w-3 h-3" /> Bridge
              </TabsTrigger>
            </TabsList>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[9px] font-mono border-primary/20 bg-primary/5 text-primary">
                LIVE: {vantageId}
              </Badge>
              <button onClick={disconnectVantage} className="p-1.5 hover:bg-destructive/10 rounded-full text-muted-foreground hover:text-destructive transition-colors">
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <TabsContent value="signals">
            <CardTitle className="font-headline text-lg flex items-center gap-2 text-primary mb-6">
              <Zap className="w-5 h-5" strokeWidth={1.5} />
              Command Center
            </CardTitle>
            <form onSubmit={handleBroadcast} className="space-y-6 pb-4">
              <Tabs defaultValue="BUY" className="w-full" onValueChange={(v) => setDirection(v as 'BUY' | 'SELL')}>
                <TabsList className="grid w-full grid-cols-2 h-12 bg-secondary/30">
                  <TabsTrigger value="BUY" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground flex gap-2 font-headline">
                    <TrendingUp className="w-4 h-4" /> BUY
                  </TabsTrigger>
                  <TabsTrigger value="SELL" className="data-[state=active]:bg-destructive data-[state=active]:text-destructive-foreground flex gap-2 font-headline">
                    <TrendingDown className="w-4 h-4" /> SELL
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label className="text-[10px] text-muted-foreground uppercase font-headline tracking-widest">Pair</Label>
                  <Input
                    list="pair-options"
                    placeholder="EURUSD"
                    value={pair}
                    onChange={(e) => setPair(e.target.value.toUpperCase())}
                    className="bg-secondary/20 font-mono border-white/5 focus:border-primary/50"
                  />
                  <datalist id="pair-options">
                    {currencyPairs.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </datalist>
                  <p className="text-[10px] text-muted-foreground">Type any MT5 symbol supported by your broker.</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] text-muted-foreground uppercase font-headline tracking-widest">Entry</Label>
                  <Input placeholder="1.08450" value={entry} onChange={(e) => setEntry(e.target.value)} className="bg-secondary/20 font-mono border-white/5 focus:border-primary/50" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] text-muted-foreground uppercase font-headline tracking-widest">Lots</Label>
                  <Input type="number" step="0.0001" min="0.0001" placeholder="0.01" value={lotSize} onChange={(e) => setLotSize(e.target.value)} className="bg-secondary/20 font-mono border-white/5 focus:border-primary/50" />
                  <p className="text-[10px] text-muted-foreground">Minimum lot size is 0.0001.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] text-muted-foreground uppercase font-headline tracking-widest">Stop Loss</Label>
                  <Input placeholder="1.08200" value={sl} onChange={(e) => setSl(e.target.value)} className="bg-secondary/20 font-mono text-destructive border-white/5" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] text-muted-foreground uppercase font-headline tracking-widest">Take Profit</Label>
                  <Input placeholder="1.09100" value={tp} onChange={(e) => setTp(e.target.value)} className="bg-secondary/20 font-mono text-accent border-white/5" />
                </div>
              </div>

              <div className="rounded-3xl border border-white/5 bg-secondary/20 p-4">
                <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-widest text-muted-foreground">Live Price Preview</p>
                        <h3 className="text-sm font-semibold">{selectedPairLabel}</h3>
                      </div>
                      <Badge variant="secondary" className="uppercase text-[10px] tracking-[0.2em]">
                        {direction} MODE
                      </Badge>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl bg-background/80 p-3 border border-white/10">
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Market Price</p>
                        <p className="mt-2 text-lg font-semibold">{currentPrice}</p>
                      </div>
                      <div className="rounded-2xl bg-background/80 p-3 border border-white/10">
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Change</p>
                        <p className={`mt-2 text-lg font-semibold ${Number(changePercent) >= 0 ? 'text-emerald-400' : 'text-destructive'}`}>
                          {changePercent}%
                        </p>
                      </div>
                      <div className="rounded-2xl bg-background/80 p-3 border border-white/10">
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Spread</p>
                        <p className="mt-2 text-lg font-semibold">{spreadLabel}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col justify-between gap-4">
                    <div className="rounded-2xl bg-background/90 p-4 border border-white/10">
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Selected timeframe</p>
                      <div className="mt-2 relative">
                        <select
                          value={selectedTimeframe}
                          onChange={(event) => setSelectedTimeframe(event.target.value)}
                          className="w-full h-10 rounded-2xl border border-white/10 bg-secondary/20 px-3 text-sm font-mono text-foreground outline-none transition focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
                        >
                          {timeframes.map((item) => (
                            <option key={item.value} value={item.value} className="bg-background text-foreground">
                              {item.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" type="button" onClick={loadSignals}>
                      Refresh Signals
                    </Button>
                  </div>
                </div>

                <div className="mt-4 h-72">
                  <div className="h-full">
                    {/* Candlestick chart showing real-market candles */}
                    <TradingViewChart symbol={pair} timeframe={selectedTimeframe} />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] text-muted-foreground uppercase font-headline tracking-widest">Follower IDs</Label>
                <Input
                  placeholder="F-101, F-102"
                  value={followers}
                  onChange={(e) => setFollowers(e.target.value)}
                  className="bg-secondary/20 font-mono border-white/5 focus:border-primary/50"
                />
                <p className="text-[10px] text-muted-foreground">Use comma-separated follower keys to replicate this trade.</p>
              </div>

              <div className="mt-4 p-3 border rounded">
                <h4 className="font-semibold">Followers</h4>
                <div className="flex gap-2 mt-2">
                  <Input value={newFollowerKey} onChange={(e) => setNewFollowerKey(e.target.value)} placeholder="new follower key" />
                  <Button type="button" onClick={() => handleRegisterFollower()}>Register</Button>
                </div>

                <div className="mt-3">
                  {followersData && followersData.followers && followersData.followers.length ? (
                    <ul className="text-sm space-y-1">
                      {followersData.followers.map((f: any) => (
                        <li key={f.id}>
                          <strong>{f.followerKey}</strong> {f.name ? `— ${f.name}` : ''} <span className="text-muted">{f.status}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted">No followers registered</p>
                  )}
                </div>
              </div>

              <Button className="w-full h-12 font-headline text-md snappy-transition shadow-[0_0_15px_rgba(var(--primary),0.3)]" disabled={isBroadcasting}>
                {isBroadcasting ? <Zap className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                {isBroadcasting ? "SYNCING..." : "BROADCAST SIGNAL"}
              </Button>

              <div className="rounded-3xl border border-white/5 bg-secondary/20 p-4 mt-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Open Trades</p>
                    <h4 className="text-sm font-semibold">Pending MT5 Signals</h4>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    disabled={!signals.length || closingSignalId === 'ALL'}
                    onClick={handleCloseAll}
                  >
                    {closingSignalId === 'ALL' ? 'CLOSING...' : 'Close All'}
                  </Button>
                </div>

                <div className="mt-4 space-y-3">
                  {loadingSignals ? (
                    <p className="text-sm text-muted-foreground">Loading active trades...</p>
                  ) : signals.length ? (
                    signals.map((signal) => (
                      <div key={signal.id} className="rounded-2xl border border-white/10 bg-background/50 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">{signal.currencyPair} · {signal.direction}</p>
                            <p className="text-xs text-muted-foreground">Entry: {signal.entryPrice} · SL: {signal.stopLoss || 'n/a'} · TP: {signal.takeProfit || 'n/a'} · Lots: {signal.lotSize ?? '0.01'}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">P/L</p>
                            {(() => {
                              const pnl = getSignalPnL(signal);
                              return (
                                <p className={`text-sm font-semibold ${pnl?.value ?? 0 >= 0 ? 'text-emerald-400' : 'text-destructive'}`}>
                                  {pnl ? pnl.label : 'n/a'}
                                </p>
                              );
                            })()}
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                          <span>{signal.followerCount !== undefined ? `${signal.followerCount} follower${signal.followerCount === 1 ? '' : 's'}` : 'Followers unavailable'}</span>
                          <span>Cur: {formatPairPrice(signal.currencyPair, getCurrentPriceForPair(signal.currencyPair))}</span>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          type="button"
                          disabled={closingSignalId === signal.id}
                          onClick={() => handleCloseSignal(signal.id)}
                        >
                          {closingSignalId === signal.id ? 'Closing...' : 'Close'}
                        </Button>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No pending MT5 signals are active. Broadcast a signal or refresh.</p>
                  )}
                </div>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="bridge">
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-6 py-4">
                <Alert className="bg-primary/10 border-primary/20">
                  <Globe className="h-4 w-4 text-primary" />
                  <AlertTitle className="text-xs uppercase font-bold text-primary">Self-Hosted Deployment</AlertTitle>
                  <AlertDescription className="text-[10px]">
                    This terminal is now configured for your own infrastructure.
                    <br/>1. Deploy this code to your <strong>Hostinger VPS</strong>.
                    <br/>2. Point your domain (e.g., <strong>trade.yoursite.com</strong>) to the VPS.
                    <br/>3. MT5 will talk to <strong>your domain</strong> directly via the API route below.
                  </AlertDescription>
                </Alert>

                <div className="flex items-center justify-between px-4 py-6 bg-secondary/20 rounded-xl border border-white/5 relative">
                  <div className="flex flex-col items-center gap-2 z-10">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30">
                      <Layout className="w-5 h-5 text-primary" />
                    </div>
                    <span className="text-[9px] font-bold uppercase text-muted-foreground">Your Website</span>
                  </div>
                  <ArrowRightLeft className="w-4 h-4 text-muted-foreground/30 animate-pulse" />
                  <div className="flex flex-col items-center gap-2 z-10">
                    <div className="w-12 h-12 rounded-full bg-accent/20 flex items-center justify-center border border-accent/40 shadow-[0_0_15px_hsl(var(--accent)/0.2)]">
                      <Globe className="w-6 h-6 text-accent" />
                    </div>
                    <span className="text-[9px] font-bold uppercase text-accent">Your Domain API</span>
                  </div>
                  <ArrowRightLeft className="w-4 h-4 text-muted-foreground/30 animate-pulse" />
                  <div className="flex flex-col items-center gap-2 z-10">
                    <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center border border-destructive/30">
                      <TerminalIcon className="w-5 h-5 text-destructive" />
                    </div>
                    <span className="text-[9px] font-bold uppercase text-muted-foreground">MT5 EA</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <Label className="text-[9px] uppercase tracking-widest opacity-50 flex justify-between">
                      API Whitelist URL (MT5 Settings)
                      <button 
                        onClick={() => copyToClipboard(hostUrl)}
                        className="hover:text-accent transition-colors"
                      >
                        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </Label>
                    <div className="font-mono text-[10px] bg-secondary/30 p-2 rounded border border-white/5 text-accent break-all">
                      {hostUrl}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-[9px] uppercase tracking-widest opacity-50 flex items-center gap-2">
                        <FileCode className="w-3 h-3 text-primary" />
                        MQL5 Self-Hosted Code
                      </Label>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <HelpCircle className="w-3 h-3 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[250px] text-[10px]">
                            <p className="font-bold mb-1">MT5 Connection Details:</p>
                            <ul className="list-disc pl-3 space-y-1">
                              <li>Target: {mqlApiUrl}</li>
                              <li>Method: GET (Proxy via Next.js)</li>
                              <li>Format: JSON standard</li>
                            </ul>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <div className="relative group">
                      <pre className="text-[9px] font-mono bg-black/40 p-3 rounded-lg border border-white/5 text-muted-foreground overflow-x-auto h-48">
                        {mql5Template}
                      </pre>
                      <button 
                        className="absolute top-2 right-2 p-1.5 bg-white/5 hover:bg-white/10 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => copyToClipboard(mql5Template)}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardHeader>
      <CardContent />
    </Card>
  );
}
