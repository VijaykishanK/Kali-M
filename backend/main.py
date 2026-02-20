from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
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

def format_ticker(symbol: str) -> str:
    """Format symbol for Indian stocks on Yahoo Finance"""
    symbol = symbol.upper().strip()
    if not symbol.endswith('.NS') and not symbol.endswith('.BO'):
        symbol += '.NS'
    return symbol

def calculate_prediction(hist: pd.DataFrame):
    """Calculate likelihood of stock going up based on RSI and SMA"""
    if len(hist) < 20:
        return {"likelihood": 50, "signal": "Neutral", "reason": "Insufficient data"}
    
    # Calculate RSI
    delta = hist['Close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / loss
    rsi = 100 - (100 / (1 + rs)).iloc[-1]
    
    # Calculate SMA
    sma_20 = hist['Close'].rolling(window=20).mean().iloc[-1]
    current_price = hist['Close'].iloc[-1]
    
    # Simple weighted logic
    score = 50
    reasons = []
    
    # RSI Logic
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
        
    # SMA Logic
    if current_price > sma_20:
        score += 15
        reasons.append("Above 20-day SMA")
    else:
        score -= 15
        reasons.append("Below 20-day SMA")
        
    # Clamp score
    score = max(5, min(95, score))
    
    signal = "Bullish" if score > 55 else "Bearish" if score < 45 else "Neutral"
    
    return {
        "likelihood": round(float(score), 2),
        "signal": signal,
        "rsi": round(float(rsi), 2),
        "reasons": reasons
    }

@app.get("/api/stock/{symbol}")
async def get_stock_data(symbol: str):
    """Get current price, fundamentals, and prediction for a stock"""
    try:
        ticker_symbol = format_ticker(symbol)
        stock = yf.Ticker(ticker_symbol)
        
        # Get history for prediction (need at least 30 days)
        hist = stock.history(period="60d")
        if hist.empty:
            raise HTTPException(status_code=404, detail=f"Stock '{symbol.upper()}' not found")
        
        info = stock.info
        current_price = float(hist['Close'].iloc[-1])
        prev_close = info.get('previousClose', current_price)
        
        change = float(current_price) - float(prev_close)
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
                "dividendYield": info.get('dividendYield', 0) * 100 if info.get('dividendYield') else 0,
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
        
        # Mapping frontend ranges to yfinance periods/intervals
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
            
        # Format data for frontend chart
        chart_data = []
        for index, row in hist.iterrows():
            chart_data.append({
                "time": index.strftime("%Y-%m-%d %H:%M:%S") if params["interval"] in ["5m", "15m"] else index.strftime("%Y-%m-%d"),
                "value": round(row['Close'], 2)
            })
            
        return chart_data
    except Exception as e:
        print(f"Error fetching history for {symbol}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch historical data")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
