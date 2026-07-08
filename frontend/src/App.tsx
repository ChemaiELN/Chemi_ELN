import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider } from 'antd'
import { AppRouter } from './router'
import AuthInitializer from './components/AuthInitializer'

const antdTheme = {
  token: {
    colorPrimary: '#c084fc',
    colorPrimaryHover: '#c084fc',
    colorLink: '#a855f7',
    colorLinkHover: '#9333ea',
    borderRadius: 6,
    borderRadiusLG: 8,
    borderRadiusSM: 4,
    controlHeight: 32,
    fontSize: 12,
    fontFamily: "'UniversLTPro-55Roman', 'Inter', sans-serif",
    colorBgContainer: 'rgba(255,255,255,0.65)',
    colorBgElevated: 'rgba(255,255,255,0.90)',
    colorBorder: 'rgba(216,180,254,0.55)',
    colorBorderSecondary: 'rgba(216,180,254,0.35)',
    boxShadow: '0 4px 24px rgba(216,180,254,0.12)',
  },
  components: {
    Menu: {
      itemBg: 'transparent',
      subMenuItemBg: 'transparent',
      itemColor: '#475569',
      itemSelectedBg: '#d8b4fe4d',
      itemSelectedColor: '#7e22ce',
      itemHoverBg: 'rgba(255,255,255,0.55)',
      itemHoverColor: '#9333ea',
      groupTitleColor: '#d8b4fe',
      groupTitleFontSize: 10,
      popupBg: 'rgba(255,255,255,0.95)',
    },
    Table: {
      headerBg: 'rgba(255,255,255,0.25)',
      headerColor: '#64748b',
      rowHoverBg: 'rgba(255,255,255,0.40)',
      borderColor: 'rgba(255,255,255,0.45)',
      colorBgContainer: 'rgba(255,255,255,0.10)',
    },
    Modal: {
      contentBg: 'rgba(255,255,255,0.85)',
      headerBg: 'rgba(255,255,255,0.85)',
    },
    Button: {
      primaryShadow: 'none',
    },
    Input: {
      colorBgContainer: 'rgba(255,255,255,0.65)',
    },
    Select: {
      colorBgContainer: 'rgba(255,255,255,0.65)',
    },
    InputNumber: {
      colorBgContainer: 'rgba(255,255,255,0.65)',
    },
    Switch: {
      colorPrimary: '#d8b4fe',
      colorPrimaryHover: '#c084fc',
    },
    Tabs: {
      colorBorderSecondary: 'rgba(255,255,255,0.45)',
    },
    Drawer: {
      colorBgElevated: 'rgba(255,255,255,0.15)',
    },
    Form: {
      itemMarginBottom: 12,
      verticalLabelPadding: '0 0 3px',
    },
  },
}

export default function App() {
  return (
    <ConfigProvider theme={antdTheme}>
      <BrowserRouter>
        <AuthInitializer>
          <AppRouter />
        </AuthInitializer>
      </BrowserRouter>
    </ConfigProvider>
  )
}
