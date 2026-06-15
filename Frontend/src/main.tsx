import React from 'react'
import ReactDOM from 'react-dom/client'
import { Provider } from 'react-redux'
import { ConfigProvider } from 'antd'
import { store } from './store/store'
import App from './App'
import './index.css'
import './styles/typography.less'
import './styles/antd-global.less'

const antdTheme = {
  token: {
    colorPrimary: '#5aa3a1',
    colorPrimaryHover: '#4a9290',
    colorPrimaryActive: '#458988',
    borderRadius: 6,
    fontFamily: "'Inter', system-ui, sans-serif",
    colorBgContainer: '#ffffff',
    colorBorder: '#e7e5e4',
    colorText: '#1c1917',
    colorTextSecondary: '#78716c',
    controlHeight: 31,
    controlHeightSM: 31,
    controlHeightLG: 31,
    fontSize: 12,
  },
  components: {
    Button: {
      controlHeight: 31,
      controlHeightSM: 31,
      controlHeightLG: 31,
      contentFontSize: 12,
      contentFontSizeSM: 12,
      contentFontSizeLG: 12,
    },
    Input: {
      controlHeight: 31,
      controlHeightSM: 31,
      controlHeightLG: 31,
      inputFontSize: 12,
    },
    Select: {
      controlHeight: 31,
      controlHeightSM: 31,
      controlHeightLG: 31,
    },
    DatePicker: {
      controlHeight: 31,
      controlHeightSM: 31,
      controlHeightLG: 31,
    },
    InputNumber: {
      controlHeight: 31,
      controlHeightSM: 31,
      controlHeightLG: 31,
    },
  },
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <ConfigProvider theme={antdTheme}>
        <App />
      </ConfigProvider>
    </Provider>
  </React.StrictMode>,
)
