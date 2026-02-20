import React, { useState, useEffect } from 'react';
import { Search, TrendingUp, TrendingDown, LogOut, Info, Gauge, Zap, BarChart3 } from 'lucide-react';
import axios from 'axios';
import { popularIndianStocks } from './indianStocks';
import {

  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

const API_URL = import.meta.env.PROD
  ? '/api/stock'
  : 'http://127.0.0.1:8000/api/stock';

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Dashboard state
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [stockData, setStockData] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [timeRange, setTimeRange] = useState('1mo');
  const [marketTrends, setMarketTrends] = useState([]);
  const [trendsLoading, setTrendsLoading] = useState(false);

  const handleLogin = (e) => {
    e.preventDefault();
    if (username === 'Vijavk24' && password === 'Vijavk24@#&') {
      setIsAuthenticated(true);
      setError('');
    } else {
      setError('Invalid username or password');
    }
  };

  const fetchMarketTrends = async () => {
    setTrendsLoading(true);
    try {
      const res = await axios.get(`${API_URL.replace('/api/stock', '/api/market/trends')}`);
      setMarketTrends(res.data);
    } catch (err) {
      console.error("Failed to fetch trends", err);
    } finally {
      setTrendsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchMarketTrends();
    }
  }, [isAuthenticated]);

  const fetchStockData = async (symbol, range = timeRange) => {
    if (!symbol.trim()) return;

    setLoading(true);
    setSearchError('');

    try {
      const [stockRes, historyRes] = await Promise.all([
        axios.get(`${API_URL}/${symbol}`),
        axios.get(`${API_URL}/${symbol}/history?range=${range}`)
      ]);

      setStockData(stockRes.data);
      setChartData(historyRes.data);
    } catch (err) {
      setSearchError(err.response?.data?.detail || 'Failed to fetch stock data');
      setStockData(null);
      setChartData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchStockData(searchQuery, timeRange);
  };

  const handleRangeChange = (range) => {
    setTimeRange(range);
    if (stockData) {
      fetchStockData(stockData.symbol, range);
    }
  };

  const formatCurrency = (value, currency = 'INR') => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency
    }).format(value);
  };

  const formatLargeNumber = (num) => {
    if (!num) return 'N/A';
    if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
    if (num >= 1e7) return (num / 1e7).toFixed(2) + ' Cr';
    if (num >= 1e5) return (num / 1e5).toFixed(2) + ' L';
    return num.toLocaleString('en-IN');
  };

  const getLikelihoodColor = (likelihood) => {
    if (likelihood >= 70) return '#10b981';
    if (likelihood >= 55) return '#34d399';
    if (likelihood > 45) return '#9ca3af';
    if (likelihood > 30) return '#f87171';
    return '#ef4444';
  };

  if (!isAuthenticated) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <TrendingUp size={40} className="logo-icon" />
            <h1>Indian Stock Explorer</h1>
            <p>Enter password to access the platform</p>
          </div>
          <form onSubmit={handleLogin} className="login-form">
            <div className="input-group">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                className={error ? 'input-error' : ''}
              />
            </div>
            <div className="input-group">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className={error ? 'input-error' : ''}
              />
              {error && <span className="error-text">{error}</span>}
            </div>
            <button type="submit" className="login-button">
              Access Platform
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Filter suggestions based on query
  const filteredStocks = searchQuery.trim() === ''
    ? popularIndianStocks.slice(0, 10)
    : popularIndianStocks.filter(stock =>
      stock.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      stock.name.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 10);

  const handleSuggestionClick = (symbol) => {
    setSearchQuery(symbol);
    setShowSuggestions(false);
    fetchStockData(symbol, timeRange);
  };

  return (
    <div className="dashboard-container" onClick={() => setShowSuggestions(false)}>
      <header className="dashboard-header">
        <div className="header-content">
          <div className="logo">
            <TrendingUp size={28} className="logo-icon" />
            <h2>Stock Explorer</h2>
          </div>
          <div className="search-container">
            <form onSubmit={handleSearch}>
              <div className="search-input-wrapper">
                <Search size={20} className="search-icon" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Search Indian stocks (e.g., RELIANCE, TCS)"
                  className="search-input"
                  autoComplete="off"
                />
                <button type="submit" className="search-button">
                  Search
                </button>

                {showSuggestions && (
                  <div className="suggestions-dropdown" onClick={(e) => e.stopPropagation()}>
                    {filteredStocks.length > 0 ? (
                      filteredStocks.map((stock) => (
                        <div
                          key={stock.symbol}
                          className="suggestion-item"
                          onClick={() => handleSuggestionClick(stock.symbol)}
                        >
                          <span className="suggestion-symbol">{stock.symbol}</span>
                          <span className="suggestion-name">{stock.name}</span>
                        </div>
                      ))
                    ) : (
                      <div className="suggestion-empty">No stocks found</div>
                    )}
                  </div>
                )}
              </div>
            </form>
          </div>
          <button
            className="logout-button"
            onClick={() => setIsAuthenticated(false)}
          >
            <LogOut size={18} />
            <span>Exit</span>
          </button>
        </div>
      </header>

      <main className="dashboard-main">
        {loading && (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Analyzing market data...</p>
          </div>
        )}

        {searchError && !loading && (
          <div className="error-state">
            <p>{searchError}</p>
          </div>
        )}

        {!loading && !stockData && !searchError && (
          <div className="market-scanner animate-fade-in">
            <div className="scanner-header">
              <div className="header-title">
                <Gauge size={24} className="primary-icon" />
                <div>
                  <h3>Daily Market Analysis</h3>
                  <p>AI-powered predictions for the top 25 Indian stocks</p>
                </div>
              </div>
              <button
                className="refresh-button"
                onClick={fetchMarketTrends}
                disabled={trendsLoading}
              >
                <Zap size={16} />
                <span>{trendsLoading ? 'Scanning...' : 'Refresh Analysis'}</span>
              </button>
            </div>

            <div className="trends-grid">
              {marketTrends.map((stock) => (
                <div
                  key={stock.symbol}
                  className="trend-card"
                  onClick={() => handleSuggestionClick(stock.symbol)}
                >
                  <div className="trend-main">
                    <div>
                      <span className="trend-symbol">{stock.symbol}</span>
                      <h4 className="trend-name">{stock.name}</h4>
                    </div>
                    <div className="trend-price-info">
                      <span className="trend-price">{formatCurrency(stock.price)}</span>
                      <span className={`trend-change ${stock.change >= 0 ? 'positive' : 'negative'}`}>
                        {stock.change >= 0 ? '+' : ''}{stock.percent_change}%
                      </span>
                    </div>
                  </div>

                  <div className="trend-prediction">
                    <div className="prediction-metrics">
                      <span className="likelihood-val" style={{ color: getLikelihoodColor(stock.prediction.likelihood) }}>
                        {stock.prediction.likelihood}%
                      </span>
                      <div className={`mini-badge ${stock.prediction.signal.toLowerCase()}`}>
                        {stock.prediction.signal}
                      </div>
                    </div>
                    <div className="trend-reasons">
                      {stock.prediction.reasons.slice(0, 2).map((reason, i) => (
                        <span key={i} className="tiny-tag">{reason}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && stockData && (
          <div className="content-grid">
            <div className="price-card animate-fade-in">
              <div className="stock-header">
                <div>
                  <h1 className="stock-symbol">{stockData.symbol}</h1>
                  <h2 className="stock-name">{stockData.name}</h2>
                </div>
              </div>

              <div className="price-display">
                <div className="current-price">
                  {formatCurrency(stockData.price, stockData.currency)}
                </div>
                <div className={`price-change ${stockData.change >= 0 ? 'positive' : 'negative'}`}>
                  {stockData.change >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
                  <span>{formatCurrency(Math.abs(stockData.change), stockData.currency)}</span>
                  <span className="percent-change">({stockData.percent_change}%)</span>
                </div>
              </div>
            </div>

            <div className="prediction-card animate-fade-in delay-1">
              <div className="card-header">
                <Gauge size={20} />
                <h3>Movement AI Prediction</h3>
              </div>
              <div className="prediction-content">
                <div className="likelihood-score" style={{ color: getLikelihoodColor(stockData.prediction.likelihood) }}>
                  <span className="score-value">{stockData.prediction.likelihood}%</span>
                  <span className="score-label">Likelihood</span>
                </div>
                <div className={`signal-badge ${stockData.prediction.signal.toLowerCase()}`}>
                  {stockData.prediction.signal}
                </div>
                <div className="prediction-reasons">
                  {stockData.prediction.reasons.map((reason, i) => (
                    <div key={i} className="reason-tag">
                      <Zap size={12} />
                      <span>{reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="fundamentals-card animate-fade-in delay-2">
              <div className="card-header">
                <Info size={20} />
                <h3>Market Fundamentals</h3>
              </div>
              <div className="fundamentals-grid">
                <div className="f-item">
                  <span className="f-label">Market Cap</span>
                  <span className="f-value">{formatLargeNumber(stockData.fundamentals.marketCap)}</span>
                </div>
                <div className="f-item">
                  <span className="f-label">P/E Ratio</span>
                  <span className="f-value">{stockData.fundamentals.peRatio?.toFixed(2) || 'N/A'}</span>
                </div>
                <div className="f-item">
                  <span className="f-label">52W High</span>
                  <span className="f-value">{formatCurrency(stockData.fundamentals.week52High, stockData.currency)}</span>
                </div>
                <div className="f-item">
                  <span className="f-label">52W Low</span>
                  <span className="f-value">{formatCurrency(stockData.fundamentals.week52Low, stockData.currency)}</span>
                </div>
                <div className="f-item">
                  <span className="f-label">Div. Yield</span>
                  <span className="f-value">{stockData.fundamentals.dividendYield?.toFixed(2)}%</span>
                </div>
                <div className="f-item">
                  <span className="f-label">Volume</span>
                  <span className="f-value">{formatLargeNumber(stockData.fundamentals.volume)}</span>
                </div>
              </div>
              {stockData.fundamentals.sector && (
                <div className="sector-info">
                  <BarChart3 size={14} />
                  <span>{stockData.fundamentals.sector} • {stockData.fundamentals.industry}</span>
                </div>
              )}
            </div>

            <div className="chart-card animate-fade-in delay-3">
              <div className="chart-header">
                <h3>Price History</h3>
                <div className="time-ranges">
                  {['1d', '1w', '1mo', '3mo', '1y', '5y'].map((range) => (
                    <button
                      key={range}
                      className={`range-button ${timeRange === range ? 'active' : ''}`}
                      onClick={() => handleRangeChange(range)}
                    >
                      {range.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={stockData.change >= 0 ? "#10b981" : "#ef4444"} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={stockData.change >= 0 ? "#10b981" : "#ef4444"} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis
                      dataKey="time"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#9ca3af', fontSize: 12 }}
                      tickFormatter={(value) => {
                        if (timeRange === '1d' || timeRange === '1w') {
                          return value.split(' ')[1].substring(0, 5);
                        }
                        const date = new Date(value);
                        return `${date.getDate()} ${date.toLocaleString('default', { month: 'short' })}`;
                      }}
                      minTickGap={30}
                    />
                    <YAxis
                      domain={['auto', 'auto']}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#9ca3af', fontSize: 12 }}
                      tickFormatter={(value) => value.toLocaleString('en-IN')}
                      width={60}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                      }}
                      formatter={(value) => [formatCurrency(value, stockData.currency), 'Price']}
                      labelFormatter={(label) => label}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke={stockData.change >= 0 ? "#10b981" : "#ef4444"}
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorValue)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
