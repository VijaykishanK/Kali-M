from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from concurrent.futures import ThreadPoolExecutor, as_completed
import yfinance as yf
import pandas as pd
import numpy as np

app = FastAPI(title="Indian Stock Search API")

# Configure CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Top Indian stocks to scan automatically (NIFTY 50 key stocks)
SCAN_STOCKS = [
    ("RELIANCE", "Reliance Industries"),
    ("TCS", "Tata Consultancy Services"),
    ("HDFCBANK", "HDFC Bank"),
    ("ICICIBANK", "ICICI Bank"),
    ("INFY", "Infosys"),
    ("ITC", "ITC Limited"),
    ("SBIN", "State Bank of India"),
    ("BHARTIARTL", "Bharti Airtel"),
    ("BAJFINANCE", "Bajaj Finance"),
    ("KOTAKBANK", "Kotak Mahindra Bank"),
    ("LT", "Larsen & Toubro"),
    ("HINDUNILVR", "Hindustan Unilever"),
    ("AXISBANK", "Axis Bank"),
    ("MARUTI", "Maruti Suzuki"),
    ("SUNPHARMA", "Sun Pharma"),
    ("TATASTEEL", "Tata Steel"),
    ("TATAMOTORS", "Tata Motors"),
    ("NTPC", "NTPC"),
    ("WIPRO", "Wipro"),
    ("HCLTECH", "HCL Technologies"),
    ("TECHM", "Tech Mahindra"),
    ("HEROMOTOCO", "Hero MotoCorp"),
    ("DRREDDY", "Dr Reddy's Labs"),
    ("CIPLA", "Cipla"),
    ("COALINDIA", "Coal India"),
]

def format_ticker(symbol: str) -> str:
    """Format symbol for Indian stocks on Yahoo Finance"""
    symbol = symbol.upper().strip()
    if not symbol.endswith('.NS') and not symbol.endswith('.BO'):
        symbol += '.NS'
    return symbol

def calculate_prediction(hist: pd.DataFrame):
    """Calculate likelihood of stock going up based on RSI and SMA"""
    if len(hist) < 20:
        return {"likelihood": 50, "signal": "Neutral", "reasons": ["Insufficient data"]}
    
    # Calculate RSI
    delta = hist['Close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    
    # Avoid division by zero
    loss = loss.replace(0, 0.001)
    rs = gain / loss
    rsi_series = 100 - (100 / (1 + rs))
    rsi = float(rsi_series.iloc[-1])
    
    # Calculate SMA
    sma_20 = hist['Close'].rolling(window=20).mean()
    sma_20_val = float(sma_20.iloc[-1])
    current_price = float(hist['Close'].iloc[-1])
    
    score = 50.0
    reasons = []
    
    if rsi < 30:
        score += 25
        reasons.append("Oversold (RSI)")
    elif rsi > 70:
        score -= 25
        reasons.append("Overbought (RSI)")
    elif rsi > 50:
        score += 10
        reasons.append("Positive Momentum")
    else:
        score -= 10
        reasons.append("Negative Momentum")
        
    if current_price > sma_20_val:
        score += 15
        reasons.append("Above 20-day SMA")
    else:
        score -= 15
        reasons.append("Below 20-day SMA")
        
    score = max(5.0, min(95.0, score))
    signal = "Bullish" if score > 55 else "Bearish" if score < 45 else "Neutral"
    
    return {
        "likelihood": round(score, 2),
        "signal": signal,
        "rsi": round(rsi, 2),
        "reasons": reasons
    }

def _fetch_single_stock_scan(symbol: str, name: str):
    """Fetch and analyze a single stock for the market scanner (runs in thread)"""
    try:
        ticker_symbol = format_ticker(symbol)
        stock = yf.Ticker(ticker_symbol)
        hist = stock.history(period="60d")
        if hist.empty:
            return None

        info = stock.info
        current_price = float(hist['Close'].iloc[-1])
        prev_close = float(info.get('previousClose', current_price))
        change = current_price - prev_close
        percent_change = (change / prev_close) * 100 if prev_close else 0
        prediction = calculate_prediction(hist)

        return {
            "symbol": symbol,
            "name": info.get('longName', name),
            "price": round(current_price, 2),
            "change": round(change, 2),
            "percent_change": round(percent_change, 2),
            "prediction": prediction,
        }
    except Exception as e:
        print(f"Scanner error for {symbol}: {e}")
        return None

@app.get("/api/market/trends")
async def get_market_trends():
    """Scan all major Indian stocks and return predictions sorted by signal strength"""
    results = []
    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = {
            executor.submit(_fetch_single_stock_scan, sym, name): sym
            for sym, name in SCAN_STOCKS
        }
        for future in as_completed(futures):
            result = future.result()
            if result:
                results.append(result)
    
    # Sort: Bullish first (highest likelihood), then Bearish (lowest likelihood), Neutral in middle
    results.sort(key=lambda x: x['prediction']['likelihood'], reverse=True)
    return results

@app.get("/api/stock/{symbol}")
async def get_stock_data(symbol: str):
    """Get current price, fundamentals, and prediction for a stock"""
    try:
        ticker_symbol = format_ticker(symbol)
        stock = yf.Ticker(ticker_symbol)
        
        hist = stock.history(period="60d")
        if hist.empty:
            raise HTTPException(status_code=404, detail=f"Stock '{symbol.upper()}' not found")
        
        info = stock.info
        current_price = float(hist['Close'].iloc[-1])
        prev_close = float(info.get('previousClose', current_price))
        
        change = current_price - prev_close
        percent_change = (change / prev_close) * 100 if prev_close else 0

        prediction = calculate_prediction(hist)
        
        return {
            "symbol": symbol.upper(),
            "name": info.get('longName', info.get('shortName', symbol.upper())),
            "price": round(current_price, 2),
            "change": round(change, 2),
            "percent_change": round(percent_change, 2),
            "currency": info.get('currency', 'INR'),
            "prediction": prediction,
            "fundamentals": {
                "marketCap": info.get('marketCap'),
                "peRatio": info.get('trailingPE'),
                "week52High": info.get('fiftyTwoWeekHigh'),
                "week52Low": info.get('fiftyTwoWeekLow'),
                "dividendYield": float(info.get('dividendYield', 0)) * 100 if info.get('dividendYield') else 0,
                "volume": info.get('volume'),
                "sector": info.get('sector'),
                "industry": info.get('industry')
            }
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Error fetching stock data for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=f"Server Error: {str(e)}")

@app.get("/api/stock/{symbol}/history")
async def get_stock_history(symbol: str, range: str = "1mo"):
    """Get historical data for the chart"""
    try:
        ticker_symbol = format_ticker(symbol)
        stock = yf.Ticker(ticker_symbol)
        
        range_mapping = {
            "1d": {"period": "1d", "interval": "5m"},
            "1w": {"period": "5d", "interval": "15m"},
            "1mo": {"period": "1mo", "interval": "1d"},
            "3mo": {"period": "3mo", "interval": "1d"},
            "1y": {"period": "1y", "interval": "1d"},
            "5y": {"period": "5y", "interval": "1wk"}
        }
        
        params = range_mapping.get(range, range_mapping["1mo"])
        hist = stock.history(**params)
        
        if hist.empty:
            raise HTTPException(status_code=404, detail="No historical data found")
            
        chart_data = []
        for index, row in hist.iterrows():
            chart_data.append({
                "time": index.strftime("%Y-%m-%d %H:%M:%S") if params["interval"] in ["5m", "15m"] else index.strftime("%Y-%m-%d"),
                "value": round(float(row['Close']), 2)
            })
            
        return chart_data
    except Exception as e:
        print(f"Error fetching history for {symbol}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch historical data")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
