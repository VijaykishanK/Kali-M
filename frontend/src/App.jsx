import React, { useState } from 'react';
import { Search, TrendingUp, TrendingDown, LogOut } from 'lucide-react';
import axios from 'axios';
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
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  // Dashboard state
  const [searchQuery, setSearchQuery] = useState('');
  const [stockData, setStockData] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [timeRange, setTimeRange] = useState('1mo');

  const handleLogin = (e) => {
    e.preventDefault();
    if (password === 'Vijay123@@') {
      setIsAuthenticated(true);
      setError('');
    } else {
      setError('Invalid password');
    }
  };

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

  return (
    <div className="dashboard-container">
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
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search Indian stocks (e.g., RELIANCE, TCS)"
                  className="search-input"
                />
                <button type="submit" className="search-button">
                  Search
                </button>
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
          <div className="empty-state">
            <div className="empty-icon-wrapper">
              <Search size={48} />
            </div>
            <h3>Discover Market Opportunities</h3>
            <p>Search for any Indian stock to view real-time data and historical charts.</p>
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

            <div className="chart-card animate-fade-in delay-1">
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
