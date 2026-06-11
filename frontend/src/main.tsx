import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'
import { ConfigProvider } from 'antd'
import { store } from './store/store'
import AppRouter from './router'
import './index.css'

const antdTheme = {
  token: {
    colorPrimary: '#0F766E',
    colorPrimaryHover: '#0d9488',
    borderRadius: 6,
    fontFamily: "'Inter', system-ui, sans-serif",
    colorBgContainer: '#ffffff',
    colorBorder: '#e7e5e4',
    colorText: '#1c1917',
    colorTextSecondary: '#78716c',
    controlHeight: 40,
  },
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <ConfigProvider theme={antdTheme}>
        <AppRouter />
      </ConfigProvider>
    </Provider>
  </React.StrictMode>,
)
