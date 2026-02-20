from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
app = FastAPI(title="Indian Stock Search API")

# Configure CORS for frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def format_ticker(symbol: str) -> str:
    """Format symbol for Indian stocks on Yahoo Finance"""
    # Simply append .NS if not there for Indian stocks
    symbol = symbol.upper().strip()
    if not symbol.endswith('.NS') and not symbol.endswith('.BO'):
        symbol += '.NS'
    return symbol

@app.get("/api/stock/{symbol}")
async def get_stock_data(symbol: str):
    """Get current price and basic info for a stock"""
    try:
        ticker_symbol = format_ticker(symbol)
        stock = yf.Ticker(ticker_symbol)
        info = stock.info
        
        # Check if we got valid data
        if 'regularMarketPrice' not in info and 'currentPrice' not in info:
            # Fallback to fetching history if info fails
            hist = stock.history(period="1d")
            if hist.empty:
                raise HTTPException(status_code=404, detail="Stock not found")
            current_price = hist['Close'].iloc[-1]
            prev_close = stock.info.get('previousClose', current_price)
        else:
            current_price = info.get('currentPrice', info.get('regularMarketPrice'))
            prev_close = info.get('previousClose', current_price)
            
        change = current_price - prev_close
        percent_change = (change / prev_close) * 100 if prev_close else 0

        name = info.get('longName', info.get('shortName', symbol.upper()))
        
        return {
            "symbol": symbol.upper(),
            "name": name,
            "price": round(current_price, 2),
            "change": round(change, 2),
            "percent_change": round(percent_change, 2),
            "currency": info.get('currency', 'INR')
        }
    except Exception as e:
        print(f"Error fetching stock data for {symbol}: {e}")
        raise HTTPException(status_code=404, detail=f"Stock '{symbol}' not found or data unavailable")

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
