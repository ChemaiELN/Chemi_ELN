import { configureStore } from '@reduxjs/toolkit'
import { useDispatch, useSelector } from 'react-redux'
import authReducer from './authSlice'
import privilegesReducer from './privilegesSlice'
import uiReducer from './uiSlice'

export const store = configureStore({
  reducer: {
    auth: authReducer,
    privileges: privilegesReducer,
    ui: uiReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

// Typed hooks — use these everywhere instead of plain useDispatch/useSelector
export const useAppDispatch = () => useDispatch<AppDispatch>()
export const useAppSelector = <T>(selector: (state: RootState) => T): T =>
  useSelector(selector)
