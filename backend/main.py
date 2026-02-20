from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import yfinance as yf
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
        
        # Use fast_info if available for speed and reliability, fallback to history
        current_price = None
        info = {}
        
        try:
            info = stock.info
            current_price = info.get('currentPrice', info.get('regularMarketPrice'))
        except Exception:
            pass

        if current_price is None:
            hist = stock.history(period="1d")
            if hist.empty:
                raise HTTPException(status_code=404, detail=f"Stock '{symbol.upper()}' not found")
            current_price = float(hist['Close'].iloc[-1])
            prev_close = info.get('previousClose', current_price)
        else:
            prev_close = info.get('previousClose', current_price or 0)
            
        change = float(current_price) - float(prev_close)
        percent_change = (change / prev_close) * 100 if prev_close else 0

        name = info.get('longName', info.get('shortName', symbol.upper()))
        
        # Prepare for return with safe rounding
        final_price: float = round(float(current_price), 2)
        final_change: float = round(float(change), 2)
        final_percent: float = round(float(percent_change), 2)

        return {
            "symbol": symbol.upper(),
            "name": name,
            "price": final_price,
            "change": final_change,
            "percent_change": final_percent,
            "currency": info.get('currency', 'INR')
        }
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Server Error for {symbol}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal Server Error: {str(e)}")

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
