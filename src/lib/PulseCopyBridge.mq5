//+------------------------------------------------------------------+
//|                                              PulseCopyBridge.mq5 |
//|                             igrow Learning Society Self-Hosted    |
//+------------------------------------------------------------------+
#property copyright "igrow Learning Society"
#property link      "https://www.igrowlearningsociety.in"
#property version   "2.0"
#property strict

#include <Trade\Trade.mqh>

input string ApiUrl = "https://www.igrowlearningsociety.in/api/signals";
input string TradesApiUrl = "https://www.igrowlearningsociety.in/api/followers/trades";
input string FollowerKey = "";
input int    RequestTimeoutMs = 5000;
input int    PollIntervalSec = 5;
input double OrderVolume = 0.01;
input int    OrderDeviation = 20;
input bool   StrictTPValidation = false;  // Set to false for brokers with restricted pricing

string lastProcessedSignal = "";
CTrade trade;

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
         int parseStart = 0;
         bool processedAny = false;

         if(ParseFirstPendingSignal(response, parseStart, parseStart, signalId, currencyPair, direction, action, entryPrice, stopLoss, takeProfit))
         {
            if(StringLen(signalId) == 0)
            {
               Print("No valid signal id found in response.");
            }
            else if(StringCompare(signalId, lastProcessedSignal) != 0)
            {
               Print("Processing signal ", signalId, ": ", action, " ", direction, " ", currencyPair);
               bool success = false;
               if(StringCompare(action, "CLOSE") == 0)
               {
                  success = ExecuteCloseSignal(currencyPair);
               }
               else
               {
                  success = ExecuteSignal(currencyPair, direction, entryPrice, stopLoss, takeProfit);
               }

               if(success)
               {
                  lastProcessedSignal = signalId;
                  processedAny = true;
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

         if(!processedAny)
         {
            Print("No new pending signals were processed.");
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

bool ParseFirstPendingSignal(const string json, int searchFrom, int &nextSearchStart, string &signalId, string &currencyPair, string &direction, string &action, double &entryPrice, double &stopLoss, double &takeProfit)
{
   int signalsIndex = StringFind(json, "\"signals\"");
   if(signalsIndex < 0) return false;

   int arrayStart = StringFind(json, "[", signalsIndex);
   if(arrayStart < 0) return false;

   int objectStart = StringFind(json, "{", MaxInt(arrayStart, searchFrom));
   if(objectStart < 0) return false;

   int objectEnd = StringFind(json, "}", objectStart);
   if(objectEnd < 0 || objectEnd <= objectStart) return false;

   string document = StringSubstr(json, objectStart, objectEnd - objectStart + 1);
   nextSearchStart = objectEnd + 1;
   signalId = ExtractJsonField(document, "id");
   currencyPair = ExtractJsonField(document, "currencyPair");
   direction = ExtractJsonField(document, "direction");
   action = ExtractJsonField(document, "action");
   if(StringLen(action) == 0)
      action = "OPEN";
   entryPrice = StringToDouble(ExtractJsonField(document, "entryPrice"));
   stopLoss = StringToDouble(ExtractJsonField(document, "stopLoss"));
   takeProfit = StringToDouble(ExtractJsonField(document, "takeProfit"));

   return StringLen(signalId) > 0 && StringLen(currencyPair) > 0 && StringLen(direction) > 0;
}

int MaxInt(int a, int b)
{
   return a > b ? a : b;
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
      int end = StringFind(json, "\"", pos);
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

   while(start <= end && (StringGetCharacter(value, start) == 32 || StringGetCharacter(value, start) == 9 || StringGetCharacter(value, start) == 10 || StringGetCharacter(value, start) == 13))
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

   if(takeProfit > 0)
   {
      bool invalidSide = !IsTakeProfitValid(orderType, price, takeProfit);
      bool invalidDistance = minDistance > 0 && MathAbs(price - takeProfit) < minDistance;
      if(invalidSide || (StrictTPValidation && invalidDistance))
      {
         Print("Invalid take profit for ", orderType == ORDER_TYPE_BUY ? "BUY" : "SELL", " order; clearing TP. price=", DoubleToString(price, _Digits), " takeProfit=", DoubleToString(takeProfit, _Digits), " minDistance=", DoubleToString(minDistance, _Digits));
         takeProfit = 0;
      }
   }
}

bool ExecuteSignal(const string currencyPair, const string direction, double entryPrice, double stopLoss, double takeProfit)
{
   if(StringLen(currencyPair) == 0 || StringLen(direction) == 0)
      return false;

   double price = 0;
   ENUM_ORDER_TYPE orderType = ORDER_TYPE_BUY;
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
      // Prevent duplicate orders: if a position already exists for this symbol in the same direction, skip
      if(PositionSelect(currencyPair))
      {
         int existingType = (int)PositionGetInteger(POSITION_TYPE);
         if((existingType == POSITION_TYPE_BUY && orderType == ORDER_TYPE_BUY) || (existingType == POSITION_TYPE_SELL && orderType == ORDER_TYPE_SELL))
         {
            Print("Skipping signal: existing position for ", currencyPair, " in same direction");
            return false;
         }
      }

      SanitizeStops(currencyPair, orderType, price, stopLoss, takeProfit);

   MqlTradeRequest request;
   MqlTradeResult result;
   ZeroMemory(request);
   ZeroMemory(result);

   request.action = TRADE_ACTION_DEAL;
   request.symbol = currencyPair;
   request.volume = OrderVolume;
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

   // Report executed trade to server (best-effort). profitLoss unknown at open, send 0.
   if(StringLen(TrimString(FollowerKey)) > 0)
   {
      if(!ReportTrade(TrimString(FollowerKey), currencyPair, direction, OrderVolume, price, 0.0))
         Print("ReportTrade: failed to report open trade for ", currencyPair);
   }

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

   if(!trade.PositionClose(ticket))
   {
      Print("PositionClose failed for ", currencyPair, " ticket=", ticket);
      return false;
   }

   Print("Close order requested for position: ", currencyPair, " ticket=", ticket);

   // Report close to server (best-effort). price/profit unknown here; send current market quote and 0 profit.
   double closePrice = SymbolInfoDouble(currencyPair, SYMBOL_BID);
   if(StringLen(TrimString(FollowerKey)) > 0)
   {
      if(!ReportTrade(TrimString(FollowerKey), currencyPair, "CLOSE", OrderVolume, closePrice, 0.0))
         Print("ReportTrade: failed to report close for ", currencyPair);
   }

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

bool ReportTrade(const string followerKey, const string symbol, const string side, double volume, double price, double profitLoss)
{
   if(StringLen(followerKey) == 0 || StringLen(symbol) == 0)
      return false;

   string json = "{";
   json += "\"followerKey\":\"" + followerKey + "\",";
   json += "\"symbol\":\"" + symbol + "\",";
   json += "\"side\":\"" + side + "\",";
   json += "\"volume\":" + DoubleToString(volume, 2) + ",";
   json += "\"price\":" + DoubleToString(price, _Digits) + ",";
   json += "\"profitLoss\":" + DoubleToString(profitLoss, 2);
   json += "}";

   uchar requestData[];
   StringToCharArray(json, requestData);

   uchar result[];
   string resultHeaders;
   int status = WebRequest("POST", TradesApiUrl, "Content-Type: application/json\r\n", RequestTimeoutMs, requestData, result, resultHeaders);
   if(status != 200)
   {
      Print("ReportTrade failed, HTTP status=", status);
      return false;
   }

   string response = CharArrayToString(result);
   Print("ReportTrade response: ", response);
   return StringFind(response, "\"success\":true") >= 0;
}
